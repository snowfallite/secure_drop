# Server Deployment Guide (Containerized Caddy)

We have containerized Caddy, so it now runs inside Docker Compose alongside the app.

## ⚠ Important Pre-requisite
**You must STOP the Caddy running on your host machine** to avoid port conflicts (80/443).

```bash
systemctl stop caddy
systemctl disable caddy  # Optional: prevent it from starting on boot
```

## 1. Environment Setup

1.  **Clone/Update Project**: Ensure you have the latest `docker-compose.yml` and `Caddyfile`.
2.  **Environment Variables**: Create or update `.env` file:
    ```bash
    cp .env.example .env
    nano .env
    ```
    *   Set `ALLOW_ORIGINS=https://domen`
    *   Set `SITE_ADDRESS=https://domen` (or `:80` for local dev)
    *   Set `POSTGRES_PASSWORD`, `SECRET_KEY`, etc.

## 2. Deployment

Run the entire stack (Database, Redis, Backend, Frontend, Caddy) with one command:

```bash
docker-compose down  # Stop old containers if any
docker-compose up -d --build
```

## 3. Verification

Check if all containers are running:

```bash
docker-compose ps
```

You should see 5 containers: `db`, `redis`, `backend`, `frontend`, `caddy`.

## 4. Logs

To check Caddy logs (for SSL certificate issuance, etc.):

```bash
docker-compose logs -f caddy
```

## 5. Security Note regarding E2EE
Currently, the application **DOES NOT** implement End-to-End Encryption. Messages are stored in plain text.
**Do not use for sensitive communications until E2EE is implemented.**
