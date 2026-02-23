import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import http from "../api/http";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MatchPage = () => {
  const { user, isLoggedInUser, continueAsGuest, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const closePeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteStreamReady(false);
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

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    setLocalStreamReady(true);

    return stream;
  }, []);

  const createPeer = useCallback(async (targetSocketId) => {
    closePeer();

    const stream = await ensureLocalMedia();
    const peer = new RTCPeerConnection(ICE_CONFIG);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
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
  }, [closePeer, ensureLocalMedia]);

  const resetMatchState = useCallback((nextMessage = "") => {
    setPartnerId("");
    setRoomId("");
    setStatus("idle");
    setMessage(nextMessage);
    setError("");
    setShowReportPanel(false);
    closePeer();
  }, [closePeer]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setMessage("Connected. Start matching when ready.");
    });

    socket.on("matched", async ({ roomId: incomingRoomId, partnerId: incomingPartnerId }) => {
      setStatus("matched");
      setRoomId(incomingRoomId);
      setPartnerId(incomingPartnerId);
      setMessage("You’re connected ✨");
      setError("");
      setShowReportPanel(false);

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

    socket.on("partner_skipped", () => {
      resetMatchState("Partner skipped. Ready for the next match.");
    });

    socket.on("partner_disconnected", () => {
      resetMatchState("Partner disconnected.");
    });

    socket.on("call_end", () => {
      resetMatchState("Call ended by partner.");
    });

    socket.on("disconnect", () => {
      setStatus("offline");
      setMessage("Socket disconnected. Reconnecting...");
    });

    return () => {
      socket.disconnect();
      closePeer();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      setLocalStreamReady(false);
      setRemoteStreamReady(false);
    };
  }, [closePeer, createPeer, resetMatchState]);

  const findMatch = () => {
    setError("");
    setMessage("Finding someone interesting…");
    setStatus("searching");
    socketRef.current?.emit("find_match");
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
    resetMatchState("You skipped this partner.");
  };

  const endCall = () => {
    if (partnerId) {
      socketRef.current?.emit("call_end", { to: partnerId });
    }
    resetMatchState("Call ended.");
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

  const isMatched = status === "matched";

  return (
    <div className="center-screen">
      <div className="match-shell glass">
        <header className="match-header">
          <div>
            <p className="site-name">LETZTALK</p>
            <h2 className="match-title">
              Connect with
              <span>Random Strangers</span>
            </h2>
          </div>
          <div className="header-actions">
            {!user && (
              <button type="button" className="ghost-btn small" onClick={continueAsGuest}>
                Optional Guest Login
              </button>
            )}
            {!isLoggedInUser && (
              <Link className="ghost-link small-link" to="/auth">
                Login / Register
              </Link>
            )}
            {isLoggedInUser && (
              <button type="button" className="ghost-btn small" onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </header>

        <div className="match-main-area">
            {!isMatched ? (
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
              <section className="video-grid">
                <div className="video-card glass">
                  <span>Voice Panel · You</span>
                  <div className={`video-media-wrap ${localStreamReady ? "has-stream" : ""}`}>
                    <video ref={localVideoRef} autoPlay playsInline muted onLoadedData={() => setLocalStreamReady(true)} />
                    {!localStreamReady && (
                      <div className="video-placeholder">
                        <div className="video-placeholder-icon">🎤</div>
                        <p>Enable microphone to start</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="video-card glass">
                  <span>Voice Panel · {partnerId ? "Partner connected" : "Waiting for match"}</span>
                  <div className={`video-media-wrap ${remoteStreamReady ? "has-stream" : ""}`}>
                    <video ref={remoteVideoRef} autoPlay playsInline onLoadedData={() => setRemoteStreamReady(true)} />
                    {!remoteStreamReady && (
                      <div className="video-placeholder">
                        <div className="video-placeholder-icon">👤</div>
                        <p>{partnerId ? "Waiting for partner voice" : "Waiting for match"}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {isMatched && showReportPanel && (
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

        {isMatched && (
          <div className="control-dock-wrap">
            <section className="control-dock glass">
              <button
                type="button"
                className="dock-btn"
                onClick={() => window.open("/games", "_blank", "noopener,noreferrer")}
                title="Games"
              >
                <span className="dock-icon">🎮</span>
                <span className="dock-label">Games</span>
              </button>
              <button
                type="button"
                className="dock-btn"
                onClick={() => window.open("/message", "_blank", "noopener,noreferrer")}
                title="Chat"
              >
                <span className="dock-icon">💬</span>
                <span className="dock-label">Chat</span>
              </button>
              <button type="button" className="dock-btn" onClick={toggleMute} title="Mute">
                <span className="dock-icon">{isMuted ? "🔇" : "🎤"}</span>
                <span className="dock-label">Mute</span>
              </button>
              <button
                type="button"
                className="dock-btn"
                onClick={skipPartner}
                title="Next"
              >
                <span className="dock-icon">⏭️</span>
                <span className="dock-label">People</span>
              </button>
              <button
                type="button"
                className={`dock-btn ${showReportPanel ? "report-active" : ""}`}
                onClick={() => setShowReportPanel((prev) => !prev)}
                title="Report"
              >
                <span className="dock-icon">🚩</span>
                <span className="dock-label">Report</span>
              </button>
              <button type="button" className="dock-btn danger" onClick={endCall} disabled={!partnerId} title="End">
                <span className="dock-icon">❌</span>
                <span className="dock-label">End</span>
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchPage;
