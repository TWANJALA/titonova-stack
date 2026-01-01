# Titonova Stack

Local run instructions:

1. API

```bash
cd api
npm install
# (optional) export OPENAI_API_KEY="sk-..."
node server.js
```

API runs on http://localhost:3001 by default.

2. Frontend

```bash
cd studio
npm install
npm run dev
```

Open the app at the Vite URL (for example http://localhost:5176/).

Notes:
- The frontend reads `VITE_API_URL` at build time. If not provided it will default to `http://localhost:3001` in development.
- `studio/` is a nested git repository. The root repo contains the API and project scaffolding.
