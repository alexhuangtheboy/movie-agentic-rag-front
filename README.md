# Movie Apex Frontend

Next.js chat UI for [movie-agentic-rag](https://github.com) with **webhook-driven agent progress**.

## Webhook flow

1. Browser `POST /api/chat` with `stream: true` → backend returns `{ task_id, status: "running" }`.
2. Browser opens `EventSource` on `/api/chat/stream?task_id=...`.
3. Render backend pushes steps to `POST /api/movie-webhook` (configure on the API service):

   ```env
   WEBHOOK_URL=https://movieapex.space/api/movie-webhook
   ```

4. Webhook handler fans out events to the SSE subscriber; the UI shows **Agent progress** (node + reasoning) then the final answer.

## Environment

Copy `.env.example` to `.env.local`:

```bash
MOVIE_BACKEND_URL=https://movie-agentic-rag.onrender.com/movie/query
```

Optional `WEBHOOK_SECRET` — if set, the movie backend must send the same value in header `X-Webhook-Secret` (add on the API if you extend it).

## Local development

```bash
npm install
npm run dev
```

For local end-to-end webhook testing, expose the Next app (e.g. `ngrok http 3000`) and set Render `WEBHOOK_URL` to `https://<tunnel>/api/movie-webhook`.

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Start query (`stream: true` by default) |
| `/api/chat/stream` | GET | SSE progress for `task_id` |
| `/api/movie-webhook` | POST | Receives backend webhook callbacks |

## Deploy (Vercel)

Set `MOVIE_BACKEND_URL` in project settings. On Render, set `WEBHOOK_URL` to `https://<your-domain>/api/movie-webhook` and redeploy the backend.

**Note:** Progress uses an in-memory hub on the Next.js server. It works on a single instance; for multi-region/serverless you may need Redis or similar later.
