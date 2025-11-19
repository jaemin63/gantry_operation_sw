import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import MonitorPage from './pages/MonitorPage';

import MainPage from './pages/MainPage';
import HardwareDefinitionPage from './pages/HardwareDefinitionPage';
import ProcessPage from './pages/ProcessPage';
import DiagnosisPage from './pages/DiagnosisPage';
import SettingPage from './pages/SettingPage';
import './App.css';

function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  return (
    <Router>
      <div className="App">
        {/* 상단 바 */}
        <nav className="navbar">
          <button className="menu-btn" onClick={toggleSidebar}>☰</button>
          <img src="/logo.png" alt="Logo" className="nav-logo-img" />
        </nav>

        {/* 좌측 사이드바 */}
        <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <button className="close-sidebar" onClick={toggleSidebar}>×</button>
          <ul>
            <li><Link to="/" onClick={toggleSidebar}>Home (Monitoring) </Link></li>
            <li><Link to="/hardware" onClick={toggleSidebar}>Hardware Definition</Link></li>
            <li><Link to="/process" onClick={toggleSidebar}>Process</Link></li>
            <li><Link to="/diagnosis" onClick={toggleSidebar}>Diagnosis</Link></li>
            <li><Link to="/setting" onClick={toggleSidebar}>Setting</Link></li>

            <li><Link to="/monitor" onClick={toggleSidebar}> TEST1 : Monitor</Link></li>
            <li><Link to="/register" onClick={toggleSidebar}> TEST2 :Register Data Point</Link></li>
          </ul>
        </div>

        {/* 메인 컨텐츠 */}
        <main className="main-content">
        <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/hardware" element={<HardwareDefinitionPage />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/diagnosis" element={<DiagnosisPage />} />
            <Route path="/setting" element={<SettingPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;