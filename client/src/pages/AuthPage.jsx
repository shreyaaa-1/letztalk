import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const AuthPage = () => {
  const { login, register, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(null);
  const navTimerRef = useRef(null);

  const suggestions = useMemo(() => {
    const emailPrefix = form.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || "talker";
    const suffix = Math.floor(100 + Math.random() * 900);
    return [
      `${emailPrefix}_${suffix}`,
      `${emailPrefix}_live`,
      `${emailPrefix}_random`,
      `letztalk_${suffix}`,
    ];
  }, [form.email]);

  const getFriendlyError = (requestError, fallback) => {
    if (requestError.response?.data?.message) {
      return requestError.response.data.message;
    }

    if (requestError.code === "ERR_NETWORK") {
      return "Cannot reach server. Start backend on port 5000 or set VITE_API_BASE_URL.";
    }

    return fallback;
  };

  const showPopup = (message, type = "success") => {
    setPopup({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!popup) {
      return undefined;
    }

    const timer = setTimeout(() => setPopup(null), 2400);
    return () => clearTimeout(timer);
  }, [popup]);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
      }
    };
  }, []);

  const scheduleNavigateToMatch = () => {
    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
    }

    navTimerRef.current = setTimeout(() => {
      navigate("/call");
    }, 900);
  };

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(form.email.trim(), form.password);
        showPopup("Login successful. Redirecting to match...", "success");
      } else {
        await register(form.username.trim(), form.email.trim(), form.password);
        showPopup("Registration successful. Redirecting to match...", "success");
      }

      setError("");
      scheduleNavigateToMatch();
    } catch (requestError) {
      const friendlyError = getFriendlyError(requestError, "Authentication failed");
      setError(friendlyError);
      showPopup(friendlyError, "error");
    } finally {
      setLoading(false);
    }
  };

  const onGuest = async () => {
    setError("");
    setLoading(true);

    try {
      await continueAsGuest();
      showPopup("Guest session started. Redirecting to match...", "success");
      scheduleNavigateToMatch();
    } catch (requestError) {
      const friendlyError = getFriendlyError(requestError, "Guest login failed");
      setError(friendlyError);
      showPopup(friendlyError, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card glass auth-shell">
        {popup && <div className={`popup-toast ${popup.type}`}>{popup.message}</div>}

        <h1 className="auth-title">
          Connect with
          <span>Random Strangers</span>
        </h1>
        <p className="auth-subtitle">Login/register is optional. Start safe spontaneous conversations anytime.</p>

        <Link to="/call" className="solid-link full-link">
          Start Random Talk (No Login)
        </Link>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <label>
                Username
                <input
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  placeholder="yourname"
                  required
                />
              </label>

              <div className="username-suggest">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, username: name }))}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <button type="button" className="ghost-btn" onClick={onGuest} disabled={loading}>
          Continue as guest
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
