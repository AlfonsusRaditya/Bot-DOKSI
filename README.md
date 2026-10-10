# Discord Twitter/X Media Forwarder

Node.js + Discord.js v14 bot that forwards all media from a Twitter/X tweet via the fxtwitter API, without saving files to disk.

## Features

- Prefix command: `!dl <url>`
- Supports `twitter.com`, `x.com`, `fixupx.com`, and `fxtwitter.com`
- Fetches tweet metadata via `https://api.fxtwitter.com/status/{tweet_id}`
- Fast size pre-check via `HEAD content-length` before downloading the body
- Fail-fast parallel media download with `AbortController`; remaining downloads are canceled once one file fails
- Sends photos, videos, and GIFs with `AttachmentBuilder`
- Up to 10 attachments per Discord message; sends multiple messages when there are more
- Files over 20 MB fall back to a `fixupx.com` link instead of an upload
- No `yt-dlp`, no `temp/` folder, no disk writes

## Requirements

- Node.js 18 or newer
- npm
- Discord bot with `Message Content Intent` enabled in the Discord Developer Portal
- Bot permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Manage Messages` (the last one is used to remove the loading reply and the original command)

## Install

```bash
npm install
```

## Configure `.env`

Copy `.env.example` to `.env`, then set the bot token:

```env
BOT_TOKEN=your_discord_bot_token
PREFIX=!
```

Do not share the token and do not commit `.env`.

## Run

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Example command in Discord:

```text
!dl https://twitter.com/username/status/123456789
```

The bot replies with a loading message, fetches the tweet, sends the media as attachments with a status embed, then deletes the loading reply and the original command when permissions allow. If any file exceeds 20 MB, it sends a `fixupx.com` link fallback instead.

## Notes

- Only one instance must run per token. Running two copies (for example local + VPS, or `src/` + `dist/`) causes duplicate replies.
- Large or slow media can still take several seconds: total wait time is determined by the slowest download plus the Discord upload.
