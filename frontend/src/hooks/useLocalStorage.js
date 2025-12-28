import { useState, useEffect } from 'react';

/**
 * Custom hook for persisting state to localStorage
 * Automatically saves to localStorage and restores on page load
 *
 * @param {string} key - localStorage key
 * @param {any} initialValue - default value if nothing in localStorage
 * @returns {[any, function]} - [value, setValue] same as useState
 */
export function useLocalStorage(key, initialValue) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);

      // Parse stored json or if none return initialValue
      if (item) {
        const parsed = JSON.parse(item);
        console.log(`✅ Restored ${key} from localStorage:`, parsed);
        return parsed;
      }

      return initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = (value) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        console.log(`💾 Saved ${key} to localStorage`);
      }
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  return [storedValue, setValue];
}

/**
 * Custom hook for auto-saving state with debounce
 * Saves to localStorage after user stops typing
 *
 * @param {string} key - localStorage key
 * @param {any} initialValue - default value
 * @param {number} delay - debounce delay in ms (default 1000ms)
 * @returns {[any, function, function]} - [value, setValue, clearValue]
 */
export function useAutoSave(key, initialValue, delay = 1000) {
  const [value, setValue] = useLocalStorage(key, initialValue);
  const [saveTimeout, setSaveTimeout] = useState(null);

  // Auto-save with debounce
  const setAutoSaveValue = (newValue) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set value immediately in state
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
    setValue(valueToStore);

    // Show auto-save indicator
    const timeout = setTimeout(() => {
      console.log(`✅ Auto-saved ${key}`);
    }, delay);

    setSaveTimeout(timeout);
  };

  // Clear saved data
  const clearValue = () => {
    setValue(initialValue);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
      console.log(`🗑️ Cleared ${key} from localStorage`);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  return [value, setAutoSaveValue, clearValue];
}

/**
 * Hook to clear all localStorage data for the app
 * Useful for "Clear All" or "Reset" buttons
 */
export function useClearAllStorage() {
  const clearAll = () => {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(window.localStorage);
      const appKeys = keys.filter(key =>
        key.startsWith('evotfx_') ||
        key.startsWith('functional_') ||
        key.startsWith('smoke_') ||
        key.startsWith('performance_') ||
        key.startsWith('chaos_') ||
        key.startsWith('regression_') ||
        key.startsWith('contract_')
      );

      appKeys.forEach(key => {
        window.localStorage.removeItem(key);
      });

      console.log(`🗑️ Cleared ${appKeys.length} items from localStorage`);
      return appKeys.length;
    }
    return 0;
  };

  return clearAll;
}

/**
 * Hook for session storage (clears on browser close)
 * Use for temporary data that shouldn't persist across sessions
 */
export function useSessionStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading ${key} from sessionStorage:`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error saving ${key} to sessionStorage:`, error);
    }
  };

  return [storedValue, setValue];
}

export default useLocalStorage;
