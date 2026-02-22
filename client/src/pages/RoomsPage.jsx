import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

const RoomsPage = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [displayName, setDisplayName] = useState(user?.username || "Guest");
  const [roomName, setRoomName] = useState("My Chill Room");
  const [joinCode, setJoinCode] = useState("");
  const [chatText, setChatText] = useState("");
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("Connecting...");
  const [error, setError] = useState("");

  const canChat = Boolean(room?.code);
  const welcomeName = useMemo(() => displayName.trim() || "Guest", [displayName]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected. Create or join a room.");
    });

    socket.on("room_joined", ({ room: incomingRoom }) => {
      setRoom(incomingRoom);
      setMessages([{ id: Date.now(), text: `Joined room ${incomingRoom.name}`, system: true }]);
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
    socketRef.current?.emit("create_room", { roomName: roomName.trim(), displayName: welcomeName });
  };

  const joinRoom = () => {
    socketRef.current?.emit("join_room", { roomCode: joinCode.trim().toUpperCase(), displayName: welcomeName });
  };

  const leaveRoom = () => {
    socketRef.current?.emit("leave_room");
    setRoom(null);
    setMessages([]);
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
      <div className="feature-shell glass">
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
          {room?.code && <span className="mono">Room Code: {room.code}</span>}
        </section>

        <section className="rooms-grid">
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

          <div className="room-card glass">
            <h3>Join Room</h3>
            <label>
              Room Code
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Enter code" />
            </label>
            <button type="button" className="ghost-link" onClick={joinRoom}>Join</button>
            <button type="button" className="ghost-link" onClick={leaveRoom} disabled={!canChat}>Leave Room</button>
          </div>
        </section>

        {room && (
          <section className="room-card glass">
            <h3>{room.name}</h3>
            <p className="mono">Members: {room.members.join(", ")}</p>
            <div className="messages-list room-msg-list">
              {messages.map((item) => (
                <div key={item.id} className={`msg-bubble ${item.system ? "peer" : "self"}`}>{item.text}</div>
              ))}
            </div>
            <div className="messages-input-row">
              <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Type room message..." />
              <button type="button" className="solid-link action-btn" onClick={sendRoomMessage}>Send</button>
            </div>
          </section>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="home-actions">
          <Link to="/" className="ghost-link">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default RoomsPage;
