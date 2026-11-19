# 🌿 White Garden — Curating Moments (وايت قاردن)
### Real-Time Multi-Branch Waiting List & Concierge Platform

A production-grade, bilingual waiting list, live guest ticket tracking, and hostess front-desk management system built specifically for **White Garden** (`https://whitegarden.co/`) across all **5 Riyadh locations**:

1. **Olaya (العليا)** – Flagship / Prince Sultan St
2. **Riyadh Roshn (واجهة روشن)** – Front Mall, Northern Promenade
3. **60 Avenue (٦٠ افنيو)** – Salah Al-Din / King Abdul Aziz
4. **The View (ذا فيو)** – Cenomi The View Mall
5. **Ammariayh (العمارية)** – Scenic Valley & Luxury Garden Sanctuary

---

## 🛠 Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons, Leaflet (interactive Riyadh branch map).
- **Backend**: Node.js, Express, Socket.IO (instant live synchronization across customer phones and hostess tablets).
- **Database**: PostgreSQL with Prisma ORM (with automatic in-memory fallback for instant zero-dependency testing).
- **Localization**: Full English (LTR) & Arabic (RTL) toggle.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(If you do not specify a PostgreSQL `DATABASE_URL`, the application automatically runs in standalone memory mode with full Socket.IO functionality).*

### 3. Run the Application
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
- **Join Waitlist Form**: `/join`
- **Interactive Branch Map**: `/map`
- **Live Guest Ticket Pass**: `/ticket`
- **Hostess Reception Desk**: `/hostess`

---

## ☁️ Deployment Guide (Option C)

### 1. Deploy on Render (Recommended)
This repository includes a pre-configured `render.yaml` Blueprint with free PostgreSQL and native WebSockets:
1. Push your code to GitHub.
2. In [Render.com](https://render.com), click **New +** ➔ **Blueprint**.
3. Connect your repository. Render will automatically provision:
   - A Node.js web service running `npm run build` and `npm start`.
   - A managed PostgreSQL database.

### 2. Deploy on Railway
1. In [Railway.app](https://railway.app), click **New Project** ➔ **Deploy from GitHub repo**.
2. Add a **PostgreSQL** plugin from the Railway dashboard.
3. Railway automatically detects the start command (`node dist/server.cjs`) and port `3000`.

### 3. Custom Subdomain (`waitlist.whitegarden.co`)
To connect this system to White Garden's official domain:
1. Go to your DNS provider (e.g., Hostinger / Cloudflare).
2. Add a **CNAME record**:
   - **Host / Name**: `waitlist` (or `queue`)
   - **Target / Value**: your Render or Railway app URL (e.g., `white-garden-waitlist.onrender.com`).
3. Add the custom domain in your hosting dashboard with free SSL.
4. On `whitegarden.co`, point the *"Reservation / قائمة الانتظار"* navigation button to `https://waitlist.whitegarden.co`.
