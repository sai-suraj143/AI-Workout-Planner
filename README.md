# AI Workout Planner (AdaptiveFit)

Full-stack app: React + Vite client, Express + Mongoose server, AI workout-plan generation (Gemini).

## Prerequisites

- Node.js 20+ (verified on Node 22)
- A MongoDB database (local or Atlas connection string)

## Configuration

`server/.env` is required (copy from `server/.env.example`):

```
PORT=5000
MONGODB_URI=<your mongodb connection string>
JWT_SECRET=<any long random string>
GEMINI_API_KEY=<gemini api key>          # only needed for plan generation
GEMINI_MODEL=gemini-3.8-flash
CLIENT_URL=http://localhost:5173
```

`CLIENT_URL` must match the exact origin you open in the browser — CORS is locked to it.

The client needs no `.env`; without `VITE_API_URL` it calls `http://localhost:5000/api`.

## Running the project

Two terminals. **Both must be running** — the login/register error
"An unexpected error occurred. Please try again." means the API process is not up.

**Terminal 1 — API server (port 5000):**

```bash
cd server
npm install        # first time only
npm run dev        # tsc -> dist, then node dist/server.js
```

**Terminal 2 — web app (port 5173):**

```bash
cd client
npm install        # first time only
npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1` — CORS allows only
`http://localhost:5173`).

### Available server scripts

| Script | What it does |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Build, then run `dist/server.js` |
| `npm start` | Run the already-built `dist/server.js` |

> Note: `ts-node-dev` (installed but unusable) crashes with this project's
> TypeScript 7 — use `npm run dev` instead.

## Verify it works

```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"AI Workout Planner API is running",...}
```

## Scripts (client)

```bash
npm run dev     # Vite dev server on 5173
npm run build   # tsc -b && vite build
npm run lint    # oxlint
```
