import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Shared back-to-dashboard button used across all test suite headers.
 * Navigates to '/' on click. Fully self-contained — no props required.
 */
export default function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/')}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 10,
        color: 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        fontSize: 15,
        fontWeight: 500,
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      title="Back to Dashboard"
    >
      <ArrowLeft size={16} />
      Back
    </button>
  );
}
