from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .models import MessageType

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    public_key: str

class UserResponse(UserBase):
    id: str
    public_key: Optional[str] = None
    is_verified: bool = False
    avatar_url: Optional[str] = None
    created_at: datetime
    
    # New fields for presence
    is_online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None

class ChatBase(BaseModel):
    pass

class ChatCreate(BaseModel):
    participant_username: str

class LastMessage(BaseModel):
    id: str
    content: str
    type: str
    sender_id: str
    created_at: datetime

class ChatResponse(BaseModel):
    id: str
    participants: List[UserResponse]
    created_at: datetime
    last_message: Optional[LastMessage] = None

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    content: str
    type: MessageType
    reply_to_id: Optional[str] = None

class MessageCreate(MessageBase):
    pass

class MessageReply(BaseModel):
    id: str
    content: str
    sender_id: str
    type: MessageType

class MessageResponse(MessageBase):
    id: str
    chat_id: str
    sender_id: str
    created_at: datetime
    read_at: Optional[datetime] = None
    reply_to: Optional[MessageReply] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
