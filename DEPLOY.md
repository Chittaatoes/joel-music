# Panduan Deploy Joel Music Studio

Panduan lengkap untuk deploy aplikasi ke:
- **Frontend** → Vercel
- **Backend** → Render
- **Database** → Supabase (PostgreSQL)

---

## Struktur Project

```
joel-music-studio/
├── client/                    # Frontend (React + Vite)
│   ├── public/
│   │   ├── favicon.png
│   │   └── images/
│   │       ├── hero-studio.png
│   │       ├── logo.png
│   │       ├── qris.png
│   │       └── studio-hero.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin-layout.tsx
│   │   │   └── ui/            # Shadcn UI components
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-mobile.tsx
│   │   │   └── use-toast.ts
│   │   ├── lib/
│   │   │   ├── queryClient.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── admin-dashboard.tsx
│   │   │   ├── admin-login.tsx
│   │   │   ├── admin-payments.tsx
│   │   │   ├── booking-form.tsx
│   │   │   ├── booking.tsx
│   │   │   ├── history.tsx
│   │   │   ├── landing.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── sewa.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── .env.example
│   ├── components.json
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── vercel.json
│   └── vite.config.ts
│
├── server/                    # Backend (Express.js)
│   ├── dist/                  # Hasil build (otomatis)
│   ├── auth.ts
│   ├── db.ts
│   ├── drizzle.config.ts
│   ├── index.ts
│   ├── routes.ts
│   ├── seed.ts
│   ├── storage.ts
│   ├── vite.ts                # Dev only (tidak dipakai di production)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── tsup.config.ts
│
├── shared/                    # Schema bersama (dipakai FE & BE)
│   └── schema.ts
│
└── public/
    └── invoices/              # Invoice PDF (otomatis dibuat)
```

---

## Langkah 1: Setup Database (Supabase)

### 1.1 Buat Project Supabase
1. Buka [supabase.com](https://supabase.com) dan login/daftar
2. Klik **"New Project"**
3. Isi nama project (misal: `joel-music-studio`)
4. Pilih region **Southeast Asia (Singapore)** untuk latency terbaik
5. Buat password database yang kuat, **simpan password ini**
6. Klik **"Create new project"** dan tunggu sampai selesai

### 1.2 Ambil Connection String
1. Di dashboard Supabase, buka **Settings → Database**
2. Scroll ke bagian **"Connection string"**
3. Pilih tab **"URI"**
4. Copy connection string, formatnya seperti ini:
   ```
   postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
5. Ganti `[PASSWORD]` dengan password yang kamu buat tadi

### 1.3 Buat Tabel Database
1. Di komputer lokal, clone repo project
2. Masuk ke folder `server/`:
   ```bash
   cd server
   npm install
   ```
3. Buat file `.env` di folder `server/` (copy dari `.env.example`):
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` dan isi `DATABASE_URL` dengan connection string Supabase:
   ```
   DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
5. Jalankan perintah untuk membuat tabel:
   ```bash
   npm run db:push
   ```
6. Jika berhasil, akan muncul pesan bahwa tabel sudah dibuat

---

## Langkah 2: Deploy Backend (Render)

### 2.1 Push Code ke GitHub
1. Buat repository baru di GitHub
2. Push seluruh code project ke repository tersebut

### 2.2 Buat Web Service di Render
1. Buka [render.com](https://render.com) dan login/daftar
2. Klik **"New +"** → **"Web Service"**
3. Connect dengan GitHub dan pilih repository project kamu
4. Isi pengaturan berikut:

| Pengaturan | Nilai |
|---|---|
| **Name** | `joel-music-studio-api` (atau nama lain) |
| **Region** | Singapore (Southeast Asia) |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Instance Type** | Free (atau sesuai kebutuhan) |

### 2.3 Tambahkan Environment Variables
Di halaman pengaturan Render, masuk ke tab **"Environment"** dan tambahkan:

| Key | Value | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.xxxx:...` | Connection string dari Supabase (langkah 1.2) |
| `SESSION_SECRET` | `buat-string-random-panjang-32-karakter` | Secret untuk session login admin |
| `CLIENT_URL` | `https://nama-project.vercel.app` | URL frontend di Vercel (isi setelah deploy Vercel) |
| `SERVER_URL` | `https://joel-music-studio-api.onrender.com` | URL backend Render sendiri (otomatis dari Render) |
| `NODE_ENV` | `production` | Wajib diisi `production` |
| `PORT` | `10000` | Render biasanya pakai port 10000 |

5. Klik **"Create Web Service"**
6. Tunggu build selesai, catat URL backend (misal: `https://joel-music-studio-api.onrender.com`)

---

## Langkah 3: Deploy Frontend (Vercel)

### 3.1 Import Project di Vercel
1. Buka [vercel.com](https://vercel.com) dan login/daftar
2. Klik **"Add New..."** → **"Project"**
3. Import repository GitHub yang sama
4. Isi pengaturan berikut:

| Pengaturan | Nilai |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `client` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 3.2 Tambahkan Environment Variables
Di halaman pengaturan Vercel, tambahkan:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://joel-music-studio-api.onrender.com` |

> Ganti dengan URL backend Render kamu yang sebenarnya dari langkah 2.

### 3.3 Deploy
1. Klik **"Deploy"**
2. Tunggu build selesai
3. Catat URL frontend (misal: `https://nama-project.vercel.app`)

### 3.4 Update CLIENT_URL di Render
1. Kembali ke dashboard Render
2. Masuk ke pengaturan Web Service → Environment
3. Update nilai `CLIENT_URL` dengan URL Vercel yang sebenarnya:
   ```
   CLIENT_URL=https://nama-project.vercel.app
   ```
4. Render akan otomatis redeploy

---

## Langkah 4: Verifikasi

### Checklist
- [ ] Buka URL Vercel → halaman utama tampil dengan benar
- [ ] Coba booking → form muncul, data terkirim
- [ ] Buka `/admin` → halaman login admin tampil
- [ ] Login admin → dashboard tampil dengan data
- [ ] Approve/reject booking → status berubah
- [ ] Invoice PDF bisa didownload

---

## Referensi Environment Variables

### Frontend (`client/.env`)
```env
VITE_API_URL=https://nama-backend.onrender.com
```

### Backend (`server/.env`)
```env
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
SESSION_SECRET=string-random-minimal-32-karakter
CLIENT_URL=https://nama-project.vercel.app
SERVER_URL=https://nama-backend.onrender.com
NODE_ENV=production
PORT=10000
```

---

## Troubleshooting

### Frontend tidak bisa connect ke backend
- Pastikan `VITE_API_URL` di Vercel sudah benar (tanpa trailing slash `/`)
- Pastikan `CLIENT_URL` di Render sudah diisi URL Vercel yang benar
- Cek apakah backend Render sudah running (bukan sleeping)

### Admin login gagal
- Pastikan `SESSION_SECRET` sudah diisi di Render
- Pastikan `NODE_ENV=production` sudah diset
- Cookie membutuhkan HTTPS — pastikan kedua URL menggunakan `https://`

### Database error
- Pastikan `DATABASE_URL` dari Supabase sudah benar
- Cek apakah tabel sudah dibuat (jalankan `npm run db:push` lagi)
- Pastikan password database tidak mengandung karakter spesial yang perlu di-encode

### Invoice PDF tidak muncul
- Invoice PDF disimpan di `public/invoices/` di server Render
- Pastikan `SERVER_URL` di Render sudah benar agar URL invoice mengarah ke backend

### Render free tier — server sleep
- Render free tier akan men-sleep server setelah 15 menit tidak ada aktivitas
- Request pertama setelah sleep akan lambat (30-60 detik) karena cold start
- Upgrade ke paid plan untuk menghindari ini

### Build gagal di Render
- Pastikan **Root Directory** diset ke `server`
- Pastikan **Build Command** adalah `npm install && npm run build`
- Cek log build di Render dashboard untuk detail error

### Build gagal di Vercel
- Pastikan **Root Directory** diset ke `client`
- Pastikan **Framework Preset** diset ke `Vite`
- Pastikan `VITE_API_URL` sudah ditambahkan sebagai environment variable
