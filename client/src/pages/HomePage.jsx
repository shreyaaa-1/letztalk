import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const homeCards = [
  {
    id: "voice",
    title: "Voice Call",
    subtitle: "Find random strangers and talk instantly.",
    emoji: "🎤",
    to: "/call?feature=voice",
  },
  {
    id: "chat",
    title: "Text Chat",
    subtitle: "Chat if you prefer typing over speaking.",
    emoji: "💬",
    to: "/message",
  },
  {
    id: "games",
    title: "Games",
    subtitle: "Break the ice with dice, quiz, and RPS.",
    emoji: "🎮",
    to: "/games",
  },
  {
    id: "rooms",
    title: "Rooms",
    subtitle: "Create private rooms for your own circle.",
    emoji: "🏠",
    to: "/rooms",
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const onStartGuest = async () => {
    if (loadingGuest) {
      return;
    }

    setLoadingGuest(true);

    try {
      await continueAsGuest();
    } catch {
      // user can still continue as anonymous in the call flow
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 850);
    });

    navigate("/call?feature=voice", {
      state: {
        fromHome: true,
        notice: "Finding someone interesting…",
      },
    });

    setLoadingGuest(false);
  };

  return (
    <div className="home-layout landing-grid-bg site-home hero-only-home home-v2-layout">
      <div className="landing-container">
        <section className="landing-shell home-v2-hero" aria-label="Connect section">
          <div className="landing-glow home-v2-glow" aria-hidden="true" />

          <p className="home-v2-brand">LETZTALK</p>
          <h1 className="home-v2-title">
            LetzTalk —
            <span>Where Conversations Begin.</span>
          </h1>

          <p className="home-v2-subtitle">Voice, chat, and play — instantly connect across India.</p>

          <div className="landing-actions home-v2-actions">
            <button
              type="button"
              className="solid-link landing-primary"
              onClick={onStartGuest}
              disabled={loadingGuest}
            >
              {loadingGuest ? "⏳ FINDING..." : "📞 START AS GUEST"}
            </button>

            <Link className="ghost-link landing-secondary" to="/auth">
              Sign Up / Login
            </Link>
          </div>

          {loadingGuest && (
            <p className="landing-finding" role="status" aria-live="polite">
              <span className="landing-finding-dot" aria-hidden="true" />
              Finding someone for you...
            </p>
          )}
        </section>

        <section className="home-v2-cards-section" aria-label="Feature cards">
          <div className="home-v2-cards-track">
            {[...homeCards, ...homeCards].map((card, index) => (
              <Link key={`${card.id}-${index}`} to={card.to} className="home-v2-card">
                <span className="home-v2-card-icon" aria-hidden="true">{card.emoji}</span>
                <h3>{card.title}</h3>
                <p>{card.subtitle}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
