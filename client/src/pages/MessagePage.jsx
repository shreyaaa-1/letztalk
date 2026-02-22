import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const MessagePage = () => {
  const { user, continueAsGuest, isLoggedInUser } = useAuth();
  const socketRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [partnerId, setPartnerId] = useState("");
  const [message, setMessage] = useState("Connected. Start matching for text chat.");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);

  const username = useMemo(() => user?.username || "Anonymous", [user]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("idle");
      setMessage("Connected. Start matching for text chat.");
    });

    socket.on("matched", ({ partnerId: incomingPartnerId }) => {
      setPartnerId(incomingPartnerId);
      setStatus("matched");
      setMessage("Text partner connected ✨");
      setMessages([{ id: Date.now(), fromSelf: false, text: "Partner connected. Say hi 👋" }]);
      setError("");
    });

    socket.on("chat_message", ({ text }) => {
      setMessages((prev) => [...prev, { id: Date.now() + Math.random(), fromSelf: false, text }]);
    });

    socket.on("partner_skipped", () => {
      setPartnerId("");
      setStatus("idle");
      setMessage("Partner skipped. Find a new chat.");
      setMessages([]);
    });

    socket.on("partner_disconnected", () => {
      setPartnerId("");
      setStatus("idle");
      setMessage("Partner disconnected.");
      setMessages([]);
    });

    socket.on("disconnect", () => {
      setStatus("offline");
      setMessage("Disconnected. Reconnecting...");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const findMatch = () => {
    setStatus("searching");
    setMessage("Finding someone for text chat…");
    setError("");
    setMessages([]);
    socketRef.current?.emit("find_match");
  };

  const skipPartner = () => {
    socketRef.current?.emit("skip");
    setPartnerId("");
    setStatus("idle");
    setMessage("You skipped this chat.");
    setMessages([]);
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

  return (
    <div className="center-screen">
      <div className="feature-shell glass">
        <header className="feature-header">
          <div>
            <h1>Text Chat</h1>
            <p>{username} · Anonymous random messaging</p>
          </div>
          <div className="header-actions">
            {!user && (
              <button type="button" className="ghost-btn small" onClick={continueAsGuest}>
                Continue as Guest
              </button>
            )}
            {!isLoggedInUser && (
              <Link className="ghost-link small-link" to="/auth">
                Login / Register
              </Link>
            )}
            <Link className="ghost-link small-link" to="/call">
              Call Page
            </Link>
          </div>
        </header>

        <section className="match-status glass">
          <span className={`pulse ${status === "matched" ? "live" : ""}`} />
          <strong>{message}</strong>
          <span className="mono">Mode: Text chat</span>
        </section>

        <section className="messages-box glass">
          <div className="messages-list">
            {messages.length === 0 && <p className="hint">No messages yet. Start matching and send a message.</p>}
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
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
            />
            <button type="button" className="solid-link action-btn" onClick={sendMessage}>
              Send
            </button>
          </div>
        </section>

        {error && <p className="form-error">{error}</p>}

        <div className="home-actions">
          <button type="button" className="solid-link action-btn" onClick={status === "matched" ? skipPartner : findMatch}>
            {status === "matched" ? "Skip Chat" : "Find Chat"}
          </button>
          <Link to="/" className="ghost-link">
            Home
          </Link>
          <Link to="/games" className="ghost-link">
            Games
          </Link>
          <Link to="/rooms" className="ghost-link">
            Rooms
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MessagePage;
