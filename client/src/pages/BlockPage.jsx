import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import http from "../api/http";
import { useAuth } from "../hooks/useAuth";

const BlockPage = () => {
  const { isLoggedInUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const targetSocketId = useMemo(() => searchParams.get("targetSocketId") || "", [searchParams]);

  const onBlock = async () => {
    if (!targetSocketId) {
      setError("No partner found to block.");
      return;
    }

    if (!isLoggedInUser) {
      setError("Login is required to block users.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await http.post("/mod/block", {
        blockedSocketId: targetSocketId,
      });

      navigate("/match", {
        replace: true,
        state: { notice: "User blocked successfully." },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to block user right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-layout">
      <div className="home-card block-card glass">
        <h1>Block this stranger?</h1>
        <p>
          Report was submitted. You can now block this partner from your side.
        </p>

        <div className="target-chip">Partner Socket: {targetSocketId || "Not available"}</div>

        {error && <p className="form-error">{error}</p>}

        <div className="home-actions">
          <button type="button" className="solid-link action-btn" onClick={onBlock} disabled={loading}>
            {loading ? "Blocking..." : "Block User"}
          </button>
          {!isLoggedInUser && (
            <Link to="/auth" className="ghost-link">
              Login / Register
            </Link>
          )}
          <Link to="/match" className="ghost-link">
            Back to Match
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BlockPage;
