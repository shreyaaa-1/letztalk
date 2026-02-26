import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";

const pickOne = (items) => items[Math.floor(Math.random() * items.length)];

const pickDifferent = (items, lastReply) => {
  if (!items.length) {
    return "I’m listening.";
  }
  const filtered = items.filter((item) => item !== lastReply);
  return pickOne(filtered.length ? filtered : items);
};

const buildHumanLikeReply = (text, recentMessages = [], lastReply = "") => {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const recentUserTexts = recentMessages
    .filter((message) => message.fromSelf)
    .slice(-4)
    .map((message) => (message.text || "").toLowerCase().trim())
    .filter(Boolean);
  const hasFollowUpContext = recentUserTexts.length >= 2;
  const previousMessage = recentUserTexts.at(-1) || "";
  const repeatedLowSignal = /\b(ntg|nothing|idk|dont know|don't know|hmm)\b/.test(previousMessage);

  if (!normalized) {
    return "I’m here — tell me what’s on your mind.";
  }

  if (/\b(hi|hello|hey|yo|hola)\b/.test(normalized)) {
    return pickDifferent([
      "Hey! Nice to hear from you 😊",
      "Hi! How’s your day going so far?",
      "Hey there — what’s on your mind right now?",
    ], lastReply);
  }

  if (/\b(thank|thanks|thx)\b/.test(normalized)) {
    return pickDifferent([
      "Anytime 🙂",
      "You got it — I’m with you.",
      "Happy to help. Want to keep going?",
    ], lastReply);
  }

  if (/\b(bye|goodbye|gn|good night|see you|cya|ttyl)\b/.test(normalized)) {
    return pickDifferent([
      "Take care 🤍 I’m here whenever you want to talk again.",
      "Goodnight. Hope tomorrow feels a little lighter for you.",
      "See you soon — you did good sharing today.",
    ], lastReply);
  }

  if (/\b(ntg|nothing|idk|dont know|don't know|hmm)\b/.test(normalized)) {
    if (repeatedLowSignal) {
      return "No stress. Pick one and I’ll follow your lead: talk feelings, life update, or random fun topic.";
    }
    if (hasFollowUpContext) {
      return "Got it. If words are hard right now, just tell me your mood in one word and I’ll take it from there.";
    }
    return "That’s okay. We can keep it easy—how was your day in one line?";
  }

  if (/\b(bored|boring|no mood|empty|blank)\b/.test(normalized)) {
    return pickDifferent([
      "Bored days feel slow. Want a quick 2-minute reset idea or just a chill chat?",
      "I get that. Want to do one tiny thing right now: music pick, short rant, or random fun question?",
      "That mood is real. Tell me what usually helps you feel even 10% better.",
    ], lastReply);
  }

  if (/\?$/.test(normalized) || /\b(what|why|how|when|where|who|which|can you|could you|should i)\b/.test(normalized)) {
    if (/\b(love|relationship|breakup|friend|family)\b/.test(normalized)) {
      return pickDifferent([
        "That’s personal and important. Want to share what happened first?",
        "Relationships can get complicated. What part is bothering you most?",
        "I hear you — do you want support, or practical advice right now?",
      ], lastReply);
    }
    if (/\b(study|exam|career|job|work|code|project)\b/.test(normalized)) {
      return pickDifferent([
        "Let’s make it practical. Tell me your goal and deadline, and I’ll help you plan.",
        "Good question. Share your current situation and I’ll give a clear next step.",
        "We can solve this step by step — what’s the hardest part right now?",
      ], lastReply);
    }
    return pickDifferent([
      "Good question. Give me a little context and I’ll answer properly.",
      "That depends on what outcome you want most — speed, quality, or less stress?",
      "Let’s break it down together. What have you already tried?",
    ], lastReply);
  }

  if (/\b(sad|stressed|anxious|tired|upset|bad|depressed|lonely|overwhelmed|hurt|angry)\b/.test(normalized)) {
    return pickDifferent([
      "That sounds heavy. Want to talk about what’s been the hardest part?",
      "I’m sorry you’re carrying this. I’m here with you — one step at a time.",
      "Thanks for opening up. Do you want comfort right now, or help making a plan?",
    ], lastReply);
  }

  if (/\b(happy|great|awesome|good|excited|win|won|yay)\b/.test(normalized)) {
    return pickDifferent([
      "Love that energy 🙌",
      "That’s awesome — what made it go so well today?",
      "Nice! Keep that momentum going.",
    ], lastReply);
  }

  if (normalized.length < 5 || /^[a-z]{1,4}$/.test(normalized)) {
    return pickDifferent([
      "I’m with you. Give me one more line so I can reply better.",
      "Short message received 🙂 Tell me a little more?",
      "Got you. What happened just before this?",
    ], lastReply);
  }

  if (normalized.length < 12) {
    return pickDifferent([
      "Tell me a little more — I’m listening.",
      "Got you. Say a bit more so I can respond better.",
      hasFollowUpContext ? "I remember what you said earlier — what happened after that?" : "Interesting. What happened next?",
    ], lastReply);
  }

  if (previousMessage && normalized === previousMessage) {
    return pickDifferent([
      "I hear you. Can you add one detail so I don’t misunderstand?",
      "Got it — same feeling. What do you need most right now?",
      "Thanks for repeating that. Let’s focus on what would help first.",
    ], lastReply);
  }

  return pickDifferent([
    "That makes sense. If you want, we can break it down together.",
    "I hear you. What outcome are you hoping for?",
    "Fair point — do you want advice, or just someone to listen right now?",
  ], lastReply);
};

const MessagePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);
  const botReplyTimerRef = useRef(null);
  const botLastReplyRef = useRef("");
  const messagesEndRef = useRef(null);
  const initialPartner = new URLSearchParams(location.search).get("partner") || "";

  const [status, setStatus] = useState(initialPartner ? "matched" : "idle");
  const [partnerId, setPartnerId] = useState(initialPartner);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(
    initialPartner ? [{ id: "from-call", fromSelf: false, text: "Connected from voice call. Start chatting 💬" }] : [],
  );
  const [chatMode, setChatMode] = useState(initialPartner ? "real" : null); // null (show modal), 'bot', or 'real'
  const [isBotTyping, setIsBotTyping] = useState(false);

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
      if (botReplyTimerRef.current) {
        window.clearTimeout(botReplyTimerRef.current);
      }
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isBotTyping]);

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
    setIsBotTyping(false);
    botLastReplyRef.current = "";
    setMessages([{ id: "bot-intro", fromSelf: false, text: "Hey, I’m LetzTalk. I’m here — talk to me like a friend." }]);
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
      const userMessage = { id: `${Date.now()}-self`, fromSelf: true, text };
      const conversation = [...messages, userMessage];
      setMessages(conversation);
      setDraft("");
      setError("");
      setIsBotTyping(true);

      if (botReplyTimerRef.current) {
        window.clearTimeout(botReplyTimerRef.current);
      }

      const reply = buildHumanLikeReply(text, conversation, botLastReplyRef.current);
      const delay = 500 + Math.min(900, text.length * 14);
      botReplyTimerRef.current = window.setTimeout(() => {
        setMessages((prev) => [...prev, { id: `${Date.now()}-bot`, fromSelf: false, text: reply }]);
        botLastReplyRef.current = reply;
        setIsBotTyping(false);
      }, delay);
      return;
    }

    sendMessage();
  };

  if (chatMode === null) {
    return (
      <div className="center-screen message-page-screen">
        <div className="access-modal-overlay">
          <div className="access-modal access-modal-card glass" role="dialog" aria-modal="true" aria-label="Choose chat mode">
            <div className="access-modal-header">
              <button type="button" className="ghost-btn small access-modal-back-btn" onClick={onBack} aria-label="Back">
                ←
              </button>
              <div className="access-modal-copy">
                <h2>💬 Choose Chat Mode</h2>
                <p>How would you like to chat?</p>
              </div>
            </div>
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
      </div>
    );
  }

  return (
    <div className="center-screen message-page-screen">
      <div className="feature-shell glass light-chat-theme">
        <header className="feature-header message-header">
          <button type="button" className="ghost-btn small message-back-btn" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div className="message-header-copy">
            <h1>💬 Text Chat</h1>
            <p>Share your thoughts with LetzTalk.</p>
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
                {chatMode === "bot" && isBotTyping && <p className="hint">LetzTalk is typing…</p>}
                <div ref={messagesEndRef} />
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
