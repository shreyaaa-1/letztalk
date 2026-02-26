import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";

const MessagePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initialPartner = new URLSearchParams(location.search).get("partner") || "";

  const [status, setStatus] = useState(initialPartner ? "matched" : "idle");
  const [partnerId, setPartnerId] = useState(initialPartner);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(
    initialPartner ? [{ id: "from-call", fromSelf: false, text: "Connected from voice call. Start chatting 💬" }] : [],
  );

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus((prev) => (prev === "matched" ? prev : "idle"));
    });

    socket.on("matched", ({ partnerId: incomingPartnerId }) => {
      setPartnerId(incomingPartnerId || "");
      setStatus("matched");
      setError("");
      setMessages([{ id: Date.now(), fromSelf: false, text: "Partner connected. Say hi 👋" }]);
    });

    socket.on("chat_message", ({ text }) => {
      setMessages((prev) => [...prev, { id: Date.now() + Math.random(), fromSelf: false, text }]);
    });

    socket.on("partner_skipped", () => {
      setPartnerId("");
      setStatus("idle");
      setMessages([]);
    });

    socket.on("partner_disconnected", () => {
      setPartnerId("");
      setStatus("idle");
      setMessages([]);
    });

    socket.on("disconnect", () => {
      setStatus("offline");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const findNewPeople = () => {
    if (partnerId) {
      socketRef.current?.emit("skip");
    }
    setPartnerId("");
    setStatus("searching");
    setError("");
    setMessages([]);
    socketRef.current?.emit("find_match");
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    if (!partnerId) {
      setError("No active partner to message.");
      return;
    }

    socketRef.current?.emit("chat_message", { to: partnerId, text });
    setMessages((prev) => [...prev, { id: Date.now(), fromSelf: true, text }]);
    setDraft("");
    setError("");
  };

  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const skipPartner = () => {
    socketRef.current?.emit("skip");
    setPartnerId("");
    setStatus("idle");
    setMessages([]);
    setError("");
  };

  return (
    <div className="center-screen message-page-screen">
      <div className="feature-shell glass message-purple-shell">
        <header className="feature-header message-header">
          <button type="button" className="ghost-btn small message-back-btn" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div className="message-header-copy">
            <h1>💬 Text Chat</h1>
            <p>Connect instantly and chat in a calm, centered space.</p>
          </div>
        </header>

        <div className="message-main-row">
          <div className="message-main-area">
            <section className="message-feature-strip" aria-label="Chat highlights">
              <div className="message-feature-chip">⚡ Fast matching</div>
              <div className="message-feature-chip">🔒 Private chat</div>
              <div className="message-feature-chip">💜 Friendly UI</div>
            </section>

            <section className="messages-box glass">
              <div className="messages-list">
                {messages.length === 0 && (
                  <p className="hint">{status === "searching" ? "Finding a new person..." : "No messages yet. Find someone and start chatting."}</p>
                )}
                {messages.map((item) => (
                  <div key={item.id} className={`msg-bubble ${item.fromSelf ? "self" : "peer"}`}>
                    {item.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="messages-input-row">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  placeholder={partnerId ? "Type a message..." : "Find someone first to chat"}
                  disabled={!partnerId}
                />
                <button type="button" className="solid-link action-btn" onClick={sendMessage} disabled={!partnerId}>
                  Send
                </button>
              </div>
            </section>

            {error && <p className="form-error">{error}</p>}

            <div className="home-actions message-action-row">
              <button type="button" className="solid-link action-btn" onClick={findNewPeople}>
                🔍 Find New People
              </button>
              {partnerId && (
                <button type="button" className="ghost-link action-btn" onClick={skipPartner}>
                  Skip Current
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePage;
