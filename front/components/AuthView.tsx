import React, { useState } from 'react';
import { GlassCard, Button, Input } from './LiquidUI';
import { ShieldCheck, User as UserIcon, Lock, ArrowRight, QrCode, UserPlus, LogIn } from 'lucide-react';
import { ApiService, setAuthToken } from '../services/api';
import { User } from '../types';

// Generate a simple fallback key for non-HTTPS contexts (192.168.x.x, etc.)
async function generatePublicKey(): Promise<string> {
  try {
    if (window.crypto?.subtle) {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
      );
      const exported = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));

      // Also save private key
      const exportedPrivate = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const privateBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPrivate)));
      localStorage.setItem('private_key', privateBase64);
      localStorage.setItem('public_key', base64);

      return base64;
    }
  } catch (e) {
    console.warn('WebCrypto not available, using fallback key');
  }

  // Fallback: random string key (E2EE won't work, but registration will succeed)
  const fallback = btoa(Array.from(crypto.getRandomValues(new Uint8Array(32)), b => String.fromCharCode(b)).join(''));
  localStorage.setItem('public_key', fallback);
  return fallback;
}

interface AuthViewProps {
  onAuthSuccess: (token: string, user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [step, setStep] = useState<'CREDENTIALS' | 'QR' | 'TOTP'>('CREDENTIALS');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [publicKey, setPublicKey] = useState('');

  // Phase 1: Register — just get QR code, no account created yet
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');

    try {
      const pubKey = await generatePublicKey();
      setPublicKey(pubKey);
      const data = await ApiService.auth.register(username.trim(), pubKey);

      setQrCode(data.qr_code);
      setTotpSecret(data.secret);
      setStep('QR');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Confirm registration with TOTP code — account created here
  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setLoading(true);
    setError('');

    try {
      const data = await ApiService.auth.confirmRegistration(
        username.trim(),
        publicKey,
        totpSecret,
        code
      );
      const token = data.access_token;
      localStorage.setItem('access_token', token);
      setAuthToken(token);

      const user = await ApiService.auth.me();
      onAuthSuccess(token, user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  // Login with existing account
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || code.length < 6) return;
    setLoading(true);
    setError('');

    try {
      const data = await ApiService.auth.login(username.trim(), code);
      const token = data.access_token;
      localStorage.setItem('access_token', token);
      setAuthToken(token);

      const user = await ApiService.auth.me();
      onAuthSuccess(token, user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверное имя или код');
    } finally {
      setLoading(false);
    }
  };

  const handleQrContinue = () => {
    setStep('TOTP');
    setCode('');
    setError('');
  };

  const resetToLogin = () => {
    setMode('LOGIN');
    setStep('CREDENTIALS');
    setCode('');
    setError('');
    setQrCode('');
    setTotpSecret('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden', background: '#050505' }}>
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-accent-secondary/20 rounded-full blur-[100px]" />

      <GlassCard className="w-full max-w-md z-10 !p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">Secure Drop</h1>
          <p className="text-glass-muted mt-2 text-center text-sm">Защищённый мессенджер</p>
        </div>

        {/* Tab switcher — only on credentials step */}
        {step === 'CREDENTIALS' && (
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'LOGIN' ? 'bg-accent-primary/60 text-white shadow-lg' : 'text-glass-muted hover:text-white'}`}
              onClick={() => { setMode('LOGIN'); setError(''); setCode(''); }}
            >
              <LogIn className="w-4 h-4" /> Войти
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'REGISTER' ? 'bg-accent-primary/60 text-white shadow-lg' : 'text-glass-muted hover:text-white'}`}
              onClick={() => { setMode('REGISTER'); setError(''); setCode(''); }}
            >
              <UserPlus className="w-4 h-4" /> Регистрация
            </button>
          </div>
        )}

        {/* REGISTER — Username input */}
        {mode === 'REGISTER' && step === 'CREDENTIALS' && (
          <form onSubmit={handleRegister} className="space-y-6">
            <Input
              label="Имя пользователя"
              placeholder="Придумайте имя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              icon={<UserIcon className="w-4 h-4" />}
              autoFocus
            />
            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" isLoading={loading} disabled={!username.trim()}>
              Создать аккаунт <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* REGISTER — QR Code display */}
        {step === 'QR' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-accent-primary mb-3">
                <QrCode className="w-5 h-5" />
                <span className="text-sm font-bold uppercase tracking-wider">Отсканируйте QR-код</span>
              </div>
              <p className="text-glass-muted text-xs mb-4">
                Откройте Google Authenticator и отсканируйте этот код
              </p>
            </div>

            <div className="flex justify-center">
              <div className="bg-white rounded-2xl p-3 shadow-2xl">
                <img src={qrCode} alt="QR" className="w-48 h-48" />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-glass-muted uppercase tracking-wider mb-1">Или введите код вручную</p>
              <p className="text-sm font-mono text-accent-primary tracking-widest break-all select-all">{totpSecret}</p>
            </div>

            <Button variant="primary" className="w-full" onClick={handleQrContinue}>
              Я отсканировал <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* LOGIN — Username + TOTP code */}
        {mode === 'LOGIN' && step === 'CREDENTIALS' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              label="Имя пользователя"
              placeholder="Введите имя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              icon={<UserIcon className="w-4 h-4" />}
              autoFocus
            />
            <Input
              label="Код из приложения"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              icon={<Lock className="w-4 h-4" />}
              maxLength={6}
            />
            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" isLoading={loading} disabled={!username.trim() || code.length < 6}>
              Войти
            </Button>
          </form>
        )}

        {/* REGISTER — Verify TOTP code (creates account on success) */}
        {step === 'TOTP' && mode === 'REGISTER' && (
          <form onSubmit={handleConfirmRegistration} className="space-y-6">
            <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl p-4 text-center">
              <p className="text-xs text-accent-primary uppercase font-bold tracking-wider mb-1">Подтвердите настройку</p>
              <p className="text-glass-muted text-xs">Введите 6-значный код из приложения</p>
            </div>

            <Input
              label="Код аутентификации"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              icon={<Lock className="w-4 h-4" />}
              maxLength={6}
              autoFocus
            />

            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" isLoading={loading} disabled={code.length < 6}>
              Завершить регистрацию
            </Button>

            <button type="button" onClick={resetToLogin} className="w-full text-center text-xs text-glass-muted hover:text-white mt-2 transition-colors">
              Уже есть аккаунт? Войти
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  );
};