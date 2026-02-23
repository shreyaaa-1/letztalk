import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const initialTracks = [
  { id: 1, name: "Lo-Fi Chill Beats", artist: "Lo-Fi System", genre: "Lo-Fi", likes: 24, addedBy: "System", url: "" },
  { id: 2, name: "Ambient Waves", artist: "Ambient Studio", genre: "Ambient", likes: 18, addedBy: "System", url: "" },
  { id: 3, name: "Electronic Dreams", artist: "Synth Wave", genre: "Electronic", likes: 31, addedBy: "System", url: "" },
  { id: 4, name: "Jazz in the Night", artist: "Jazz Collective", genre: "Jazz", likes: 12, addedBy: "System", url: "" },
  { id: 5, name: "Rock Anthem", artist: "Rock Masters", genre: "Rock", likes: 42, addedBy: "System", url: "" },
  { id: 6, name: "Classical Piano", artist: "Piano Virtuoso", genre: "Classical", likes: 9, addedBy: "System", url: "" },
];

const VoiceSeats = ({ seats, currentUser }) => {
  const [localSeats, setLocalSeats] = useState(seats);

  const toggleSeat = (seatIndex) => {
    setLocalSeats((prev) =>
      prev.map((seat, idx) =>
        idx === seatIndex
          ? seat.occupied && seat.user === currentUser.id
            ? { ...seat, occupied: false, user: null, mic: false }
            : { ...seat, occupied: true, user: currentUser.id, mic: true }
          : seat
      )
    );
  };

  return (
    <div className="voice-section">
      <h3>🎤 Voice Seats</h3>
      <div className="seats-grid">
        {localSeats.map((seat, idx) => (
          <button
            key={idx}
            className={`voice-seat ${seat.occupied ? "occupied" : "empty"}`}
            onClick={() => toggleSeat(idx)}
            title={seat.occupied ? `${seat.username} - Mic ${seat.mic ? "On" : "Off"}` : "Click to take seat"}
          >
            <span className="seat-icon">👤</span>
            <span className="seat-label">{seat.occupied ? seat.username || "User" : "Empty"}</span>
            {seat.occupied && seat.mic && <span className="mic-badge">🎙️</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

const MusicPlayer = ({ currentTrack, isPlaying, progress, duration, onPlay, onNext, onPrev, onProgressChange, onLike, likedTracks }) => {
  return (
    <div className="music-player-section">
      <div className="now-playing-card">
        <span className="label">NOW PLAYING</span>
        <h2>{currentTrack.name}</h2>
        <p className="artist">{currentTrack.artist}</p>
        <p className="added-by">Added by: <strong>{currentTrack.addedBy}</strong></p>
        <div className="genre-badge">{currentTrack.genre}</div>
      </div>

      <div className="player-controls">
        <button className="control-btn" onClick={onPrev} title="Previous track">⏮️</button>
        <button className="play-btn" onClick={onPlay} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? "⏸️" : "▶️"}
        </button>
        <button className="control-btn" onClick={onNext} title="Next track">⏭️</button>
      </div>

      <div className="progress-container">
        <span className="time">0:00</span>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={progress}
          onChange={(e) => onProgressChange(Number(e.target.value))}
          className="progress-slider"
        />
        <span className="time">{duration || "0:00"}</span>
      </div>

      <div className="player-actions">
        <button className="action-btn" onClick={() => onLike(currentTrack.id)} title="Like this track">
          {likedTracks.includes(currentTrack.id) ? "❤️" : "🤍"} Like
        </button>
        <span className="like-count">{currentTrack.likes + (likedTracks.includes(currentTrack.id) ? 1 : 0)} Likes</span>
      </div>
    </div>
  );
};

const PlaylistSection = ({ tracks, currentTrackId, onTrackSelect, onLike, likedTracks }) => {
  return (
    <div className="playlist-section">
      <h3>🎵 Shared Playlist</h3>
      <p className="track-count">{tracks.length} tracks</p>
      <div className="playlist-container">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`playlist-item ${currentTrackId === track.id ? "current" : ""}`}
            onClick={() => onTrackSelect(track.id)}
          >
            <span className="play-icon">{currentTrackId === track.id ? "▶️" : "♫"}</span>
            <div className="track-info">
              <span className="track-name">{track.name}</span>
              <span className="track-artist">{track.artist}</span>
            </div>
            <button
              className="like-btn"
              onClick={(e) => {
                e.stopPropagation();
                onLike(track.id);
              }}
            >
              {likedTracks.includes(track.id) ? "❤️" : "🤍"}
            </button>
            <span className="track-likes">{track.likes + (likedTracks.includes(track.id) ? 1 : 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AddTrackSection = ({ onAddTrack }) => {
  const [trackName, setTrackName] = useState("");
  const [trackUrl, setTrackUrl] = useState("");

  const handleAdd = () => {
    if (trackName.trim()) {
      onAddTrack({ name: trackName, url: trackUrl });
      setTrackName("");
      setTrackUrl("");
    }
  };

  return (
    <div className="add-track-section">
      <h3>🎶 Share Your Music Taste</h3>
      <div className="add-track-form">
        <input
          type="text"
          placeholder="Track name..."
          value={trackName}
          onChange={(e) => setTrackName(e.target.value)}
          className="form-input"
        />
        <input
          type="text"
          placeholder="MP3 URL..."
          value={trackUrl}
          onChange={(e) => setTrackUrl(e.target.value)}
          className="form-input"
        />
        <button className="add-btn" onClick={handleAdd}>+ Add</button>
      </div>
    </div>
  );
};

const RoomChatSection = ({ messages, onSendMessage, currentUser }) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText("");
    }
  };

  return (
    <div className="chat-section">
      <h3>💬 Room Chat</h3>
      <div className="messages-container">
        {messages.length === 0 ? (
          <p className="no-messages">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.userId === currentUser.id ? "own" : ""}`}>
              <span className="username">{msg.username}</span>
              <p className="text">{msg.text}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-wrap">
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          className="chat-input"
        />
        <button className="send-btn" onClick={handleSend}>➤</button>
      </div>
    </div>
  );
};

const MusicRoomPage = () => {
  const [currentTrackId, setCurrentTrackId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tracks, setTracks] = useState(initialTracks);
  const [messages, setMessages] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const currentUser = useMemo(() => ({ id: 1, name: "shreya", avatar: "S" }), []);

  const voiceSeatsInitial = [
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
    { occupied: false, user: null, username: "", mic: false },
  ];

  const currentTrack = useMemo(() => tracks.find((t) => t.id === currentTrackId) || tracks[0], [tracks, currentTrackId]);

  const showToast = (text, type = "info") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  };

  const handlePlayTrack = (trackId) => {
    setCurrentTrackId(trackId);
    setIsPlaying(true);
    setProgress(0);
    showToast(`🎵 Playing: ${tracks.find((t) => t.id === trackId)?.name}`);
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

  const handleLikeTrack = (trackId) => {
    if (likedTracks.includes(trackId)) {
      setLikedTracks((prev) => prev.filter((id) => id !== trackId));
      showToast("💔 Removed from likes");
    } else {
      setLikedTracks((prev) => [...prev, trackId]);
      showToast("❤️ Added to likes");
    }
  };

  const handleAddTrack = ({ name, url }) => {
    const newTrack = {
      id: tracks.length + 1,
      name,
      artist: "Unknown",
      genre: "Music",
      likes: 0,
      addedBy: currentUser.name,
      url,
    };
    setTracks((prev) => [...prev, newTrack]);
    showToast(`✨ "${name}" added to shared playlist`);
  };

  const handleSendMessage = (text) => {
    const newMessage = {
      userId: currentUser.id,
      username: currentUser.name,
      text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    showToast("✓ Message sent");
  };

  // Simulate progress bar movement
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextTrack();
          return 0;
        }
        return prev + 0.5;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, handleNextTrack]);

  return (
    <div className="center-screen">
      <div className="feature-shell refresh-shell glass">
        {toast && <div className={`game-toast ${toast.type}`}>{toast.text}</div>}

        <header className="feature-header">
          <div>
            <h1>🎵 Neon Nexus</h1>
            <p>Collaborative Music Room - Share, Play, Vibe Together</p>
          </div>
          <div className="header-actions">
            <Link className="ghost-link small-link" to="/call">Call</Link>
            <Link className="ghost-link small-link" to="/games">Games</Link>
            <Link className="ghost-link small-link" to="/rooms">Rooms</Link>
          </div>
        </header>

        <div className="music-room-layout">
          {/* Left Column: Voice + Music Player */}
          <div className="music-room-left">
            <VoiceSeats seats={voiceSeatsInitial} currentUser={currentUser} />
            <MusicPlayer
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              progress={progress}
              duration={100}
              onPlay={() => setIsPlaying(!isPlaying)}
              onNext={handleNextTrack}
              onPrev={handlePrevTrack}
              onProgressChange={setProgress}
              onLike={handleLikeTrack}
              likedTracks={likedTracks}
            />
            <AddTrackSection onAddTrack={handleAddTrack} />
          </div>

          {/* Right Column: Playlist + Chat */}
          <div className="music-room-right">
            <PlaylistSection
              tracks={tracks}
              currentTrackId={currentTrackId}
              onTrackSelect={handlePlayTrack}
              onLike={handleLikeTrack}
              likedTracks={likedTracks}
            />
            <RoomChatSection messages={messages} onSendMessage={handleSendMessage} currentUser={currentUser} />
          </div>
        </div>

        <div className="home-actions">
          <Link to="/" className="ghost-link">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default MusicRoomPage;
