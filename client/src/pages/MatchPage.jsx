import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import http from "../api/http";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const QUICK_QUIZ = [
  {
    question: "What does 'No cap' mean?",
    options: ["For real", "No hat", "I don't know"],
    answer: 0,
  },
  {
    question: "What does 'Sus' mean?",
    options: ["Super", "Suspicious", "Silent"],
    answer: 1,
  },
  {
    question: "What is a 'W' in chat?",
    options: ["Warning", "Wait", "Win"],
    answer: 2,
  },
];

const DICE_DOT_MAP = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const DicePips = ({ value, isRolling, variant }) => {
  const activeDots = DICE_DOT_MAP[value] || [];

  return (
    <div className={`dice-neon-cube ${variant} ${isRolling ? "rolling" : ""}`} aria-label={`Dice shows ${value}`}>
      {Array.from({ length: 9 }).map((_, index) => {
        const spot = index + 1;
        return <span key={spot} className={`dice-neon-dot ${activeDots.includes(spot) ? "show" : ""}`} />;
      })}
    </div>
  );
};

const MatchPage = ({ directVoice = false } = {}) => {
  const { user, isLoggedInUser, continueAsGuest, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const shouldDirectCallFlow = directVoice || Boolean(location.state?.fromHome);

  const [status, setStatus] = useState("idle");
  const [partnerId, setPartnerId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [reason, setReason] = useState("inappropriate_behavior");
  const [message, setMessage] = useState(() => location.state?.notice || "");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [activeView, setActiveView] = useState("call");
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isGameMinimized, setIsGameMinimized] = useState(false);
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [diceResult, setDiceResult] = useState("Roll to see who wins this round.");
  const [gameState, setGameState] = useState({
    dice: { me: 1, stranger: 1 },
  });
  const [inlineDiceScore, setInlineDiceScore] = useState({ me: 0, stranger: 0 });
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [showConnectedToast, setShowConnectedToast] = useState(false);
  const [rpsMeChoice, setRpsMeChoice] = useState(null);
  const [rpsPartnerChoice, setRpsPartnerChoice] = useState(null);
  const [rpsInlineResult, setRpsInlineResult] = useState("Choose rock, paper, or scissors.");
  const [rpsInlineScore, setRpsInlineScore] = useState({ me: 0, partner: 0 });
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState("Pick one option.");
  const [quizAnswered, setQuizAnswered] = useState(false);

  const remoteAudioRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const autoStartedRef = useRef(false);
  const localSpeakingCleanupRef = useRef(null);
  const remoteSpeakingCleanupRef = useRef(null);
  const chatScrollRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const connectedToastTimerRef = useRef(null);

  const appendMessage = useCallback((nextMessage) => {
    setChatMessages((prev) => [...prev, nextMessage]);
  }, []);

  const appendSystemMessage = useCallback((text) => {
    appendMessage({
      id: `system-${Date.now()}-${Math.random()}`,
      type: "system",
      text,
      sentAt: Date.now(),
    });
  }, [appendMessage]);

  const createSpeakingMonitor = useCallback((stream, setSpeaking) => {
    if (!stream) {
      return () => {};
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return () => {};
    }

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const intervalId = window.setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setSpeaking(average > 20);
    }, 180);

    return () => {
      window.clearInterval(intervalId);
      setSpeaking(false);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, []);

  const closePeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (remoteSpeakingCleanupRef.current) {
      remoteSpeakingCleanupRef.current();
      remoteSpeakingCleanupRef.current = null;
    }

    remoteStreamRef.current = null;

    setRemoteStreamReady(false);
    setRemoteSpeaking(false);
  }, []);

  const ensureLocalMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;

    setLocalStreamReady(true);

    if (!localSpeakingCleanupRef.current) {
      localSpeakingCleanupRef.current = createSpeakingMonitor(stream, setLocalSpeaking);
    }

    return stream;
  }, [createSpeakingMonitor]);

  const createPeer = useCallback(async (targetSocketId) => {
    closePeer();

    const stream = await ensureLocalMedia();
    const peer = new RTCPeerConnection(ICE_CONFIG);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }

      remoteStreamRef.current = remoteStream;

      if (remoteSpeakingCleanupRef.current) {
        remoteSpeakingCleanupRef.current();
      }

      remoteSpeakingCleanupRef.current = createSpeakingMonitor(remoteStream, setRemoteSpeaking);
      setRemoteStreamReady(true);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc_ice_candidate", {
          to: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        setStatus("idle");
        setMessage("Call ended. You can find a new match.");
      }
    };

    peerRef.current = peer;
    return peer;
  }, [closePeer, createSpeakingMonitor, ensureLocalMedia]);

  const resetMatchState = useCallback((nextMessage = "", nextStatus = "idle") => {
    setPartnerId("");
    setRoomId("");
    setStatus(nextStatus);
    setMessage(nextMessage);
    setError("");
    setChatDraft("");
    setChatMessages([]);
    setIsPartnerTyping(false);
    setIsCallMinimized(false);
    setIsChatSidebarOpen(false);
    setIsChatMinimized(false);
    setIsGameMinimized(false);
    setSelectedGame(null);
    setShowConnectedToast(false);
    setShowReportPanel(false);
    closePeer();
  }, [closePeer]);

  const triggerConnectedToast = useCallback(() => {
    setShowConnectedToast(true);

    if (connectedToastTimerRef.current) {
      window.clearTimeout(connectedToastTimerRef.current);
    }

    connectedToastTimerRef.current = window.setTimeout(() => {
      setShowConnectedToast(false);
    }, 2000);
  }, []);

  const startSearch = useCallback((searchMessage = "Finding someone interesting…") => {
    setError("");
    setMessage(searchMessage);
    setStatus("searching");
    setIsPartnerTyping(false);
    ensureLocalMedia().catch(() => {
      setError("Microphone permission is needed to start voice chat.");
    });
    socketRef.current?.emit("find_match");
  }, [ensureLocalMedia]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (shouldDirectCallFlow && !autoStartedRef.current) {
        autoStartedRef.current = true;
        startSearch();
        return;
      }

      setMessage("Connected. Start matching when ready.");
    });

    socket.on("matched", async ({ roomId: incomingRoomId, partnerId: incomingPartnerId }) => {
      setStatus("connected");
      setRoomId(incomingRoomId);
      setPartnerId(incomingPartnerId);
      setMessage("Connected to stranger ✨");
      setError("");
      setChatMessages([{ id: `system-${Date.now()}`, type: "system", text: "Partner connected. Say hi 👋", sentAt: Date.now() }]);
      setActiveView("call");
      setIsCallMinimized(false);
      setIsChatSidebarOpen(false);
      setShowReportPanel(false);
      setIsPartnerTyping(false);
      triggerConnectedToast();

      try {
        const shouldInitiateOffer = socket.id < incomingPartnerId;
        if (shouldInitiateOffer) {
          const peer = await createPeer(incomingPartnerId);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          socket.emit("webrtc_offer", {
            to: incomingPartnerId,
            offer,
          });
        }
      } catch {
        setError("Could not start call media. Check camera/mic permissions.");
      }
    });

    socket.on("webrtc_offer", async ({ from, offer }) => {
      try {
        const peer = await createPeer(from);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("webrtc_answer", {
          to: from,
          answer,
        });
      } catch {
        setError("Unable to accept incoming call offer.");
      }
    });

    socket.on("webrtc_answer", async ({ answer }) => {
      try {
        if (peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch {
        setError("Unable to complete peer connection handshake.");
      }
    });

    socket.on("webrtc_ice_candidate", async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch {
        setError("Network path negotiation failed.");
      }
    });

    socket.on("chat_message", ({ text, sentAt }) => {
      setIsPartnerTyping(false);
      appendMessage({
        id: `peer-${Date.now()}-${Math.random()}`,
        type: "peer",
        fromSelf: false,
        text,
        sentAt: sentAt || Date.now(),
      });
    });

    socket.on("chat_typing", () => {
      setIsPartnerTyping(true);
    });

    socket.on("chat_stop_typing", () => {
      setIsPartnerTyping(false);
    });

    socket.on("room_state", ({ state, roomId: syncedRoomId, partnerId: syncedPartnerId }) => {
      if (state === "searching") {
        setStatus("searching");
        setMessage("Finding someone…");
        return;
      }

      if (state === "connected") {
        setStatus("connected");
        if (syncedRoomId) {
          setRoomId(syncedRoomId);
        }
        if (syncedPartnerId) {
          setPartnerId(syncedPartnerId);
        }
        setMessage("Connected to stranger ✨");
        triggerConnectedToast();
        return;
      }

      if (state === "ended") {
        setStatus("ended");
        setMessage("Conversation ended");
      }
    });

    socket.on("partner_skipped", () => {
      resetMatchState("Partner skipped.", "ended");
      appendSystemMessage("Partner left the chat.");
    });

    socket.on("partner_disconnected", () => {
      resetMatchState("Partner disconnected.", "ended");
      appendSystemMessage("Partner disconnected.");
    });

    socket.on("call_end", () => {
      resetMatchState("Call ended by partner.", "ended");
      appendSystemMessage("Call ended by partner.");
    });

    socket.on("disconnect", () => {
      setStatus("reconnecting");
      setMessage("Socket disconnected. Reconnecting...");
    });

    return () => {
      socket.disconnect();
      closePeer();

      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      if (connectedToastTimerRef.current) {
        window.clearTimeout(connectedToastTimerRef.current);
      }

      if (localSpeakingCleanupRef.current) {
        localSpeakingCleanupRef.current();
        localSpeakingCleanupRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      setLocalStreamReady(false);
      setRemoteStreamReady(false);
      setLocalSpeaking(false);
      setRemoteSpeaking(false);
    };
  }, [appendMessage, appendSystemMessage, closePeer, createPeer, resetMatchState, shouldDirectCallFlow, startSearch, triggerConnectedToast]);

  const findMatch = () => {
    if (status === "searching") {
      socketRef.current?.emit("skip");
      setStatus("idle");
      setMessage("Search canceled. Tap find when ready.");
      setError("");
      return;
    }

    startSearch();
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!text || !partnerId) {
      return;
    }

    socketRef.current?.emit("chat_message", { to: partnerId, text });
    socketRef.current?.emit("chat_stop_typing", { to: partnerId });
    appendMessage({
      id: `self-${Date.now()}`,
      type: "self",
      fromSelf: true,
      text,
      sentAt: Date.now(),
    });
    setChatDraft("");
    setIsPartnerTyping(false);
  };

  const onBack = () => {
    if (shouldDirectCallFlow) {
      navigate("/");
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const toggleMute = () => {
    if (!localStreamRef.current) {
      return;
    }

    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
  };

  const skipPartner = () => {
    socketRef.current?.emit("skip");
    resetMatchState("Searching for a new partner...", "searching");
    startSearch("Finding someone else…");
  };

  const cancelVoiceSearch = () => {
    socketRef.current?.emit("skip");
    resetMatchState("Search canceled.", "idle");
    navigate("/");
  };

  const endCall = () => {
    if (partnerId) {
      socketRef.current?.emit("call_end", { to: partnerId });
    }
    resetMatchState("Call ended.", "ended");
  };

  const playInlineDice = () => {
    if (isDiceRolling) {
      return;
    }

    setIsDiceRolling(true);
    const randomValues = crypto.getRandomValues(new Uint32Array(2));
    const me = (randomValues[0] % 6) + 1;
    const stranger = (randomValues[1] % 6) + 1;

    window.setTimeout(() => {
      setGameState((prev) => ({
        ...prev,
        dice: { me, stranger },
      }));
      setInlineDiceScore((prev) => ({
        me: prev.me + me,
        stranger: prev.stranger + stranger,
      }));

      if (me === stranger) {
        setDiceResult("Draw round — both rolled the same.");
      } else if (me > stranger) {
        setDiceResult("You win this roll! 🎉");
      } else {
        setDiceResult("Stranger wins this roll.");
      }

      setIsDiceRolling(false);
    }, 700);
  };

  const playInlineRps = (choice) => {
    const options = ["rock", "paper", "scissors"];
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const partnerChoice = options[randomValue % options.length];

    setRpsMeChoice(choice);
    setRpsPartnerChoice(partnerChoice);

    if (choice === partnerChoice) {
      setRpsInlineResult("Draw round.");
      return;
    }

    const playerWins =
      (choice === "rock" && partnerChoice === "scissors") ||
      (choice === "paper" && partnerChoice === "rock") ||
      (choice === "scissors" && partnerChoice === "paper");

    if (playerWins) {
      setRpsInlineScore((prev) => ({ ...prev, me: prev.me + 1 }));
      setRpsInlineResult("You win this RPS round!");
      return;
    }

    setRpsInlineScore((prev) => ({ ...prev, partner: prev.partner + 1 }));
    setRpsInlineResult("Player 2 wins this RPS round.");
  };

  const answerInlineQuiz = (optionIndex) => {
    if (quizAnswered) {
      return;
    }

    const current = QUICK_QUIZ[quizIndex];
    const isCorrect = optionIndex === current.answer;

    setQuizAnswered(true);
    setQuizFeedback(isCorrect ? "Correct ✅" : `Wrong ❌ · Correct: ${current.options[current.answer]}`);
  };

  const nextInlineQuiz = () => {
    const nextIndex = (quizIndex + 1) % QUICK_QUIZ.length;
    setQuizIndex(nextIndex);
    setQuizAnswered(false);
    setQuizFeedback("Pick one option.");
  };

  const submitReport = async () => {
    if (!isLoggedInUser) {
      setError("Login is required for reporting.");
      return;
    }

    if (!partnerId) {
      setError("No active partner to report.");
      return;
    }

    try {
      await http.post("/mod/report", {
        reportedSocketId: partnerId,
        reason,
        roomId,
      });
      navigate(`/block?targetSocketId=${encodeURIComponent(partnerId)}`);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to submit report.");
    }
  };

  const isMatched = status === "connected";
  const onChatInputChange = (event) => {
    const value = event.target.value;
    setChatDraft(value);

    if (!partnerId) {
      return;
    }

    socketRef.current?.emit("chat_typing", { to: partnerId });

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      socketRef.current?.emit("chat_stop_typing", { to: partnerId });
    }, 700);
  };

  const formatTime = (sentAt) => {
    try {
      return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isPartnerTyping]);

  const showControlDock = isMatched;
  const isMiniOnlyMode = activeView === "call" && isCallMinimized;
  const isChatMaxMode = isCallMinimized && isChatSidebarOpen;

  return (
    <div className="center-screen">
      <div className="match-shell glass">
        <header className={`match-header dashboard-header ${activeView === "games" ? "games-header-compact" : ""}`}>
          {activeView === "games" ? (
            <>
              <div className="games-top-left">
                <button type="button" className="ghost-btn small back-left-btn" onClick={onBack} aria-label="Back">
                  ← Back
                </button>
              </div>

              <div className="header-center-tabs glass games-top-tabs">
                <button
                  type="button"
                  className={`dock-btn top-dock-btn ${activeView === "call" ? "active" : ""}`}
                  onClick={() => {
                    setActiveView("call");
                    setIsCallMinimized(false);
                    setIsChatSidebarOpen(false);
                  }}
                >
                  <span className="dock-label">Call</span>
                </button>
                <button
                  type="button"
                  className={`dock-btn top-dock-btn ${isChatSidebarOpen ? "active" : ""}`}
                  onClick={() => {
                    setActiveView("call");
                    setIsCallMinimized(false);
                    setIsChatSidebarOpen((prev) => !prev);
                  }}
                >
                  <span className="dock-label">Chat</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <button type="button" className="ghost-btn small back-left-btn back-icon-only" onClick={onBack} aria-label="Back">
                  ←
                </button>
                <p className="site-name">LETZTALK</p>
                <h2 className="match-title">
                  Connect with
                  <span>Random Strangers</span>
                </h2>
              </div>
              <div className="header-center-tabs glass">
                <button
                  type="button"
                  className={`dock-btn top-dock-btn ${activeView === "games" ? "active" : ""}`}
                  onClick={() => {
                    setActiveView("games");
                    setIsCallMinimized(false);
                    setSelectedGame(null);
                    setIsGameMinimized(false);
                  }}
                >
                  <span className="dock-icon">🎮</span>
                  <span className="dock-label">Games</span>
                </button>
                <button
                  type="button"
                  className={`dock-btn top-dock-btn ${activeView === "call" ? "active" : ""}`}
                  onClick={() => {
                    setActiveView("call");
                    setIsCallMinimized(false);
                    setIsChatSidebarOpen(false);
                  }}
                >
                  <span className="dock-icon">🎤</span>
                  <span className="dock-label">Call</span>
                </button>
                <button
                  type="button"
                  className={`dock-btn top-dock-btn ${isChatSidebarOpen ? "active" : ""}`}
                  onClick={() => {
                    setActiveView("call");
                    setIsCallMinimized(false);
                    setIsChatMinimized(false);
                    setIsChatSidebarOpen((prev) => !prev);
                  }}
                >
                  <span className="dock-icon">💬</span>
                  <span className="dock-label">Text Chat</span>
                </button>
              </div>

              <div className="header-actions">
                {!user && !isLoggedInUser && (
                  <button type="button" className="ghost-btn small" onClick={continueAsGuest}>
                    Guest Login
                  </button>
                )}
                {!isLoggedInUser ? (
                  <Link className="ghost-link small-link" to="/auth">
                    Login / Register
                  </Link>
                ) : (
                  <button type="button" className="ghost-btn small" onClick={logout}>
                    Logout
                  </button>
                )}
              </div>
            </>
          )}
        </header>

        <div className="match-main-area">
            {!isMatched && !shouldDirectCallFlow ? (
              <section className="connect-card glass">
                <div className="connect-icon" aria-hidden="true">
                  <img src="/letztalk.svg" alt="" className="connect-icon-logo" />
                </div>
                <h3>LETZTALK</h3>
                <p>{status === "searching" ? message || "Finding someone interesting…" : "Find a random stranger to talk with"}</p>
                <button
                  type="button"
                  className="solid-link connect-find-btn"
                  onClick={findMatch}
                  disabled={status === "searching"}
                >
                  {status === "searching" ? "⏳ FINDING..." : "🔍 FIND SOMEONE"}
                </button>
              </section>
            ) : (
              <>
                <audio ref={remoteAudioRef} autoPlay />

                <section className={`call-live-layout ${isChatSidebarOpen ? "chat-open" : ""} ${isChatMaxMode ? "chat-max" : ""}`}>
                  <div className={`call-live-main ${isChatMaxMode ? "hidden" : ""}`}>
                    {status === "searching" && activeView !== "games" && !isMiniOnlyMode && (
                      <section className="searching-inline-card glass" role="status" aria-live="polite">
                        <div className="searching-spinner" aria-hidden="true" />
                        <p>{message || "Finding stranger…"}</p>
                        <button type="button" className="ghost-btn small search-cancel-tab" onClick={cancelVoiceSearch}>
                          Cancel
                        </button>
                      </section>
                    )}

                    {showConnectedToast && !isMiniOnlyMode && (
                      <section className="searching-inline-card connected-inline-card glass" role="status" aria-live="polite">
                        <p>✅ Connected to stranger</p>
                      </section>
                    )}

                    {activeView === "games" && !isGameMinimized && (
                      <section className="games-mini-panel games-zone-embed" aria-label="Games panel">
                        <div className="games-zone-glow" aria-hidden="true" />

                        <>
                            <div className="games-panel-top-actions">
                              <button
                                type="button"
                                className="game-minimize-btn"
                                onClick={() => {
                                  setIsGameMinimized(true);
                                  setActiveView("call");
                                  setIsCallMinimized(false);
                                  setIsChatSidebarOpen(false);
                                }}
                                title="Minimize game"
                              >
                                −
                              </button>
                              {selectedGame !== null && (
                                <button type="button" className="ghost-btn small" onClick={() => setSelectedGame(null)}>
                                  ← All Games
                                </button>
                              )}
                            </div>

                            {selectedGame === null ? (
                              <>
                                <div className="games-zone-hero">
                                  <div className="games-zone-icon" aria-hidden="true">🎮</div>
                                  <h3>PLAY &amp; CONNECT</h3>
                                  <p>Break the ice with arcade-style games!</p>
                                </div>

                                <div className="games-selector-row games-zone-tabs">
                                  <button
                                    type="button"
                                    className="game-chip game-zone-chip"
                                    onClick={() => setSelectedGame("dice")}
                                  >
                                    🎲 LUDO DICE
                                  </button>
                                  <button
                                    type="button"
                                    className="game-chip game-zone-chip"
                                    onClick={() => setSelectedGame("quiz")}
                                  >
                                    🧠 GEN Z SLANG
                                  </button>
                                  <button
                                    type="button"
                                    className="game-chip game-zone-chip"
                                    onClick={() => setSelectedGame("rps")}
                                  >
                                    ✊ RPS
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="game-stage-active game-zone-stage glass">
                                {selectedGame === "dice" ? (
                                  <article className="games-3d-card game-stage-card dice-neon-stage">
                                    <h4 className="dice-neon-title">🎲 Ludo Dice Battle</h4>
                                    <p className="dice-neon-subtitle">Roll and compete to reach the highest score!</p>

                                    <div className="dice-neon-duel">
                                      <div className="dice-neon-player">
                                        <span className="dice-neon-tag you">PLAYER 1</span>
                                        <DicePips value={gameState.dice.me} isRolling={isDiceRolling} variant="you" />
                                      </div>
                                      <span className="dice-neon-vs">VS</span>
                                      <div className="dice-neon-player">
                                        <span className="dice-neon-tag bot">PLAYER 2</span>
                                        <DicePips value={gameState.dice.stranger} isRolling={isDiceRolling} variant="bot" />
                                      </div>
                                    </div>

                                    <div className="dice-neon-score-grid">
                                      <div className="dice-neon-score you">
                                        <span>🏆</span>
                                        <p>Player 1 Score</p>
                                        <strong>{inlineDiceScore.me}</strong>
                                      </div>
                                      <div className="dice-neon-score bot">
                                        <span>🏆</span>
                                        <p>Player 2 Score</p>
                                        <strong>{inlineDiceScore.stranger}</strong>
                                      </div>
                                    </div>

                                    <p className="dice-result-note">{diceResult}</p>
                                    <button type="button" className="solid-link action-btn room-ad-btn dice-roll-btn" onClick={playInlineDice} disabled={isDiceRolling}>
                                      {isDiceRolling ? "Rolling..." : "🎲 Roll Dice"}
                                    </button>
                                  </article>
                                ) : selectedGame === "rps" ? (
                                  <article className="games-3d-card game-stage-card rps-neon-stage">
                                    <h4 className="rps-neon-title">✋ Rock Paper Scissors</h4>

                                    <div className="dice-neon-duel">
                                      <div className="dice-neon-player">
                                        <span className="dice-neon-tag you">PLAYER 1</span>
                                        <div className="rps-neon-cube">{rpsMeChoice ? (rpsMeChoice === "rock" ? "✊" : rpsMeChoice === "paper" ? "✋" : "✌️") : "?"}</div>
                                      </div>
                                      <span className="dice-neon-vs">VS</span>
                                      <div className="dice-neon-player">
                                        <span className="dice-neon-tag bot">PLAYER 2</span>
                                        <div className="rps-neon-cube">{rpsPartnerChoice ? (rpsPartnerChoice === "rock" ? "✊" : rpsPartnerChoice === "paper" ? "✋" : "✌️") : "?"}</div>
                                      </div>
                                    </div>

                                    <div className="dice-neon-score-grid">
                                      <div className="dice-neon-score you">
                                        <span>🏆</span>
                                        <p>Player 1 Wins</p>
                                        <strong>{rpsInlineScore.me}</strong>
                                      </div>
                                      <div className="dice-neon-score bot">
                                        <span>🏆</span>
                                        <p>Player 2 Wins</p>
                                        <strong>{rpsInlineScore.partner}</strong>
                                      </div>
                                    </div>

                                    <p className="dice-result-note">{rpsInlineResult}</p>
                                    <div className="rps-neon-actions">
                                      <button type="button" className="rps-neon-btn rock" onClick={() => playInlineRps("rock")}>✊</button>
                                      <button type="button" className="rps-neon-btn paper" onClick={() => playInlineRps("paper")}>✋</button>
                                      <button type="button" className="rps-neon-btn scissors" onClick={() => playInlineRps("scissors")}>✌️</button>
                                    </div>
                                  </article>
                                ) : (
                                  <article className="games-3d-card game-stage-card quiz-neon-stage">
                                    <h4 className="rps-neon-title">🧠 Gen Z Slang</h4>
                                    <p className="quiz-mini-question">{QUICK_QUIZ[quizIndex].question}</p>
                                    <div className="quiz-mini-options">
                                      {QUICK_QUIZ[quizIndex].options.map((option, optionIndex) => (
                                        <button key={option} type="button" className="ghost-btn small" onClick={() => answerInlineQuiz(optionIndex)} disabled={quizAnswered}>
                                          {option}
                                        </button>
                                      ))}
                                    </div>
                                    <p className="dice-result-note">{quizFeedback}</p>
                                    <button type="button" className="solid-link action-btn room-ad-btn" onClick={nextInlineQuiz}>Next</button>
                                  </article>
                                )}
                              </div>
                            )}
                        </>
                      </section>
                    )}

                    {activeView === "call" && !isCallMinimized ? (
                      <section>
                        <div className="voice-page-toolbar">
                          <button
                            type="button"
                            className="ghost-btn small voice-minimize-btn"
                            onClick={() => {
                              setIsCallMinimized(true);
                              setIsChatSidebarOpen(true);
                              setIsChatMinimized(false);
                            }}
                            title="Minimize voice"
                            aria-label="Minimize voice"
                          >
                            −
                          </button>
                        </div>
                        <div className="voice-panels-grid">
                        <div className="voice-panel-card glass">
                          <span className="panel-label">🎤 Me</span>
                          <div className={`voice-placeholder ${isMuted ? "muted" : ""} ${localSpeaking ? "speaking" : ""} ${localStreamReady ? "online" : ""}`}>
                            <div className="voice-placeholder-logo">
                              <img src="/letztalk.svg" alt="LetzTalk" />
                            </div>
                            <p>Me</p>
                          </div>
                        </div>
                        <div className="voice-panel-card glass">
                          <span className="panel-label">👤 Stranger</span>
                          <div className={`voice-placeholder ${remoteSpeaking ? "speaking" : ""} ${remoteStreamReady ? "online" : ""}`}>
                            <div className="voice-placeholder-logo">
                              <img src="/letztalk.svg" alt="LetzTalk" />
                            </div>
                            <p>{partnerId ? "Connected to stranger" : status === "searching" ? "Finding stranger..." : "Waiting for stranger"}</p>
                          </div>
                        </div>
                        </div>
                      </section>
                    ) : activeView === "call" ? null : null}

                    {activeView === "call" && showControlDock && !isMiniOnlyMode && (
                      <div className="control-dock-wrap">
                        <section className="control-dock glass">
                          <button type="button" className={`dock-btn ${isMuted ? "report-active" : ""}`} onClick={toggleMute} title="Mute" disabled={!localStreamReady}>
                            <span className="dock-icon">{isMuted ? "🔇" : "🎙️"}</span>
                            <span className="dock-label">{isMuted ? "Mic Off" : "Mic On"}</span>
                          </button>
                          <button
                            type="button"
                            className="dock-btn"
                            onClick={skipPartner}
                            title="Next"
                            disabled={status === "searching"}
                          >
                            <span className="dock-icon">⏭️</span>
                            <span className="dock-label">Next</span>
                          </button>
                          <button
                            type="button"
                            className={`dock-btn ${showReportPanel ? "report-active" : ""}`}
                            onClick={() => setShowReportPanel((prev) => !prev)}
                            title="Report"
                            disabled={!partnerId}
                          >
                            <span className="dock-icon">🚩</span>
                            <span className="dock-label">Report/Block</span>
                          </button>
                          <button type="button" className="dock-btn danger" onClick={endCall} disabled={!partnerId} title="End">
                            <span className="dock-icon">❌</span>
                            <span className="dock-label">End</span>
                          </button>
                        </section>
                      </div>
                    )}

                  </div>

                  {isChatSidebarOpen && !isChatMinimized && (
                    <aside className="call-chat-sidebar glass chat-inline-panel">
                      <div className="call-chat-head-row">
                        <div>
                          <h3 className="call-chat-title">Text Chat</h3>
                          <p className="call-chat-subtitle">If you can't talk, text here.</p>
                        </div>
                        <button
                          type="button"
                          className="chat-minimize-btn"
                          onClick={() => {
                            if (isCallMinimized) {
                              setIsCallMinimized(false);
                              setIsChatSidebarOpen(false);
                              setIsChatMinimized(false);
                              return;
                            }

                            setIsChatSidebarOpen(false);
                            setIsChatMinimized(true);
                          }}
                          title="Minimize chat"
                        >
                          −
                        </button>
                      </div>

                      <div className="call-chat-list" ref={chatScrollRef}>
                        {chatMessages.length === 0 && <p className="hint">No chat yet. Start with a message.</p>}
                        {chatMessages.map((item) => (
                          <div key={item.id} className={`msg-bubble ${item.type === "system" ? "system" : item.fromSelf ? "self" : "peer"}`}>
                            <span>{item.text}</span>
                            {item.sentAt && <small className="msg-time">{formatTime(item.sentAt)}</small>}
                          </div>
                        ))}
                        {isPartnerTyping && <p className="typing-indicator">Partner is typing…</p>}
                      </div>

                      <div className="call-chat-input-row">
                        <input
                          value={chatDraft}
                          onChange={onChatInputChange}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              sendChatMessage();
                            }
                          }}
                          placeholder="Type a message..."
                          disabled={!partnerId}
                        />
                        <button type="button" className="solid-link action-btn send-round-btn" onClick={sendChatMessage} disabled={!partnerId}>
                          ➤
                        </button>
                      </div>
                    </aside>
                  )}
                </section>

                {activeView === "call" && showControlDock && !isMiniOnlyMode && (
                  <section className="room-feature-card glass" aria-label="Rooms features">
                    <div>
                      <h4>👥 Rooms</h4>
                      <p>Create private spaces and chat with your circle.</p>
                    </div>
                    <ul>
                      <li>Private invite-only rooms</li>
                      <li>Voice + text in one place</li>
                      <li>Moderation and safety controls</li>
                    </ul>
                    <Link to={isLoggedInUser ? "/rooms" : "/auth"} className="solid-link action-btn room-feature-btn">
                      {isLoggedInUser ? "Open Rooms" : "Login to Unlock"}
                    </Link>
                  </section>
                )}
              </>
            )}

            {isMatched && showReportPanel && !isMiniOnlyMode && (
              <section className="chat-panel glass report-panel">
                <div className="chat-header">
                  <h3>Text Chat & Safety</h3>
                  <label>
                    Report reason
                    <select value={reason} onChange={(event) => setReason(event.target.value)}>
                      <option value="inappropriate_behavior">Inappropriate behavior</option>
                      <option value="harassment">Harassment</option>
                      <option value="spam">Spam</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <p className="chat-meta">This space is optimized for calm, anonymous and moderated conversations.</p>
                {error && <p className="form-error">{error}</p>}
                {!isLoggedInUser && <p className="hint">Report and block actions require login.</p>}
                <div className="report-action-row">
                  <button type="button" className="solid-link action-btn" onClick={submitReport}>Submit Report</button>
                  <button type="button" className="ghost-link action-btn" onClick={() => setShowReportPanel(false)}>Close</button>
                </div>
              </section>
            )}
        </div>
      </div>
    </div>
  );
};

export default MatchPage;
