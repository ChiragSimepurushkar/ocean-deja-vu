import React from 'react';

export default function NewAnalysisPage() {
  return (
    <>
      <h2 className="section-title">Start New Analysis</h2>
      
      <div className="task-card" style={{ maxWidth: '600px' }}>
         <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Region of Interest (ROI)</label>
            <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
               <option>Bay of Bengal (5°N-25°N, 80°E-100°E)</option>
               <option>Arabian Sea</option>
               <option>Equatorial Indian Ocean</option>
            </select>
         </div>

         <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Date Range</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
               <input type="date" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
               <input type="date" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
            </div>
         </div>

         <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Model Selection</label>
            <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
               <option>ConvNeXt-Tiny EOF (Main)</option>
               <option>Baseline Climatology</option>
            </select>
         </div>

         <button className="promo-btn" style={{ width: '100%' }}>Launch Inference Job</button>
      </div>
    </>
  );
}
