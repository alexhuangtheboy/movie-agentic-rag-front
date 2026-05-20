/**
 * In-process pub/sub for movie-agent webhook events keyed by task_id.
 * Works on a single Node instance (local dev, single-region deploy).
 * Late SSE subscribers receive buffered events from the current run.
 */

export type WebhookEventPayload = {
  task_id: string;
  thread_id?: string | null;
  status: "running" | "completed" | "failed";
  answer?: string | null;
  reasoning?: string | null;
  success?: boolean | null;
  node?: string | null;
  routing?: Record<string, unknown> | null;
};

type Listener = (payload: WebhookEventPayload) => void;

type TaskBuffer = {
  events: WebhookEventPayload[];
  listeners: Set<Listener>;
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;

function getStore(): Map<string, TaskBuffer> {
  const key = "__movieWebhookHub__";
  const g = globalThis as typeof globalThis & { [key: string]: Map<string, TaskBuffer> | undefined };
  if (!g[key]) {
    g[key] = new Map();
  }
  return g[key];
}

function pruneExpired(store: Map<string, TaskBuffer>) {
  const now = Date.now();
  for (const [taskId, buffer] of store.entries()) {
    if (buffer.expiresAt <= now) {
      store.delete(taskId);
    }
  }
}

export function publishWebhookEvent(payload: WebhookEventPayload): void {
  const store = getStore();
  pruneExpired(store);

  const taskId = payload.task_id;
  let buffer = store.get(taskId);
  if (!buffer) {
    buffer = {
      events: [],
      listeners: new Set(),
      expiresAt: Date.now() + TTL_MS,
    };
    store.set(taskId, buffer);
  }

  buffer.expiresAt = Date.now() + TTL_MS;
  buffer.events.push(payload);

  for (const listener of buffer.listeners) {
    listener(payload);
  }
}

export function subscribeWebhookEvents(
  taskId: string,
  listener: Listener,
): () => void {
  const store = getStore();
  pruneExpired(store);

  let buffer = store.get(taskId);
  if (!buffer) {
    buffer = {
      events: [],
      listeners: new Set(),
      expiresAt: Date.now() + TTL_MS,
    };
    store.set(taskId, buffer);
  }

  for (const event of buffer.events) {
    listener(event);
  }

  buffer.listeners.add(listener);

  return () => {
    buffer?.listeners.delete(listener);
  };
}
