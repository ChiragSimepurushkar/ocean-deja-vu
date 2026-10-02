import React, { useState, useEffect } from 'react';

const STATUSES = ['To Do', 'In Progress', 'Completed'];

const STATUS_COLORS = {
  'To Do': { bg: '#F3F4F6', color: '#374151' },
  'In Progress': { bg: '#E0F2FE', color: '#0369A1' },
  'Completed': { bg: '#DCFCE7', color: '#15803D' }
};

const DEFAULT_GOALS = [
  { id: 1, title: 'Train ConvNeXt-Tiny Autoencoder', sub: 'Target: RMSE < 0.5°C on validation set', status: 'In Progress' },
  { id: 2, title: 'Implement FAISS Analog Retrieval', sub: 'Use latent embeddings to find historical matches', status: 'Completed' },
  { id: 3, title: 'Integrate with Copernicus API', sub: 'Automated daily fetch pipeline', status: 'To Do' }
];

export default function GoalsPage() {
  const [goals, setGoals] = useState(() => {
    try {
      const saved = localStorage.getItem('ocean_goals');
      return saved ? JSON.parse(saved) : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  });

  useEffect(() => {
    localStorage.setItem('ocean_goals', JSON.stringify(goals));
  }, [goals]);

  const cycleStatus = (id) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      const nextIndex = (STATUSES.indexOf(g.status) + 1) % STATUSES.length;
      return { ...g, status: STATUSES[nextIndex] };
    }));
  };

  return (
    <>
      <h2 className="section-title">Project Goals & Milestones</h2>
      
      {goals.map(goal => (
        <div key={goal.id} className="list-item">
           <div className="list-col" style={{ flex: 3 }}>
              <div className="list-title">{goal.title}</div>
              <div className="list-sub">{goal.sub}</div>
           </div>
           <div className="list-col" style={{ flex: 1, textAlign: 'center' }}>
              <span 
                onClick={() => cycleStatus(goal.id)}
                className="status-badge" 
                style={{ 
                  background: STATUS_COLORS[goal.status].bg, 
                  color: STATUS_COLORS[goal.status].color,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                title="Click to change status"
              >
                {goal.status}
              </span>
           </div>
        </div>
      ))}
    </>
  );
}
