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
    guestAccess: true,
  },
  {
    id: "chat",
    title: "Text Chat",
    subtitle: "Chat if you prefer typing over speaking.",
    emoji: "💬",
    to: "/message",
    guestAccess: true,
  },
  {
    id: "games",
    title: "Games",
    subtitle: "Break the ice with dice, quiz, and RPS.",
    emoji: "🎮",
    to: "/games",
    guestAccess: true,
  },
  {
    id: "rooms",
    title: "Rooms",
    subtitle: "Create private rooms for your own circle.",
    emoji: "🚪",
    to: "/rooms",
    guestAccess: false,
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user, continueAsGuest } = useAuth();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const isGuest = user && (!user.username || user.username === "Guest");
  const visibleCards = isGuest ? homeCards.filter((c) => c.guestAccess) : homeCards;

  const onStartGuest = async () => {
    if (loadingGuest) {
      return;
    }

    setLoadingGuest(true);

    navigate("/call?feature=voice", {
      state: {
        fromHome: true,
      },
    });

    continueAsGuest()
      .catch(() => {
        // user can still continue as anonymous in the call flow
      })
      .finally(() => {
        setLoadingGuest(false);
      });
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
            >
              📞 START AS GUEST
            </button>

            <Link className="ghost-link landing-secondary" to="/auth">
              Sign Up / Login
            </Link>
          </div>

        </section>

        <section className={`home-v2-cards-section ${isGuest ? 'static-grid' : ''}`} aria-label="Feature cards">
          <div className="home-v2-cards-track">
            {isGuest ? (
              visibleCards.map((card) => (
                <Link key={card.id} to={card.to} className="home-v2-card">
                  <span className="home-v2-card-icon" aria-hidden="true">{card.emoji}</span>
                  <h3>{card.title}</h3>
                  <p>{card.subtitle}</p>
                </Link>
              ))
            ) : (
              [...visibleCards, ...visibleCards].map((card, index) => (
                <Link key={`${card.id}-${index}`} to={card.to} className="home-v2-card">
                  <span className="home-v2-card-icon" aria-hidden="true">{card.emoji}</span>
                  <h3>{card.title}</h3>
                  <p>{card.subtitle}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
