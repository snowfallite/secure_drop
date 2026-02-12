import { Utils } from './utils'; // As assuming we might need some utils or just standard

// Crypto Service wrapping Web Crypto API

export class CryptoService {
  // --- 1. Key Generation (ECDH) ---

  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true, // extractable (need to save private key)
      ["deriveKey", "deriveBits"]
    );
  }

  // --- 2. Key Export/Import ---

  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey(
      key.type === "public" ? "spki" : "pkcs8",
      key
    );
    return this.arrayBufferToBase64(exported);
  }

  static async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const buffer = this.base64ToArrayBuffer(base64Key);
    return window.crypto.subtle.importKey(
      "spki",
      buffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      []
    );
  }

  static async importPrivateKey(base64Key: string): Promise<CryptoKey> {
    const buffer = this.base64ToArrayBuffer(base64Key);
    return window.crypto.subtle.importKey(
      "pkcs8",
      buffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"]
    );
  }

  // --- 3. Shared Secret Derivation ---

  static async deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
    return window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: publicKey,
      },
      privateKey,
      {
        name: "AES-GCM",
        length: 256,
      },
      true, // exportable (optional, but keep true for debug/caching)
      ["encrypt", "decrypt"]
    );
  }

  // --- 4. Message Encryption/Decryption (AES-GCM) ---

  static async encrypt(content: string, key: CryptoKey): Promise<{ cipherText: string; iv: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(content);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encoded
    );

    return {
      cipherText: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  static async decrypt(cipherText: string, iv: string, key: CryptoKey): Promise<string> {
    const encryptedBuffer = this.base64ToArrayBuffer(cipherText);
    const ivBuffer = this.base64ToArrayBuffer(iv);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivBuffer,
        },
        key,
        encryptedBuffer
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      // console.warn("Decryption failed (likely old key):", e);
      throw new Error("Failed to decrypt message");
    }
  }

  // --- 5. Private Key Wrapping (Password Based) ---

  static async generateSalt(): Promise<string> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    return this.arrayBufferToBase64(salt);
  }

  // Derive a Key-Wrapping-Key (KWK) from password
  static async deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: this.base64ToArrayBuffer(saltBase64),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  static async encryptPrivateKey(privateKeyBase64: string, passwordKey: CryptoKey): Promise<{ encrypted: string; iv: string }> {
    const { cipherText, iv } = await this.encrypt(privateKeyBase64, passwordKey);
    return { encrypted: cipherText, iv };
  }

  static async decryptPrivateKey(encryptedKeyBase64: string, ivBase64: string, passwordKey: CryptoKey): Promise<string> {
    return this.decrypt(encryptedKeyBase64, ivBase64, passwordKey);
  }


  // --- Helpers ---

  static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Sanitize: remove whitespace, support URL-safe base64
    if (!base64 || base64 === 'undefined' || base64.includes('undefined')) {
      console.warn("Invalid base64 input (undefined).");
      throw new Error("Invalid base64 key");
    }
    let sanitized = base64.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');

    // Fix padding
    while (sanitized.length % 4 !== 0) {
      sanitized += '=';
    }

    try {
      const binary_string = window.atob(sanitized);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (e) {
      console.error("Base64 decode failed input:", base64);
      console.error("Sanitized input:", sanitized);
      throw e;
    }
  }
}
