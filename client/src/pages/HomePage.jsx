import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div className="home-layout">
      <div className="home-card">
        <h1>Meet new strangers instantly on LetzTalk</h1>
        <p>
          No login required to start random talks. Guest, login, and register are optional if you want
          account features.
        </p>

        <img
          className="home-gif"
          src="https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif"
          alt="People meeting and chatting"
        />

        <div className="home-actions">
          <Link to="/match" className="solid-link">
            Start Random Talk
          </Link>
          <Link to="/auth" className="ghost-link">
            Login / Register / Guest (Optional)
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
