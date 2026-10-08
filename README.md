# AI Workout Planner (AdaptiveFit)

Full-stack app: React + Vite client, Express + Mongoose server, AI workout-plan generation with Gemini.

## Architecture

- Frontend: Vercel
- Backend API: Render
- Database: MongoDB Atlas
- AI: Gemini API

## Prerequisites

- Node.js 20+
- MongoDB Atlas connection string or a running MongoDB instance
- Gemini API key
- Vercel app URL for the frontend

## Environment variables

Create the required local environment files before running the app:

### Frontend

`client/.env.example`

```env
VITE_API_URL=http://localhost:5000/api
```

### Backend

`server/.env.example`

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=
JWT_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
CLIENT_URL=http://localhost:5173
```

Do not commit real secrets. Keep `.env` files local and ignore them in git.

## Local development

Two terminals must be running for the app to work.

### Terminal 1 — API server

```bash
cd server
npm install
cp .env.example .env
# fill in your local values
npm run dev
```

### Terminal 2 — frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173` in the browser.

## Production deployment notes

### Frontend (Vercel)

- Set the Vercel project to the `client` directory.
- Set `VITE_API_URL` to the Render backend URL, for example:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

- Add a SPA rewrite in Vercel for client-side routes such as `/planner`, `/history`, and `/workout/:id`.

### Backend (Render)

- Set the Render build command to `npm install --include=dev && npm run build`
- Set the start command to `npm start`
- Configure the environment variables in Render:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
CLIENT_URL=https://YOUR-VERCEL-APP.vercel.app
```

### Database and AI

- MongoDB Atlas should be used for the production database.
- Gemini API is server-side only; never call it from the frontend.

## Production verification

```bash
cd client && npm run build
cd ../server && npm run build
```

The backend health endpoint should respond on:

```bash
curl http://localhost:5000/api/health
```

## Scripts

### Client

```bash
npm run dev
npm run build
npm run lint
```

### Server

```bash
npm run build
npm start
```
