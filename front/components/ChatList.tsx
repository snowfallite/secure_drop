import React, { useState } from 'react';
import { MessageSquarePlus, Search, Users, Trash2 } from 'lucide-react';
import { ChatSession, User } from '../types';
import { Avatar } from './LiquidUI';
import { ApiService } from '../services/api';
import { CryptoService } from '../services/crypto';

interface ChatListProps {
  chats: ChatSession[];
  currentUser: User;
  onSelectChat: (chat: ChatSession) => void;
  onNewChat: (username: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRefresh: () => void;
}

// Proper Russian relative time
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const dayDiff = Math.floor(diff / (1000 * 3600 * 24));

  if (dayDiff === 0 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (dayDiff === 0 || (dayDiff === 1 && now.getDate() !== date.getDate())) {
    return 'Вчера';
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Truncate message preview
function truncateMsg(text: string, max: number = 40): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export const ChatList: React.FC<ChatListProps> = ({ chats, currentUser, onSelectChat, onNewChat, onDeleteChat, onRefresh }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Decryption for previews
  const [decryptedPreviews, setDecryptedPreviews] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const decryptPreviews = async () => {
      const newPreviews: Record<string, string> = {};
      const privateKeyStr = localStorage.getItem('private_key');
      if (!privateKeyStr) return;

      try {
        const myPriv = await CryptoService.importPrivateKey(privateKeyStr);

        for (const chat of chats) {
          const lastMsg = chat.last_message;
          if (!lastMsg || !lastMsg.content.includes(':')) continue;
          if (decryptedPreviews[lastMsg.id]) continue;

          const otherUser = chat.participants?.find(p => p.id !== currentUser.id) || chat.participants?.[0];
          if (!otherUser?.public_key) continue;

          try {
            // Expensive deriving?
            const otherPub = await CryptoService.importPublicKey(otherUser.public_key);
            const sessionKey = await CryptoService.deriveSharedKey(myPriv, otherPub);

            const parts = lastMsg.content.split(':');
            if (parts.length === 2) {
              const plain = await CryptoService.decrypt(parts[1], parts[0], sessionKey);
              newPreviews[lastMsg.id] = plain;
            }
          } catch (e) { }
        }
        if (Object.keys(newPreviews).length > 0) {
          setDecryptedPreviews(prev => ({ ...prev, ...newPreviews }));
        }
      } catch (e) { }
    };
    decryptPreviews();
  }, [chats]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newUsername.trim()) return;
    if (newUsername.trim() === currentUser.username) {
      setCreateError('Нельзя начать чат с самим собой');
      return;
    }
    try {
      await onNewChat(newUsername.trim());
      setNewUsername('');
      setIsCreating(false);
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Ошибка создания чата');
    }
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm('Удалить чат и все сообщения?')) return;
    setDeletingId(chatId);
    try {
      await ApiService.chats.delete(chatId);
      onDeleteChat(chatId);
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Сообщения</h2>
        <button
          onClick={() => { setIsCreating(!isCreating); setCreateError(''); }}
          style={{ padding: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer' }}
        >
          <MessageSquarePlus style={{ width: 20, height: 20, color: '#0A3A6B' }} />
        </button>
      </div>

      {/* New Chat Form */}
      {isCreating && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />
              <input
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px 12px 36px', color: 'white', fontSize: 14, outline: 'none' }}
                placeholder="Имя пользователя..."
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoFocus
              />
            </div>
            {createError && <p style={{ color: '#D44A4A', fontSize: 12, textAlign: 'center' }}>{createError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setIsCreating(false)} style={{ padding: '8px 16px', fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Отмена
              </button>
              <button type="submit" disabled={!newUsername.trim()} style={{ padding: '8px 16px', fontSize: 12, background: !newUsername.trim() ? 'rgba(10,58,107,0.3)' : 'rgba(10,58,107,0.8)', color: 'white', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                Начать чат
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chat List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 32 }}>
        {chats.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.3)' }}>
            <Users style={{ width: 56, height: 56, margin: '0 auto 16px', opacity: 0.2 }} />
            <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Пока нет чатов</p>
            <p style={{ fontSize: 14, opacity: 0.6 }}>Нажмите + чтобы начать</p>
          </div>
        ) : (
          chats.map((chat) => {
            const otherUser = chat.participants?.find(p => p.id !== currentUser.id) || chat.participants?.[0];
            if (!otherUser) return null;
            const lastMsg = chat.last_message;
            const isDeleting = deletingId === chat.id;

            // Presence logic
            const isOnline = otherUser.is_online;
            const lastSeenText = isOnline ? 'Online' : (otherUser.last_seen ? timeAgo(otherUser.last_seen) : '');

            return (
              <div
                key={chat.id}
                onClick={() => !isDeleting && onSelectChat(chat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  transition: 'background 0.15s',
                  position: 'relative'
                }}
                className="hover:bg-white/[0.06] active:scale-[0.98]"
              >
                <div style={{ position: 'relative' }}>
                  <Avatar name={otherUser.username} src={otherUser.avatar_url} size="md" />
                  {isOnline && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#4EB88B',
                      border: '1.5px solid #050505'
                    }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {otherUser.username}
                    </span>
                    {lastMsg && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {timeAgo(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {lastMsg
                      ? (lastMsg.content.includes(':')
                        ? (decryptedPreviews[lastMsg.id] || '🔒 Сообщение')
                        : (lastMsg.type === 'IMAGE' ? '📷 Фото' : truncateMsg(lastMsg.content))
                      )
                      : (isOnline ? <span style={{ color: '#4EB88B' }}>В сети</span> : <span>Был(а) {lastSeenText}</span>)
                    }
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, chat.id)}
                  style={{ padding: 8, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4 }}
                  className="hover:!opacity-100 hover:bg-red-500/20 transition-opacity"
                >
                  <Trash2 style={{ width: 16, height: 16, color: '#D44A4A' }} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
