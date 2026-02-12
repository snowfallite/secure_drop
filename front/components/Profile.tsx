import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Avatar } from './LiquidUI';
import { Camera, LogOut, Bell, Shield, Key, Check, Pencil, Sparkles, Sun, Moon } from 'lucide-react';
import { ApiService } from '../services/api';

interface ProfileProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user.username);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [isLight, setIsLight] = useState(document.body.classList.contains('light-theme'));

  const toggleTheme = () => {
    document.body.classList.toggle('light-theme');
    setIsLight(document.body.classList.contains('light-theme'));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Макс. размер: 2 МБ'); return; }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setAvatar(base64);
      setSaving(true);
      try {
        await ApiService.users.updateMe({ avatar_url: base64 });
        onUpdateUser({ ...user, avatar_url: base64 });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch { alert('Ошибка сохранения'); }
      finally { setSaving(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async () => {
    const clean = newName.trim();
    setNameError('');
    if (clean.length < 2) { setNameError('Минимум 2 символа'); return; }
    if (clean === user.username) { setEditingName(false); return; }
    try {
      const updated = await ApiService.users.updateMe({ username: clean });
      onUpdateUser({ ...user, username: updated.username });
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err: any) {
      setNameError(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleNotifications = async () => {
    if (!('Notification' in window)) { setNotifStatus('Не поддерживается'); return; }
    try {
      const p = await Notification.requestPermission();
      if (p === 'granted') {
        setNotifStatus('Включены ✓');
        try { new Notification('Secure Drop', { body: 'Уведомления включены!' }); } catch { }
      } else if (p === 'denied') { setNotifStatus('Заблокированы'); }
      else { setNotifStatus('Не разрешены'); }
    } catch { setNotifStatus('Не поддерживается'); }
  };

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 h-full overflow-y-auto pb-28">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-glass-text">Профиль</h2>
        <button onClick={toggleTheme} className="p-2 rounded-full bg-glass-surface hover:bg-glass-highlight transition-colors text-glass-text">
          {isLight ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group cursor-pointer">
          <Avatar name={user.username} src={avatar || undefined} size="xl" />
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {saving ? <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
          </div>
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} />
        </div>
        <p className={`text-xs ${saved ? 'text-accent-success' : 'text-glass-muted/60'}`}>
          {saved ? 'Сохранено ✓' : 'Нажмите чтобы изменить'}
        </p>
      </div>

      {/* Username */}
      <div className="bg-glass-surface border border-glass-border rounded-2xl p-4">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-glass-muted block mb-2">Имя пользователя</label>

        <div className={editingName ? "flex flex-col gap-2" : "hidden"}>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-glass-background border border-glass-border rounded-xl py-2.5 px-3 text-glass-text focus:outline-none focus:border-accent-primary text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
            />
            <button onClick={handleSaveName} className="p-2.5 rounded-xl bg-accent-primary/80 hover:bg-accent-primary transition-colors">
              <Check className="w-4 h-4 text-white" />
            </button>
          </div>
          {nameError && <p className="text-accent-danger text-xs">{nameError}</p>}
        </div>

        <div className={!editingName ? "flex items-center justify-between" : "hidden"}>
          <p className="text-glass-text font-medium text-lg">{user.username}</p>
          <button onClick={() => { setEditingName(true); setNewName(user.username); }} className="p-2 rounded-lg hover:bg-glass-highlight transition-colors">
            <Pencil className="w-4 h-4 text-glass-muted" />
          </button>
          {nameSaved && <span className="text-accent-success text-xs ml-2">Сохранено ✓</span>}
        </div>
      </div>

      {/* Settings Info */}
      <div className="space-y-3">
        <div className="bg-glass-surface border border-glass-border rounded-2xl p-4 flex items-center gap-4">
          <Bell className="w-5 h-5 text-glass-text flex-shrink-0 opacity-80" />
          <div className="flex-1">
            <span className="text-sm text-glass-text block">Уведомления</span>
            {notifStatus && <span className="text-[10px] text-glass-muted">{notifStatus}</span>}
          </div>
          <button onClick={handleNotifications} className="text-xs bg-glass-highlight hover:bg-glass-border text-glass-text px-3 py-1.5 rounded-lg transition-colors">
            Включить
          </button>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-glass-border rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute inset-0 bg-glass-highlight opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="p-2 bg-glass-highlight rounded-xl backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 z-10">
            <h3 className="text-glass-text font-bold text-sm tracking-wide">
              Secure Drop <span className="text-indigo-400">Quantum</span>
            </h3>
            <p className="text-[10px] text-glass-muted leading-tight mt-0.5">
              Build v1.0 • E2E Encrypted
            </p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent-danger/15 hover:bg-accent-danger/30 text-accent-danger rounded-2xl transition-colors font-medium text-sm mt-auto">
        <LogOut className="w-4 h-4" /> Выйти из аккаунта
      </button>
    </div>
  );
};