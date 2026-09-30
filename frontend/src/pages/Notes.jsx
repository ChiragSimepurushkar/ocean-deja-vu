import React from 'react';

export default function NotesPage() {
  return (
    <>
      <h2 className="section-title">Research Notes</h2>
      <div className="cards-row">
        <div className="task-card">
          <div className="task-title">Anomaly in Bay of Bengal</div>
          <div className="task-desc">Noticed a significant warming trend at 50m depth during June 2023. Needs cross-validation with Copernicus baseline.</div>
          <div className="task-footer">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Updated 2 days ago</span>
          </div>
        </div>
        <div className="task-card">
          <div className="task-title">Model Performance Review</div>
          <div className="task-desc">ConvNeXt-Tiny EOF decoder is showing 0.82 Skill Score. We might want to increase the latent dimension to capture mesoscale eddies better.</div>
          <div className="task-footer">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Updated 5 days ago</span>
          </div>
        </div>
      </div>
      
      <div className="task-card" style={{ marginTop: '2rem', minHeight: '300px' }}>
         <h3 style={{ marginBottom: '1rem' }}>New Note</h3>
         <textarea style={{ width: '100%', height: '200px', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none', background: 'var(--bg-input)', color: 'var(--text-main)' }} placeholder="Type your observations here..."></textarea>
         <button className="promo-btn" style={{ marginTop: '1rem' }}>Save Note</button>
      </div>
    </>
  );
}
