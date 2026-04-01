"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, RotateCcw } from "lucide-react";
import { cn } from "@/utils/cn";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What devices are low on stock right now?",
  "What's our revenue this month?",
  "Which devices are selling the most?",
  "Are there any pending transfers?",
  "What are our active alerts?",
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your inventory assistant. I can answer questions about stock levels, sales, transfers, forecasts, and alerts. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    setInput("");
    setError(null);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Request failed");

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.answer },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, I encountered an error: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi! I'm your inventory assistant. I can answer questions about stock levels, sales, transfers, forecasts, and alerts. What would you like to know?",
      },
    ]);
    setError(null);
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-surface-900">Inventory Assistant</p>
            <p className="text-xs text-surface-400">Powered by GPT-4o mini</p>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-500 hover:bg-surface-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" && "flex-row-reverse"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
                msg.role === "assistant"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-surface-800 text-white"
              )}
            >
              {msg.role === "assistant" ? (
                <Bot className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "assistant"
                  ? "bg-surface-50 text-surface-800 rounded-tl-sm"
                  : "bg-brand-700 text-white rounded-tr-sm"
              )}
            >
              {msg.content.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i < msg.content.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-surface-50 px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <div className="h-2 w-2 rounded-full bg-surface-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-surface-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-surface-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions — only when just the welcome message */}
      {messages.length === 1 && (
        <div className="border-t border-surface-100 px-6 py-3">
          <p className="mb-2 text-xs font-medium text-surface-400">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs text-surface-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-surface-100 px-4 py-3">
        <div className="flex items-end gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 focus-within:border-brand-300 focus-within:bg-white transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about inventory, sales, transfers…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-surface-300">
          Answers are based on live system data · Press Enter to send
        </p>
      </div>
    </div>
  );
}
