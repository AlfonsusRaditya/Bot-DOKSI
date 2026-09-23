# Discord Twitter/X Media Forwarder

Bot Discord berbasis Node.js dan Discord.js v14 untuk meneruskan semua media dari tweet Twitter/X melalui API fxtwitter, tanpa menyimpan file ke disk.

## Fitur

- Command prefix: `!dl <url>`
- Mendukung `twitter.com`, `x.com`, `fixupx.com`, dan `fxtwitter.com`
- Mengambil metadata tweet melalui `https://api.fxtwitter.com/status/{tweet_id}`
- Mengunduh media langsung ke memory sebagai `Buffer` menggunakan `axios`
- Mengirim foto, video, dan GIF menggunakan `AttachmentBuilder`
- Maksimal 10 attachment per pesan Discord; jika media lebih dari 10, bot mengirim beberapa pesan
- Menolak file di atas 25 MB dan menampilkan URL media langsung
- Tidak menggunakan `yt-dlp`, tidak membuat folder `temp/`, dan tidak menyimpan file ke disk

## Persyaratan

- Node.js 18 atau lebih baru
- npm
- Bot Discord dengan `Message Content Intent` aktif di Discord Developer Portal

## Instalasi

```bash
npm install
```

## Setup `.env`

Salin `.env.example` menjadi `.env`, kemudian isi token bot Discord:

```env
BOT_TOKEN=token_bot_discord_anda
PREFIX=!
```

Jangan membagikan token bot dan jangan commit file `.env` ke repository.

## Menjalankan bot

```bash
npm start
```

Untuk mode development:

```bash
npm run dev
```

Contoh command di Discord:

```text
!dl https://twitter.com/username/status/123456789
```

Bot akan menampilkan embed status, mengambil tweet dari API fxtwitter, mengirim media sebagai attachment, lalu menghapus pesan loading dan command asli jika permission Discord mengizinkan.
