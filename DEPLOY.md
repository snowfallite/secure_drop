# Deployment Guide

This guide describes how to deploy Secure Drop to a Linux server (e.g., Ubuntu/Debian) using Docker Compose.

## Prerequisites

-   A Linux server (VPS) with a public IP.
-   Domain name configured (A record pointing to your server IP).
-   [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

## Step 1: Clone the Repository

SSH into your server and clone the project:

```bash
git clone https://github.com/yourusername/secure_drop.git
cd secure_drop
```

## Step 2: Configure Environment Variables

1.  **Copy the example configuration**:
    ```bash
    cp .env.example .env
    ```

2.  **Edit the `.env` file**:
    ```bash
    nano .env
    ```

    **Critical Settings to Change:**
    -   `POSTGRES_PASSWORD`: Set a strong database password.
    -   `SECRET_KEY`: Generate a long, random string (e.g., `openssl rand -hex 32`).
    -   `ENVIRONMENT`: Set to `production`.
    -   `ALLOW_ORIGINS`: Set to your domain (e.g., `https://chat.yourdomain.com`).
    -   `DATABASE_URL`: Update the password inside this connection string to match `POSTGRES_PASSWORD`.

## Step 3: Build and Run

Run the following command to build and start the containers in detached mode:

```bash
docker compose up --build -d
```

## Step 4: Configure Reverse Proxy (Nginx)

Ideally, you should run a reverse proxy (like Nginx) on the host to handle SSL (HTTPS) and forward traffic to the Docker container.

1.  **Install Nginx**: `sudo apt install nginx`
2.  **Install Certbot**: `sudo apt install certbot python3-certbot-nginx`
3.  **Configure Nginx Site**: `sudo nano /etc/nginx/sites-available/secure_drop`

    ```nginx
    server {
        server_name chat.yourdomain.com;

        location / {
            proxy_pass http://localhost:80; # Points to frontend container
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/ {
            # If you serve frontend/backend on same domain, you might need rewriting
            # or serve backend on api.yourdomain.com
            # This example assumes frontend handles routing or uses relative paths
        }
    }
    ```
    *Note: The simplest setup is to expose the frontend on port 80/443 and let it proxy API requests, OR serve the backend on a subdomain (e.g., `api.yourdomain.com`) and update `VITE_API_URL`.*

4.  **Enable Site**: `sudo ln -s /etc/nginx/sites-available/secure_drop /etc/nginx/sites-enabled/`
5.  **Obtain SSL**: `sudo certbot --nginx -d chat.yourdomain.com`

## Troubleshooting

-   **Check Logs**:
    ```bash
    docker compose logs -f backend
    ```
-   **Database Access**:
    ```bash
    docker exec -it secure_drop-db-1 psql -U secure_drop_user secure_drop_db
    ```
