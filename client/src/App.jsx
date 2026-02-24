import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import BlockPage from "./pages/BlockPage";
import CallPage from "./pages/CallPage";
import GamesPage from "./pages/GamesPage";
import HomePage from "./pages/HomePage";
import MatchPage from "./pages/MatchPage";
import MessagePage from "./pages/MessagePage";
import RoomsPage from "./pages/RoomsPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/call" element={<CallPage />} />
      <Route path="/message" element={<MessagePage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route
        path="/rooms"
        element={(
          <ProtectedRoute>
            <RoomsPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/match" element={<MatchPage />} />
      <Route path="/block" element={<BlockPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
