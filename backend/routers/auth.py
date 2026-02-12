from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models import User
from ..schemas import UserCreate, Token
from jose import jwt
from datetime import datetime, timedelta, timezone
import pyotp
import qrcode
import io
import base64
from ..deps import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from pydantic import BaseModel

router = APIRouter()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Phase 1: Generate TOTP secret and QR — user NOT created yet
class UserRegisterStart(BaseModel):
    username: str

@router.get("/check")
async def check_username(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    if result.scalars().first():
        return {"available": False}
    return {"available": True}

@router.post("/register")
async def register(user: UserRegisterStart, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Имя пользователя уже занято")

    secret = pyotp.random_base32()
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.username, issuer_name="SecureDrop")

    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    return {
        "username": user.username,
        "qr_code": f"data:image/png;base64,{img_base64}",
        "secret": secret
    }


# Phase 2: Verify TOTP code and create user
class ConfirmRegistration(BaseModel):
    username: str
    public_key: str
    encrypted_private_key: str
    key_salt: str
    totp_secret: str
    totp_code: str

@router.post("/confirm-registration")
async def confirm_registration(req: ConfirmRegistration, db: AsyncSession = Depends(get_db)):
    # Verify TOTP code with the secret
    totp = pyotp.TOTP(req.totp_secret)
    if not totp.verify(req.totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Неверный код. Попробуйте ещё раз")

    # Check uniqueness again (race condition guard)
    result = await db.execute(select(User).filter(User.username == req.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Имя уже занято")

    new_user = User(
        username=req.username,
        totp_secret=req.totp_secret,
        public_key=req.public_key,
        encrypted_private_key=req.encrypted_private_key,
        key_salt=req.key_salt,
        is_verified=True  # Verified because TOTP was confirmed
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Issue token immediately
    access_token = create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}


class LoginRequest(BaseModel):
    username: str
    totp_code: str

@router.post("/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == request.username))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=400, detail="Неверное имя пользователя или код")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(request.totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Неверный код")

    if not user.is_verified:
        user.is_verified = True
        await db.commit()

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}
