import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const MessagePage = () => {
  const { isLoggedInUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);
  const initialPartner = new URLSearchParams(location.search).get("partner") || "";

  const [status, setStatus] = useState(initialPartner ? "matched" : "idle");
  const [partnerId, setPartnerId] = useState(initialPartner);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(
    initialPartner ? [{ id: "from-call", fromSelf: false, text: "Connected from voice call. Start chatting 💬" }] : [],
  );
  const [chatMode, setChatMode] = useState(initialPartner ? "real" : null); // null (show modal), 'bot', or 'real'

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

  const handleChatWithBot = () => {
    setChatMode("bot");
    setMessages([{ id: "bot-intro", fromSelf: false, text: "🤖 LetzTalk: Hi! I'm LetzTalk. Type anything and I'll echo it back!" }]);
  };

  const handleFindRandom = () => {
    setChatMode("real");
    findNewPeople();
  };

  const sendMessageWithBotCheck = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    if (chatMode === "bot") {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), fromSelf: true, text },
        { id: Date.now() + 1, fromSelf: false, text: `🤖 LetzTalk: You said "${text}"` },
      ]);
      setDraft("");
      return;
    }

    sendMessage();
  };

  return (
    <div className="center-screen">
      {chatMode === null && (
        <div className="access-modal-overlay">
          <div className="access-modal glass">
            <h2>💬 Choose Chat Mode</h2>
            <p>How would you like to chat?</p>
            <div className="access-modal-actions">
              <button type="button" className="solid-link action-btn" onClick={handleChatWithBot}>
                🤖 Chat with LetzTalk
              </button>
              <button type="button" className="ghost-link action-btn" onClick={handleFindRandom}>
                🌐 Find Random Person
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="feature-shell glass light-chat-theme">
        <header className="feature-header message-header">
          <button type="button" className="ghost-btn small message-back-btn" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div className="message-header-copy">
            <h1>💬 Text Chat</h1>
            <p>Share your thoughts with LetzTalk.</p>
          </div>
          <div className="header-actions message-header-actions">
            {!isLoggedInUser && (
              <Link className="ghost-link small-link" to="/auth">
                Login / Register
              </Link>
            )}
          </div>
        </header>

        <div className="message-main-row">
          <div className="message-main-area">
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
              </div>

              <div className="messages-input-row">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessageWithBotCheck();
                    }
                  }}
                  placeholder={chatMode === "bot" ? "Type a message to LetzTalk..." : partnerId ? "Type a message..." : "Find someone first to chat"}
                  disabled={chatMode !== "bot" && !partnerId}
                />
                <button type="button" className="solid-link action-btn" onClick={sendMessageWithBotCheck} disabled={chatMode !== "bot" && !partnerId}>
                  Send
                </button>
              </div>
            </section>

            {error && <p className="form-error">{error}</p>}

            {chatMode === "bot" ? (
              <div className="home-actions message-bot-actions">
                <button type="button" className="solid-link action-btn" onClick={handleFindRandom}>
                  🌐 Chat with Stranger
                </button>
              </div>
            ) : (
              <div className="home-actions">
                <button type="button" className="solid-link action-btn" onClick={findNewPeople}>
                  🔍 Find New People
                </button>
                {partnerId && (
                  <button type="button" className="ghost-link action-btn" onClick={skipPartner}>
                    Skip Current
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePage;
