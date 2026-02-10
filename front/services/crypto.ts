export class CryptoService {
    static async generateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey; publicKeyObj: CryptoKey }> {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256",
            },
            true,
            ["deriveKey"]
        );

        const exported = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const publicKeyDocs = btoa(String.fromCharCode(...new Uint8Array(exported)));

        return {
            publicKey: publicKeyDocs,
            privateKey: keyPair.privateKey,
            publicKeyObj: keyPair.publicKey
        };
    }

    static async importPublicKey(base64Key: string): Promise<CryptoKey> {
        const binary = atob(base64Key);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return await window.crypto.subtle.importKey(
            "spki",
            bytes,
            {
                name: "ECDH",
                namedCurve: "P-256",
            },
            true,
            []
        );
    }

    static async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
        return await window.crypto.subtle.deriveKey(
            {
                name: "ECDH",
                public: publicKey,
            },
            privateKey,
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    static async encrypt(content: string, key: CryptoKey): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            data
        );

        const encryptedArray = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.length + encryptedArray.length);
        combined.set(iv);
        combined.set(encryptedArray, iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    static async decrypt(encryptedContent: string, key: CryptoKey): Promise<string> {
        try {
            const binary = atob(encryptedContent);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const iv = bytes.slice(0, 12);
            const data = bytes.slice(12);

            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                },
                key,
                data
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (e) {
            console.error("Decryption failed", e);
            return "[Decryption Error]";
        }
    }
}
