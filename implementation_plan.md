# End-to-End Encryption Implementation Plan (Updated)

## Goal
Implement full E2EE with multi-device support (via key sync) and image encryption.

## Design

### 1. Cryptography Stack (Web Crypto API)
*   **Key Exchange:** ECDH (P-256).
*   **Message Encryption:** AES-GCM (256-bit).
*   **Key Wrapping (Sync):** AES-KW (or AES-GCM) derived from a **Recovery Password** using PBKDF2.

### 2. Workflow

#### Registration (Updated)
1.  **Generate Keys:** ECDH KeyPair (Public + Private).
2.  **User Input:** User creates a **Recovery Password**.
3.  **Encrypt Private Key:**
    *   Derive `Key-Wrapping-Key` (KWK) from Recovery Password via `PBKDF2`.
    *   Encrypt `Private Key` using KWK (AES-GCM).
4.  **Send to Server:**
    *   `username`
    *   `public_key`
    *   `encrypted_private_key` (New field)
    *   `salt` (for PBKDF2)

#### Login (New Device)
1.  **Authenticate:** TOTP Login (as before).
2.  **Fetch Keys:** Server returns `encrypted_private_key` and `salt`.
3.  **Decrypt Key:**
    *   User inputs **Recovery Password**.
    *   Derive KWK using `salt`.
    *   Decrypt `Private Key`.
4.  **Save:** Store `Private Key` in `localStorage`.

#### Sending Message (Text & Images)
1.  **Derive Session Key:** ECDH (`My Private` + `Recipient Public`) -> AES-GCM Key.
2.  **Encrypt Content:**
    *   **Text:** Encrypt text string.
    *   **Image:** Encrypt base64 image string.
    *   **Video:** Block/Show "Unavailable".
3.  **Send:** POST `encrypted_content` + `iv`.

#### Receiving Messages
1.  **Decrypt:** AES-GCM decrypt using derived session key.
2.  **Display:**
    *   Detect type (Text/Image).
    *   Render decrypted content.

## Proposed Changes

### `backend`
*   **Database:** Add `encrypted_private_key` (Text) and `key_salt` (Text) to `users` table.
*   **API:** Update `/auth/register` and `/auth/me` to handle these fields.

### `front/services/crypto.ts`
*   Add `deriveKeyFromPassword(password, salt)`
*   Add `encryptPrivateKey(privateKey, password)`
*   Add `decryptPrivateKey(encryptedKey, password)`

### `front/components/AuthView.tsx`
*   Add **Recovery Password** input step during Registration.
*   Add **Recovery Password** input step after Login (if private key missing).

### `front/components/ChatRoom.tsx`
*   Implement encryption/decryption loop.
*   Handle `MessageType.IMAGE` encryption.
*   Disable/Hide Video upload.

### UX Improvements
#### [MODIFY] [auth.py](file:///c:/Users/sunny/Desktop/secure_drop/backend/routers/auth.py)
- Add `GET /auth/check` endpoint to verify username availability.

#### [MODIFY] [api.ts](file:///c:/Users/sunny/Desktop/secure_drop/front/services/api.ts)
- Add `checkUsername` method to `ApiService.auth`.

#### [MODIFY] [AuthView.tsx](file:///c:/Users/sunny/Desktop/secure_drop/front/components/AuthView.tsx)
- Call `checkUsername` before moving to password setup in registration flow.
- Rename "2FA" to "Код подтверждения" / "Вход по коду".
- Update UI text to reflect single-factor TOTP login.

## Verification
1.  **Register:** Check DB has `encrypted_private_key`.
2.  **Login New Device:** Ensure history is readable after entering password.
3.  **Chat:** Verify DB `content` is encrypted. Verify Images load correctly.
