import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const initialTracks = [
  { id: 1, name: "Lo-Fi Chill Beats", artist: "Lo-Fi System", genre: "Lo-Fi", likes: 24, addedBy: "System", url: "" },
  { id: 2, name: "Ambient Waves", artist: "Ambient Studio", genre: "Ambient", likes: 18, addedBy: "System", url: "" },
  { id: 3, name: "Electronic Dreams", artist: "Synth Wave", genre: "Electronic", likes: 31, addedBy: "System", url: "" },
  { id: 4, name: "Jazz in the Night", artist: "Jazz Collective", genre: "Jazz", likes: 12, addedBy: "System", url: "" },
  { id: 5, name: "Rock Anthem", artist: "Rock Masters", genre: "Rock", likes: 42, addedBy: "System", url: "" },
  { id: 6, name: "Classical Piano", artist: "Piano Virtuoso", genre: "Classical", likes: 9, addedBy: "System", url: "" },
];

const voiceSeatsInitial = [
  { id: 1, occupied: false, user: null },
  { id: 2, occupied: false, user: null },
  { id: 3, occupied: false, user: null },
  { id: 4, occupied: false, user: null },
  { id: 5, occupied: false, user: null },
];

const RoomsPage = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [displayName, setDisplayName] = useState(user?.username || "Guest");
  const [roomName, setRoomName] = useState("My Chill Room");
  const [joinCode, setJoinCode] = useState("");
  const [chatText, setChatText] = useState("");
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("Connecting...");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  // Music room state
  const [currentTrackId, setCurrentTrackId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tracks, setTracks] = useState(initialTracks);
  const [likedTracks, setLikedTracks] = useState([]);
  const [trackName, setTrackName] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [showJoinSection, setShowJoinSection] = useState(false);

  const isRegistered = user && user.username && user.username !== "Guest";
  const canChat = Boolean(room?.code);
  const welcomeName = useMemo(() => displayName.trim() || "Guest", [displayName]);
  const currentTrack = useMemo(() => tracks.find((t) => t.id === currentTrackId) || tracks[0], [tracks, currentTrackId]);

  const showToast = (text, type = "info") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  };

  const handleNextTrack = useCallback(() => {
    setCurrentTrackId((prevId) => {
      const currentIndex = tracks.findIndex((t) => t.id === prevId);
      const nextIndex = (currentIndex + 1) % tracks.length;
      showToast(`🎵 Playing: ${tracks[nextIndex].name}`);
      return tracks[nextIndex].id;
    });
  }, [tracks]);

  const handlePrevTrack = useCallback(() => {
    setCurrentTrackId((prevId) => {
      const currentIndex = tracks.findIndex((t) => t.id === prevId);
      const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      showToast(`🎵 Playing: ${tracks[prevIndex].name}`);
      return tracks[prevIndex].id;
    });
  }, [tracks]);

  const handlePlayTrack = (trackId) => {
    setCurrentTrackId(trackId);
    setIsPlaying(true);
    setProgress(0);
    showToast(`🎵 Playing: ${tracks.find((t) => t.id === trackId)?.name}`);
  };

  const handleLikeTrack = (trackId) => {
    if (likedTracks.includes(trackId)) {
      setLikedTracks((prev) => prev.filter((id) => id !== trackId));
      showToast("💔 Removed from likes");
    } else {
      setLikedTracks((prev) => [...prev, trackId]);
      showToast("❤️ Added to likes");
    }
  };

  const handleAddTrack = () => {
    if (trackName.trim()) {
      const newTrack = {
        id: tracks.length + 1,
        name: trackName,
        artist: "Unknown",
        genre: "Music",
        likes: 0,
        addedBy: welcomeName,
        url: trackUrl,
      };
      setTracks((prev) => [...prev, newTrack]);
      showToast(`✨ "${trackName}" added to shared playlist`);
      setTrackName("");
      setTrackUrl("");
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected. Create or join a room.");
    });

    socket.on("room_joined", ({ room: incomingRoom }) => {
      setRoom(incomingRoom);
      setMessages([{ id: Date.now(), text: `Joined room ${incomingRoom.name}`, system: true }]);
      setStatus(`Connected in ${incomingRoom.name}`);
      setJoinCode(incomingRoom.code || "");
      setError("");
    });

    socket.on("room_updated", ({ room: incomingRoom }) => {
      setRoom(incomingRoom);
    });

    socket.on("room_message", ({ senderName, text }) => {
      setMessages((prev) => [...prev, { id: Date.now() + Math.random(), text: `${senderName}: ${text}`, system: false }]);
    });

    socket.on("room_error", ({ message }) => {
      setError(message || "Room action failed.");
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected. Reconnecting...");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = () => {
    setError("");
    setStatus("Creating room...");
    socketRef.current?.emit("create_room", { roomName: roomName.trim(), displayName: welcomeName });
  };

  const joinRoom = () => {
    if (joinCode.trim().length !== 4) {
      setError("Enter a valid 4-digit room code.");
      return;
    }

    setError("");
    setStatus("Joining room...");
    socketRef.current?.emit("join_room", { roomCode: joinCode.trim(), displayName: welcomeName });
  };

  const leaveRoom = () => {
    socketRef.current?.emit("leave_room");
    setRoom(null);
    setMessages([]);
    setStatus("Connected. Create or join a room.");
  };

  const onCopyRoomCode = async () => {
    if (!room?.code || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Unable to copy room code right now.");
    }
  };

  const sendRoomMessage = () => {
    const text = chatText.trim();
    if (!text || !room?.code) {
      return;
    }

    socketRef.current?.emit("room_message", { text });
    setChatText("");
  };

  return (
    <div className="center-screen">
      <div className="feature-shell refresh-shell glass">
        <header className="feature-header">
          <div>
            <h1>Rooms</h1>
            <p>Create a room, invite friends, and chat live.</p>
          </div>
          <div className="header-actions">
            <Link className="ghost-link small-link" to="/call">Call</Link>
            <Link className="ghost-link small-link" to="/message">Message</Link>
            <Link className="ghost-link small-link" to="/games">Games</Link>
          </div>
        </header>

        <section className="match-status glass">
          <span className="pulse" />
          <strong>{status}</strong>
          {room?.code && (
            <button type="button" className="room-code-chip" onClick={onCopyRoomCode}>
              Room Code: {room.code} {copied ? "✓" : "📋"}
            </button>
          )}
        </section>

        <section className="rooms-grid rooms-grid-polished">
          <div className="room-card glass">
            <h3>Create Room</h3>
            <label>
              Display Name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Room Name
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
            </label>
            <button type="button" className="solid-link action-btn" onClick={createRoom}>Create Room</button>
          </div>

          {!isRegistered ? (
            <div className="room-card glass auth-prompt">
              <h3>🔐 Members Only</h3>
              <p>Sign up or login to join rooms and collaborate with others.</p>
              <div className="auth-prompt-actions">
                <Link to="/auth" className="solid-link action-btn">Sign Up / Login</Link>
              </div>
            </div>
          ) : (
            <div className="room-card glass">
              <button
                type="button"
                className={`room-toggle-btn ${showJoinSection ? "active" : ""}`}
                onClick={() => setShowJoinSection(!showJoinSection)}
              >
                <span className="toggle-icon">{showJoinSection ? "▼" : "▶"}</span>
                <span>Join Existing Room</span>
              </button>
              {showJoinSection && (
                <div className="join-room-content">
                  <label>
                    Room Code
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="4-digit code"
                      inputMode="numeric"
                      maxLength={4}
                    />
                  </label>
                  <div className="join-actions">
                    <button type="button" className="solid-link action-btn" onClick={joinRoom}>Join</button>
                    <button type="button" className="ghost-link action-btn" onClick={leaveRoom} disabled={!canChat}>Leave Room</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {room && (
          <section className="music-room-layout">
            {/* LEFT COLUMN: Voice + Music */}
            <div className="room-left-col">
              {/* Voice Section */}
              <div className="voice-section">
                <h3>🎤 Voice Chat</h3>
                <div className="voice-seats-grid">
                  {voiceSeatsInitial.map((seat) => (
                    <button
                      key={seat.id}
                      type="button"
                      className={`voice-seat ${seat.occupied ? "occupied" : "empty"}`}
                    >
                      <span className="seat-number">{seat.id}</span>
                      {seat.occupied && <span className="seat-user">{seat.user}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Music Player Section */}
              <div className="music-player-section">
                {currentTrack && (
                  <div className="now-playing-card">
                    <div className="track-cover">
                      <div className="cover-placeholder">🎵</div>
                    </div>
                    <h4>{currentTrack.name}</h4>
                    <p className="artist-name">{currentTrack.artist}</p>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: isPlaying ? `${(progress / 180) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <div className="controls">
                      <button
                        type="button"
                        onClick={handlePrevTrack}
                        className="control-btn"
                        title="Previous track"
                      >
                        ⏮️
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="control-btn play-btn"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? "⏸️" : "▶️"}
                      </button>
                      <button
                        type="button"
                        onClick={handleNextTrack}
                        className="control-btn"
                        title="Next track"
                      >
                        ⏭️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLikeTrack(currentTrack.id)}
                        className={`control-btn like-btn ${likedTracks.includes(currentTrack.id) ? "liked" : ""}`}
                        title={likedTracks.includes(currentTrack.id) ? "Remove from likes" : "Add to likes"}
                      >
                        {likedTracks.includes(currentTrack.id) ? "❤️" : "🤍"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Playlist + Chat */}
            <div className="room-right-col">
              {/* Playlist Section */}
              <div className="playlist-section">
                <h3>🎵 Shared Playlist</h3>
                <div className="tracks-list">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      className={`track-item ${currentTrackId === track.id ? "active" : ""}`}
                      onClick={() => handlePlayTrack(track.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handlePlayTrack(track.id)}
                    >
                      <div className="track-info">
                        <div className="track-name">{track.name}</div>
                        <div className="track-meta">
                          {track.artist} • {track.genre}
                        </div>
                      </div>
                      <div className="track-actions">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLikeTrack(track.id);
                          }}
                          className={`like-mini ${likedTracks.includes(track.id) ? "liked" : ""}`}
                          title={likedTracks.includes(track.id) ? "Remove like" : "Add like"}
                        >
                          {likedTracks.includes(track.id) ? "❤️" : "🤍"}
                        </button>
                        <span className="track-likes">{track.likes}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Track Section */}
                <div className="add-track-section">
                  <h4>➕ Add Track</h4>
                  <input
                    type="text"
                    value={trackName}
                    onChange={(e) => setTrackName(e.target.value)}
                    placeholder="Track name..."
                    className="track-input"
                  />
                  <input
                    type="url"
                    value={trackUrl}
                    onChange={(e) => setTrackUrl(e.target.value)}
                    placeholder="URL (optional)"
                    className="track-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddTrack}
                    className="solid-link add-track-btn"
                  >
                    Add to Playlist
                  </button>
                </div>
              </div>

              {/* Chat Section */}
              <div className="chat-section">
                <h3>💬 Room Chat</h3>
                <div className="messages-list room-msg-list">
                  {messages.map((item) => (
                    <div key={item.id} className={`msg-bubble ${item.system ? "system" : "user"}`}>
                      {item.text}
                    </div>
                  ))}
                </div>
                <div className="messages-input-row">
                  <input
                    value={chatText}
                    onChange={(event) => setChatText(event.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendRoomMessage()}
                    placeholder="Type message..."
                  />
                  <button type="button" className="solid-link action-btn" onClick={sendRoomMessage}>
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Room Info Footer */}
            <div className="room-footer">
              <div className="room-info">
                <h4>{room.name}</h4>
                <p className="mono">Members: {room.members.join(", ")}</p>
              </div>
              <button type="button" className="ghost-link" onClick={leaveRoom}>
                Leave Room
              </button>
            </div>
          </section>
        )}

        {error && <p className="form-error room-error">{error}</p>}

        {toast && <div className={`toast-notification ${toast.type}`}>{toast.text}</div>}

        <div className="home-actions">
          <Link to="/" className="ghost-link">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default RoomsPage;
