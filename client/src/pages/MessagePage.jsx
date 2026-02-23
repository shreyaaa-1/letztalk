import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const MessagePage = () => {
  const { isLoggedInUser } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("idle");
    });

    socket.on("matched", () => {
      setStatus("matched");
      setError("");
    });

    socket.on("chat_message", () => {
      // Messages received - app simplified to not show full chat
    });

    socket.on("partner_skipped", () => {
      setStatus("idle");
    });

    socket.on("partner_disconnected", () => {
      setStatus("idle");
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
    socketRef.current?.emit("find_match");
  };

  const skipPartner = () => {
    socketRef.current?.emit("skip");
    setStatus("idle");
    setError("");
  };

  return (
    <div className="center-screen">
      <div className="feature-shell glass">
        <header className="feature-header">
          <div>
            <h1>💬 Text Chat</h1>
            <p>Connect and chat with strangers instantly</p>
          </div>
          <div className="header-actions">
            {!isLoggedInUser && (
              <Link className="ghost-link small-link" to="/auth">
                Login / Register
              </Link>
            )}
            <button type="button" className="ghost-btn small" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </header>

        <div className="message-main-row">
          <div className="message-main-area">
            <section className="chat-simple-callout glass">
              <div className="callout-icon">💬</div>
              <h2>Chat if you can't talk</h2>
              <p>Send text messages with your match. Perfect when you need to communicate silently.</p>
              
              {error && <p className="form-error">{error}</p>}

              <div className="chat-action-buttons">
                <button type="button" className="solid-link action-btn" onClick={status === "matched" ? skipPartner : findMatch}>
                  {status === "matched" ? "🚀 Skip" : "🔍 Find Chat Partner"}
                </button>
                {status === "matched" && (
                  <button type="button" className="ghost-link action-btn" onClick={skipPartner}>
                    Next
                  </button>
                )}
              </div>
              
              <p className="chat-status-hint">{status === "matched" ? "✨ Connected with a stranger" : "Ready to connect..."}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePage;
