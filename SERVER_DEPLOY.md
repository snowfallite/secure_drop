# Server Deployment Guide (Specific)

Since you already have Caddy, Xray, and Postgres running on your server, here is how to deploy Secure Drop without conflicts.

## 1. Updated `docker-compose.yml`
I have updated `docker-compose.yml` to:
-   Bind ports only to `127.0.0.1` (localhost) so they don't conflict with your external interfaces.
-   Move Postgres to port `5433` (internal mapping) to avoid conflict with your existing Postgres on `5432`.
-   Expose Frontend on `127.0.0.1:3000` and Backend on `127.0.0.1:8000`.

## 2. Prepare Domain
You need a domain for the chat. For example: `your-domain`.
Ensure this domain points to your server IP (A record).

## 3. Update Caddyfile
Add the following block to your `/etc/caddy/Caddyfile`.

**Important**: Since you use `listener_wrappers { proxy_protocol }`, your Caddy expects traffic via Xray/Proxy. Ensure Xray sends traffic for this new domain to Caddy.

```caddy
# Add this block to your Caddyfile
https://your-domain {
  # Forward frontend requests to Docker container
  reverse_proxy 127.0.0.1:3000

  # Forward API requests to Backend container
  handle /api/* {
    # Remove /api prefix if your backend doesn't expect it, 
    # BUT your backend routers have prefixes /auth, /users.
    # The frontend calls /auth..., not /api/auth... usually.
    # If your frontend is built to call /auth, /users directly:
    reverse_proxy 127.0.0.1:8000
  }
  
  # Forward specific backend paths if not using /api prefix logic above:
  handle /auth/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /users/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /chats/* {
    reverse_proxy 127.0.0.1:8000
  }

  log {
    output file /var/lib/caddy/secure_drop_access.log
  }
}
```

**Alternative (Simpler)**:
If your backend routes are at root (`/auth`, `/chats`), just matching paths is easiest:

```caddy
https://your-domain {
  # Backend endpoints
  reverse_proxy /auth/* 127.0.0.1:8000
  reverse_proxy /users/* 127.0.0.1:8000
  reverse_proxy /chats/* 127.0.0.1:8000
  reverse_proxy /docs* 127.0.0.1:8000
  reverse_proxy /openapi.json* 127.0.0.1:8000

  # Frontend (Catch-all for SPA)
  reverse_proxy * 127.0.0.1:3000
}
```

## 4. Deploy
1.  Upload the project to your server.
2.  Set up `.env` (copy `.env.example`).
3.  Set `ALLOW_ORIGINS=https://your-domain` in `.env`.
4.  Run:
    ```bash
    docker compose up --build -d
    ```
5.  Reload Caddy:
    ```bash
    systemctl reload caddy
    ```
