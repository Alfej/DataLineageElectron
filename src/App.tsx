import { Routes, Route, Navigate, HashRouter } from "react-router-dom";
import Landing from "./components/Landing";
import GraphPage from "./pages/GraphPage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/landingPage" replace />} />
        <Route path="/landingPage" element={<Landing />} />
        <Route path="/Graph/:fileKey" element={<GraphPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
