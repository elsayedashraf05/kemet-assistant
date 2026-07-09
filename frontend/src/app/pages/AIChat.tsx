import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Send, Bot, User, Database, MessageSquare, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE_URL } from "../lib/api";

const API_BASE = API_BASE_URL;

type Message = {
  role: "user" | "assistant";
  content: string;
  direction?: "ltr" | "rtl";
};

type Mode = "Chat" | "Web Search" | "Data";
type Model = "Flash" | "Flash Lite";

// مفاتيح sessionStorage: بتفضل محفوظة لحد ما التاب/المتصفح يتقفل (حتى لو عملت refresh)
const STORAGE_KEY_MESSAGES = "kemet_chat_messages";
const STORAGE_KEY_MODE = "kemet_chat_mode";
const STORAGE_KEY_MODEL = "kemet_chat_model";

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Welcome! I'm Kemet, your AI guide to Egypt. I can help you plan trips, find hotels, check safety ratings, discover monuments, and answer any questions about traveling in Egypt. How can I assist you today?",
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#C9A84C] underline hover:text-[#EBD9A6]"
    >
      {children}
    </a>
  ),
  code: ({ children }: any) => (
    <code className="bg-black/30 rounded px-1 py-0.5 text-xs">{children}</code>
  ),
  h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-bold mb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
};

const suggestedQuestions = [
  "Plan a 5-day trip to Cairo",
  "Best hotels under $100/night",
  "Safe areas in Alexandria",
  "Must-try Egyptian food",
];

const MODE_OPTIONS: { value: Mode; label: string; icon: typeof MessageSquare; desc: string }[] = [
  { value: "Chat", label: "Chat", icon: MessageSquare, desc: "General AI chat about Egypt tourism" },
  { value: "Data", label: "Data", icon: Database, desc: "Answers based on KEMET's own data files" },
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

export function AIChat() {
  const [searchParams, setSearchParams] = useSearchParams();

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
  const autoSentRef = useRef(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // بيحفظ المحادثة في sessionStorage أول ما تتغير، فلو عملت refresh أو انتقلت
  // لصفحة تانية ورجعت، المحادثة بتفضل موجودة لحد ما تقفل التاب/المتصفح.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch {
      // sessionStorage ممكن يفشل (وضع خاص/متصفح شايل الميزة) - نتجاهل بهدوء
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

  const runSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendMessage(trimmed, mode, model);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, direction: data.direction },
      ]);
    } catch {
      setError("Couldn't reach KEMET AI. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong reaching the server. Please try again.",
          direction: "ltr",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // لو الدخول جاي من صفحة الداشبورد ومعاه ?q=... (زرار "Ask AI")،
  // بنكتب السؤال وبنبعته أوتوماتيك مرة واحدة بس.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      setInput(q);
      runSend(q);
      // بنشيل الـ query param من الـ URL عشان لو المستخدم عمل refresh ما يتبعتش تاني
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSend = () => runSend(input);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">
          AI Chat Assistant <span className="text-[#C9A84C]">𓂀</span>
        </h1>
        <p className="text-sm md:text-base text-gray-400">
          Ask me anything about Egypt - from trip planning to cultural insights
        </p>
      </div>

      {/* Mode + Model controls */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                title={opt.desc}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-all ${
                  active
                    ? "bg-[#C9A84C] text-[#1A1A2E] font-medium"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value as Model)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs md:text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]"
        >
          <option value="Flash">Flash</option>
          <option value="Flash Lite">Flash Lite</option>
        </select>

        <span className="text-xs text-gray-500 hidden sm:inline">
          {MODE_OPTIONS.find((o) => o.value === mode)?.desc}
        </span>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 md:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="md:w-[18px] md:h-[18px] text-[#C9A84C]" />
                </div>
              )}
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 md:px-4 py-2 md:py-3 text-sm md:text-base ${
                  message.role === "user"
                    ? "bg-[#C9A84C] text-[#1A1A2E]"
                    : "bg-white/10 text-white"
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
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="md:w-[18px] md:h-[18px] text-gray-300" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 md:gap-3 justify-start">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="md:w-[18px] md:h-[18px] text-[#C9A84C]" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-white/10 text-white flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm text-gray-300">Thinking...</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-3">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs md:text-sm border border-white/10 hover:border-[#C9A84C]/50 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 md:p-4 border-t border-white/10">
          <div className="flex gap-2 md:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
              placeholder="Ask me anything about Egypt..."
              disabled={loading}
              dir="auto"
              className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 md:px-4 py-2 md:py-3 text-sm md:text-base focus:outline-none focus:border-[#C9A84C] transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 md:px-6 py-2 md:py-3 bg-[#C9A84C] hover:bg-[#B8984A] disabled:opacity-50 disabled:hover:bg-[#C9A84C] rounded-lg transition-colors flex items-center gap-2 text-[#1A1A2E] font-medium text-sm md:text-base"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="md:w-[18px] md:h-[18px]" />}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
