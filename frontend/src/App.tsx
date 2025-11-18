// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import RegisterPage from "./pages/RegisterPage";
import MonitorPage from "./pages/MonitorPage";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-container">
            <h2 className="nav-logo">PLC Monitor</h2>
            <ul className="nav-menu">
              <li className="nav-item">
                <NavLink to="/" end className={({ isActive }) => "nav-link" + (isActive ? " nav-link-active" : "")}>
                  Monitor
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/register" className={({ isActive }) => "nav-link" + (isActive ? " nav-link-active" : "")}>
                  Register Data Point
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<MonitorPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
