import { API_BASE_URL } from './lib/api.js';

/**
 * Save a completed test run session to the history backend.
 * Silently fails — history is non-critical, never blocks the user.
 *
 * @param {Object} params
 * @param {string} params.module       - e.g. 'functional', 'smoke', 'performance'
 * @param {string} params.apiUrl       - the API URL that was tested
 * @param {number} params.totalTests   - total number of test cases run
 * @param {number} params.passed       - number that passed
 * @param {number} params.failed       - number that failed
 * @param {number} [params.durationMs] - optional total duration in ms
 * @param {string} params.overallStatus - 'PASS' or 'FAIL'
 */
export async function saveTestRun({ module, apiUrl, totalTests, passed, failed, durationMs, overallStatus, resultJson }) {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/history/runs/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        module,
        api_url: apiUrl,
        total_tests: totalTests,
        passed,
        failed,
        duration_ms: durationMs ?? null,
        overall_status: overallStatus,
        result_json: resultJson ?? null
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[History] Save failed:', res.status, body);
    } else {
      console.log('[History] Saved run for module:', module);
    }
  } catch (err) {
    console.error('[History] Save error:', err);
  }
}
