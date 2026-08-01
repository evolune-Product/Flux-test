import { useState, useCallback, useRef } from 'react';

/**
 * Generic API request hook.
 *
 * Wraps any async function (typically an apiFetch call) and exposes
 * reactive loading / error / data state alongside an execute() trigger
 * and a reset() to clear state between calls.
 *
 * Usage:
 *   const { loading, error, data, execute, reset } = useApiRequest(fn);
 *   // Trigger: await execute(arg1, arg2, …)
 *   // Render:  if (loading) …  else if (error) …  else …
 *
 * @template T
 * @param {(...args: any[]) => Promise<T>} requestFn
 *   An async function that performs the actual API call and returns the
 *   parsed response data (not the raw Response object).
 * @returns {{
 *   loading: boolean,
 *   error: string | null,
 *   data: T | null,
 *   execute: (...args: any[]) => Promise<T | undefined>,
 *   reset: () => void,
 * }}
 */
export function useApiRequest(requestFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [data, setData]     = useState(null);

  // Keep a stable reference so callers can safely pass an inline arrow
  // function without needing useMemo/useCallback at the call-site.
  const requestFnRef = useRef(requestFn);
  requestFnRef.current = requestFn;

  /**
   * Execute the request function with the provided arguments.
   * Returns the parsed data on success, or undefined on error.
   *
   * @param {...any} args - Forwarded directly to requestFn.
   * @returns {Promise<T | undefined>}
   */
  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestFnRef.current(...args);
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []); // stable — requestFnRef handles updates without re-renders

  /** Reset state back to the initial idle state. */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, execute, reset };
}

export default useApiRequest;
