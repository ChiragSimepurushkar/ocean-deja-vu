import React, { useState } from 'react';
import { useNotes } from '../hooks/useNotes';
import { useOceanSessionStore } from '../store/oceanSessionStore';
import { useNavigate } from 'react-router-dom';

export default function NotesPage() {
  const { notes, addNote, deleteNote } = useNotes();
  const { currentLat, currentLon, currentDate, setLocation, setDate } = useOceanSessionStore();
  const [newNoteText, setNewNoteText] = useState('');
  const navigate = useNavigate();

  const handleSave = () => {
    if (!newNoteText.trim()) return;
    addNote({
      text: newNoteText,
      lat: currentLat,
      lon: currentLon,
      date: currentDate
    });
    setNewNoteText('');
  };

  const handleJump = (note) => {
    setLocation(note.lat, note.lon);
    setDate(note.date);
    navigate('/');
  };

  return (
    <>
      <h2 className="section-title">Research Notes</h2>
      <div className="cards-row" style={{ flexWrap: 'wrap' }}>
        {notes.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No notes yet. Add one below!</div>}
        {notes.map(note => (
          <div key={note.id} className="task-card" style={{ minWidth: '300px', flex: '1 1 300px' }}>
            <div className="task-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span 
                style={{ cursor: 'pointer', color: 'var(--accent)' }} 
                onClick={() => handleJump(note)}
                title="Jump to this location & date"
              >
                {note.lat.toFixed(2)}°N, {note.lon.toFixed(2)}°E @ {note.date}
              </span>
              <button 
                onClick={() => deleteNote(note.id)}
                style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}
                title="Delete note"
              >
                ✕
              </button>
            </div>
            <div className="task-desc" style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{note.text}</div>
            <div className="task-footer" style={{ marginTop: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {new Date(note.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="task-card" style={{ marginTop: '2rem', minHeight: '300px' }}>
         <h3 style={{ marginBottom: '1rem' }}>New Note (Tagged: {currentLat.toFixed(2)}°N, {currentLon.toFixed(2)}°E @ {currentDate})</h3>
         <textarea 
           value={newNoteText}
           onChange={(e) => setNewNoteText(e.target.value)}
           style={{ width: '100%', height: '200px', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none', background: 'var(--bg-input)', color: 'var(--text-main)', resize: 'vertical' }} 
           placeholder="Type your observations here..."
         />
         <button onClick={handleSave} className="promo-btn" style={{ marginTop: '1rem' }}>Save Note</button>
      </div>
    </>
  );
}
