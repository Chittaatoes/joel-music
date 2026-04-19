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
- 2026-03-18: **Equipment Feature Complete** — admin UI service checkboxes for equipment assignment, booking page equipment selection with checkboxes, payment/invoice show equipment details, landing page "Fasilitas Studio" now shows DB equipment + static facilities, "Drum Set" renamed to "Drum Electric"
- 2026-03-18: Admin Services Management — full CRUD UI at /admin/services (add/edit/delete/toggle visibility)
- 2026-03-18: Dynamic pricing — services table in DB, pricing tiers (JSONB), server-side calculatePrice
- 2026-03-18: Booking page, booking form, and landing page now fetch services from /api/services dynamically
- 2026-03-18: Price changes in admin propagate to booking page, price list on landing, and booking calculations
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
- `/admin/services` - Service management (add/edit/delete/toggle visibility, configure pricing tiers)

### API Endpoints
- `GET /api/services` - Get active services (public)
- `GET /api/admin/equipment` - Get all equipment (public; no auth needed for booking page)
- `GET /bookings/schedule/:date` - Get bookings by date (public)
- `POST /bookings` - Create booking with optional selectedEquipmentIds (public)
- `POST /bookings/status` - Get booking statuses by IDs (public)
- `GET /api/admin/services` - All services including hidden (auth)
- `POST /api/admin/services` - Create service (auth)
- `PATCH /api/admin/services/:id` - Update service/pricing/visibility (auth)
- `DELETE /api/admin/services/:id` - Delete service (auth)
- `POST /api/admin/equipment` - Create equipment with serviceKeys array (auth)
- `PATCH /api/admin/equipment/:id` - Update equipment and service assignment (auth)
- `DELETE /api/admin/equipment/:id` - Delete equipment (auth)
- `GET /admin/bookings/all` - All bookings (auth)
- `GET /admin/bookings/:date` - Bookings by date (auth)
- `PATCH /admin/bookings/:id/status` - Update status (auth)
- `POST /admin/bookings/:id/approve` - Approve, generate invoice PDF, return WhatsApp URL (auth)
- `POST /admin/bookings/:id/reject` - Reject, return WhatsApp URL (auth)
- `DELETE /admin/bookings/:id` - Delete booking permanently (auth)
- `GET /admin/costs/:date` - Daily costs (auth)
- `POST /admin/costs` - Add cost (auth)
- `PATCH /admin/costs/:id` - Update cost entry (auth)
- `DELETE /admin/costs/:id` - Delete cost entry (auth)

## Business Logic
- Pricing: Managed in `services` DB table. Admin can set price per hour, fixed price, and special pricing tiers per duration (e.g., 3 jam = 190K flat). Server recalculates total on booking creation using DB prices.
- Equipment: Additional equipment table with service-specific availability. Admin assigns equipment to services via serviceKeys checkboxes. Equipment shows on booking form based on selected service. Prices added to total: durasi × price_per_hour per item selected.
- Default services seeded: Rehearsal (65K/jam, 3jam=190K), Karaoke (55K/jam, 2jam=100K), Live Record (100K/jam), Cover Lagu (500K fixed)
- Default equipment: Keyboard (Rp 10K/jam) available for Rehearsal service
- Pricing tiers: JSONB array `[{ hours: number, price: number }]` — tier match takes priority over pricePerHour × durasi
- isFixedPrice: services like Cover Lagu return fixedPrice regardless of duration
- Keyboard: Now managed as equipment (legacy hardcoded surcharge still applies for backward compatibility)
- Equipment pricing: For selected equipment, total += durasi × equipment.price_per_hour for each item
- Payment timer: 10 minutes to complete payment on booking form
- Operating hours: Senin-Jumat 09:00-23:00 (14 slots), Sabtu-Minggu 09:00-00:00 (15 slots)
- Service types: rehearsal, karaoke, live_recording, cover_lagu
- Cover Lagu: 500K flat rate, single slot only (durasi=1), include video, description: "tuning vocal & mixing"
- Package discounts: rehearsal 3jam = 190K, karaoke 2jam = 100K (auto-applied)
- Booking ID: YYMMDD-XX format (e.g., 260302-01); generated server-side, sequential per date
- Anti-double booking: slots with pending/confirmed status cannot be booked
- WhatsApp redirect: after booking success, auto-opens WhatsApp with formatted message including Booking ID, details, payment info
- Admin approval flow: Approve generates invoice PDF (pdfkit) showing all charges and equipment -> saves to /invoices/ -> opens WhatsApp to customer with confirmation + invoice link. Reject opens WhatsApp with rejection message.
- Profit = Pendapatan (confirmed bookings) - Cost (manual input)
- WhatsApp: +62 899-1601-137 (admin)
- Instagram: @joel_musicstudio
- Address: Kp. Bencongan Rt.00/Rw.001 No.256, Kab. Tangerang, Kelapa Dua
- Facilities: Landing page "Fasilitas Studio" now shows static facilities + all active equipment from DB

## Database Tables
- `bookings` - id, nama_band, jumlah_person, no_wa, jenis_layanan, tanggal, jam_mulai, durasi, total, status, payment_method, bukti_transfer, with_keyboard, selected_equipment_ids (JSONB string[]), booking_id (YYMMDD-XX format), invoice_url, invoice_pdf (base64 text — auto-deleted after 7 days)
- `daily_cost` - id, tanggal, cost, keterangan
- `admins` - id (uuid), username (unique), password_hash (bcrypt), created_at
- `sessions` - express-session storage
- `services` - id (uuid), key (unique), name, description, is_active, is_fixed_price, fixed_price, price_per_hour, pricing_tiers (JSONB `[{hours, price}]`), note, sort_order
- `additional_equipment` - id (uuid), name, price_per_hour, service_keys (JSONB string[] array of service keys like "rehearsal"), is_active, sort_order

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
