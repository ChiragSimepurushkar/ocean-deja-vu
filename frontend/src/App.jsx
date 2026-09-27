import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Bell, Settings, Home, FileText, Target, Activity, Folder, Plus, Search } from 'lucide-react';
import MapPage from './pages/Map';
import ProfilePage from './pages/Profile';
import DeepDivePage from './pages/DeepDive';
import CinematicViewPage from './pages/CinematicView';
import ValidationPage from './pages/Validation';
import NotesPage from './pages/Notes';
import GoalsPage from './pages/Goals';
import NewAnalysisPage from './pages/NewAnalysis';
import './index.css';

function AppContent() {
  const [date, setDate] = useState('2023-06-01');
  const [depth, setDepth] = useState('50');
  const [lat, setLat] = useState(15.0);
  const [lon, setLon] = useState(85.0);
  const location = useLocation();
  const pushDownRightColumn = location.pathname === '/profile' || location.pathname === '/validation';

  return (
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
                <Route path="/deepdive" element={<DeepDivePage date={date} lat={lat} lon={lon} />} />
                <Route path="/cinematic" element={<CinematicViewPage date={date} lat={lat} lon={lon} />} />
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
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{day}</div>
                    <div style={{ fontWeight: 800, color: i === 5 ? 'var(--primary)' : 'var(--text-main)' }}>{21 + i}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderLeft: '2px solid #EEF2FF', paddingLeft: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>09:00 AM</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Fetch Copernicus Data</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Automated Job</div>
              </div>

              <div style={{ borderLeft: '2px solid #EEF2FF', paddingLeft: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>14:30 PM</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Update ML Model</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dev 2 Upload</div>
              </div>

              <div style={{ borderLeft: '2px solid #EEF2FF', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>18:00 PM</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Generate PDF Reports</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily Summary</div>
              </div>

              <div style={{ position: 'sticky', top: '2rem' }}>
                <div className="task-card" style={{ marginTop: pushDownRightColumn ? '6rem' : '2rem', padding: '1.5rem', borderRadius: '16px', background: 'white', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                <div style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={16} color="var(--primary)" /> Inference Status
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ConvNeXt-Tiny EOF</span>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>Online</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Latent Dimension</span>
                  <span style={{ fontWeight: 600 }}>256</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Data Sync</span>
                  <span style={{ fontWeight: 600 }}>Just now</span>
                </div>
              </div>

              <div className="task-card" style={{ marginTop: '2rem', marginBottom: '1rem', padding: '1.5rem', borderRadius: '16px', background: '#F8F9FA', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={16} color="var(--primary)" /> Active Location
                </div>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Latitude</label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{lat.toFixed(2)}°N</span>
                  </div>
                  <input type="range" min="5" max="30" step="0.1" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Longitude</label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{lon.toFixed(2)}°E</span>
                  </div>
                  <input type="range" min="45" max="105" step="0.1" value={lon} onChange={(e) => setLon(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
