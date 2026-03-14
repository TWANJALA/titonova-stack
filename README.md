# Titonova Stack

Local run instructions:

1. Full stack

```bash
# Install dependencies once:
cd api && npm install
cd ../studio && npm install
cd ..

# Start both services together from the repo root:
npm run dev
```

This starts the API on `http://localhost:3001` and the frontend on the Vite dev URL printed in the terminal.

2. API only

```bash
cd api
npm install
# (optional) export OPENAI_API_KEY="sk-..."
node server.js
```

API runs on `http://localhost:3001` by default.

3. Frontend only

```bash
cd studio
npm install
npm run dev
```

Open the app at the Vite URL printed by Vite (for example `http://localhost:5173/`).

Notes:
- The frontend reads `VITE_API_URL` at build time. If not provided it will default to `http://localhost:3001` in development.
- `studio/` is a nested git repository. The root repo contains the API and project scaffolding.
