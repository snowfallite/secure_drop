from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models import User
from ..schemas import UserResponse, UserUpdate
from ..deps import get_current_user
from typing import List

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_me(
    update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if update.username is not None:
        clean = update.username.strip()
        if len(clean) < 2:
            raise HTTPException(status_code=400, detail="Имя должно быть минимум 2 символа")
        if clean != current_user.username:
            existing = await db.execute(select(User).filter(User.username == clean))
            if existing.scalars().first():
                raise HTTPException(status_code=400, detail="Это имя уже занято")
            current_user.username = clean

    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.get("", response_model=List[UserResponse])
async def search_users(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(User).filter(
            User.username.contains(username),
            User.is_verified == True,
            User.id != current_user.id
        )
    )
    return result.scalars().all()
