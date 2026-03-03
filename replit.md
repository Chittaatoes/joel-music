# Joel Music Studio - Booking Online Web App

## Overview
Web application for online music studio booking with live schedule, QRIS manual payment, WhatsApp confirmation, admin profit dashboard, and equipment rental catalog.

## Monorepo Structure (Deployment-Ready)
Project is structured as a monorepo with separate `client/` and `server/` packages for independent deployment:
- **Frontend** (`client/`): Deployable to Vercel — has own `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- **Backend** (`server/`): Deployable to Render — has own `package.json`, `tsconfig.json`, `drizzle.config.ts`
- **Shared** (`shared/`): Shared types/schema used by both packages
- **Dev mode**: `server/index.ts` conditionally loads Vite dev middleware (`server/vite.ts`) when `NODE_ENV=development`; in production, server is API-only
- **Assets**: Images in `client/public/images/` (logo.png, qris.png); referenced as `/images/...` in frontend code
- **PostCSS/Tailwind**: Configured inline in `client/vite.config.ts` (no separate postcss.config.js); Tailwind config uses absolute paths via `import.meta.url` for content scanning

## Environment Variables
### Server
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Express session secret
- `CLIENT_URL` — Frontend URL for CORS (production only)
- `SERVER_URL` — Backend URL prefix for invoice URLs (production only)
- `PORT` — Server port (default 5000)
- `NODE_ENV` — `development` or `production`

### Client
- `VITE_API_URL` — Backend API URL (production only; empty in dev for same-origin)

## Build & Deploy
- **Server build**: Uses `tsup` (esbuild-based) to bundle server into `server/dist/index.js`. Resolves `@shared/*` path aliases. Config: `server/tsup.config.ts`
- **Client build**: Standard Vite build → `client/dist/`. SPA routing via `client/vercel.json` rewrites.
- **Deployment guide**: See `DEPLOY.md` for full Supabase + Render + Vercel deployment instructions.

## Recent Changes
- 2026-03-03: Added tsup build config for server production builds (replaces broken `tsc` build)
- 2026-03-03: Added vercel.json for SPA routing on Vercel
- 2026-03-03: Created DEPLOY.md with full deployment guide (Indonesian)
- 2026-03-03: Admin logout now redirects to /admin login page; embedded login form removed from AdminLayout
- 2026-03-03: Delete booking now actually removes from DB (was soft-delete); optimistic UI removal with rollback on error
- 2026-03-03: Admin pages (dashboard, payments, layout) lazy-loaded with React.lazy for faster public page loads
- 2026-03-03: Full cost/pengeluaran CRUD: add, edit, delete with API endpoints PATCH/DELETE /api/admin/costs/:id
- 2026-03-03: Cost endpoints have admin auth guards and input validation
- 2026-03-03: Fixed Tailwind CSS not generating utility classes — content paths now use absolute resolution via `import.meta.url` in `client/tailwind.config.ts`
- 2026-03-03: PostCSS config moved inline to `client/vite.config.ts` with explicit tailwind config path
- 2026-03-03: Monorepo refactor complete — separate client/server packages with own configs
- 2026-02-13: Full feature set implemented (see Business Logic section)

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI + Wouter routing
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Custom username/password with bcrypt hashing + express-session

## Key Routes
### User Routes
- `/` - Landing page (studio info, jam operasional, fasilitas, lokasi, ketentuan)
- `/booking` - Calendar + time slot selection (horizontal weekly strip)
- `/booking/form` - Booking form with service type -> QRIS payment -> WhatsApp confirmation
- `/history` - Booking history (stored in localStorage, shows all past bookings with details)
- `/sewa` - Equipment rental catalog

### Admin Routes (requires auth)
- `/admin` - Admin login page
- `/admin/dashboard` - Dashboard (summary cards, cost management, booking details with layanan)
- `/admin/payments` - Payment verification (approve/reject, shows layanan)

### API Endpoints
- `GET /api/bookings/schedule/:date` - Get bookings by date (public)
- `POST /api/bookings` - Create booking with jenisLayanan + paymentMethod (public)
- `GET /api/bookings/status` - Get booking statuses by IDs (public, for history sync)
- `DELETE /api/admin/bookings/:id` - Delete booking permanently (auth)
- `PATCH /api/admin/costs/:id` - Update cost entry (auth)
- `DELETE /api/admin/costs/:id` - Delete cost entry (auth)
- `GET /api/admin/bookings/all` - All bookings (auth)
- `GET /api/admin/bookings/:date` - Bookings by date (auth)
- `PATCH /api/admin/bookings/:id/status` - Update status (auth)
- `POST /api/admin/bookings/:id/approve` - Approve booking, generate invoice PDF, return WhatsApp URL (auth)
- `POST /api/admin/bookings/:id/reject` - Reject booking, return WhatsApp URL (auth)
- `GET /api/admin/costs/:date` - Daily costs (auth)
- `POST /api/admin/costs` - Add cost (auth)

## Business Logic
- Pricing: Rehearsal 65K/jam (3jam=190K), Karaoke 55K/jam (2jam=100K), Live Record 100K/jam (80K promo Ramadan), Cover Lagu 500K (include video)
- Live Record Ramadan promo: isRamadan() helper checks date against hardcoded Ramadan periods (2026: Feb 17–Mar 19, 2027: Feb 7–Mar 9, 2028: Jan 27–Feb 26); auto-reverts to 100K after Ramadan
- Payment timer: 10 minutes to complete payment on booking form
- Operating hours: Senin-Jumat 09:00-23:00 (14 slots), Sabtu-Minggu 09:00-00:00 (15 slots)
- Service types: rehearsal, karaoke, live_recording, cover_lagu
- Cover Lagu: 500K flat rate, single slot only (durasi=1), include video, description: "tuning vocal & mixing"
- Package discounts: rehearsal 3jam = 190K, karaoke 2jam = 100K (auto-applied)
- Booking ID: YYMMDD-XX format (e.g., 260302-01); generated server-side, sequential per date
- Anti-double booking: slots with pending/confirmed status cannot be booked
- WhatsApp redirect: after booking success, auto-opens WhatsApp with formatted message including Booking ID, details, payment info
- Admin approval flow: Approve generates invoice PDF (pdfkit) -> saves to /invoices/ -> opens WhatsApp to customer with confirmation + invoice link. Reject opens WhatsApp with rejection message.
- Profit = Pendapatan (confirmed bookings) - Cost (manual input)
- WhatsApp: +62 899-1601-137 (admin)
- Instagram: @joel_musicstudio
- Address: Kp. Bencongan Rt.00/Rw.001 No.256, Kab. Tangerang, Kelapa Dua

## Database Tables
- `bookings` - id, nama_band, jumlah_person, no_wa, jenis_layanan, tanggal, jam_mulai, durasi, total, status, payment_method, bukti_transfer, booking_id (YYMMDD-XX format), invoice_url
- `daily_cost` - id, tanggal, cost, keterangan
- `admins` - id (uuid), username (unique), password_hash (bcrypt), created_at
- `sessions` - express-session storage

## Auth Details
- Admin login: POST /api/admin/login (uses `admins` table with bcrypt)
- Session check: GET /api/admin/me
- Logout: POST /api/admin/logout
- Admin credentials: username=admin, password=Joelmusicstudio26 hashed with bcrypt (saltRounds=10)
- Seed runs on every startup (upsert, checks & updates password if changed)
- Admin login page has "Simpan username & password" checkbox; saves to localStorage only when checked

## User Preferences
- Language: Indonesian (Bahasa Indonesia)
- Theme: Dark theme with cyan/teal primary (HSL 187 80% 42-48%) and gold accent (HSL 45 85% 55%)
- Branding: Joel Music Studio & Recording
