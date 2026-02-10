import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, Smile, Lock as LockIcon, Trash2, Reply as ReplyIcon, X, Check, CheckCheck } from 'lucide-react';
import { ChatSession, Message, MessageType, User } from '../types';
import { Avatar } from './LiquidUI';
import { ApiService } from '../services/api';
import { MOCK_EMOJIS } from '../constants';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ChatRoomProps {
  chat: ChatSession;
  currentUser: User;
  onBack: () => void;
  onSendMessage: (chatId: string, content: string, type: MessageType, replyToId?: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ chat, currentUser, onBack, onSendMessage, onDeleteChat }) => {
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>(chat.messages || []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const otherUser = chat.participants?.find(p => p.id !== currentUser.id) || chat.participants?.[0];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { setMessages(chat.messages || []); }, [chat.messages]);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Poll every 3s
  useEffect(() => {
    const poll = async () => {
      try {
        const newMsgs = await ApiService.chats.getMessages(chat.id);
        setMessages(prev => JSON.stringify(newMsgs) !== JSON.stringify(prev) ? newMsgs : prev);
      } catch { }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chat.id]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setSending(true);
    setInputText('');
    setShowEmoji(false);
    try {
      await onSendMessage(chat.id, text, MessageType.TEXT, replyingTo?.id);
      setReplyingTo(null);
      const newMsgs = await ApiService.chats.getMessages(chat.id);
      setMessages(newMsgs);
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Макс. 5 МБ'); return; }
    const reader = new FileReader();
    reader.onloadend = async () => {
      await onSendMessage(chat.id, reader.result as string, MessageType.IMAGE, replyingTo?.id);
      setReplyingTo(null);
      const newMsgs = await ApiService.chats.getMessages(chat.id);
      setMessages(newMsgs);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteChat = async () => {
    if (!confirm('Удалить чат?')) return;
    try { await ApiService.chats.delete(chat.id); onDeleteChat(chat.id); } catch { }
  };

  const handeDeleteMessage = async (msgId: string) => {
    if (!confirm('Удалить сообщение?')) return;
    try {
      await ApiService.chats.deleteMessage(chat.id, msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch { }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dx > 80 && dy < 60) onBack();
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const fmtTime = (d: string) => { try { return format(new Date(d), 'HH:mm', { locale: ru }); } catch { return ''; } };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ===== HEADER ===== */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <button
          onClick={onBack}
          style={{ padding: 8, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
          className="hover:bg-white/10 active:scale-95 transition-all"
        >
          <ArrowLeft style={{ width: 22, height: 22, color: 'white' }} />
        </button>
        {otherUser && <Avatar name={otherUser.username} src={otherUser.avatar_url} size="sm" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {otherUser?.username || 'Чат'}
          </div>
          <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }} className="text-glass-muted">
            {otherUser?.is_online ? (
              <span className="text-accent-success">On-line</span>
            ) : (
              <span>{otherUser?.last_seen ? `Был(а) ${fmtTime(otherUser.last_seen)}` : 'Off-line'}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-white/20 mx-1" />
            <LockIcon style={{ width: 10, height: 10 }} /> E2E
          </div>
        </div>
        <button
          onClick={handleDeleteChat}
          style={{ padding: 8, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
          className="hover:bg-red-500/20 transition-colors"
        >
          <Trash2 style={{ width: 18, height: 18, color: '#ff6b6b', opacity: 0.7 }} />
        </button>
      </div>

      {/* ===== MESSAGES ===== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '20px 16px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 14, marginBottom: 4 }}>Начните переписку</p>
            <p style={{ fontSize: 11, opacity: 0.5 }}>Сообщения зашифрованы</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 4 }}>

                  {/* Reply Preview */}
                  {msg.reply_to && (
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderLeft: '2px solid #4EB88B',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: 2,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.reply_to?.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <div className="font-semibold text-accent-primary text-[10px]">{msg.reply_to.sender_id === currentUser.id ? 'Вы' : 'Собеседник'}</div>
                      <div className="truncate">{msg.reply_to.type === MessageType.IMAGE ? '📷 Фото' : msg.reply_to.content}</div>
                    </div>
                  )}

                  <div
                    id={`msg-${msg.id}`}
                    className="group"
                    style={{
                      position: 'relative',
                      padding: '10px 16px',
                      borderRadius: 18,
                      fontSize: 14,
                      lineHeight: 1.5,
                      ...(isMe
                        ? { background: 'rgba(10,58,107,0.8)', color: 'white', borderBottomRightRadius: 6 }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', borderBottomLeftRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }
                      )
                    }}
                  >
                    {msg.type === MessageType.TEXT && <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{msg.content}</p>}
                    {msg.type === MessageType.EMOJI && <p style={{ fontSize: 36, margin: 0 }}>{msg.content}</p>}
                    {msg.type === MessageType.IMAGE && <img src={msg.content} alt="" style={{ borderRadius: 12, maxWidth: '100%', maxHeight: 240, objectFit: 'cover' }} />}

                    {/* Actions (Reply/Delete) */}
                    <div className={`absolute top-0 ${isMe ? '-left-16' : '-right-16'} h-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-2`}>
                      <button onClick={() => setReplyingTo(msg)} className="p-1 rounded-full hover:bg-white/10 text-glass-muted hover:text-white">
                        <ReplyIcon size={14} />
                      </button>
                      {isMe && (
                        <button onClick={() => handeDeleteMessage(msg.id)} className="p-1 rounded-full hover:bg-red-500/20 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{fmtTime(msg.created_at)}</span>
                    {isMe && (
                      <span className="text-accent-primary" style={{ display: 'flex' }}>
                        {msg.read_at ? (
                          <CheckCheck size={14} className="text-[#60A5FA]" />
                        ) : (
                          <Check size={14} className="text-white/60" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* ===== INPUT BAR ===== */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px 12px 16px 12px',
          background: 'linear-gradient(to top, #050505 60%, transparent)',
        }}
      >

        {replyingTo && (
          <div className="absolute bottom-full left-0 right-0 bg-glass-surface border-t border-white/10 p-2 flex items-center justify-between backdrop-blur-md">
            <div className="flex flex-col text-xs pl-2 border-l-2 border-accent-primary">
              <span className="text-accent-primary font-medium">Ответ на сообщение</span>
              <span className="text-white/60 truncate max-w-[200px]">{replyingTo.type === MessageType.IMAGE ? '📷 Фото' : replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-full">
              <X size={16} className="text-white/60" />
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: '4px 8px',
          }}
        >
          <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageUpload} />

          <button onClick={() => fileInputRef.current?.click()} style={{ padding: 10, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }} className="text-glass-muted hover:text-white transition-colors">
            <ImageIcon style={{ width: 20, height: 20 }} />
          </button>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowEmoji(!showEmoji)} style={{ padding: 10, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }} className={showEmoji ? 'text-accent-secondary' : 'text-glass-muted hover:text-white'}>
              <Smile style={{ width: 20, height: 20 }} />
            </button>
            {showEmoji && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowEmoji(false)} />
                <div style={{ position: 'absolute', bottom: 48, left: 0, background: 'rgba(0,0,0,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, width: 256, zIndex: 50 }}>
                  {MOCK_EMOJIS.map(e => (
                    <button key={e} onClick={() => setInputText(p => p + e)} style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }} className="hover:bg-white/10 active:scale-90 transition-all">{e}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <input
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              padding: '10px 8px',
              fontSize: 14,
            }}
            placeholder="Сообщение..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            style={{
              padding: 10,
              borderRadius: '50%',
              border: 'none',
              cursor: !inputText.trim() || sending ? 'default' : 'pointer',
              display: 'flex',
              flexShrink: 0,
              opacity: !inputText.trim() || sending ? 0.3 : 1,
              transition: 'all 0.2s',
            }}
            className="bg-accent-primary active:scale-95"
          >
            <Send style={{ width: 20, height: 20, color: 'white' }} />
          </button>
        </div>
      </div>
    </div>
  );
};