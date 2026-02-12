from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
import uuid
from datetime import datetime
from sqlalchemy.sql import func
from .database import Base

class MessageType(enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    EMOJI = "EMOJI"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    totp_secret = Column(String, nullable=True)
    public_key = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(Text, nullable=True)
    
    # E2EE Sync fields
    encrypted_private_key = Column(Text, nullable=True)
    key_salt = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())

    chats = relationship("ChatParticipant", back_populates="user")
    sent_messages = relationship("Message", back_populates="sender")

class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime(timezone=True), default=func.now())

    participants = relationship("ChatParticipant", back_populates="chat")
    messages = relationship("Message", back_populates="chat")
    created_by = Column(String, ForeignKey("users.id"), nullable=True) # Creator of the chat

class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    chat_id = Column(String, ForeignKey("chats.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)

    chat = relationship("Chat", back_populates="participants")
    user = relationship("User", back_populates="chats")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chats.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False) # Encrypted content
    type = Column(Enum(MessageType), default=MessageType.TEXT)
    created_at = Column(DateTime(timezone=True), default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True) # Read receipt
    reply_to_id = Column(String, ForeignKey("messages.id"), nullable=True)

    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    reply_to = relationship("Message", remote_side=[id], backref="replies")
