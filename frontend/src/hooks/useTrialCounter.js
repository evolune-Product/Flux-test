import { useState, useCallback } from 'react';

const TRIAL_LIMIT = 3;
const STORAGE_KEY = 'flasqo_trial_count';
// Track visited routes per session to avoid counting the same route twice
const SESSION_KEY = 'flasqo_trial_visited';

function getVisitedRoutes() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveVisitedRoutes(set) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...set]));
}

export function useTrialCounter() {
  const [trialCount, setTrialCount] = useState(() => {
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    return isNaN(stored) ? 0 : stored;
  });

  const isExpired = trialCount >= TRIAL_LIMIT;
  const runsLeft = Math.max(0, TRIAL_LIMIT - trialCount);

  // Increments only if this route hasn't been visited this session
  const increment = useCallback((route) => {
    const visited = getVisitedRoutes();
    if (visited.has(route)) return;
    visited.add(route);
    saveVisitedRoutes(visited);

    setTrialCount(prev => {
      const next = prev + 1;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Called on successful signup/login — clear trial state entirely
  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setTrialCount(0);
  }, []);

  return { trialCount, runsLeft, isExpired, increment, reset, TRIAL_LIMIT };
}
