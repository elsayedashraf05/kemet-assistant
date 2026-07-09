import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Database, MessageSquare, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { onAskAI } from "../lib/askAI";
import { API_BASE_URL } from "../lib/api";

const API_BASE = API_BASE_URL;

type Message = {
  role: "user" | "assistant";
  content: string;
  direction?: "ltr" | "rtl";
};

type Mode = "Chat" | "Web Search" | "Data";
type Model = "Flash" | "Flash Lite";

// نفس مفاتيح sessionStorage بتاعة AIChat.tsx القديمة - عشان لو المستخدم
// كان مستخدم صفحة /chat قبل كدا، محادثته القديمة تفضل شغالة هنا كمان.
const STORAGE_KEY_MESSAGES = "kemet_chat_messages";
const STORAGE_KEY_MODE = "kemet_chat_mode";
const STORAGE_KEY_MODEL = "kemet_chat_model";
const STORAGE_KEY_OPEN = "kemet_chat_bubble_open";

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Welcome! I'm Kemet, your AI guide to Egypt. Ask me about trip planning, hotels, safety, or monuments.",
  direction: "ltr",
};

function loadStoredMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function loadStoredValue<T extends string>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return (raw as T) || fallback;
  } catch {
    return fallback;
  }
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-[#EBD9A6]">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc mb-2 pl-5 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal mb-2 pl-5 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#C9A84C] underline hover:text-[#EBD9A6]">
      {children}
    </a>
  ),
  code: ({ children }: any) => <code className="bg-black/30 rounded px-1 py-0.5 text-xs">{children}</code>,
  h1: ({ children }: any) => <h1 className="text-base font-bold mb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
};

const MODE_OPTIONS: { value: Mode; icon: typeof MessageSquare; desc: string }[] = [
  { value: "Chat", icon: MessageSquare, desc: "General AI chat about Egypt tourism" },
  { value: "Data", icon: Database, desc: "Answers based on KEMET's own data files" },
];

async function sendMessage(message: string, mode: Mode, model: Model) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, mode, model }),
  });
  if (!res.ok) throw new Error("Failed to reach KEMET AI.");
  return res.json() as Promise<{
    reply: string;
    direction: "ltr" | "rtl";
    mode: Mode;
    model: Model;
    error_code: string | null;
  }>;
}

export function ChatBubble() {
  const [open, setOpen] = useState(() => loadStoredValue(STORAGE_KEY_OPEN, "") === "1");
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>(() => {
    const stored = loadStoredValue<Mode>(STORAGE_KEY_MODE, "Chat");
    return stored === "Web Search" ? "Chat" : stored;
  });
  const [model, setModel] = useState<Model>(() => loadStoredValue<Model>(STORAGE_KEY_MODEL, "Flash"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MODEL, model);
    } catch {
      /* ignore */
    }
  }, [model]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_OPEN, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const runSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendMessage(trimmed, mode, model);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, direction: data.direction }]);
    } catch {
      setError("Couldn't reach KEMET AI. Please try again.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong reaching the server. Please try again.", direction: "ltr" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => runSend(input);

  // Lets a button anywhere in the app (e.g. Dashboard's "Ask AI") open this
  // bubble and send a question through it, instead of navigating away.
  useEffect(() => {
    return onAskAI((question) => {
      setOpen(true);
      runSend(question);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Keyframes for the glow ring - scoped to this component, no global CSS edits needed */}
      <style>{`
        @keyframes kemetGlowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.55), 0 0 18px 4px rgba(201,168,76,0.35); }
          50% { box-shadow: 0 0 0 10px rgba(201,168,76,0), 0 0 28px 8px rgba(201,168,76,0.55); }
        }
        .kemet-bubble-glow { animation: kemetGlowPulse 2.6s ease-in-out infinite; }
      `}</style>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[560px] flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: "#1A1A2E" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                <Bot size={16} className="text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">KEMET AI</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{MODE_OPTIONS.find((o) => o.value === mode)?.desc}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Mode + model controls */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    title={opt.desc}
                    className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                      active ? "bg-[#C9A84C] text-[#1A1A2E]" : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={13} />
                  </button>
                );
              })}
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as Model)}
              className="ml-auto bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-[#C9A84C]"
            >
              <option value="Flash">Flash</option>
              <option value="Flash Lite">Flash Lite</option>
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <Bot size={13} className="text-[#C9A84C]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    message.role === "user" ? "bg-[#C9A84C] text-[#1A1A2E]" : "bg-white/10 text-white"
                  }`}
                  dir={message.direction || "auto"}
                >
                  {message.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-gray-300" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-[#C9A84C]" />
                </div>
                <div className="rounded-2xl px-3 py-2 bg-white/10 text-white flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-xs text-gray-300">Thinking...</span>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-2.5 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
                placeholder="Ask me anything about Egypt..."
                disabled={loading}
                dir="auto"
                className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[#C9A84C] hover:bg-[#B8984A] disabled:opacity-50 rounded-lg transition-colors text-[#1A1A2E]"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble button - fixed bottom-right, always on top, glowing */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className={`fixed bottom-4 right-4 md:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
          !open ? "kemet-bubble-glow" : ""
        }`}
        style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}
      >
        {open ? <X size={22} className="text-[#1A1A2E]" /> : <MessageSquare size={22} className="text-[#1A1A2E]" />}
      </button>
    </>
  );
}
