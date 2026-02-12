# Руководство по развертыванию (Production)

Это руководство описывает процесс развертывания Secure Drop на Linux-сервере (VPS) с использованием Docker Compose и автоматического HTTPS через Caddy.

## Предварительные требования

1.  **Сервер**: VPS с Ubuntu 20.04/22.04 LTS (или другой Linux).
2.  **Домен**: Зарегистрированный домен (например, `secure-drop.com`), A-запись которого указывает на IP вашего сервера.
3.  **Порты**: Свободные порты 80 и 443. (Если у вас запущен nginx/apache на хосте, их нужно остановить или настроить проксирование).
4.  **Установленный Docker**: [Инструкция по установке](https://docs.docker.com/engine/install/ubuntu/).

---

## 1. Подготовка сервера

Подключитесь к серверу по SSH и установите Docker и Docker Compose, если они еще не установлены.

```bash
# Проверка установки
docker --version
docker compose version
```

**Важно:** Убедитесь, что порты 80 и 443 свободны.
```bash
sudo lsof -i :80
sudo lsof -i :443
# Если заняты (например, системным nginx), остановите их:
sudo systemctl stop nginx
sudo systemctl disable nginx
```

---

## 2. Установка приложения

Клонируйте репозиторий в нужную директорию (например, `/opt/secure_drop` или `~/secure_drop`).

```bash
git clone https://github.com/yourusername/secure_drop.git
cd secure_drop
```

---

## 3. Настройка окружения (.env)

Создайте файл `.env` из примера.

```bash
cp .env.example .env
nano .env
```

**Отредактируйте ключевые параметры:**

| Параметр | Значение | Описание |
| :--- | :--- | :--- |
| `POSTGRES_PASSWORD` | `ваш_супер_пароль` | Пароль базы данных. Придумайте сложный. |
| `SECRET_KEY` | `длинная_случайная_строка` | Ключ для подписи JWT токенов. |
| `ENVIRONMENT` | `production` | Режим работы. |
| `SITE_ADDRESS` | `https://ваш-домен.com` | Адрес, на котором будет доступен сайт (Caddy использует его для SSL). |
| `ALLOW_ORIGINS` | `https://ваш-домен.com` | CORS настройки (тот же адрес). |

**Пример .env:**
```ini
POSTGRES_USER=secure_drop_user
POSTGRES_PASSWORD=CorrectHorseBatteryStaple
POSTGRES_DB=secure_drop_db
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql+asyncpg://secure_drop_user:CorrectHorseBatteryStaple@db:5432/secure_drop_db
SECRET_KEY=GeneratingSuperSecretKey123!
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ENVIRONMENT=production
ALLOW_ORIGINS=https://secure-drop.com
SITE_ADDRESS=https://secure-drop.com
```

---

## 4. Запуск

Запустите контейнеры в фоновом режиме. Сборка (`--build`) гарантирует применение последних изменений кода.

```bash
docker compose up -d --build
```

**Что произойдет:**
1.  Запустятся сервисы: `db` (Postgres), `redis`, `backend`, `frontend`, `caddy`.
2.  Caddy автоматически запросит SSL-сертификат у Let's Encrypt для вашего домена (указанного в `SITE_ADDRESS`).

---

## 5. Проверка работы

1.  **Статус контейнеров:**
    ```bash
    docker compose ps
    ```
    Все 5 контейнеров должны иметь статус `Up`.

2.  **Логи Caddy (SSL):**
    Если сайт не открывается, проверьте логи веб-сервера:
    ```bash
    docker compose logs -f caddy
    ```
    Вы должны увидеть успешное получение сертификата (`Certificate obtained successfully`).

3.  **Доступ:**
    Откройте `https://ваш-домен.com` в браузере. Вы должны увидеть экран входа Secure Drop.

---

## 6. Обновление

Чтобы обновить приложение после внесения изменений в код:

```bash
# 1. Скачать изменения
git pull

# 2. Пересобрать и перезапустить контейнеры
docker compose up -d --build
```
(Время простоя составит несколько секунд при перезапуске).

---

## 7. Безопасность

*   **База данных:** Порт 5432 не проброшен наружу (доступен только внутри Docker сети).
*   **Redis:** Порт 6379 также закрыт от внешнего мира.
*   **SSL:** Caddy автоматически обновляет сертификаты (за 30 дней до истечения).
*   **Logs:** Рекомендуется настроить ротацию логов Docker, чтобы не забить диск.
