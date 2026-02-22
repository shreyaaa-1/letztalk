import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import BlockPage from "./pages/BlockPage";
import HomePage from "./pages/HomePage";
import MatchPage from "./pages/MatchPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/match" element={<MatchPage />} />
      <Route path="/block" element={<BlockPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
