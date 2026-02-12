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
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-glass-text">Сообщения</h2>
        <button
          onClick={() => { setIsCreating(!isCreating); setCreateError(''); }}
          className="p-2.5 rounded-full bg-glass-surface border border-glass-border cursor-pointer hover:bg-glass-highlight transition-colors"
        >
          <MessageSquarePlus className="w-5 h-5 text-accent-primary" />
        </button>
      </div>

      {/* New Chat Form */}
      {isCreating && (
        <div className="bg-glass-surface border border-glass-border rounded-xl p-4 mb-4">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-glass-muted" />
              <input
                className="w-full bg-glass-background/50 border border-glass-border rounded-xl py-3 pl-9 pr-4 text-glass-text text-sm outline-none focus:border-accent-primary"
                placeholder="Имя пользователя..."
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoFocus
              />
            </div>
            {createError && <p className="text-accent-danger text-xs text-center">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-xs text-glass-muted hover:text-glass-text transition-colors">
                Отмена
              </button>
              <button type="submit" disabled={!newUsername.trim()} className={`px-4 py-2 text-xs text-white rounded-xl transition-colors bg-accent-primary ${!newUsername.trim() ? 'opacity-30' : ''}`}>
                Начать чат
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chat List */}
      <div className="flex flex-col gap-2 pb-8">
        {chats.length === 0 ? (
          <div className="text-center pt-20 text-glass-muted">
            <Users className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">Пока нет чатов</p>
            <p className="text-sm opacity-60">Нажмите + чтобы начать</p>
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
                className={`flex items-center gap-3.5 p-3.5 bg-glass-surface border border-glass-border rounded-2xl cursor-pointer transition-all hover:bg-glass-highlight active:scale-[0.98] relative ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="relative">
                  <Avatar name={otherUser.username} src={otherUser.avatar_url} size="md" />
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-accent-success border-2 border-glass-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-[15px] text-glass-text truncate">
                      {otherUser.username}
                    </span>
                    {lastMsg && (
                      <span className="text-[11px] text-glass-muted whitespace-nowrap ml-2">
                        {timeAgo(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-glass-muted truncate m-0">
                    {lastMsg
                      ? (lastMsg.content.includes(':')
                        ? (decryptedPreviews[lastMsg.id] || '🔒 Сообщение')
                        : (lastMsg.type === 'IMAGE' ? '📷 Фото' : truncateMsg(lastMsg.content))
                      )
                      : (isOnline ? <span className="text-accent-success">В сети</span> : <span>Был(а) {lastSeenText}</span>)
                    }
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, chat.id)}
                  className="p-2 rounded-full hover:bg-red-500/20 transition-colors opacity-40 hover:opacity-100 group"
                >
                  <Trash2 className="w-4 h-4 text-accent-danger" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
