"use client"

import { useEffect, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { IoMdClose } from "react-icons/io";

type Message = {
  id: number;
  text: string;
  from: "user" | "bot";
};

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLDivElement>(".chat-body")?.scrollTo({
      top: ref.current.querySelector<HTMLDivElement>(".chat-body")!.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now(), text, from: "user" };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    // fake bot reply
    setTimeout(() => {
      const botMsg: Message = {
        id: Date.now() + 1,
        text: `Echo: ${text}`,
        from: "bot",
      };
      setMessages((m) => [...m, botMsg]);
    }, 700 + Math.random() * 800);
  }

  return (
    <div>
      {/* Floating trigger */}
      <div className="fixed z-50 bottom-6 end-6">
        <button
          aria-label="Open chat"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 shadow-lg text-white hover:scale-105 active:scale-95 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* Modal panel */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div
            ref={ref}
            className="pointer-events-auto w-full max-w-xs md:max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold">AI</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assistant</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">How can I help you?</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setMessages([]);
                  }}
                  title="Clear"
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="p-1 rounded-md text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <IoMdClose className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="chat-body flex-1 overflow-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-gray-500">Say hi 👋</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg ${
                        m.from === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                      } shadow-sm`}
                    >
                      <div className="text-sm">{m.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <FiSend />
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
