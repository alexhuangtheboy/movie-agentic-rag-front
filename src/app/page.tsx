"use client";

import { Mail } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  appendStreamingAssistantPlaceholder,
  createMessageId,
  failStreamingAssistant,
  finalizeStreamingAssistant,
  type ChatMessage,
  upsertStreamingAssistant,
} from "@/lib/chat-stream";

type ViewMode = "landing" | "chat";

type ChatApiResponse = {
  task_id?: string;
  thread_id?: string;
  status?: "running" | "completed" | "failed";
  answer?: string | null;
  reasoning?: string | null;
  success?: boolean | null;
  routing?: Record<string, unknown> | null;
  stream?: boolean;
  error?: string;
};

type StreamEvent =
  | { type: "step"; node: string | null; reasoning: string | null }
  | {
      type: "completed";
      answer: string | null;
      reasoning?: string | null;
      success?: boolean | null;
    }
  | { type: "failed"; answer: string | null; reasoning?: string | null };

const FALLBACK_ERROR = "Failed to fetch recommendations. Please try again.";
const SUGGESTED_QUESTIONS = [
  "Tell me 5 movies after 2020 with rating over 9",
  "Tell me movies with plot of hero and action",
  "Tell me who acted in The Loves of Edgar Allan Poe",
];

/** Switch assistant bubble style: "gray" | "cream-ring" | "dark-solid" */
type AssistantBubbleVariant = "gray" | "cream-ring" | "dark-solid";
const ASSISTANT_BUBBLE_VARIANT: AssistantBubbleVariant = "gray";

const ASSISTANT_BUBBLE_CLASS: Record<AssistantBubbleVariant, string> = {
  gray: "chat-bubble-assistant-gray self-start",
  "cream-ring": "chat-bubble-assistant-cream-ring self-start ring-1 ring-neon/40",
  "dark-solid": "chat-bubble-assistant-dark self-start",
};

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4";
const CTA_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_055729_72d66327-b59e-4ae9-bb70-de6ccb5ecdb0.mp4";
const SocialIcon = ({ icon }: { icon: "mail" | "twitter" | "github" }) => {
  if (icon === "mail") {
    return <Mail className="h-5 w-5" strokeWidth={1.7} />;
  }

  if (icon === "twitter") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2.25h3.68l-8.04 9.19L24 21.75h-7.4l-5.8-7.58-6.63 7.58H.49l8.6-9.83L0 2.25h7.58l5.24 6.93 6.08-6.93Zm-1.29 17.68h2.04L6.47 3.98H4.28l13.33 15.95Z" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.14c-3.2.69-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.33.95.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18A10.96 10.96 0 0 1 12 6.03c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.16c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      />
    </svg>
  );
};

export default function Home() {
  const [view, setView] = useState<ViewMode>("landing");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatId] = useState(() => {
    const hasRandomUuid =
      typeof globalThis !== "undefined" &&
      !!globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === "function";
    return hasRandomUuid ? globalThis.crypto.randomUUID() : `chat-${Date.now()}`;
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const goToChat = () => setView("chat");
  const goToLanding = () => {
    setView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (view === "landing") {
    return <OrbisLanding onOpenChat={goToChat} />;
  }

  return (
    <ChatView
      onBackToLanding={goToLanding}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      setIsLoading={setIsLoading}
      chatId={chatId}
      chatHistory={chatHistory}
      setChatHistory={setChatHistory}
    />
  );
}

type ChatViewProps = {
  onBackToLanding: () => void;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  chatId: string;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
};

function formatNodeLabel(node: string | null): string {
  if (!node) {
    return "Agent";
  }
  return node.replace(/_/g, " ");
}

function ChatView({
  onBackToLanding,
  input,
  setInput,
  isLoading,
  setIsLoading,
  chatId,
  chatHistory,
  setChatHistory,
}: ChatViewProps) {
  const chatPanelRef = useRef<HTMLDivElement | null>(null);

  const historyMessages = useMemo(
    () =>
      chatHistory
        .filter((msg) => msg.role !== "system")
        .map((msg) => msg.content)
        .slice(-12),
    [chatHistory],
  );

  useEffect(() => {
    const panel = chatPanelRef.current;
    if (!panel) {
      return;
    }
    panel.scrollTop = panel.scrollHeight;
  }, [chatHistory, isLoading]);

  const submitChatQuery = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || isLoading) {
      return;
    }

    setInput("");
    setIsLoading(true);
    setChatHistory((prev) =>
      appendStreamingAssistantPlaceholder([
        ...prev,
        { id: createMessageId(), role: "user", content: query },
      ]),
    );

    const streamRef: { source: EventSource | null } = { source: null };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          top_k: 5,
          stream: true,
          chat_id: chatId,
          chat_history_messages: [...historyMessages, query],
        }),
      });

      const data: ChatApiResponse = await response.json();

      if (!response.ok || data.status === "failed") {
        const message =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : typeof data.answer === "string" && data.answer.trim()
              ? data.answer
              : FALLBACK_ERROR;
        setChatHistory((prev) => failStreamingAssistant(prev, message));
        return;
      }

      if (data.stream && data.status === "running" && data.task_id) {
        const taskId = data.task_id;

        await new Promise<void>((resolve, reject) => {
          const source = new EventSource(`/api/chat/stream?task_id=${encodeURIComponent(taskId)}`);
          streamRef.source = source;

          source.onmessage = (messageEvent) => {
            try {
              const payload = JSON.parse(messageEvent.data) as StreamEvent;
              if (payload.type === "step") {
                const reasoning = payload.reasoning?.trim();
                if (reasoning) {
                  setChatHistory((prev) =>
                    upsertStreamingAssistant(prev, {
                      content: reasoning,
                      stepLabel: formatNodeLabel(payload.node),
                    }),
                  );
                }
                return;
              }
              if (payload.type === "completed") {
                source.close();
                streamRef.source = null;
                const answer = payload.answer?.trim() ?? "";
                if (answer && payload.success !== false) {
                  setChatHistory((prev) => finalizeStreamingAssistant(prev, { content: answer }));
                } else {
                  setChatHistory((prev) => failStreamingAssistant(prev, FALLBACK_ERROR));
                }
                resolve();
                return;
              }
              if (payload.type === "failed") {
                source.close();
                streamRef.source = null;
                const message = payload.answer?.trim() || payload.reasoning?.trim() || FALLBACK_ERROR;
                setChatHistory((prev) => failStreamingAssistant(prev, message));
                resolve();
              }
            } catch {
              source.close();
              streamRef.source = null;
              reject(new Error("Invalid stream payload"));
            }
          };

          source.onerror = () => {
            source.close();
            streamRef.source = null;
            reject(new Error("Lost connection to progress stream"));
          };
        }).catch(() => {
          setChatHistory((prev) =>
            failStreamingAssistant(
              prev,
              "Lost live progress stream. Ensure Render WEBHOOK_URL is https://movieapex.space/api/movie-webhook and redeploy both services.",
            ),
          );
        });

        return;
      }

      const hasAnswer = typeof data.answer === "string" && data.answer.trim().length > 0;
      const isSuccess = data.status === "completed" && data.success !== false && hasAnswer;

      if (isSuccess) {
        setChatHistory((prev) => finalizeStreamingAssistant(prev, { content: data.answer as string }));
      } else {
        setChatHistory((prev) => failStreamingAssistant(prev, FALLBACK_ERROR));
      }
    } catch {
      setChatHistory((prev) => failStreamingAssistant(prev, FALLBACK_ERROR));
    } finally {
      streamRef.source?.close();
      setIsLoading(false);
    }
  };

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitChatQuery(input);
  };

  const hasConversation = chatHistory.length > 0;
  const characterCount = input.length;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background text-cream">
      <div className="space-texture pointer-events-none fixed inset-0 z-[1] opacity-60" />

      <div className="pointer-events-none absolute inset-x-0 top-0">
        <video
          className="block h-auto w-full"
          src={CTA_VIDEO}
          autoPlay
          loop
          muted
          playsInline
        />
      </div>

      <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-[1831px] flex-col px-4 pb-10 sm:px-8 lg:px-12">

        <nav className="relative z-30 flex items-center justify-between py-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="relative z-30 cursor-pointer font-grotesk text-base uppercase tracking-wide text-cream transition hover:text-neon"
            aria-label="Back to home"
          >
            Apex
          </button>
          <div className="w-[86px]" />
        </nav>

        <section className={`flex w-full flex-1 flex-col items-center ${hasConversation ? "pt-8" : "justify-center -mt-[50px]"}`}>
          {!hasConversation && (
            <>
              <div className="liquid-glass mb-8 inline-flex items-center rounded-full px-2 py-2">
                <div className="mr-2 inline-flex items-center gap-1 rounded-full bg-neon px-3 py-1 text-xs text-black">
                  <span>★</span>
                  <span>New</span>
                </div>
                <span className="pr-2 font-mono text-[14px] text-cream/90">Discover what&apos;s possible</span>
              </div>

              <h1 className="text-center font-grotesk text-4xl uppercase leading-none text-cream sm:text-5xl md:text-[64px]">
                Apex
              </h1>
              <p className="mt-5 w-full max-w-[736px] text-center font-mono text-base text-cream/70 sm:text-lg">
                Ask for personalized movie recommendations from one intelligent workspace.
              </p>

              <div className="mt-8 grid w-full max-w-[860px] gap-3 sm:grid-cols-3">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void submitChatQuery(question)}
                    disabled={isLoading}
                    className="liquid-glass rounded-2xl px-4 py-4 text-left font-medium text-cream/90 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-neon focus:outline-none focus:ring-2 focus:ring-neon/60 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ fontFamily: "var(--font-noto-sans)" }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </>
          )}

          {hasConversation && (
            <div
              ref={chatPanelRef}
              className="chat-panel mb-6 flex max-h-[min(60vh,520px)] w-full max-w-[860px] flex-col gap-4 overflow-y-auto rounded-2xl p-4 sm:p-5"
            >
              {chatHistory.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] sm:text-base ${
                    message.role === "user"
                      ? "self-end bg-neon font-medium text-black shadow-[0_4px_16px_rgba(111,255,0,0.25)]"
                      : message.role === "assistant"
                        ? `${ASSISTANT_BUBBLE_CLASS[ASSISTANT_BUBBLE_VARIANT]}${message.phase === "streaming" ? " animate-pulse" : ""}`
                        : "self-center bg-red-950/80 font-medium text-red-100 backdrop-blur-sm"
                  }`}
                  style={{ fontFamily: "var(--font-noto-sans)" }}
                  aria-live={message.phase === "streaming" ? "polite" : undefined}
                >
                  {message.role === "assistant" && message.phase === "streaming" && message.stepLabel ? (
                    <span className="mb-2 block font-mono text-[11px] uppercase tracking-wide text-cream/55">
                      {message.stepLabel}
                    </span>
                  ) : null}
                  {message.content}
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={handleChatSubmit}
            className="liquid-glass w-full max-w-[728px] rounded-[18px] p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between text-cream">
              <div className="inline-flex items-center gap-2">
                <span className="font-mono text-xs text-cream/80">60/450 credits</span>
                <button
                  type="button"
                  className="rounded-md bg-neon px-2 py-1 text-xs font-semibold text-black"
                >
                  Upgrade
                </button>
              </div>
              <div className="inline-flex items-center gap-1 font-mono text-xs text-cream/80">
                <span>⚙</span>
                <span>Powered by GPT-4o</span>
              </div>
            </div>

            <div className="flex h-[120px] w-full items-end justify-between gap-3 rounded-xl bg-cream/95 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.25)]">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 3000))}
                placeholder="Type question..."
                className="h-full w-full border-none bg-transparent text-base text-black outline-none placeholder:text-[rgba(0,0,0,0.6)]"
                style={{ fontFamily: "var(--font-noto-sans)" }}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Submit question"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="text-sm">↑</span>
                )}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <div className="font-mono text-xs text-cream/50">{characterCount}/3,000</div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function OrbisLanding({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-cream">
      <div className="space-texture pointer-events-none fixed inset-0 z-50 opacity-60" />

      <section className="relative min-h-screen overflow-hidden rounded-b-[32px]">
        <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO} autoPlay loop muted playsInline />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1831px] flex-col px-5 py-6 sm:px-8 lg:px-12">
          <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 sm:top-28 lg:top-32">
            <button
              type="button"
              onClick={onOpenChat}
              className="rounded-full bg-cream px-9 py-4 font-grotesk text-base uppercase tracking-[0.08em] text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:bg-neon hover:shadow-[0_22px_60px_rgba(111,255,0,0.28)] sm:px-12 sm:text-lg"
            >
              Start Now
            </button>
          </div>

          <div className="relative flex flex-1 items-center">
            <div className="relative max-w-[780px] lg:ml-32">
              <h1 className="font-grotesk text-[40px] leading-[1.05] uppercase sm:text-[60px] md:text-[75px] md:leading-none lg:text-[90px]">
                Beyond earth
                <br />
                and ( its ) familiar boundaries
              </h1>
              <div className="mt-8 flex justify-center gap-3 lg:hidden">
                {["mail", "twitter", "github"].map((icon) => (
                  <button key={icon} type="button" className="liquid-glass flex h-14 w-14 items-center justify-center rounded-[1rem] transition hover:bg-white/10">
                    <SocialIcon icon={icon as "mail" | "twitter" | "github"} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute right-12 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
            {["mail", "twitter", "github"].map((icon) => (
              <button key={icon} type="button" className="liquid-glass flex h-14 w-14 items-center justify-center rounded-[1rem] transition hover:bg-white/10">
                <SocialIcon icon={icon as "mail" | "twitter" | "github"} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
