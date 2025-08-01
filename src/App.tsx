import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppBarComponent from "./components/AppBar";
import Home from "./pages/Home";
import YourSpace from "./pages/YourSpace";
import Settings from "./pages/Settings";
import './App.css'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white text-black">
        <AppBarComponent />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/your-space" element={<YourSpace />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
