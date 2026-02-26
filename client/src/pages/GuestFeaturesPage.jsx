import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const guestFeatures = [
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
];

const GuestFeaturesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const startVoiceCall = () => {
    navigate("/call?feature=voice", {
      state: {
        fromHome: true,
      },
    });
  };

  return (
    <div className="home-layout landing-grid-bg site-home hero-only-home home-v2-layout">
      <div className="landing-container">
        <section className="landing-shell home-v2-hero" aria-label="Guest features">
          <div className="landing-glow home-v2-glow" aria-hidden="true" />

          <Link className="ghost-link home-v2-back-link" to="/">
            ← Back to Home
          </Link>

          <p className="home-v2-brand">LETZTALK</p>
          <h1 className="home-v2-title">
            Welcome, Guest
            <span>Choose Your Experience</span>
          </h1>

          <p className="home-v2-subtitle">Explore voice calls, text chat, and games instantly.</p>

          <div className="landing-actions home-v2-actions">
            <button
              type="button"
              className="solid-link landing-primary"
              onClick={startVoiceCall}
            >
              🔍 FIND SOMEONE
            </button>
          </div>
        </section>

        <section className="home-v2-cards-section static-grid" aria-label="Available features">
          <div className="home-v2-cards-track">
            {guestFeatures.map((card) => (
              <Link key={card.id} to={card.to} className="home-v2-card">
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

export default GuestFeaturesPage;
