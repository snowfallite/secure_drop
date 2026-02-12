
# Техническое задание: Secure Messenger (FastAPI + Caddy + React PWA) - Название Secure Drop

## 1. Общая информация

**Цель:**
Создать безопасный мессенджер с **end-to-end шифрованием (AES-256)**, поддержкой текста, emoji и фото, с регистрацией/входом через **TOTP**, фронтенд на **Caddy + React + TypeScript** с PWA и SPA-подобным поведением.

**Технологии:**

* **Backend:** FastAPI + Uvicorn
* **Frontend:** Caddy (backend для статики и API) + React + TypeScript (SPA, PWA)
* **База данных:** PostgreSQL
* **Docker + Docker Compose**
* **TOTP** для аутентификации
* **E2EE** для сообщений и фото (AES-256)

---

## 2. Функциональные требования

### 2.1 Регистрация и аутентификация

* Регистрация через **TOTP**:

  * Пользователь выбирает username
  * Генерируется **секретный ключ TOTP**
  * Отображается QR-код для сканирования (Google Authenticator, Authy и т.д.)
* Вход через **TOTP**:

  * Ввод username + текущий TOTP-код
* JWT для сессий и авторизации
* Возможность выхода и сброса токена

### 2.2 Обмен сообщениями (E2EE)

* **Алгоритмы**:
  * **ECDH (P-256)**: Для генерации общего секрета (Shared Secret) между пользователями.
  * **AES-GCM (256-bit)**: Для симметричного шифрования сообщений и медиафайлов.
  * **PBKDF2**: Для шифрования приватного ключа пользователя его паролем восстановления.
* **Схема работы**:
  1. При регистрации генерируется пара ключей (Public/Private).
  2. Private Key шифруется паролем пользователя и отправляется на сервер (`encrypted_private_key`).
  3. Public Key отправляется в открытом виде для других пользователей.
  4. При отправке сообщения берется Public Key получателя -> вычисляется Shared Secret -> сообщение шифруется AES-GCM.
  5. Сервер получает только `IV:CipherText`.
* **Восстановление**:
  * При входе на новом устройстве пользователь вводит пароль.
  * Приложение качает `encrypted_private_key` и расшифровывает его паролем.
  * История сообщений становится доступна.

### 2.3 Контакты / Чат

* **Lazy Chat Creation**: Чат создается в базе только после отправки первого сообщения (чтобы не спамить пустыми чатами).
* **Списки чатов**: Сортировка по последнему сообщению, индикаторы онлайн/оффлайн.
* **Поиск пользователей**: Поиск по `username`.

### 2.4 Безопасность

* **HTTPS Only**: Web Crypto API требует Secure Context. В локальной сети (LAN) доступ возможен только по `localhost` или через HTTPS туннель (ngrok).
* **Key Verification**: Приложение сверяет локальные ключи с профилем пользователя при каждом входе. Чужие ключи удаляются.
* **No Plaintext Fallback**: Код блокирует отправку, если шифрование не инициализировано.
* **Key Sanitization**: Жесткая валидация ключей (защита от `undefined` string corruption) на клиенте.
* **Auth**: JWT (Access Token) + TOTP (Google Authenticator) + Password (для ключей).

### 2.5 Хранение данных

* **Пользователи**: `id`, `username`, `totp_secret`, `public_key`, `encrypted_private_key` (blob), `key_salt`, `created_at`
* **Чаты**: `id`, `created_by_id`, `created_at`
* **Участники чатов**: Link-table `chat_participants`
* **Сообщения**: `id`, `chat_id`, `sender_id`, `content` (encrypted text), `type` (text/image), `reply_to_id`, `created_at`

---

## 3. Архитектура

### 3.1 Backend (FastAPI)

* Эндпоинты:

  * `/register` — регистрация username + выдача TOTP QR-кода / секрета
  * `/login` — вход по username + TOTP-код
  * `/send_message` — отправка зашифрованного сообщения
  * `/get_messages` — получение сообщений
  * `/send_photo` — отправка фото
  * `/get_photo` — получение фото
* JWT для авторизации
* Docker-контейнер с Uvicorn

### 3.2 Frontend

* **Caddy**: статика, PWA сервис-воркеры, API proxy (по желанию)
* **React + TypeScript**: SPA-подобное поведение, динамическая загрузка чатов и сообщений
* **PWA**: offline support для последних сообщений и кеширование статических файлов
* **AES-256**: шифрование и дешифровка сообщений и фото на клиенте

---

## 4. Docker & Docker Compose

* Backend контейнер (FastAPI + Uvicorn)
* Frontend контейнер (Caddy + React build)
* PostgreSQL контейнер
* docker-compose.yml должен запускать все сервисы одной командой

---

## 5. MVP Scope

* Регистрация/вход через TOTP + QR-код
* SPA на React/TS с PWA
* Отправка/получение текстовых сообщений и emoji
* Отправка/получение фото
* End-to-end шифрование AES-256
* Docker + Docker Compose

