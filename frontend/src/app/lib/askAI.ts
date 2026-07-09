// Lets any component (e.g. a "Ask AI" button on the Dashboard) open the
// floating KEMET chat bubble and send a message through it, instead of
// navigating to a separate full-page chat. Works via a plain window
// CustomEvent so it needs no shared React context/provider wiring.

const EVENT_NAME = "kemet:ask-ai";

interface AskAIEventDetail {
  question: string;
}

/** Call this from anywhere to open the chat bubble and send `question`. */
export function askAI(question: string) {
  const trimmed = question.trim();
  if (!trimmed) return;
  window.dispatchEvent(new CustomEvent<AskAIEventDetail>(EVENT_NAME, { detail: { question: trimmed } }));
}

/** Call once (e.g. inside a useEffect in ChatBubble) to react to askAI() calls. */
export function onAskAI(handler: (question: string) => void) {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<AskAIEventDetail>).detail;
    if (detail?.question) handler(detail.question);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
