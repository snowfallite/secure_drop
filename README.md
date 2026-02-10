# Secure Drop Messenger

Secure Drop is a secure, E2E encrypted messaging application designed for privacy and anonymity. It features a modern, glassmorphism-inspired UI and works as a Progressive Web App (PWA).

![Secure Drop](https://via.placeholder.com/800x400?text=Secure+Drop+Screenshot)

## Key Features

-   **End-to-End Encryption**: Messages are encrypted on the client side using robust cryptographic standards. The server never sees the plain text.
-   **Anonymous**: No phone number or email required. Just a username and password.
-   **Real-time**: Instant message delivery, read receipts, and online status updates.
-   **PWA Support**: Installable on mobile and desktop devices.
-   **Modern UI**: Sleek, dark-themed interface with glassmorphism effects.
-   **Secure Media**: Share images seamlessly.

## Tech Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS
-   **Backend**: Python, FastAPI, SQLAlchemy
-   **Database**: PostgreSQL
-   **Real-time/Cache**: Redis
-   **Containerization**: Docker & Docker Compose

## Quick Start (Local Development)

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/secure_drop.git
    cd secure_drop
    ```

2.  **Start with Docker Compose**:
    ```bash
    docker compose up --build
    ```

3.  **Access the application**:
    -   Frontend: [http://localhost:3000](http://localhost:3000) (or port 80 depending on config)
    -   Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

## Project Structure

-   `/backend`: FastAPI application, models, and API routers.
-   `/front`: React frontend application.
-   `/docker-compose.yml`: Orchestration for DB, Redis, Backend, and Frontend.

## License

MIT
