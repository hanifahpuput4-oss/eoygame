# llysSmart (Let's Learn Your Skills)

Platform game edukasi multiplayer 2D berbasis web untuk guru dan siswa di dalam kelas. Guru dapat mengelola kelas, mata pelajaran, tujuan pembelajaran, import soal pilihan ganda dengan cepat, membuka ruang pertandingan multiplayer, dan mengunduh rekap nilai akhir siswa dalam format CSV/Excel.

---

## Fitur Utama

### 1. Arena Game Multiplayer 2D
- **Realtime Movement & Bubble Chat**: Pergerakan pemain tersinkronisasi halus antar pemain (interpolasi 60 FPS) lengkap dengan bubble chat di atas kepala karakter dan ruang obrolan yang dapat di-minimize.
- **Player Stacking (Gendong-gendongan)**: Pemain dapat melompat dan berdiri di atas kepala pemain lain untuk memanjat ke platform tinggi bersama-sama.
- **Kotak Soal Random (`?`)**:
  - Jumlah kotak `?` otomatis mengikuti jumlah soal pada Tujuan Pembelajaran ruang tersebut.
  - Sebaran posisi kotak diacak per pemain agar setiap siswa mencari dan memecahkan tantangannya sendiri.
  - Saat kotak `?` diinjak atau disundul, soal langsung muncul.
  - Kotak berubah menjadi **Hijau (`✔`)** jika dijawab benar, atau **Merah (`✖`)** jika dijawab salah.
- **Rintangan & Dunia Luas**: Peti kayu bertingkat, trampolin (*bounce pad*), rintangan duri, pulau melayang, atap dan menara jam gedung sekolah yang bisa dipanjat, serta gerbang benteng berantai (*Coming Soon*).
- **UI Draggable & Ramah Mobile**: Seluruh panel (`Leaderboard`, `Chat Room`, `Pemain`, `Misi`, `Tantangan Soal`) bisa digeser (*drag*) dan diperkecil menjadi tombol ikon sehingga kontrol layar sentuh tidak terhalang.

### 2. Dashboard Guru
- **Kelas Saya**: Buat kelas dengan kode join 6 karakter dan klik kartu kelas untuk melihat daftar siswa yang terdaftar.
- **Manajemen Mapel & Tujuan Pembelajaran**:
  - Tambah Mata Pelajaran beserta tingkat kelasnya.
  - Tambah beberapa Tujuan Pembelajaran (Kategori Soal) di dalam satu mata pelajaran.
  - Input soal manual atau gunakan **Import Soal Cepat (CSV/TXT)** lengkap dengan tombol *Download Template Dummy CSV*.
- **Ruang Game & Rekap Nilai**:
  - Buat ruang game hanya dengan memilih **Kelas -> Mata Pelajaran -> Tujuan Pembelajaran**.
  - Siswa hanya bisa masuk setelah guru menekan **Mulai Game** (guru tetap bisa masuk lebih dulu untuk simulasi).
  - Fitur **Kick Pemain** dan **Akhiri Game** langsung dari dalam game maupun dashboard.
  - Saat game diakhiri, seluruh pemain otomatis keluar ke dashboard dan tabel **Rekap Nilai Akhir (Skala 0-100)** langsung tersedia untuk diunduh ke CSV/Excel.
- **Pengaturan Akun**: Ubah nama lengkap, username game, warna avatar karakter, dan ganti password.

### 3. Dashboard Siswa
- Gabung ke kelas menggunakan kode kelas dari guru.
- Masuk ke ruang game aktif menggunakan kode ruang 6 karakter.
- Pengaturan profil, username, warna avatar kucing, dan ganti password.

---

## Teknologi

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, HTML5 Canvas 2D Engine
- **Backend**: Next.js Route Handlers (REST API), Service-based MVC Architecture
- **Database**: Turso (libSQL / SQLite) + Drizzle ORM
- **Autentikasi**: Session berbasis HTTP-only Cookie + hashing password `scrypt`
- **Realtime**: Ably Realtime + HTTP Polling Fallback (kompatibel penuh dengan deployment serverless Vercel)

---

## Cara Menjalankan secara Lokal

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Siapkan environment variables**:
   Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Untuk database lokal SQLite, isi `DATABASE_URL=file:local.db` di `.env`.

3. **Jalankan migrasi / push skema database**:
   ```bash
   npx drizzle-kit push
   ```

4. **Jalankan server development**:
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` di browser.

---

## Format Import Soal (CSV)

Gunakan pemisah titik koma (`;`) dengan kolom berikut:

```csv
Pertanyaan;Opsi A;Opsi B;Opsi C;Opsi D;Kunci;Poin;Pembahasan
Manakah fungsi Excel untuk menjumlahkan rentang angka?;VLOOKUP;SUM;AVERAGE;COUNT;B;10;SUM digunakan untuk menjumlahkan seluruh angka pada rentang sel.
Fungsi untuk mencari nilai rata-rata di Microsoft Excel adalah?;MAX;MIN;AVERAGE;IF;C;10;AVERAGE menghitung rata-rata aritmatika dari argumen.
```
