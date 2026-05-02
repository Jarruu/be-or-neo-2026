<p align="center">
  <a href="https://neotelemetri.id/" target="blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Neo Telemetri Logo" />
  </a>
</p>

<h1 align="center">Open Recruitment Neo Telemetri 2026 API</h1>

<p align="center">
  Repositori ini berisi sistem backend untuk mengelola seluruh siklus rekrutmen terbuka Neo Telemetri 2026.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node Version" />
  <img src="https://img.shields.io/badge/nestjs-11.x-red" alt="NestJS Version" />
  <img src="https://img.shields.io/badge/prisma-7.x-0c344b" alt="Prisma Version" />
  <img src="https://img.shields.io/badge/database-PostgreSQL-blue" alt="Database" />
</p>

---

## 📋 Ringkasan Fitur

Sistem ini dirancang untuk menangani berbagai modul fungsional rekrutmen:

- **🔐 Autentikasi & Otorisasi**: Implementasi JWT dengan *Role-Based Access Control* (RBAC) untuk memisahkan hak akses antara Admin dan User.
- **👤 Manajemen Profil**: Pengelolaan data akademik, data pribadi, dan preferensi sub-divisi pendaftar.
- **📊 Dasbor Progres**: Pelacakan tahapan rekrutmen secara *real-time* untuk setiap pengguna.
- **📅 Manajemen Timeline**: Pengaturan jadwal kegiatan rekrutmen yang dinamis.
- **📚 Modul Pembelajaran & Tugas**: Distribusi materi belajar dan pengelolaan pengumpulan tugas berbasis sub-divisi.
- **📝 Sistem Ujian Online**: Ujian berbasis waktu dengan fitur *auto-grading* untuk efisiensi penilaian.
- **💳 Integrasi Pembayaran**: Pemrosesan biaya pendaftaran secara otomatis menggunakan **Midtrans Snap API**.
- **🕒 Sistem Absensi**: Pencatatan kehadiran kegiatan menggunakan mekanisme QR Code dan *passcode*.
- **✅ Verifikasi Dokumen**: Alur kerja administrasi untuk meninjau dan memverifikasi berkas pendaftar.

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Media Storage**: [Cloudinary](https://cloudinary.com/)
- **Payment Gateway**: [Midtrans](https://midtrans.com/)
- **Documentation**: [Swagger / OpenAPI](https://swagger.io/)

---

## 🚀 Panduan Instalasi

### Prasyarat
- Node.js >= 18.x
- pnpm >= 8.x
- Instance PostgreSQL yang aktif

### 1. Instalasi Dependensi
```bash
$ git clone https://github.com/neo-telemetri/be-or-neo-2026.git
$ cd be-or-neo-2026
$ pnpm install
```

### 2. Konfigurasi Environment
Salin file `.env.example` menjadi `.env` dan lengkapi variabel berikut:
- `DATABASE_URL`
- `JWT_SECRET`
- `CLOUDINARY_*` (untuk penyimpanan file)
- `MIDTRANS_*` (untuk integrasi pembayaran)

### 3. Setup Database
```bash
# Jalankan migrasi database
$ npx prisma migrate dev

# Masukkan data awal (seeding)
$ npx prisma db seed
```

---

## 🏃 Menjalankan Aplikasi

```bash
# Mode pengembangan (watch mode)
$ pnpm run start:dev

# Produksi
$ pnpm run build
$ pnpm run start:prod
```

Setelah aplikasi berjalan, dokumentasi API dapat diakses melalui:
👉 **`http://localhost:3000/docs`**

---

## 🧪 Pengujian

```bash
# Unit tests
$ pnpm run test

# End-to-end (E2E) tests
$ pnpm run test:e2e

# Test coverage
$ pnpm run test:cov
```

---

## 📁 Struktur Proyek

```text
src/
├── common/           # Decorators, guards, pipes, dan service global (Prisma, Storage)
├── modules/          # Domain fitur (Auth, Profile, Exam, Payment, dsb.)
├── app.module.ts     # Root module aplikasi
└── main.ts           # Entry point aplikasi
```

---

## 🤝 Kontribusi

Proyek ini dikembangkan secara internal oleh **Tim IT Neo Telemetri**. Laporan *bug* dan saran fitur dapat disampaikan melalui sistem internal organisasi.

---

<p align="center">
  Developed by <b>Neo Telemetri IT Team</b>
</p>
