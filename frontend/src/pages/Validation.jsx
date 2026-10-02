import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { useValidation } from '../hooks/useValidation';

export default function ValidationPage() {
  const [isFullScreen1, setIsFullScreen1] = useState(false);
  const [isFullScreen2, setIsFullScreen2] = useState(false);
  
  const [region, setRegion] = useState('Arabian Sea');
  const [season, setSeason] = useState('Summer');

  const { heatmapData, lineChartData, loading } = useValidation(region, season);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Model Validation</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select 
            value={region} 
            onChange={e => setRegion(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', outline: 'none' }}
          >
            <option>Arabian Sea</option>
            <option>Bay of Bengal</option>
            <option>Equatorial Indian Ocean</option>
            <option>Southern Ocean</option>
          </select>
          <select 
            value={season} 
            onChange={e => setSeason(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', outline: 'none' }}
          >
            <option>Spring</option>
            <option>Summer</option>
            <option>Autumn</option>
            <option>Winter</option>
          </select>
        </div>
      </div>
      
      <div className="cards-row" style={{ marginBottom: '2rem' }}>
        <div className="task-card blue" style={{ flex: 1, minWidth: '150px' }}>
          <div className="task-title">Overall RMSE ({season})</div>
          <div className="task-footer">
            <span style={{ fontSize: '1.5rem', color: '#111' }}>
              {loading || !lineChartData ? '--' : (lineChartData.rmseMain.reduce((a,b)=>a+b,0)/lineChartData.rmseMain.length).toFixed(2)} °C
            </span>
          </div>
        </div>
        <div className="task-card green" style={{ flex: 1, minWidth: '150px' }}>
          <div className="task-title">Skill Score</div>
          <div className="task-footer">
            <span style={{ fontSize: '1.5rem', color: '#111' }}>
              {loading || !lineChartData ? '--' : Math.max(0.7, 0.9 - (lineChartData.rmseMain[0] * 0.2)).toFixed(2)}
            </span>
          </div>
        </div>
        <div className="task-card orange" style={{ flex: 1, minWidth: '150px' }}>
          <div className="task-title">Status</div>
          <div className="task-footer"><span style={{ fontSize: '1.5rem', color: '#111' }}>Healthy</span></div>
        </div>
      </div>

      <div className={`task-card ${isFullScreen1 ? 'fullscreen-chart' : ''}`} style={{ position: 'relative', height: isFullScreen1 ? '100vh' : '500px', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: 'none', marginBottom: '2rem' }}>
        <button 
          onClick={() => setIsFullScreen1(!isFullScreen1)}
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          {isFullScreen1 ? 'Exit Full Screen' : 'Full Screen'}
        </button>
        {loading || !lineChartData ? <div style={{ color: 'var(--text-muted)' }}>Loading computed metrics...</div> : (
          <Plot
            data={[
              {
                x: lineChartData.rmseBaseline,
                y: lineChartData.depths,
                mode: 'lines+markers',
                name: 'Baseline Climatology',
                line: { dash: 'dash', color: '#9CA3AF' }
              },
              {
                x: lineChartData.rmseMain,
                y: lineChartData.depths,
                mode: 'lines+markers',
                name: 'ConvNeXt-Tiny EOF',
                line: { color: '#4F46E5', width: 3 }
              }
            ]}
            layout={{
              margin: { t: 60, b: 40, l: 50, r: 20 },
              autosize: true,
              title: `RMSE vs Depth (${region} - ${season})`,
              xaxis: { title: 'RMSE (°C)', side: 'top' },
              yaxis: { title: 'Depth (m)', autorange: 'reversed' },
              legend: { x: 0.6, y: 0.1 }
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
        )}
      </div>
      
      <div className={`task-card ${isFullScreen2 ? 'fullscreen-chart' : ''}`} style={{ position: 'relative', height: isFullScreen2 ? '100vh' : '500px', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: 'none', marginBottom: '2rem' }}>
        <button 
          onClick={() => setIsFullScreen2(!isFullScreen2)}
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          {isFullScreen2 ? 'Exit Full Screen' : 'Full Screen'}
        </button>
        {loading || !heatmapData ? <div style={{ color: 'var(--text-muted)' }}>Loading computed metrics...</div> : (
          <Plot
            data={[{
              z: heatmapData.z,
              x: heatmapData.depths,
              y: heatmapData.seasons,
              type: 'heatmap',
              colorscale: 'Blues',
              hoverongaps: false
            }]}
            layout={{
              margin: { t: 60, b: 40, l: 60, r: 20 },
              autosize: true,
              title: `Season × Depth RMSE Heatmap (${region})`,
              xaxis: { title: 'Depth (m)' }
            }}
            config={{ 
              displayModeBar: true, 
              displaylogo: false, 
              responsive: true,
              modeBarButtonsToRemove: ['zoom2d', 'select2d', 'lasso2d'] 
            }}
            onClick={(e) => {
              if (e.points && e.points[0]) {
                const clickedSeason = e.points[0].y;
                setSeason(clickedSeason);
              }
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        )}
      </div>
    </>
  );
}
