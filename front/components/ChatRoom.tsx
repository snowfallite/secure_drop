import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, Smile, Lock as LockIcon, Trash2, Reply as ReplyIcon, X, Check, CheckCheck } from 'lucide-react';
import { ChatSession, Message, MessageType, User } from '../types';
import { Avatar } from './LiquidUI';
import { ApiService } from '../services/api';
import { MOCK_EMOJIS } from '../constants';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CryptoService } from '../services/crypto';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [rawMessages, setRawMessages] = useState<Message[]>(chat.messages || []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // E2EE State
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [keyError, setKeyError] = useState('');

  const otherUser = chat.participants?.find(p => p.id !== currentUser.id) || chat.participants?.[0];

  // 1. Derive Session Key on Load
  useEffect(() => {
    const initCrypto = async () => {
      try {
        const myPrivBase64 = localStorage.getItem('private_key');
        if (!myPrivBase64 || myPrivBase64 === 'undefined') {
          // Key missing at runtime? Force logout/recovery.
          localStorage.removeItem('access_token');
          window.location.reload();
          return;
        }

        let otherPubBase64 = otherUser?.public_key;
        if (!otherPubBase64 || otherPubBase64 === 'undefined' || otherPubBase64.includes('undefined')) {
          setKeyError('Encryption unavailable (Partner keys corrupted)');
          return;
        }

        const myPriv = await CryptoService.importPrivateKey(myPrivBase64);
        const otherPub = await CryptoService.importPublicKey(otherPubBase64);
        const shared = await CryptoService.deriveSharedKey(myPriv, otherPub);
        setSessionKey(shared);
      } catch (err) {
        console.error('E2EE Init Failed:', err);
        setKeyError('Crypto Error');
      }
    };
    if (chat && otherUser) initCrypto();
  }, [chat.id, otherUser?.id]);



  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Poll
  useEffect(() => {
    const poll = async () => {
      try {
        const newMsgs = await ApiService.chats.getMessages(chat.id);
        // Compare with RAW chat.messages to see if changed
        // But chat.messages isn't automatically updated here unless parent updates it.
        // Yet we use local `messages` state which is decrypted.
        // Problem: if we pull new messages, they are encrypted. 
        // We need to decrypt them before comparing or setting?
        // Or just setChat in parent?
        // Actually, `ApiService.chats.getMessages` returns array.
        // We should ideally update the PARENT state (which passes `chat` prop), 
        // or handle logic here fully. Currently `useEffect [chat.messages]` handles updates.
        // But polling here only checks difference? 
        // The previous code did: setMessages(prev => ...).
        // If we poll, we get ENCRYPTED messages. 
        // We can't easily compare Encrypted Vs Decrypted in state.
        // Better strategy: Calls `onPoll` prop? Or just re-run the decryption effect when data comes.
        // Let's rely on Parent polling or if we stick to local polling:
        // We fetch encrypted, check if different from *last fetched encrypted* (need ref), then update state -> trigger decrypt effect.

        // Simplified: Just decrypt newly fetched always.
        // Optimization: Checking last message ID.
        const lastMsg = newMsgs[newMsgs.length - 1];
        // We need access to current raw messages to compare? 
        // Let's just trust `onSendMessage` updates and maybe occasional manual refresh?
        // The original code had polling. I will keep it but it needs to trigger the Decrypt Effect.
        // We can set a separate `rawMessages` state?
        // Refactoring:
        // 1. `rawMessages` state.
        // 2. `useEffect([rawMessages, sessionKey])` -> sets `messages` (decrypted).
        // 3. Polling updates `rawMessages`.

        // DOING THIS NOW:
        setRawMessages(prev => {
          const isSame = JSON.stringify(newMsgs) === JSON.stringify(prev);
          return isSame ? prev : newMsgs;
        });
      } catch { }
    };
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chat.id]);

  // 3. Sync with props ONLY if props have messages (initial load or full refresh)
  // Fix for flickering: If parent polling returns chat WITHOUT messages, ignore it.
  useEffect(() => {
    if (chat.messages && chat.messages.length > 0) {
      setRawMessages(chat.messages);
    } else if (rawMessages.length === 0 && chat.messages) {
      // Initial load of empty chat
      setRawMessages(chat.messages);
    }
  }, [chat.messages]);

  // Re-run decryption when rawMessages or key changes
  useEffect(() => {
    const run = async () => {
      if (!sessionKey) {
        setMessages(rawMessages);
        return;
      }
      const decrypted = await Promise.all(rawMessages.map(async (msg) => {
        try {
          // console.log("Decrypting msg:", msg.id, msg.content);
          if (msg.content.includes(':')) {
            const [iv, cipher] = msg.content.split(':');
            const plain = await CryptoService.decrypt(cipher, iv, sessionKey);
            // console.log("Decrypted result:", plain);
            if (!plain) return { ...msg, content: 'EMPTY_DECRYPT' }; // Debug marker
            return { ...msg, content: plain };
          }
          return msg;
        } catch (e) {
          console.error("Decryption error for msg:", msg.id, e);
          return { ...msg, content: '🔒 Ошибка расшифровки' };
        }
      }));
      setMessages(decrypted);
    };
    run();
  }, [rawMessages, sessionKey]);


  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    if (!sessionKey && !keyError) return; // Wait for key?

    // If keyError (no key for valid reason, e.g. other user old), maybe allow plaintext?
    // User requested E2E. If E2E fails, we should probably Block or Warn.
    // For now: if sessionKey exists, Encrypt. Else plain (or block).

    const text = inputText.trim();
    setSending(true);
    setInputText('');
    setShowEmoji(false);
    try {
      let contentToSend = text;

      if (sessionKey) {
        const { cipherText, iv } = await CryptoService.encrypt(text, sessionKey);
        contentToSend = `${iv}:${cipherText}`;
      } else {
        alert("Ошибка шифрования: ключи не согласованы. Сообщение не может быть отправлено.");
        setSending(false);
        return;
      }

      await onSendMessage(chat.id, contentToSend, MessageType.TEXT, replyingTo?.id);
      setReplyingTo(null);
      // Let polling or parent update handle the rest? 
      // Original code fetched new msgs immediately.
      const newMsgs = await ApiService.chats.getMessages(chat.id);
      setRawMessages(newMsgs);
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
      const base64Img = reader.result as string;
      let contentToSend = base64Img;

      if (sessionKey) {
        const { cipherText, iv } = await CryptoService.encrypt(base64Img, sessionKey);
        contentToSend = `${iv}:${cipherText}`;
      } else {
        alert("Ошибка шифрования: ключи не согласованы.");
        return;
      }

      await onSendMessage(chat.id, contentToSend, MessageType.IMAGE, replyingTo?.id);
      setReplyingTo(null);
      const newMsgs = await ApiService.chats.getMessages(chat.id);
      setRawMessages(newMsgs);
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
      setRawMessages(prev => prev.filter(m => m.id !== msgId));
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
      className="flex flex-col h-full w-full bg-glass-background"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ===== HEADER ===== */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-glass-border bg-glass-background/80 backdrop-blur-md">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-glass-highlight active:scale-95 transition-all text-glass-text"
        >
          <ArrowLeft size={22} />
        </button>
        {otherUser && <Avatar name={otherUser.username} src={otherUser.avatar_url} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base text-glass-text truncate">
            {otherUser?.username || 'Чат'}
          </div>
          <div className="text-[10px] flex items-center gap-1 text-glass-muted">
            {otherUser?.is_online ? (
              <span className="text-accent-success">On-line</span>
            ) : (
              <span>{otherUser?.last_seen ? `Был(а) ${fmtTime(otherUser.last_seen)}` : 'Off-line'}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-glass-muted mx-1" />
            <LockIcon size={10} /> E2E
          </div>
        </div>
        <button
          onClick={handleDeleteChat}
          className="p-2 rounded-full hover:bg-red-500/20 transition-colors group"
        >
          <Trash2 size={18} className="text-red-400 opacity-70 group-hover:opacity-100" />
        </button>
      </div>

      {/* ===== MESSAGES ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="text-center pt-20 text-glass-muted">
            <p className="text-sm mb-1">Начните переписку</p>
            <p className="text-[11px] opacity-60">Сообщения зашифрованы</p>
          </div>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}>

                  {/* Reply Preview */}
                  {msg.reply_to && (
                    <div
                      className="bg-glass-highlight border-l-2 border-accent-success px-2 py-1 rounded text-xs text-glass-muted mb-1 cursor-pointer hover:opacity-80 transition-opacity"
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
                    className={`group relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed border ${isMe
                      ? 'bg-accent-primary text-white rounded-br-md border-transparent'
                      : 'bg-glass-surface text-glass-text rounded-bl-md border-glass-border'
                      }`}
                  >
                    {msg.type === MessageType.TEXT && <p className="whitespace-pre-wrap break-words m-0">{msg.content}</p>}
                    {msg.type === MessageType.EMOJI && <p className="text-4xl m-0">{msg.content}</p>}
                    {msg.type === MessageType.IMAGE && <img src={msg.content} alt="" className="rounded-xl max-w-full max-h-[240px] object-cover" />}

                    {/* Actions (Reply/Delete) */}
                    <div className={`absolute top-0 ${isMe ? '-left-16' : '-right-16'} h-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-2`}>
                      <button onClick={() => setReplyingTo(msg)} className="p-1 rounded-full hover:bg-glass-highlight text-glass-muted hover:text-glass-text">
                        <ReplyIcon size={14} />
                      </button>
                      {isMe && (
                        <button onClick={() => handeDeleteMessage(msg.id)} className="p-1 rounded-full hover:bg-red-500/20 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-glass-muted/60 px-1">
                    <span>{fmtTime(msg.created_at)}</span>
                    {isMe && (
                      <span className="flex items-center">
                        {msg.read_at ? (
                          <CheckCheck size={12} className="text-[#60A5FA]" />
                        ) : (
                          <Check size={12} className="opacity-60" />
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
      <div className="flex-shrink-0 px-3 pb-4 pt-2 bg-gradient-to-t from-glass-background via-glass-background to-transparent">

        {replyingTo && (
          <div className="absolute bottom-full left-0 right-0 bg-glass-background/95 border-t border-glass-border p-2 flex items-center justify-between backdrop-blur-md">
            <div className="flex flex-col text-xs pl-2 border-l-2 border-accent-primary">
              <span className="text-accent-primary font-medium">Ответ на сообщение</span>
              <span className="text-glass-muted truncate max-w-[200px]">{replyingTo.type === MessageType.IMAGE ? '📷 Фото' : replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-glass-highlight rounded-full">
              <X size={16} className="text-glass-muted" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 bg-glass-surface border border-glass-border rounded-full p-1 pl-2">
          <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageUpload} />

          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-glass-muted hover:text-glass-text hover:bg-glass-highlight transition-all flex-shrink-0">
            <ImageIcon size={20} />
          </button>

          <div className="relative flex-shrink-0">
            <button onClick={() => setShowEmoji(!showEmoji)} className={`p-2 rounded-full transition-all ${showEmoji ? 'text-accent-secondary' : 'text-glass-muted hover:text-glass-text hover:bg-glass-highlight'}`}>
              <Smile size={20} />
            </button>
            {showEmoji && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
                <div className="absolute bottom-14 left-0 bg-glass-background/95 border border-glass-border rounded-2xl p-3 grid grid-cols-5 gap-2 w-64 z-50 shadow-2xl backdrop-blur-xl">
                  {MOCK_EMOJIS.map(e => (
                    <button key={e} onClick={() => setInputText(p => p + e)} className="text-2xl hover:bg-glass-highlight rounded-lg p-1 transition-colors">{e}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <input
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-glass-text py-2.5 px-2 text-sm placeholder:text-glass-muted/50"
            placeholder="Сообщение..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className={`p-2.5 rounded-full flex-shrink-0 transition-all ${!inputText.trim() || sending ? 'bg-glass-highlight text-glass-muted cursor-default' : 'bg-accent-primary text-white active:scale-95 shadow-lg'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};