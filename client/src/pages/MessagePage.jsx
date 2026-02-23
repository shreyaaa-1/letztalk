import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const MessagePage = () => {
  const { user, continueAsGuest, isLoggedInUser } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [partnerId, setPartnerId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("idle");
    });

    socket.on("matched", ({ partnerId: incomingPartnerId }) => {
      setPartnerId(incomingPartnerId);
      setStatus("matched");
      setMessages([{ id: Date.now(), fromSelf: false, text: "Partner connected. Say hi 👋" }]);
      setError("");
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

  const findMatch = () => {
    setStatus("searching");
    setError("");
    setNotice("");
    setMessages([]);
    socketRef.current?.emit("find_match");
  };

  const skipPartner = () => {
    socketRef.current?.emit("skip");
    setPartnerId("");
    setStatus("idle");
    setNotice("");
    setMessages([]);
  };

  const sendFriendRequest = () => {
    if (!partnerId) {
      setError("No active stranger found for friend request.");
      return;
    }

    setError("");
    setNotice("✅ Friend request sent to stranger.");
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
            <button type="button" className="ghost-btn small" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </header>

        <div className="message-main-row">
          <div className="message-main-area">
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
            {notice && <p className="hint">{notice}</p>}

            <div className="home-actions">
              <button type="button" className="solid-link action-btn" onClick={status === "matched" ? skipPartner : findMatch}>
                {status === "matched" ? "Skip Chat" : "Find Chat"}
              </button>
              <Link to="/games" className="ghost-link">
                Play with Stranger
              </Link>
              <button type="button" className="ghost-btn" onClick={sendFriendRequest}>
                Add Friend Request
              </button>
              <Link to="/" className="ghost-link">
                Home
              </Link>
            </div>
          </div>

          <aside className="message-sidebar message-sidebar-buttons glass">
            <div className="sidebar-toggles">
              <Link to="/call" className="sidebar-btn" title="Open Voice Call">
                🎤 Voice
              </Link>
              <Link to="/games" className="sidebar-btn" title="Open Games">
                🎮 Games
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default MessagePage;
