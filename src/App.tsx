import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/game">Play</Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
      </Routes>
    </div>
  );
}

export default App;