import React, { useState, useEffect } from 'react';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import Plot from 'react-plotly.js';
import { getProfile, getDiagnostics } from '../api';

export default function ProfilePage({ date, lat, lon }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDiagnostics(date, lat, lon).then(data => setDiagnostics(data)),
      getProfile(date, lat, lon).then(data => setProfile(data))
    ]).finally(() => setLoading(false));
  }, [date, lat, lon]);

  return (
    <>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#F8F9FA', padding: '1rem', borderRadius: '12px' }}>
         <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            Analyzing Profile at {lat.toFixed(2)}°N, {lon.toFixed(2)}°E on {date}
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
                name: 'Predicted Temp',
                type: 'scatter'
              }
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
        ) : (
          <div>Failed to load profile.</div>
        )}
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

      {profile?.analog_dates?.map((analogDate, idx) => (
        <div key={idx} className="list-item">
          <div className="list-col">
            <div className="list-title">Date: {analogDate}</div>
            <div className="list-sub">Historical Ocean State Match</div>
          </div>
          <div className="list-col" style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem'}}>
            <MessageSquare size={14} style={{verticalAlign:'middle', marginRight: '4px'}}/> 
            {(profile.analog_weights[idx] * 100).toFixed(0)}% Similarity
          </div>
          <div className="list-col" style={{textAlign: 'right'}}>
            <MoreHorizontal color="#8B8C9A"/>
          </div>
        </div>
      ))}
    </>
  );
}
