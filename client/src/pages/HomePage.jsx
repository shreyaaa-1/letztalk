import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const thoughtSlides = [
  "💭 Talk freely with people beyond your circle.",
  "⚡ One click and you are connected.",
  "🎮 Play, chat, and vibe in one place.",
  "🔒 Stay anonymous, stay safe.",
];

const HomePage = () => {
  const navigate = useNavigate();
  const { continueAsGuest, isLoggedInUser, logout } = useAuth();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const onStartGuest = async () => {
    setLoadingGuest(true);
    try {
      await continueAsGuest();
      navigate("/call?feature=voice");
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="home-layout landing-grid-bg site-home">
      <div className="landing-container">
        <section className="home-connect-shell glass" aria-label="Connect section">
          <header className="match-header">
            <div>
              <p className="site-name">LETZTALK</p>
              <h2 className="match-title">
                Connect with
                <span>Random Strangers</span>
              </h2>
            </div>
            <div className="header-actions">
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

          <div className="home-connect-row">
            <section className="connect-card glass">
              <div className="connect-icon" aria-hidden="true">
                <img src="/letztalk.svg" alt="" className="connect-icon-logo" />
              </div>
              <h3>LETZTALK</h3>
              <p>Find a random stranger to talk with</p>
              <button
                type="button"
                className="solid-link connect-find-btn"
                onClick={onStartGuest}
                disabled={loadingGuest}
              >
                {loadingGuest ? "⏳ FINDING..." : "🔍 FIND SOMEONE"}
              </button>
            </section>
          </div>

          <section className="home-feature-grid" aria-label="Feature shortcuts">
            <p className="home-feature-note">Unlock more features</p>

            <Link to="/message" className="home-feature-card feature-link">
              <div className="feature-icon blue">💬</div>
              <h3>Chat</h3>
              <p>Text with random people instantly.</p>
            </Link>

            <Link to="/games" className="home-feature-card feature-link">
              <div className="feature-icon green">🎮</div>
              <h3>Games</h3>
              <p>Play while you meet new people.</p>
            </Link>

            {isLoggedInUser ? (
              <Link to="/rooms" className="home-feature-card feature-link">
                <div className="feature-icon violet">👥</div>
                <h3>Rooms</h3>
                <p>Create private social rooms.</p>
              </Link>
            ) : (
              <div className="home-feature-card room-locked-card" aria-disabled="true">
                <div className="feature-icon violet">🔒</div>
                <h3>Rooms</h3>
                <p>Rooms are not accessible for guest users. Register to unlock.</p>
                <Link to="/auth" className="ghost-link small-link">Login / Register</Link>
              </div>
            )}
          </section>
        </section>

        <section className="thoughts-slider glass" aria-label="Your thoughts">
          <h3>Your Thoughts</h3>
          <div className="thoughts-track-wrap">
            <div className="thoughts-track">
              {[...thoughtSlides, ...thoughtSlides].map((thought, index) => (
                <div className="thought-chip" key={`${thought}-${index}`}>
                  {thought}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
