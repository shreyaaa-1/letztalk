import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import http from "../api/http";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MatchPage = ({ defaultFeature = "voice" }) => {
  const { user, isLoggedInUser, continueAsGuest, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState("idle");
  const [partnerId, setPartnerId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [reason, setReason] = useState("inappropriate_behavior");
  const [message, setMessage] = useState(() => location.state?.notice || "");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);

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
  }, []);

  const ensureLocalMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

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

  const feature = searchParams.get("feature") || defaultFeature;
  const featureLabel = feature === "text" ? "Text chat" : feature === "games" ? "Games" : "Voice call";
  const statusText = status === "searching" ? "Finding someone interesting…" : status === "matched" ? "You’re connected ✨" : message || "Ready when you are.";

  return (
    <div className="center-screen">
      <div className="match-shell glass">
        <header className="match-header">
          <div>
            <h2 className="match-title">
              Connect with
              <span>Random Strangers</span>
            </h2>
            <p>
              {user?.username || "Anonymous"} · {user ? (user?.isGuest ? "Guest" : "Registered") : "No login"}
            </p>
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
            {user && (
              <button type="button" className="ghost-btn small" onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </header>

        <section className="match-status glass">
          <span className={`pulse ${status === "matched" ? "live" : ""}`} />
          <strong>{statusText}</strong>
          <span className="mono">Mode: {featureLabel}</span>
        </section>

        <section className="video-grid">
          <div className="video-card glass">
            <span>Voice Panel · You</span>
            <video ref={localVideoRef} autoPlay playsInline muted />
          </div>
          <div className="video-card glass">
            <span>Voice Panel · {partnerId ? "Partner connected" : "Waiting for match"}</span>
            <video ref={remoteVideoRef} autoPlay playsInline />
          </div>
        </section>

        <section className="chat-panel glass">
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
        </section>

        <div className="control-dock-wrap">
          <section className="control-dock glass">
            <button type="button" className="dock-btn" onClick={toggleMute} title="Mute">
              <span>{isMuted ? "🔇" : "🎤"}</span>
            </button>
            <button
              type="button"
              className="dock-btn"
              onClick={status === "matched" ? skipPartner : findMatch}
              title="Next"
            >
              <span>⏭️</span>
            </button>
            <button type="button" className="dock-btn" onClick={submitReport} title="Report">
              <span>🚩</span>
            </button>
            <button type="button" className="dock-btn danger" onClick={endCall} disabled={!partnerId} title="End">
              <span>❌</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MatchPage;
