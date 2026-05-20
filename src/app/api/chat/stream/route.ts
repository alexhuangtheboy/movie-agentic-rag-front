import { subscribeWebhookEvents, type WebhookEventPayload } from "@/lib/webhook-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_TIMEOUT_MS = Number(process.env.CHAT_STREAM_TIMEOUT_MS ?? "120000");

function sseLine(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Browser subscribes with ?task_id=... after POST /api/chat returns a running task.
 */
export async function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("task_id")?.trim();
  if (!taskId) {
    return new Response("task_id query parameter is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const send = (payload: Record<string, unknown>) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(sseLine(payload)));
      };

      const onEvent = (event: WebhookEventPayload) => {
        if (event.status === "running") {
          send({
            type: "step",
            task_id: event.task_id,
            node: event.node ?? null,
            reasoning: event.reasoning ?? null,
          });
          return;
        }

        if (event.status === "completed") {
          send({
            type: "completed",
            task_id: event.task_id,
            answer: event.answer ?? null,
            reasoning: event.reasoning ?? null,
            success: event.success ?? null,
            routing: event.routing ?? null,
            node: event.node ?? null,
          });
          close();
          return;
        }

        if (event.status === "failed") {
          send({
            type: "failed",
            task_id: event.task_id,
            answer: event.answer ?? null,
            reasoning: event.reasoning ?? null,
          });
          close();
        }
      };

      unsubscribe = subscribeWebhookEvents(taskId, onEvent);

      const timeout = setTimeout(() => {
        send({
          type: "failed",
          task_id: taskId,
          answer: "Stream timed out waiting for the movie agent.",
        });
        close();
      }, STREAM_TIMEOUT_MS);

      const onAbort = () => {
        clearTimeout(timeout);
        close();
      };

      request.signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
