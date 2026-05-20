import { NextResponse } from "next/server";

import { publishWebhookEvent, type WebhookEventPayload } from "@/lib/webhook-hub";

function isWebhookPayload(value: unknown): value is WebhookEventPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.task_id === "string" &&
    (record.status === "running" || record.status === "completed" || record.status === "failed")
  );
}

/**
 * Receives POST callbacks from movie-agentic-rag when WEBHOOK_URL points here.
 * Configure on Render: WEBHOOK_URL=https://movieapex.space/api/movie-webhook
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const provided = request.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!isWebhookPayload(body)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook payload" }, { status: 400 });
  }

  publishWebhookEvent(body);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Movie webhook receiver. Backend should POST JSON updates here.",
  });
}
