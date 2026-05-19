import { NextResponse } from "next/server";

const BACKEND_URL = "https://movie-agentic-rag.onrender.com/movie/query";
const REQUEST_TIMEOUT_MS = 60_000;

type ClientPayload = {
  query?: string;
  top_k?: number;
  stream?: boolean;
  chat_id?: string;
  chat_history_messages?: string[];
  user_id?: string;
};

type BackendResponse = {
  task_id?: string;
  thread_id?: string | null;
  status?: "running" | "completed" | "failed";
  answer?: string | null;
  reasoning?: string | null;
  success?: boolean | null;
  routing?: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  let payload: ClientPayload;
  try {
    payload = (await request.json()) as ClientPayload;
  } catch {
    return NextResponse.json({ status: "failed", error: "Invalid JSON payload." }, { status: 400 });
  }

  const query = payload.query?.trim();
  if (!query) {
    return NextResponse.json({ status: "failed", error: "query is required." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const topKInput = typeof payload.top_k === "number" ? payload.top_k : 5;
  const topK = Math.max(1, Math.min(20, Math.floor(topKInput)));
  const history = Array.isArray(payload.chat_history_messages)
    ? payload.chat_history_messages.filter((entry): entry is string => typeof entry === "string")
    : [];

  try {
    const upstream = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        top_k: topK,
        stream: false,
        chat_id: payload.chat_id ?? null,
        user_id: payload.user_id ?? null,
        chat_history_messages: history,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    let result: BackendResponse | null = null;
    try {
      result = (await upstream.json()) as BackendResponse;
    } catch {
      return NextResponse.json(
        {
          status: "failed",
          error: "Backend returned a non-JSON response.",
        },
        { status: 502 },
      );
    }

    const normalized = {
      task_id: result.task_id ?? null,
      thread_id: result.thread_id ?? null,
      status: result.status ?? "failed",
      answer: result.answer ?? null,
      reasoning: result.reasoning ?? null,
      success: result.success ?? null,
      routing: result.routing ?? null,
      error: !upstream.ok ? result.answer ?? "Upstream request failed." : undefined,
    };

    return NextResponse.json(normalized, { status: upstream.status });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        status: "failed",
        error: isTimeout ? "Request to movie backend timed out." : "Unable to connect to movie backend.",
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
