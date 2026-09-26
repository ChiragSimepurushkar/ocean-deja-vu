import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Bell, Settings, Home, FileText, Target, Activity, Folder, Plus, Search } from 'lucide-react';
import MapPage from './pages/Map';
import ProfilePage from './pages/Profile';
import ValidationPage from './pages/Validation';
import NotesPage from './pages/Notes';
import GoalsPage from './pages/Goals';
import NewAnalysisPage from './pages/NewAnalysis';
import './index.css';

export default function App() {
  const [date, setDate] = useState('2023-06-01');
  const [depth, setDepth] = useState('50');
  const [lat, setLat] = useState(15.0);
  const [lon, setLon] = useState(85.0);

  return (
    <BrowserRouter>
      <div className="dashboard-container">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon"><Activity size={24} /></div>
            OCEAN DEJA VU
          </div>

          <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} end>
            <Home size={18} /> Home
          </NavLink>
          <NavLink to="/notes" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <FileText size={18} /> Notes
          </NavLink>
          <NavLink to="/goals" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Target size={18} /> Goals
          </NavLink>
          
          <div className="nav-section">Data Spaces</div>
          <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} end>
            <Folder size={18} /> Maps & Viz
          </NavLink>
          <NavLink to="/profile" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Folder size={18} /> Profiles
          </NavLink>
          <NavLink to="/validation" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Activity size={18} /> Validation
          </NavLink>

          <NavLink to="/new" className="add-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <Plus size={18} /> New Analysis
          </NavLink>
        </aside>

        {/* MAIN AREA */}
        <main className="main-area">
          {/* TOPBAR */}
          <header className="topbar">
            <div className="search-bar">
              <Search size={18} color="#8B8C9A" />
              <input type="text" placeholder="Search coordinates, dates..." />
            </div>

            <div className="topbar-right">
              <Settings size={20} color="#8B8C9A" style={{cursor: 'pointer'}} />
              <Bell size={20} color="#8B8C9A" style={{cursor: 'pointer'}} />
              <div className="user-profile">
                <span>Deepa</span>
                <div className="avatar"></div>
              </div>
            </div>
          </header>

          <div className="dashboard-columns">
            {/* CENTER CONTENT (Dynamic Pages) */}
            <div className="center-column">
              <Routes>
                <Route path="/" element={<MapPage date={date} setDate={setDate} depth={depth} setDepth={setDepth} lat={lat} setLat={setLat} lon={lon} setLon={setLon} />} />
                <Route path="/profile" element={<ProfilePage date={date} lat={lat} lon={lon} />} />
                <Route path="/validation" element={<ValidationPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/new" element={<NewAnalysisPage />} />
              </Routes>
            </div>

            {/* RIGHT COLUMN (Static Calendar & Promo) */}
            <div className="right-column">
              <div className="calendar-header">
                <span>{new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>&lt; Today &gt;</span>
              </div>
              
              <div style={{ padding: '1rem 0', display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                {['Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{day}</div>
                    <div style={{ fontWeight: 800, color: i === 3 ? 'var(--primary)' : 'var(--text-main)' }}>{23 + i}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderLeft: '2px solid #EEF2FF', paddingLeft: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>09:00 AM</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Fetch Copernicus Data</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Automated Job</div>
              </div>

              <div style={{ borderLeft: '2px solid #EEF2FF', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>14:30 PM</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Update ML Model</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dev 2 Upload</div>
              </div>

              <div className="promo-card">
                <div style={{ fontSize: '3rem', margin: '0 auto' }}>👑</div>
                <h3>Explore deeper ocean insights with Pro</h3>
                <button className="promo-btn">Upgrade now</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
