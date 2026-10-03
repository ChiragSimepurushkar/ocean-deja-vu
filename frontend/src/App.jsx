import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Settings, Home, FileText, Target, Activity, Folder, Plus, Search, Sun, Moon, HelpCircle, Loader2 } from 'lucide-react';
import { Joyride, STATUS } from 'react-joyride';
import { Command } from 'cmdk';
import confetti from 'canvas-confetti';

import SplashPage from './pages/SplashPage';
import { TooltipProvider } from './components/Tooltip';

// Direct imports instead of lazy loading
import MapPage from './pages/Map';
import ProfilePage from './pages/Profile';
import DeepDivePage from './pages/DeepDive';
import CinematicViewPage from './pages/CinematicView';
import ValidationPage from './pages/Validation';
import NotesPage from './pages/Notes';
import GoalsPage from './pages/Goals';
import NewAnalysisPage from './pages/NewAnalysis';
import WorkbenchPage from './pages/WorkbenchPage';
import './index.css';
import { startAmbientOceanDrone, stopAmbientOceanDrone, updateUnderwaterDepthAcoustics } from './utils/audio';

import { useOceanSessionStore } from './store/oceanSessionStore';

const TOUR_STEPS = [
  {
    target: 'body',
    placement: 'center',
    title: 'Welcome to Ocean Deja Vu!',
    content: 'Let\'s start the exploration. Click Next to begin the tour.',
    disableBeacon: true,
  },
  {
    target: '.tour-workbench',
    content: 'Data Workbench: Extract time-series and gridded NetCDF data from the ocean model.',
    disableBeacon: true,
  },
  {
    target: '.tour-globe-click',
    content: 'Click anywhere on the globe to dive deep into a station.',
    disableBeacon: true,
  },
  {
    target: '.tour-2d-toggle',
    content: 'Explore the 3D Spatial environment and toggle 2D fallback mode if needed.',
    disableBeacon: true,
  },
  {
    target: '.tour-compass',
    content: 'Use the compass to navigate the Volumetric Probe across the ocean grid.',
    disableBeacon: true,
  },
  {
    target: '.tour-cinematic',
    content: 'Play the Cinematic Sequence for an automated guided tour of the water column.',
    disableBeacon: true,
  },
  {
    target: '.tour-catalog',
    content: 'Check the Marine Catalog to track species you discover in the Deep Dive.',
    disableBeacon: true,
  },
  {
    target: '.tour-leaderboard',
    content: 'Track your expedition Leaderboard standing and badges here.',
    disableBeacon: true,
  },
  {
    target: '.tour-theme',
    content: 'Toggle between Dark and Light mode.',
    disableBeacon: true,
  }
];

function AppContent() {
  const { currentDate: date, currentDepth: depth, currentLat: lat, currentLon: lon, setDate, setDepth, setLat, setLon, setLocation, activeAlerts, soundEnabled, toggleSound } = useOceanSessionStore();
  
  const location = useLocation();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem('splashSeen'));
  const [runTour, setRunTour] = useState(() => !localStorage.getItem('tourSeen') && localStorage.getItem('splashSeen'));
  
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showCmdk, setShowCmdk] = useState(false);

  const topbarRightRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (topbarRightRef.current && !topbarRightRef.current.contains(event.target)) {
        setShowHelpMenu(false);
        setShowSettings(false);
        setShowAlerts(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Audio Persistence
  useEffect(() => {
    // Requires a user interaction first to unlock AudioContext in most browsers.
    // The tour, splash screen, or first click usually acts as this trigger.
    const audioPages = ['/deepdive', '/cinematic'];
    if (soundEnabled && audioPages.includes(location.pathname)) {
      startAmbientOceanDrone(true, depth);
    } else {
      stopAmbientOceanDrone();
    }
  }, [soundEnabled, depth, location.pathname]);

  useEffect(() => {
    const audioPages = ['/deepdive', '/cinematic'];
    if (soundEnabled && audioPages.includes(location.pathname)) {
      updateUnderwaterDepthAcoustics(depth);
    }
  }, [depth, soundEnabled, location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmdk(open => !open);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    localStorage.setItem('splashSeen', 'true');
    if (!localStorage.getItem('tourSeen')) {
      setTimeout(() => {
        setRunTour(true);
      }, 500); // slight delay
    }
  };

  const handleJoyrideCallback = (data) => {
    const { action, index, status, type } = data;
    if (status === STATUS.FINISHED) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      localStorage.setItem('tourSeen', 'true');
      navigate('/');
    } else if (type === 'step:after') {
      const nextIndex = index + (action === 'prev' ? -1 : 1);
      
      // Determine the path needed for the new step
      let targetPath = '/';
      if (nextIndex === 2) targetPath = '/deepdive';
      else if (nextIndex === 3 || nextIndex === 4) targetPath = '/cinematic';
      else if (nextIndex === 5) targetPath = '/profile';
      else if (nextIndex === 6) targetPath = '/goals';
      else if (nextIndex === 7) targetPath = '/';

      if (location.pathname !== targetPath) {
        navigate(targetPath);
      }
    } else if (type === 'tour:end') {
      setRunTour(false);
      localStorage.setItem('tourSeen', 'true');
    }
  };

  if (showSplash) {
    return <SplashPage onComplete={handleSplashComplete} />;
  }

  return (
      <TooltipProvider>
      <div className="dashboard-container">
        <Joyride
          steps={TOUR_STEPS}
          run={runTour}
          continuous
          showProgress
          showSkipButton
          callback={handleJoyrideCallback}
          styles={{
            options: {
              zIndex: 10000,
              primaryColor: '#38bdf8',
              backgroundColor: 'var(--bg-panel)',
              textColor: 'var(--text-main)',
              arrowColor: 'var(--bg-panel)'
            }
          }}
        />

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo tour-ocean-map" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Ocean Deja Vu Logo" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
            OCEAN DEJA VU
          </div>

          <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} end>
            <Home size={18} /> Home
          </NavLink>
          <NavLink to="/notes" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <FileText size={18} /> Notes
          </NavLink>
          <NavLink to="/goals" className={({isActive}) => isActive ? "nav-item active tour-leaderboard" : "nav-item tour-leaderboard"}>
            <Target size={18} /> Goals
          </NavLink>
          
          <div className="nav-section">Data Spaces</div>
          <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} end>
            <Folder size={18} /> Maps & Viz
          </NavLink>
          <NavLink to="/profile" className={({isActive}) => isActive ? "nav-item active tour-catalog" : "nav-item tour-catalog"}>
            <Folder size={18} /> Profiles
          </NavLink>
          <NavLink to="/validation" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Activity size={18} /> Validation
          </NavLink>
          <NavLink to="/deepdive" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Folder size={18} /> 3D Deep Dive
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
              <input type="text" placeholder="Search coordinates (Cmd+K)" onFocus={() => setShowCmdk(true)} />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <NavLink to="/" end className={({isActive}) => isActive ? "top-nav-tab active" : "top-nav-tab"} style={({isActive}) => ({ padding: '6px 16px', borderRadius: '4px', textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-muted)', background: isActive ? 'var(--bg-panel)' : 'transparent', fontWeight: 600, fontSize: '0.85rem' })}>
                3D Visualizer
              </NavLink>
              <NavLink to="/workbench" className={({isActive}) => isActive ? "top-nav-tab active tour-workbench" : "top-nav-tab tour-workbench"} style={({isActive}) => ({ padding: '6px 16px', borderRadius: '4px', textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-muted)', background: isActive ? 'var(--bg-panel)' : 'transparent', fontWeight: 600, fontSize: '0.85rem' })}>
                Data Workbench
              </NavLink>
            </div>

            <div className="topbar-right" ref={topbarRightRef}>
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => { setShowHelpMenu(!showHelpMenu); setShowSettings(false); setShowAlerts(false); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <HelpCircle size={20} color="var(--text-muted)" />
                </button>
                {showHelpMenu && (
                  <div style={{ position: 'absolute', top: '30px', right: 0, width: '250px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                    <div style={{ padding: '8px', fontSize: '0.9rem', fontWeight: 600, borderBottom: '1px solid var(--border)', color: 'var(--text-main)' }}>Help & Shortcuts</div>
                    <button onClick={() => { setRunTour(true); setShowHelpMenu(false); navigate('/'); }} style={{ width: '100%', textAlign: 'left', padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>🔄 Replay Guided Tour</button>
                    <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}><b>Cmd+K</b> : Command Palette</div>
                    <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}><b>Map</b> : Click globe to dive</div>
                    <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}><b>Probe</b> : Use compass to scan</div>
                  </div>
                )}
              </div>

              <button 
                className="tour-theme"
                onClick={() => {
                  setTheme(t => t === 'dark' ? 'light' : 'dark');
                  setShowHelpMenu(false);
                  setShowSettings(false);
                  setShowAlerts(false);
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={20} color="var(--text-muted)" /> : <Moon size={20} color="var(--text-muted)" />}
              </button>
              
              {/* Settings Dropdown */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => { setShowSettings(!showSettings); setShowAlerts(false); setShowHelpMenu(false); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Settings"
                >
                  <Settings size={20} color="var(--text-muted)" />
                </button>
                {showSettings && (
                  <div style={{ position: 'absolute', top: '30px', right: 0, width: '200px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Preferences</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Temperature</span>
                      <select style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '4px', padding: '2px 4px' }}>
                        <option>°C (Metric)</option>
                        <option>°F (Imperial)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Sound Effects</span>
                      <input type="checkbox" checked={soundEnabled} onChange={toggleSound} />
                    </div>
                  </div>
                )}
              </div>

              {/* Alerts Dropdown */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => { setShowAlerts(!showAlerts); setShowSettings(false); setShowHelpMenu(false); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Alerts"
                >
                  <Bell size={20} color="var(--text-muted)" />
                  {activeAlerts?.length > 0 && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: 'white', fontSize: '0.6rem', width: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activeAlerts.length}
                    </span>
                  )}
                </button>
                {showAlerts && (
                  <div style={{ position: 'absolute', top: '30px', right: 0, width: '280px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px', fontSize: '0.9rem', fontWeight: 600, borderBottom: '1px solid var(--border)', color: 'var(--text-main)', background: 'var(--bg-hover)' }}>Active Alerts</div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {activeAlerts?.length > 0 ? (
                        activeAlerts.map((alert, i) => (
                          <div key={i} style={{ padding: '12px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                            <div style={{ color: '#EF4444', fontWeight: 600, marginBottom: '4px' }}>Marine Warning</div>
                            {alert}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          No active alerts for this region.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="user-profile">
                <span>Deepa</span>
                <div className="avatar"></div>
              </div>
            </div>
          </header>

          <div className={`dashboard-columns ${location.pathname === '/workbench' ? 'full-width-center' : ''}`}>
            <div className="center-column" style={location.pathname === '/workbench' ? { flex: '1 1 100%', maxWidth: '100%' } : {}}>
                <Routes>
                  <Route path="/" element={<MapPage date={date} setDate={setDate} depth={depth} setDepth={setDepth} lat={lat} setLat={setLat} lon={lon} setLon={setLon} />} />
                  <Route path="/profile" element={<ProfilePage date={date} lat={lat} lon={lon} />} />
                  <Route path="/deepdive" element={<DeepDivePage date={date} lat={lat} lon={lon} />} />
                  <Route path="/cinematic" element={<CinematicViewPage date={date} lat={lat} lon={lon} />} />
                  <Route path="/validation" element={<ValidationPage />} />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/new" element={<NewAnalysisPage />} />
                  <Route path="/workbench" element={<WorkbenchPage />} />
                </Routes>
            </div>

            {/* RIGHT COLUMN (Static Calendar & Promo) */}
            {location.pathname !== '/workbench' && (
            <div className="right-column">
              {/* ── Calendar ── */}
              <div style={{ 
                padding: '1.25rem', borderRadius: '14px', marginBottom: '1.5rem',
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-sans)' }}>
                    {new Date(date).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', background: 'rgba(56,189,248,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.15)' }}>
                    7 DAYS
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} style={{ textAlign: 'center', fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', padding: '4px 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{day}</div>
                  ))}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                    const d = i >= 3 ? i - 2 : i + 5;
                    const dateStr = `2023-01-0${d}`;
                    const isSelected = date === dateStr;
                    return (
                      <div 
                        key={`d-${day}`} 
                        onClick={() => setDate(dateStr)}
                        style={{ 
                          textAlign: 'center', cursor: 'pointer', padding: '8px 0', borderRadius: '8px',
                          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem',
                          color: isSelected ? '#020617' : 'var(--text-main)',
                          background: isSelected ? 'linear-gradient(135deg, #38bdf8, #0ea5e9)' : 'transparent',
                          border: isSelected ? 'none' : '1px solid transparent',
                          boxShadow: isSelected ? '0 4px 12px rgba(56,189,248,0.35)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) { e.target.style.background = 'var(--bg-hover)'; e.target.style.border = '1px solid var(--border)'; }}}
                        onMouseLeave={(e) => { if (!isSelected) { e.target.style.background = 'transparent'; e.target.style.border = '1px solid transparent'; }}}
                      >
                        {d}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Timeline Events ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                {[
                  { time: '09:00', title: 'Fetch Copernicus Data', sub: 'Automated Job', color: 'var(--primary)' },
                  { time: '14:30', title: 'Update ML Model', sub: 'Dev 2 Upload', color: 'var(--accent-warn)' },
                  { time: '18:00', title: 'Generate PDF Reports', sub: 'Daily Summary', color: 'var(--accent-success)' },
                ].map((ev, i) => (
                  <div key={i} style={{ 
                    display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.75rem',
                    borderRadius: '10px', background: 'var(--bg-panel)', border: '1px solid var(--border)',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ width: '3px', borderRadius: '2px', background: ev.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '2px' }}>{ev.time}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '2px' }}>{ev.title}</div>
                      <div style={{ fontSize: '0.75rem', color: ev.color, fontWeight: 600 }}>{ev.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Inference Status ── */}
              <div style={{ position: 'sticky', top: '2rem' }}>
                <div style={{ 
                  padding: '1.25rem', borderRadius: '14px', marginBottom: '1rem',
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}>
                  <div style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <Activity size={14} color="var(--primary)" /> Inference Status
                  </div>
                  
                  {[
                    { label: 'ConvNeXt-Tiny EOF', value: 'Online', valueColor: 'var(--accent-success)' },
                    { label: 'Latent Dimension', value: '256', valueColor: 'var(--text-main)' },
                    { label: 'Data Sync', value: 'Just now', valueColor: 'var(--text-main)' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < 2 ? '0.6rem' : 0, fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: row.valueColor }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* ── Active Location ── */}
                <div style={{ 
                  padding: '1.25rem', borderRadius: '14px', marginBottom: '1rem',
                  background: 'var(--bg-input)', borderLeft: '3px solid var(--primary)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '0.9rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={14} color="var(--primary)" /> Active Location
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Latitude</label>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{lat.toFixed(2)}°N</span>
                    </div>
                    <input type="range" min="5" max="30" step="0.1" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Longitude</label>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{lon.toFixed(2)}°E</span>
                    </div>
                    <input type="range" min="45" max="105" step="0.1" value={lon} onChange={(e) => setLon(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </main>

        {showCmdk && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', paddingTop: '10vh' }} onClick={() => setShowCmdk(false)}>
            <div style={{ background: 'var(--bg-panel)', width: '600px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
              <Command>
                <Command.Input placeholder="Type a command or search..." autoFocus style={{ width: '100%', padding: '16px', fontSize: '1.2rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', outline: 'none' }} />
                <Command.List style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px' }}>
                  <Command.Empty style={{ padding: '16px', color: 'var(--text-muted)' }}>No results found.</Command.Empty>
                  <Command.Group heading="Navigation">
                    <Command.Item onSelect={() => { navigate('/'); setShowCmdk(false); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '4px' }}>🗺️ Go to Map View</Command.Item>
                    <Command.Item onSelect={() => { navigate('/deepdive'); setShowCmdk(false); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '4px' }}>🌊 Go to 3D Deep Dive</Command.Item>
                    <Command.Item onSelect={() => { navigate('/cinematic'); setShowCmdk(false); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '4px' }}>🎥 Go to Probe & Compare</Command.Item>
                    <Command.Item onSelect={() => { navigate('/goals'); setShowCmdk(false); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '4px' }}>🏆 Open Leaderboard</Command.Item>
                  </Command.Group>
                  <Command.Group heading="Actions">
                    <Command.Item onSelect={() => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setShowCmdk(false); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '4px' }}>🌗 Toggle Theme</Command.Item>
                    <Command.Item onSelect={() => { setRunTour(true); setShowCmdk(false); navigate('/'); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '4px' }}>🔄 Start Guided Tour</Command.Item>
                  </Command.Group>
                </Command.List>
              </Command>
            </div>
            <style>{`
              [cmdk-item][data-selected="true"] {
                background: var(--bg-input);
                color: var(--primary);
              }
            `}</style>
          </div>
        )}
      </div>
      </TooltipProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
