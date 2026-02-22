import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import http from "../api/http";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MatchPage = () => {
  const { user, isLoggedInUser, logout } = useAuth();

  const [status, setStatus] = useState("idle");
  const [mySocketId, setMySocketId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("inappropriate_behavior");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setTargetUserId("");
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
      setMySocketId(socket.id);
      setMessage("Connected. Start matching when ready.");
    });

    socket.on("matched", async ({ roomId: incomingRoomId, partnerId: incomingPartnerId }) => {
      setStatus("matched");
      setRoomId(incomingRoomId);
      setPartnerId(incomingPartnerId);
      setTargetUserId(incomingPartnerId);
      setMessage("Match found. Starting secure video session...");
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
    setMessage("Searching for an available partner...");
    setStatus("searching");
    socketRef.current?.emit("find_match");
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

    if (!targetUserId) {
      setError("Target user id is required.");
      return;
    }

    try {
      await http.post("/mod/report", {
        reportedUserId: targetUserId,
        reason,
        roomId,
      });
      setMessage("Report submitted successfully.");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to submit report.");
    }
  };

  const submitBlock = async () => {
    if (!isLoggedInUser) {
      setError("Login is required for blocking.");
      return;
    }

    if (!targetUserId) {
      setError("Target user id is required.");
      return;
    }

    try {
      await http.post("/mod/block", {
        blockedUserId: targetUserId,
      });
      setMessage("User blocked successfully.");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to block user.");
    }
  };

  return (
    <div className="center-screen">
      <div className="match-shell">
        <header className="match-header">
          <div>
            <h2>LetzTalk Live</h2>
            <p>
              {user?.username || "Anonymous"} · {user?.isGuest ? "Guest" : "Registered"}
            </p>
            <p className="mono">Socket: {mySocketId || "connecting..."}</p>
          </div>
          <button type="button" className="ghost-btn small" onClick={logout}>
            Logout
          </button>
        </header>

        <section className="video-grid">
          <div className="video-card">
            <span>You</span>
            <video ref={localVideoRef} autoPlay playsInline muted />
          </div>
          <div className="video-card">
            <span>Partner {partnerId ? `(${partnerId})` : ""}</span>
            <video ref={remoteVideoRef} autoPlay playsInline />
          </div>
        </section>

        <section className="actions-row">
          <button type="button" onClick={findMatch} disabled={status === "searching" || status === "matched"}>
            {status === "searching" ? "Searching..." : "Find Match"}
          </button>
          <button type="button" onClick={skipPartner} disabled={!partnerId}>
            Skip
          </button>
          <button type="button" className="danger" onClick={endCall} disabled={!partnerId}>
            End Call
          </button>
        </section>

        <section className="mod-card">
          <h3>Safety controls</h3>
          <div className="mod-grid">
            <label>
              Target user id
              <input
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="Mongo user id"
              />
            </label>

            <label>
              Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="inappropriate_behavior">Inappropriate behavior</option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="actions-row compact">
            <button type="button" onClick={submitReport}>
              Report
            </button>
            <button type="button" className="danger" onClick={submitBlock}>
              Block
            </button>
          </div>
          {!isLoggedInUser && (
            <p className="hint">Guest mode can match and call, but moderation API requires login.</p>
          )}
        </section>

        <footer className="status-row">
          <span>Status: {status}</span>
          {message && <span className="ok">{message}</span>}
          {error && <span className="err">{error}</span>}
        </footer>
      </div>
    </div>
  );
};

export default MatchPage;
