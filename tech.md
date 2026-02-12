# Техническое задание: Secure Messenger (FastAPI + Caddy + React PWA) - "Secure Drop"

## 1. Общая информация

**Цель:**
Создать максимально безопасный мессенджер с **end-to-end шифрованием (AES-256)**, поддержкой текста и фото. Архитектура построена по принципу **Zero-Knowledge**: сервер не имеет ключей для расшифровки переписки.

**Технологический стек:**
*   **Backend:** FastAPI (Python 3.10+) + Uvicorn
*   **Frontend:** React 18 + TypeScript + Vite
*   **Database:** PostgreSQL (Async SQLAlchemy)
*   **Cache/Presence:** Redis
*   **Reverse Proxy:** Caddy (Auto HTTPS)
*   **Containerization:** Docker + Docker Compose

---

## 2. Функциональные требования

### 2.1 Регистрация и Аутентификация
*   **Идентификация:** По уникальному `username`.
*   **Вход:**
    *   Фактор 1: TOTP (Time-based One-Time Password).
    *   Фактор 2 (для истории): Пароль восстановления (расшифровывает ключи).
*   **Сессии:** JWT (Access Token) с коротким сроком жизни.

### 2.2 Обмен сообщениями (E2EE)
*   **Алгоритмы:**
    *   **ECDH (P-256):** Генерация общего секрета (Shared Secret).
    *   **AES-GCM (256-bit):** Шифрование сообщений и медиа.
*   **Механизм:**
    1.  Клиент A вычисляет Shared Secret, используя свой `Private Key` и `Public Key` клиента B.
    2.  Сообщение шифруется на клиенте (AES-GCM).
    3.  Сервер получает и сохраняет только шифротекст (`iv:ciphertext`).

### 2.3 Ключевая инфраструктура (Key Management)
*   **Генерация:** Ключи создаются в браузере (Web Crypto API).
*   **Хранение (Client):** `localStorage`.
*   **Хранение (Server):**
    *   `public_key`: Открыт для всех.
    *   `encrypted_private_key`: Зашифрован *Паролем Восстановления* (PBKDF2 + AES-GCM). Сервер не знает пароля.

### 2.4 Интерфейс (Liquid Glass)
*   **Стиль:** Темная тема, размытие (backdrop-blur), полупрозрачные карточки.
*   **PWA:** Возможность установки на домашний экран (manifest.json, service worker).

---

## 3. Хранение данных (Схема БД)

### Users
*   `id`: UUID
*   `username`: String (Unique)
*   `totp_secret`: String (32 chars)
*   `public_key`: Text (Base64 SPKI)
*   `encrypted_private_key`: Text (AES-GCM Encrypted JSON)
*   `key_salt`: Text (PBKDF2 Salt)
*   `is_verified`: Boolean

### Chats
*   `id`: UUID
*   `created_at`: Timestamp

### Messages
*   `id`: UUID
*   `chat_id`: UUID
*   `sender_id`: UUID
*   `content`: Text (Encrypted `iv:ciphertext`) - Лимит 100 КБ (текст) / 5 МБ (фото blob string)
*   `type`: Enum (TEXT, IMAGE)
*   `reply_to_id`: UUID (Optional)

---

## 4. Безопасность (Security Profile)

См. полный отчет в [SECURITY.md](SECURITY.md).

*   **HTTPS Only:** Web Crypto API работает только в Secure Context.
*   **Key Sanitization:** Проверка целостности ключей при импорте.
*   **No Plaintext Fallback:** Блокировка отправки, если шифрование не удалось.
*   **CSP:** Строгая политика контента (Content-Security-Policy).

---

## 5. Развертывание

См. [SERVER_DEPLOY.md](SERVER_DEPLOY.md).

*   Все сервисы (DB, Redis, Back, Front, Caddy) запускаются через `docker-compose.yml`.
*   Caddy автоматически управляет сертификатами.
