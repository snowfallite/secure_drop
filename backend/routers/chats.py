from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..models import Chat, ChatParticipant, User, Message, MessageType
from ..schemas import ChatCreate, ChatResponse, MessageCreate, MessageResponse, UserResponse
from ..deps import get_current_user
from typing import List
from sqlalchemy import delete as sa_delete
from datetime import datetime, timezone

# Import Redis
from ..redis_client import redis_client

router = APIRouter()

@router.post("", response_model=ChatResponse)
async def create_chat(
    chat_data: ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(User).filter(User.username == chat_data.participant_username))
    other_user = result.scalars().first()
    if not other_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if not other_user.is_verified:
        raise HTTPException(status_code=400, detail="Пользователь ещё не подтвердил аккаунт")

    if other_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя создать чат с самим собой")

    # Check if chat already exists
    my_chats = await db.execute(
        select(Chat)
        .join(ChatParticipant, Chat.id == ChatParticipant.chat_id)
        .where(ChatParticipant.user_id == current_user.id)
        .options(selectinload(Chat.participants))
    )
    for existing_chat in my_chats.scalars().all():
        pids = {p.user_id for p in existing_chat.participants}
        if other_user.id in pids and len(pids) == 2:
            result = await db.execute(
                select(Chat).where(Chat.id == existing_chat.id)
                .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
            )
            c = result.scalars().first()
            # We don't enrich with Redis here for simplicity, or we can copy valid response logic
            return ChatResponse(id=c.id, created_at=c.created_at, participants=[p.user for p in c.participants])

    # Create new
    chat = Chat()
    db.add(chat)
    await db.commit()
    await db.refresh(chat)

    db.add(ChatParticipant(chat_id=chat.id, user_id=current_user.id))
    db.add(ChatParticipant(chat_id=chat.id, user_id=other_user.id))
    await db.commit()

    result = await db.execute(
        select(Chat).where(Chat.id == chat.id)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
    )
    chat = result.scalars().first()
    return ChatResponse(id=chat.id, created_at=chat.created_at, participants=[p.user for p in chat.participants])


@router.get("", response_model=List[ChatResponse])
async def get_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch chats from DB
    result = await db.execute(
        select(Chat)
        .join(ChatParticipant)
        .where(ChatParticipant.user_id == current_user.id)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.user)
            # REMOVED: selectinload(Chat.messages) - this was the bottleneck
        )
    )
    chats = result.scalars().unique().all()
    
    if not chats:
        return []

    chat_ids = [c.id for c in chats]

    # 3. Fetch Last Message for each chat efficiently
    # Use a robust subquery approach compatible with most SQL dialects, though we are on Postgres.
    # We find the latest created_at for each chat, then join to get the message details.
    
    from sqlalchemy import func, tuple_

    # Subquery to find the max created_at for each chat
    latest_times_subquery = (
        select(Message.chat_id, func.max(Message.created_at).label("max_created_at"))
        .where(Message.chat_id.in_(chat_ids))
        .group_by(Message.chat_id)
        .subquery()
    )

    # Main query to fetch full message details
    # We join on chat_id and created_at. 
    # Note: If two messages have the exact same timestamp in the same chat, this might return duplicates.
    # Given the precision of timestamps, this is rare, but we can handle it by taking the first one in python or using DISTINCT.
    try:
        stmt = (
            select(Message)
            .join(
                latest_times_subquery,
                (Message.chat_id == latest_times_subquery.c.chat_id) & 
                (Message.created_at == latest_times_subquery.c.max_created_at)
            )
        )
        
        last_msgs_result = await db.execute(stmt)
        last_msgs = last_msgs_result.scalars().all()
        
        # Deduplicate in Python just in case multiple messages have exact same timestamp
        last_msg_map = {}
        for m in last_msgs:
            # If we already have a message for this chat, only overwrite if this one somehow has a greater ID (arbitrary tie-break)
            if m.chat_id not in last_msg_map or m.id > last_msg_map[m.chat_id].id:
                last_msg_map[m.chat_id] = m
                
    except Exception as e:
        print(f"Error fetching last messages: {e}")
        last_msg_map = {}

    # 3. Collect all participant IDs for Redis
    all_users = []
    for chat in chats:
        for p in chat.participants:
            all_users.append(p.user)
    
    unique_users = {u.id: u for u in all_users}
    user_ids = list(unique_users.keys())

    # 4. Batch fetch Redis Status
    presence_map = {}
    last_seen_map = {}
    
    if user_ids and redis_client:
        try:
            pipe = redis_client.pipeline()
            for uid in user_ids:
                pipe.get(f"user:online:{uid}")
                pipe.get(f"user:last_seen:{uid}")
            results = await pipe.execute()
            
            for i, uid in enumerate(user_ids):
                is_online = results[i*2]
                last_seen_str = results[i*2 + 1]
                
                presence_map[uid] = True if is_online else False
                if last_seen_str:
                    try:
                        last_seen_map[uid] = datetime.fromisoformat(last_seen_str)
                    except:
                        last_seen_map[uid] = None
                else:
                    last_seen_map[uid] = None
        except Exception as e:
            print(f"Redis fetch error: {e}")

    # 5. Construct Response
    response = []
    for chat in chats:
        participants_resp = []
        for p in chat.participants:
            u_obj = p.user
            u_resp = UserResponse.model_validate(u_obj)
            u_resp.is_online = presence_map.get(u_obj.id, False)
            u_resp.last_seen = last_seen_map.get(u_obj.id, None)
            participants_resp.append(u_resp)

        last_msg = last_msg_map.get(chat.id)
            
        response.append({
            "id": chat.id,
            "created_at": chat.created_at,
            "participants": participants_resp,
            "last_message": {
                "id": last_msg.id,
                "content": last_msg.content if last_msg.type != MessageType.IMAGE else "📷 Фото",
                "type": last_msg.type.value,
                "sender_id": last_msg.sender_id,
                "created_at": last_msg.created_at
            } if last_msg else None
        })

    # Sort by last message time, newest first
    response.sort(key=lambda c: c["last_message"]["created_at"] if c["last_message"] else c["created_at"], reverse=True)
    return response


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify participation
    result = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="Вы не участник этого чата")

    # Delete messages, participants, then chat
    await db.execute(sa_delete(Message).where(Message.chat_id == chat_id))
    await db.execute(sa_delete(ChatParticipant).where(ChatParticipant.chat_id == chat_id))
    await db.execute(sa_delete(Chat).where(Chat.id == chat_id))
    await db.commit()

    return {"ok": True}


@router.post("/{chat_id}/messages", response_model=MessageResponse)
async def send_message(
    chat_id: str,
    message: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="Вы не участник этого чата")

    # Verify reply_to_id if present
    if message.reply_to_id:
        reply_msg_res = await db.execute(select(Message).where(Message.id == message.reply_to_id, Message.chat_id == chat_id))
        if not reply_msg_res.scalars().first():
            raise HTTPException(status_code=400, detail="Сообщение для ответа не найдено")

    new_message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=message.content,
        type=message.type,
        reply_to_id=message.reply_to_id
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    
    # Reload with reply_to relationship
    result = await db.execute(
        select(Message).where(Message.id == new_message.id).options(selectinload(Message.reply_to))
    )
    return result.scalars().first()


@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="Вы не участник этого чата")

    # Mark unread messages from other user as read
    # We can do this in bg or directly. Directly is simpler.
    stmt = (
        select(Message)
        .where(
            Message.chat_id == chat_id,
            Message.sender_id != current_user.id,
            Message.read_at.is_(None)
        )
    )
    unread_msgs = (await db.execute(stmt)).scalars().all()
    
    if unread_msgs:
        now = datetime.now(timezone.utc)
        for msg in unread_msgs:
            msg.read_at = now
        await db.commit()

    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
        .options(selectinload(Message.reply_to))
    )
    return result.scalars().all()


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify participation
    result = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="Вы не участник этого чата")

    # Fetch message
    msg_res = await db.execute(select(Message).where(Message.id == message_id, Message.chat_id == chat_id))
    message = msg_res.scalars().first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Можно удалять только свои сообщения")

    await db.delete(message)
    await db.commit()

    return {"ok": True}
