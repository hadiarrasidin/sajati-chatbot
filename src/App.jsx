import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: "0",
      role: "assistant",
      text: "Selamat datang di Sajati Kopi! ☕ Ada yang bisa saya bantu? Mau tanya menu, harga, atau rekomendasi minuman?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuContext, setMenuContext] = useState("");
  const [menuLoaded, setMenuLoaded] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("name, price, category")
        .limit(50);
      if (error) throw error;
      if (data && data.length > 0) {
        const text = data
          .map((i) => `- ${i.name} (${i.category}): Rp${Number(i.price).toLocaleString("id-ID")}`)
          .join("\n");
        setMenuContext(text);
        setMenuLoaded(true);
      }
    } catch (err) {
      console.error("Gagal fetch menu:", err.message);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: "user", text: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const history = updated.slice(1).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const systemPrompt = `Kamu adalah asisten virtual Sajati Kopi, sebuah kedai kopi lokal yang cozy.
Bantu pelanggan dengan informasi menu, rekomendasi, dan pertanyaan umum.
Jawab dengan ramah, hangat, dan dalam bahasa Indonesia. Jawaban singkat dan padat.

Menu yang tersedia saat ini:
${menuContext || "Data menu belum tersedia."}

Untuk pertanyaan di luar topik kopi/makanan, tetap bantu sebagai asisten umum.`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 500,
          messages: [{ role: "system", content: systemPrompt }, ...history],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const reply = data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa menjawab saat ini.";
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", text: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      {/* Background grain */}
      <div className="grain" />

      <div className="chat-wrapper">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            <div className="logo">☕</div>
            <div>
              <div className="brand">Sajati Kopi</div>
              <div className="status">
                <span className={`dot ${menuLoaded ? "online" : "loading"}`} />
                {menuLoaded ? "Menu tersedia" : "Memuat menu..."}
              </div>
            </div>
          </div>
          <div className="header-tag">AI Assistant</div>
        </div>

        {/* Messages */}
        <div className="messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`msg-row ${msg.role}`}>
              {msg.role === "assistant" && <div className="avatar">☕</div>}
              <div className={`bubble ${msg.role}`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant">
              <div className="avatar">☕</div>
              <div className="bubble assistant typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <textarea
            ref={inputRef}
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tanya menu, harga, atau rekomendasi..."
            rows={1}
            disabled={loading}
          />
          <button
            className={`send-btn ${loading ? "disabled" : ""}`}
            onClick={sendMessage}
            disabled={loading}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
