import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const HomePage = () => {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const onStartGuest = async () => {
    setLoadingGuest(true);
    try {
      await continueAsGuest();
      navigate("/call");
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="home-layout landing-grid-bg">
      <div className="landing-container">
        <div className="home-card glass landing-shell">
          <div className="landing-glow" aria-hidden="true" />
          <h1 className="landing-title">
            Connect with
            <span>Random Strangers</span>
          </h1>

          <p className="landing-subtitle">
            Voice calls, text chat, and fun games with people across India. No strings attached,
            just pure spontaneous connections.
          </p>

          <div className="landing-actions">
            <button type="button" className="solid-link landing-primary" onClick={onStartGuest} disabled={loadingGuest}>
              📞 {loadingGuest ? "Starting..." : "START AS GUEST"}
            </button>
            <Link to="/auth" className="ghost-link landing-secondary">
              Sign Up / Login
            </Link>
          </div>

          <div className="trust-row landing-trust">
            <span>🔒 Anonymous</span>
            <span>🛡️ Moderated</span>
            <span>⚡ Instant</span>
          </div>
        </div>

        <section className="feature-grid" aria-label="Platform features">
          <Link to="/call" className="feature-card feature-link glass" aria-label="Go to Random Voice Calls">
            <div className="feature-icon pink">📞</div>
            <h3>Random Voice Calls</h3>
            <p>Connect instantly with strangers through voice. Mute, unmute, or end anytime.</p>
          </Link>

          <Link to="/message" className="feature-card feature-link glass" aria-label="Go to Text Chat">
            <div className="feature-icon blue">💬</div>
            <h3>Text Chat</h3>
            <p>Prefer typing? Chat randomly with people who share your vibe.</p>
          </Link>

          <Link to="/games" className="feature-card feature-link glass" aria-label="Go to Play Games">
            <div className="feature-icon green">🎮</div>
            <h3>Play Games</h3>
            <p>Break the ice with Ludo or learn Gen Z slang through quiz games.</p>
          </Link>

          <Link to="/music" className="feature-card feature-link glass" aria-label="Go to Music Room">
            <div className="feature-icon purple">🎵</div>
            <h3>Neon Nexus Music</h3>
            <p>Vibe together with shared playlists, voice chat, and collaborative music.</p>
          </Link>

          <Link to="/rooms" className="feature-card feature-link glass" aria-label="Go to Create Rooms">
            <div className="feature-icon violet">👥</div>
            <h3>Create Rooms</h3>
            <p>Make your own space with music, seats, and invite your friends.</p>
          </Link>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
