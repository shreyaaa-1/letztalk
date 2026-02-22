import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const AuthPage = () => {
  const { login, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      } else {
        await register(form.username.trim(), form.email.trim(), form.password);
      }
    } catch (requestError) {
      setError(getFriendlyError(requestError, "Authentication failed"));
    } finally {
      setLoading(false);
    }
  };

  const onGuest = async () => {
    setError("");
    setLoading(true);

    try {
      await continueAsGuest();
    } catch (requestError) {
      setError(getFriendlyError(requestError, "Guest login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>LetzTalk</h1>
        <p>Login/register is optional. You can start random talks directly without any account.</p>

        <Link to="/match" className="solid-link full-link">
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
