import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db
from .models import User
from sqlalchemy.future import select
from datetime import datetime, timezone

# Import Redis client
from .redis_client import redis_client

ALGORITHM = os.getenv("ALGORITHM", "HS256")
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "CHANGE_THIS_IN_PRODUCTION":
    # In a real rigorous production setup we might raise an error. 
    # For now, let's warn but allow if development, but since user asked for prod prep:
    if os.getenv("ENVIRONMENT") == "production":
        raise ValueError("SECRET_KEY must be set in production environment")
    SECRET_KEY = SECRET_KEY or "dev_secret_key"
    
print(f"DEBUG: SECRET_KEY loaded: {SECRET_KEY[:4]}... (keep secret)")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check Redis cache for user presence/data (Optional optimization: cache user object)
    # For now, we just use Redis to TRACK presence
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 1. Fetch user (DB cache is tricky with asyncpg+sqlalchemy object detachment, so we keep DB fetch for safety)
    # But we CAN cache simple ID mapping if needed. For now, DB fetch is fast enough for <1k users.
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception

    # 2. Update Redis Presence
    # Key: user:last_seen:{user_id} -> timestamp ISO string
    # Key: user:online:{user_id} -> "1" (expires in 5 mins)
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        pipe = redis_client.pipeline()
        pipe.set(f"user:last_seen:{user.id}", now_iso)
        pipe.set(f"user:online:{user.id}", "1", ex=45) # 45 seconds online window
        await pipe.execute()
    except Exception as e:
        print(f"Redis error in deps: {e}")
        # Don't fail request if Redis is down
        pass

    return user
