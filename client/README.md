# LetzTalk Frontend

Modern React frontend for the LetzTalk backend API + Socket.IO server.

## Features

- Register, login, and guest access
- Protected match dashboard
- Real-time random matching via Socket.IO
- WebRTC audio/video call handshake
- Safety actions: report and block endpoints

## Environment

Create `.env` from `.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run lint
npm run build
```
