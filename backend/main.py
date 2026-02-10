from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, users, chats

from contextlib import asynccontextmanager
from .database import engine, Base
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate: add new columns to existing tables if they don't exist
        try:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE"
            ))
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT"
            ))
        except Exception as e:
            print(f"Migration note: {e}")
    yield

app = FastAPI(title="Secure Drop Messenger", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOW_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost,http://localhost:80").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(chats.router, prefix="/chats", tags=["chats"])
# Messages are handled under chats usually, but we can have direct access if needed
# app.include_router(messages.router, prefix="/messages", tags=["messages"])

@app.get("/")
async def root():
    return {"message": "Secure Drop Messenger API"}
