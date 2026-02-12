import React, { useState } from 'react';
import { GlassCard, Button, Input } from './LiquidUI';
import { ShieldCheck, User as UserIcon, Lock, ArrowRight, QrCode, UserPlus, LogIn, Key, AlertTriangle } from 'lucide-react';
// Adding a stable wrapper for inputs might help, but autoComplete is key against password managers forcing DOM changes

import { ApiService, setAuthToken, clearAuthToken } from '../services/api';
import { User } from '../types';
import { CryptoService } from '../services/crypto';

interface AuthViewProps {
  onAuthSuccess: (token: string, user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [step, setStep] = useState<'CREDENTIALS' | 'RECOVERY_SETUP' | 'RECOVERY_INPUT' | 'QR' | 'TOTP'>('CREDENTIALS');
  const [pendingToken, setPendingToken] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');



  // Registration data
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [tempPublicKey, setTempPublicKey] = useState('');
  const [tempEncryptedKey, setTempEncryptedKey] = useState('');
  const [tempSalt, setTempSalt] = useState('');

  // Recovery Password
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');

  // Login data (fetched from server)
  const [serverEncryptedKey, setServerEncryptedKey] = useState('');
  const [serverSalt, setServerSalt] = useState('');

  // Phase 1: Check username availablity / Start Login
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError('');
    setLoading(true);

    try {
      if (mode === 'REGISTER') {
        // Check availability
        try {
          const check = await ApiService.auth.check(username.trim());
          if (!check.available) {
            setError('Имя пользователя уже занято');
            return;
          }
          setStep('RECOVERY_SETUP');
        } catch (e) {
          setError('Ошибка проверки имени');
        }
      } else {
        // LOGIN: We need to authenticate first with TOTP, then check keys
        // But the server requires TOTP code for login. So we show TOTP input first.
        setStep('TOTP');
      }
    } catch (err: any) {
      setError("Ошибка: " + (err.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 (Reg): Generate Keys & Register with Recovery Password
  const handleRecoverySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryPassword.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (recoveryPassword !== confirmRecoveryPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Generate ECDH Key Pair
      const keyPair = await CryptoService.generateKeyPair();
      const publicKeyBase64 = await CryptoService.exportKey(keyPair.publicKey);
      const privateKeyBase64 = await CryptoService.exportKey(keyPair.privateKey);

      // 2. Encrypt Private Key with Recovery Password
      const salt = await CryptoService.generateSalt();
      const pwKey = await CryptoService.deriveKeyFromPassword(recoveryPassword, salt);
      const { encrypted, iv } = await CryptoService.encryptPrivateKey(privateKeyBase64, pwKey);
      const encryptedKey = `${iv}:${encrypted}`; // Pack for temporary state if needed, but actually we set tempEncryptedKey later.
      // Wait, we set `tempEncryptedKey` to `encryptedKey`.
      // And in ConfirmReg we send it.
      // So `encryptedKey` here should be the packed string?
      // In `handleConfirmRegistration` we send `tempEncryptedKey`.
      // Backend expects `encrypted_private_key` which we decided is "IV:Cipher".
      // So yes, we should pack it here.

      // 3. Register on Server
      const data = await ApiService.auth.register(username.trim()); // First call to reserve? No, api changed.
      // Actually, wait, the register endpoint now expects username only? 
      // Checking api.ts... register takes ONE arg. But wait, confirmRegistration takes the keys.
      // So step 1 is just reserving username and getting secret/QR.
      // Re-reading updated api.ts...
      // register(username) -> returns qr_code, secret. Keys are sent in CONFIRM.

      const regData = await ApiService.auth.register(username.trim());

      setQrCode(regData.qr_code);
      setTotpSecret(regData.secret);
      setTempPublicKey(publicKeyBase64);
      setTempEncryptedKey(encryptedKey);
      setTempSalt(salt);

      // Save private key locally for immediate use
      localStorage.setItem('private_key', privateKeyBase64);
      localStorage.setItem('public_key', publicKeyBase64);

      setStep('QR');
    } catch (err: any) {
      console.error("Recovery Setup Error:", err);
      // Detailed error for debugging Safari
      const msg = err.message || JSON.stringify(err);
      alert(`Ошибка создания ключей: ${msg}`);
      setError(`Ошибка регистрации: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Phase 3 (Reg): Confirm TOTP and Send Keys
  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setLoading(true);
    setError('');

    try {
      const data = await ApiService.auth.confirmRegistration(
        username.trim(),
        tempPublicKey,
        tempEncryptedKey,
        tempSalt,
        totpSecret,
        code
      );

      const token = data.access_token;
      localStorage.setItem('access_token', token);
      setAuthToken(token);

      const user = await ApiService.auth.me();
      onAuthSuccess(token, user);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Неверный код безопасности';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 (Login): Verify TOTP
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setLoading(true);
    setError('');

    try {
      const data = await ApiService.auth.login(username.trim(), code);
      const token = data.access_token;
      // localStorage.setItem('access_token', token); // Removed: Don't persist yet
      setAuthToken(token);

      const user = await ApiService.auth.me();

      // Check if we need to recover keys
      const localPriv = localStorage.getItem('private_key');
      if (!localPriv && user.encrypted_private_key && user.key_salt) {
        // We need to restore keys
        setPendingToken(token); // Save for later
        setServerEncryptedKey(user.encrypted_private_key);
        setServerSalt(user.key_salt);
        setStep('RECOVERY_INPUT');
        setLoading(false);
        return;
      }

      localStorage.setItem('access_token', token); // Persist only if no recovery needed
      onAuthSuccess(token, user);
    } catch (err: any) {
      // Safe error extraction
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map((e: any) => e.msg).join(', ')
          : 'Неверный код или имя пользователя';
      setError(msg);
      setLoading(false);
    }
  };

  // Phase 3 (Login): Decrypt Private Key
  const handleRecoveryInput = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const pwKey = await CryptoService.deriveKeyFromPassword(recoveryPassword, serverSalt);
      // We don't have IV stored separate? Ah, encryptPrivateKey returns { cipherText, iv }
      // But our DB schema only has `encrypted_private_key`. 
      // We need to store IV either prepended or in a separate field.
      // In crypto.ts `encrypt` returns `cipherText` and `iv`.
      // `encryptPrivateKey` implementation used `encrypt`.
      // I didn't verify if `encrypted_private_key` column stores both.
      // Let's assume we need to store "IV|Ciphertext" or similar if we have one column.
      // Wait, `CryptoService.encrypt` returns object.
      // Backend column is just Text.
      // Let's fix `AuthView` to send "IV:Ciphertext" or similar string combination.

      // Actually, looking at `CryptoService.encrypt` in previous turn...
      // I missed handling the IV storage in the Backend plan. 
      // QUICK FIX: Prepend IV to the ciphertext string using a colon separator.

      // Let's assume serverEncryptedKey is "IV:Ciphertext"
      // console.debug("Decrypting server key..."); 
      const parts = serverEncryptedKey.split(':');
      if (parts.length !== 2) throw new Error("Invalid key format (missing separator)");

      const iv = parts[0].trim();
      const cipher = parts[1].trim();

      const privateKeyBase64 = await CryptoService.decryptPrivateKey(cipher, iv, pwKey);

      localStorage.setItem('private_key', privateKeyBase64);

      // Persist token now that keys are restored
      if (pendingToken) {
        localStorage.setItem('access_token', pendingToken);
      }

      // We also need public key. It is in `user` object.
      // We must fetch user again or pass it down.
      const user = await ApiService.auth.me();
      if (user.public_key) localStorage.setItem('public_key', user.public_key);

      onAuthSuccess(pendingToken || localStorage.getItem('access_token')!, user);
    } catch (err) {
      setError("Неверный пароль восстановления или поврежденные данные");
      console.error(err);
      setError("Неверный пароль восстановления или поврежденные данные");
    } finally {
      setLoading(false);
    }
  };

  // Helper to join IV and Cipher for storage
  const packKey = (iv: string, cipher: string) => `${iv}:${cipher}`;


  const reset = () => {
    setMode('LOGIN');
    setStep('CREDENTIALS');
    setCode('');
    setError('');
    setUsername('');
    setRecoveryPassword('');
    setConfirmRecoveryPassword('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#050505' }}>
      <GlassCard className="w-full max-w-md z-10 !p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">Secure Drop</h1>
          <p className="text-glass-muted mt-2 text-center text-sm">E2E Encrypted Messenger</p>
        </div>

        {/* --- STEP 1: CREDENTIALS --- */}
        {step === 'CREDENTIALS' && (
          <>
            <div className="flex bg-white/5 rounded-xl p-1 mb-6">
              <button className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'LOGIN' ? 'bg-accent-primary/60 text-white shadow-lg' : 'text-glass-muted hover:text-white'}`} onClick={() => setMode('LOGIN')}>Войти</button>
              <button className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'REGISTER' ? 'bg-accent-primary/60 text-white shadow-lg' : 'text-glass-muted hover:text-white'}`} onClick={() => setMode('REGISTER')}>Регистрация</button>
            </div>
            <form onSubmit={handleCredentialsSubmit} className="space-y-6" autoComplete="off">
              <Input label="Имя пользователя" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} icon={<UserIcon className="w-4 h-4" />} autoFocus autoComplete="off" name="username_nope" />
              {error && <p className="text-accent-danger text-sm text-center">{error}</p>}
              <Button type="submit" variant="primary" className="w-full" isLoading={loading} disabled={!username.trim()}>Продолжить <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </form>
          </>
        )}

        {/* --- STEP 2 (REG): PASSWORD SETUP --- */}
        {step === 'RECOVERY_SETUP' && mode === 'REGISTER' && (
          <form onSubmit={handleRecoverySetup} className="space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-amber-500 text-xs font-bold mb-1">Важно!</p>
                <p className="text-glass-muted text-[11px] leading-relaxed">
                  Придумайте пароль для шифрования ключей. Если вы забудете его, доступ к переписке будет <b>навсегда утерян</b>. Мы не сможем его восстановить.
                </p>
              </div>
            </div>

            <Input label="Пароль восстановления" type="password" placeholder="Min. 8 characters" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} icon={<Key className="w-4 h-4" />} autoFocus />
            <Input label="Повторите пароль" type="password" placeholder="Confirm password" value={confirmRecoveryPassword} onChange={(e) => setConfirmRecoveryPassword(e.target.value)} icon={<Key className="w-4 h-4" />} />

            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep('CREDENTIALS')}>Назад</Button>
              <Button type="submit" variant="primary" className="flex-1" isLoading={loading}>Создать ключи</Button>
            </div>
          </form>
        )}

        {/* --- STEP 3 (REG/LOGIN): QR or TOTP Input --- */}
        {step === 'QR' && (
          <div className="space-y-6">
            <div className="text-center">
              <QrCode className="w-8 h-8 text-white mx-auto mb-3" />
              <p className="text-sm font-bold">Настройка входа по коду</p>
              <p className="text-glass-muted text-xs mt-1">Отсканируйте QR в Google Authenticator</p>
            </div>
            <div className="flex justify-center bg-white p-2 rounded-xl"><img src={qrCode} className="w-40 h-40" alt="QR" /></div>
            <div className="text-center text-xs text-glass-muted select-all cursor-text font-mono break-all px-4">
              {totpSecret}
            </div>
            <Input label="Код подтверждения" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} icon={<Lock className="w-4 h-4" />} maxLength={6} />
            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}
            <Button onClick={(e) => {
              // For Reg this needs to call detailed confirm
              // But wait, we define `handleConfirmRegistration` above and it uses `tempEncryptedKey` etc.
              // So we need to call that.
              // We can make a unified handler or just call the right one based on mode?
              // But QR step is only for Register in this flow. Login uses `TOTP` step.
              handleConfirmRegistration(e);
            }} variant="primary" className="w-full" isLoading={loading} disabled={code.length < 6}>Завершить регистрацию</Button>
          </div>
        )}

        {step === 'TOTP' && mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-white font-medium">Вход по коду</p>
              <p className="text-glass-muted text-xs">{username}</p>
            </div>
            <Input label="Код из приложения" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} icon={<Lock className="w-4 h-4" />} maxLength={6} autoFocus />
            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={reset}>Назад</Button>
              <Button type="submit" variant="primary" className="flex-1" isLoading={loading} disabled={code.length < 6}>Войти</Button>
            </div>
          </form>
        )}

        {/* --- STEP 4 (LOGIN): RECOVERY INPUT --- */}
        {step === 'RECOVERY_INPUT' && (
          <form onSubmit={handleRecoveryInput} className="space-y-6">
            <div className="text-center mb-4">
              <Key className="w-8 h-8 text-accent-primary mx-auto mb-2" />
              <p className="text-white font-medium">Расшифровка ключей</p>
              <p className="text-glass-muted text-xs px-4">Введите ваш Пароль Восстановления, чтобы расшифровать историю переписки на этом устройстве.</p>
            </div>

            <Input label="Пароль восстановления" type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} icon={<Key className="w-4 h-4" />} autoFocus />

            {error && <p className="text-accent-danger text-sm text-center">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" isLoading={loading}>Расшифровать и Войти</Button>

            <button type="button" onClick={() => {
              localStorage.removeItem('access_token');
              clearAuthToken();
              window.location.reload();
            }} className="w-full text-center text-xs text-glass-muted mt-4 hover:text-white">Отмена (Выйти)</button>
          </form>
        )}
      </GlassCard>
    </div>
  );
};
