<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1b2bd58e-ce5d-46f0-b992-bdb833fdcf10

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
4. (Optional) Run the seed script to populate sample data from the dashboard via the "Simulate" button or hitting the `POST /api/v1/seed` endpoint.

### 2. Run the App

1. Install dependencies:
   ```bash
   bun install
   ```
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
