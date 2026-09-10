# Coal Restaurant - Waitlist System

Real-time queuing and live guest tracking system for Coal Restaurant.

## 🛠 Tech Stack
- React 19, TypeScript, Tailwind CSS v4, Vite
- Node.js, Express, Socket.IO
- Prisma ORM + PostgreSQL

## 🚀 Getting Started

### 1. Database Setup
This project uses a PostgreSQL database. You must provide a valid `DATABASE_URL` in a `.env` file before running the application.

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set `DATABASE_URL` to your PostgreSQL instance. (If you don't have Postgres locally, you can create a free cloud database at Neon.tech or Supabase).
3. Sync the schema to your database:
   ```bash
   bunx prisma db push
   ```

### 2. Run the App

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm run dev
   ```
