export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  phase?: "streaming" | "final";
  stepLabel?: string | null;
};

export function createMessageId(): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function findStreamingAssistantIndex(history: ChatMessage[]): number {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role === "assistant" && message.phase === "streaming") {
      return index;
    }
  }
  return -1;
}

export function appendStreamingAssistantPlaceholder(history: ChatMessage[]): ChatMessage[] {
  return [
    ...history,
    {
      id: createMessageId(),
      role: "assistant",
      content: "Thinking…",
      phase: "streaming",
      stepLabel: null,
    },
  ];
}

export function upsertStreamingAssistant(
  history: ChatMessage[],
  update: { content: string; stepLabel?: string | null },
): ChatMessage[] {
  const index = findStreamingAssistantIndex(history);
  if (index < 0) {
    return [
      ...history,
      {
        id: createMessageId(),
        role: "assistant",
        content: update.content,
        phase: "streaming",
        stepLabel: update.stepLabel ?? null,
      },
    ];
  }

  const next = [...history];
  const current = next[index];
  next[index] = {
    ...current,
    content: update.content,
    phase: "streaming",
    stepLabel: update.stepLabel ?? current.stepLabel ?? null,
  };
  return next;
}

export function finalizeStreamingAssistant(
  history: ChatMessage[],
  update: { content: string },
): ChatMessage[] {
  const index = findStreamingAssistantIndex(history);
  if (index < 0) {
    return [
      ...history,
      {
        id: createMessageId(),
        role: "assistant",
        content: update.content,
        phase: "final",
      },
    ];
  }

  const next = [...history];
  next[index] = {
    ...next[index],
    role: "assistant",
    content: update.content,
    phase: "final",
    stepLabel: undefined,
  };
  return next;
}

export function failStreamingAssistant(history: ChatMessage[], message: string): ChatMessage[] {
  const index = findStreamingAssistantIndex(history);
  if (index < 0) {
    return [
      ...history,
      {
        id: createMessageId(),
        role: "system",
        content: message,
      },
    ];
  }

  const next = [...history];
  next[index] = {
    ...next[index],
    role: "system",
    content: message,
    phase: undefined,
    stepLabel: undefined,
  };
  return next;
}
