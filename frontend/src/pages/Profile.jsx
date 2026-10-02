import React, { useState, useEffect } from 'react';
import { MessageSquare, MoreHorizontal, Layers } from 'lucide-react';
import Plot from 'react-plotly.js';
import { getProfile, getDiagnostics } from '../api';
import { useOceanSessionStore } from '../store/oceanSessionStore';

export default function ProfilePage() {
  const { currentLat, currentLon, currentDate } = useOceanSessionStore();
  const [diagnostics, setDiagnostics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [overlayAnalog, setOverlayAnalog] = useState(null);
  const [overlayProfile, setOverlayProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setOverlayAnalog(null);
    setOverlayProfile(null);

    Promise.all([
      getDiagnostics(currentDate, currentLat, currentLon),
      getProfile(currentDate, currentLat, currentLon)
    ]).then(([diagData, profData]) => {
      if (!isMounted) return;
      if (!profData || !profData.depths) {
        throw new Error('No data available for this location/date.');
      }
      setDiagnostics(diagData);
      setProfile(profData);
    }).catch((err) => {
      if (isMounted) setError(err.message || 'Failed to load profile.');
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [currentDate, currentLat, currentLon]);

  const handleOverlay = async (analogDate) => {
    if (overlayAnalog === analogDate) {
      setOverlayAnalog(null);
      setOverlayProfile(null);
      return;
    }
    
    try {
      const historicalProf = await getProfile(analogDate, currentLat, currentLon);
      if (historicalProf && historicalProf.temp_pred) {
        setOverlayAnalog(analogDate);
        setOverlayProfile(historicalProf);
      }
    } catch (e) {
      console.error('Failed to load analog profile', e);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#F8F9FA', padding: '1rem', borderRadius: '12px' }}>
         <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            Analyzing Profile at {currentLat.toFixed(2)}°N, {currentLon.toFixed(2)}°E on {currentDate}
         </span>
      </div>

      <h2 className="section-title">Vertical Profile Viewer</h2>
      <div className={`task-card ${isFullScreen ? 'fullscreen-chart' : ''}`} style={{ position: 'relative', height: isFullScreen ? '100vh' : '550px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderLeft: 'none', marginBottom: '2rem' }}>
        <button 
          onClick={() => setIsFullScreen(!isFullScreen)}
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        </button>
        {loading ? (
          <div>Loading Profile Data...</div>
        ) : error ? (
          <div style={{ color: '#EF4444' }}>{error}</div>
        ) : profile ? (
          <Plot
            data={[
              // Uncertainty Band (Hi to Lo)
              {
                x: [...profile.temp_hi, ...profile.temp_lo.slice().reverse()],
                y: [...profile.depths, ...profile.depths.slice().reverse()],
                fill: 'toself',
                fillcolor: 'rgba(79, 70, 229, 0.2)',
                line: { color: 'transparent' },
                name: 'Uncertainty (90%)',
                type: 'scatter'
              },
              // Predicted Temperature
              {
                x: profile.temp_pred,
                y: profile.depths,
                mode: 'lines+markers',
                line: { color: '#4F46E5', width: 3 },
                marker: { size: 6 },
                name: `Predicted (${currentDate})`,
                type: 'scatter'
              },
              // Overlay Analog Temperature
              ...(overlayProfile ? [{
                x: overlayProfile.temp_pred,
                y: overlayProfile.depths,
                mode: 'lines',
                line: { color: '#EF4444', width: 2, dash: 'dash' },
                name: `Analog (${overlayAnalog})`,
                type: 'scatter'
              }] : [])
            ]}
            layout={{
              margin: { t: 50, b: 40, l: 50, r: 20 },
              autosize: true,
              xaxis: { title: 'Temperature (°C)', side: 'top' },
              yaxis: { title: 'Depth (m)', autorange: 'reversed' },
              showlegend: true,
              legend: { x: 0.7, y: 0.1 }
            }}
            config={{ 
              displayModeBar: true, 
              displaylogo: false, 
              responsive: true,
              modeBarButtonsToRemove: ['zoom2d', 'select2d', 'lasso2d'] 
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        ) : null}
      </div>

      <h2 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem', marginTop: '2rem' }}>Ocean Diagnostics</h2>
      <div className="cards-row" style={{ marginBottom: '2rem' }}>
        <div className="task-card blue" style={{ minWidth: '0', flex: 1 }}>
          <div className="task-title" style={{ fontSize: '0.9rem' }}>Mixed Layer Depth</div>
          <div className="task-footer" style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', color: '#111' }}>{diagnostics?.mld?.toFixed(1) || '--'} m</span>
          </div>
        </div>
        
        <div className="task-card orange" style={{ minWidth: '0', flex: 1 }}>
          <div className="task-title" style={{ fontSize: '0.9rem' }}>Thermocline Depth</div>
          <div className="task-footer" style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', color: '#111' }}>{diagnostics?.thermocline_depth?.toFixed(1) || '--'} m</span>
          </div>
        </div>

        <div className="task-card green" style={{ minWidth: '0', flex: 1 }}>
          <div className="task-title" style={{ fontSize: '0.9rem' }}>D20 Isotherm</div>
          <div className="task-footer" style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', color: '#111' }}>{diagnostics?.d20?.toFixed(1) || '--'} m</span>
          </div>
        </div>
      </div>

      <h2 className="section-title">Analog Retrievals <span className="count-badge">({profile?.analog_dates?.length || 0})</span></h2>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <span className="status-badge">Top Matches</span>
      </div>

      {!profile?.analog_dates?.length && !loading && (
        <div style={{ color: 'var(--text-muted)' }}>No historical analogs found for this profile.</div>
      )}

      {profile?.analog_dates?.map((analogDate, idx) => (
        <div key={idx} className="list-item" style={{ background: overlayAnalog === analogDate ? 'var(--bg-hover)' : 'transparent' }}>
          <div className="list-col">
            <div className="list-title">Date: {analogDate}</div>
            <div className="list-sub">Historical Ocean State Match</div>
          </div>
          <div className="list-col" style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem'}}>
            <MessageSquare size={14} style={{verticalAlign:'middle', marginRight: '4px'}}/> 
            {profile.analog_weights ? (profile.analog_weights[idx] * 100).toFixed(0) : 90}% Similarity
          </div>
          <div className="list-col" style={{textAlign: 'right'}}>
            <button 
              onClick={() => handleOverlay(analogDate)}
              className="promo-btn"
              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Layers size={14} />
              {overlayAnalog === analogDate ? 'Remove Overlay' : 'Overlay Profile'}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
