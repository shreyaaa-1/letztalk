import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import MatchPage from "./pages/MatchPage";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? "/match" : "/auth"} replace />}
      />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/match"
        element={(
          <ProtectedRoute>
            <MatchPage />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
