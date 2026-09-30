import React from 'react';

export default function GoalsPage() {
  return (
    <>
      <h2 className="section-title">Project Goals & Milestones</h2>
      
      <div className="list-item">
         <div className="list-col" style={{ flex: 3 }}>
            <div className="list-title">Train ConvNeXt-Tiny Autoencoder</div>
            <div className="list-sub">Target: RMSE &lt; 0.5°C on validation set</div>
         </div>
         <div className="list-col" style={{ flex: 1, textAlign: 'center' }}>
            <span className="status-badge" style={{ background: '#E0F2FE', color: '#0369A1' }}>In Progress</span>
         </div>
      </div>

      <div className="list-item">
         <div className="list-col" style={{ flex: 3 }}>
            <div className="list-title">Implement FAISS Analog Retrieval</div>
            <div className="list-sub">Use latent embeddings to find historical matches</div>
         </div>
         <div className="list-col" style={{ flex: 1, textAlign: 'center' }}>
            <span className="status-badge" style={{ background: '#DCFCE7', color: '#15803D' }}>Completed</span>
         </div>
      </div>

      <div className="list-item">
         <div className="list-col" style={{ flex: 3 }}>
            <div className="list-title">Integrate with Copernicus API</div>
            <div className="list-sub">Automated daily fetch pipeline</div>
         </div>
         <div className="list-col" style={{ flex: 1, textAlign: 'center' }}>
            <span className="status-badge" style={{ background: '#F3F4F6', color: '#374151' }}>To Do</span>
         </div>
      </div>
    </>
  );
}
