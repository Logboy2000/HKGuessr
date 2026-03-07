import { BrowserRouter, Routes, Route } from "react-router-dom"
import "../js/embedRedirector.js"
import LandingPage from "./pages/LandingPage"
import CreditsPage from "./pages/CreditsPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/credits" element={<CreditsPage />} />
      </Routes>
    </BrowserRouter>
  )
}