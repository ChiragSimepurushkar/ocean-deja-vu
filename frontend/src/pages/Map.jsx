import React, { useState, useEffect } from 'react';
import { Clock, Navigation2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getField, getAdvisory } from '../api';
import CurtainView from '../components/CurtainView';

export default function MapPage({ date, setDate, depth, setDepth, lat, setLat, lon, setLon }) {
  const [advisory, setAdvisory] = useState(null);
  const [fieldData, setFieldData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Transect & 3D state
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'
  const [transectStart, setTransectStart] = useState(null);
  const [transectEnd, setTransectEnd] = useState(null);
  const [selectingTransect, setSelectingTransect] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    getAdvisory(date, lat, lon)
      .then(data => setAdvisory(data))
      .catch(err => console.error(err));
  }, [date, lat, lon]);

  useEffect(() => {
    setLoading(true);
    getField(date, depth)
      .then(data => {
        setFieldData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [date, depth]);

  const handleMapClick = (e) => {
    if (e.points && e.points.length > 0) {
      const point = e.points[0];
      
      if (selectingTransect) {
        if (!transectStart) {
          setTransectStart([point.x, point.y]);
        } else if (!transectEnd) {
          setTransectEnd([point.x, point.y]);
          setSelectingTransect(false);
          setViewMode('3d');
        }
      } else {
        setLat(point.y);
        setLon(point.x);
        navigate('/profile');
      }
    }
  };

  const clearTransect = () => {
    setTransectStart(null);
    setTransectEnd(null);
    setSelectingTransect(true);
    setViewMode('2d');
  };

  return (
    <>
      {/* LOCAL TOPBAR FOR MAP */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#F8F9FA', padding: '1rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>DATE</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600 }} />
        </div>
        <div style={{ width: '1px', background: '#E2E8F0', margin: '0 0.5rem' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>DEPTH</span>
          <select value={depth} onChange={e => setDepth(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600 }}>
            {[0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000].map(d => (
              <option key={d} value={d}>{d} m</option>
            ))}
          </select>
        </div>
        <div style={{ width: '1px', background: '#E2E8F0', margin: '0 0.5rem' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>
          <span>Current Target:</span> {lat.toFixed(2)}°N, {lon.toFixed(2)}°E
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Spatial Temperature Map</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectingTransect ? (
             <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#EAB308', fontWeight: 600 }}>
               {transectStart ? "Click to set End Point" : "Click to set Start Point"}
             </span>
          ) : null}
          <button 
            onClick={() => {
              if (viewMode === '2d') {
                if (transectStart && transectEnd) setViewMode('3d');
                else clearTransect();
              } else {
                setViewMode('2d');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
          >
            <Navigation2 size={16} />
            {viewMode === '2d' ? (transectStart && transectEnd ? 'Show 3D Curtain' : 'Draw 3D Transect') : 'Back to 2D Map'}
          </button>
          
          {transectStart && viewMode === '2d' && (
             <button 
               onClick={clearTransect}
               style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}
             >
               Clear Transect
             </button>
          )}
        </div>
      </div>

      <div className={`task-card ${isFullScreen ? 'fullscreen-chart' : ''}`} style={{ position: 'relative', height: isFullScreen ? '100vh' : '450px', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: 'none', marginBottom: '2rem' }}>
        
        <button 
          onClick={() => setIsFullScreen(!isFullScreen)}
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, padding: '6px 12px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        </button>

        {viewMode === '3d' ? (
          <CurtainView startPoint={transectStart} endPoint={transectEnd} />
        ) : (
          loading ? (
             <div style={{ color: 'var(--text-muted)' }}>Loading Field Data...</div>
          ) : fieldData ? (
            <Plot
              data={[{
                z: fieldData.data,
                x: fieldData.lon,
                y: fieldData.lat,
                type: 'heatmap',
                colorscale: 'Jet',
                hoverongaps: false
              },
              // Render transect points/line if they exist
              ...(transectStart ? [{
                x: [transectStart[0], transectEnd ? transectEnd[0] : null].filter(Boolean),
                y: [transectStart[1], transectEnd ? transectEnd[1] : null].filter(Boolean),
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: 'white', width: 2, dash: 'dot' },
                marker: { color: 'white', size: 8, symbol: 'cross' }
              }] : [])
              ]}
              layout={{
                margin: { t: 50, b: 40, l: 40, r: 10 },
                autosize: true,
                xaxis: { title: 'Longitude' },
                yaxis: { title: 'Latitude' },
                hovermode: 'closest'
              }}
              config={{ 
                displayModeBar: true, 
                displaylogo: false, 
                responsive: true,
                modeBarButtonsToRemove: ['zoom2d', 'select2d', 'lasso2d'] 
              }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler={true}
              onClick={handleMapClick}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Failed to load map data.</div>
          )
        )}
      </div>

      <h2 className="section-title">Active Alerts <span className="count-badge">({advisory?.alerts?.length || 0})</span></h2>
      <div className="cards-row">
        {advisory?.alerts?.length > 0 ? (
          advisory.alerts.map((alert, i) => (
            <div key={i} className="task-card red">
              <div className="task-title">Marine Warning</div>
              <div className="task-desc">{alert}</div>
              <div className="task-footer">
                <span><Clock size={14} style={{display:'inline', verticalAlign:'middle'}}/> Active Now</span>
              </div>
            </div>
          ))
        ) : (
          <div className="task-card green">
            <div className="task-title">All Systems Normal</div>
            <div className="task-desc">No anomalous conditions detected in this region.</div>
            <div className="task-footer">
               <span><Clock size={14} style={{display:'inline', verticalAlign:'middle'}}/> Updated recently</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
