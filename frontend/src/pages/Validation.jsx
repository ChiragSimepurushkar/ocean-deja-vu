import React, { useState } from 'react';
import Plot from 'react-plotly.js';

export default function ValidationPage() {
  const [isFullScreen1, setIsFullScreen1] = useState(false);
  const [isFullScreen2, setIsFullScreen2] = useState(false);
  // Dummy validation metrics
  const depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
  const rmseMain = depths.map(d => 0.4 + (d / 1000) * 0.5 + Math.random() * 0.1);
  const rmseBaseline = depths.map(d => 0.6 + (d / 1000) * 0.8 + Math.random() * 0.2);

  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const heatmapData = seasons.map(() => depths.map(d => Math.random() * 0.8 + (d < 100 ? 0.2 : 0)));

  return (
    <>
      <h2 className="section-title">Model Validation</h2>
      
      <div className="cards-row" style={{ marginBottom: '2rem' }}>
        <div className="task-card blue" style={{ flex: 1, minWidth: '150px' }}>
          <div className="task-title">Overall RMSE</div>
          <div className="task-footer"><span style={{ fontSize: '1.5rem', color: '#111' }}>0.45 °C</span></div>
        </div>
        <div className="task-card green" style={{ flex: 1, minWidth: '150px' }}>
          <div className="task-title">Skill Score</div>
          <div className="task-footer"><span style={{ fontSize: '1.5rem', color: '#111' }}>0.82</span></div>
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
        <Plot
          data={[
            {
              x: rmseBaseline,
              y: depths,
              mode: 'lines+markers',
              name: 'Baseline Climatology',
              line: { dash: 'dash', color: '#9CA3AF' }
            },
            {
              x: rmseMain,
              y: depths,
              mode: 'lines+markers',
              name: 'ConvNeXt-Tiny EOF',
              line: { color: '#4F46E5', width: 3 }
            }
          ]}
          layout={{
            margin: { t: 60, b: 40, l: 50, r: 20 },
            autosize: true,
            title: 'RMSE vs Depth Chart',
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
      </div>
      
      <div className={`task-card ${isFullScreen2 ? 'fullscreen-chart' : ''}`} style={{ position: 'relative', height: isFullScreen2 ? '100vh' : '500px', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: 'none', marginBottom: '2rem' }}>
        <button 
          onClick={() => setIsFullScreen2(!isFullScreen2)}
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          {isFullScreen2 ? 'Exit Full Screen' : 'Full Screen'}
        </button>
        <Plot
          data={[{
            z: heatmapData,
            x: depths,
            y: seasons,
            type: 'heatmap',
            colorscale: 'Blues',
            hoverongaps: false
          }]}
          layout={{
            margin: { t: 60, b: 40, l: 60, r: 20 },
            autosize: true,
            title: 'Season × Depth RMSE Heatmap',
            xaxis: { title: 'Depth (m)' }
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
      </div>
    </>
  );
}
