/**
 * Centralized API service layer.
 *
 * Re-exports the core fetch primitives from lib/api.js so that no
 * consumer ever has to import from two different places.  All
 * higher-level domain APIs are built on top of apiFetch().
 */

// ─── Core primitives ──────────────────────────────────────────────────────────
export { apiFetch, API_BASE_URL } from '../lib/api.js';

import { apiFetch } from '../lib/api.js';

// ─── Testing API ───────────────────────────────────────────────────────────────
/**
 * Domain-specific helpers for the functional testing workflow.
 * Every method uses apiFetch(), so the Authorization header is
 * injected automatically from localStorage.
 */
export const testingApi = {
  /**
   * Generate AI test cases for a given API endpoint.
   *
   * @param {{ api_url: string, http_method: string, sample_data: object,
   *           num_tests?: number, test_types?: string[], has_auth?: boolean }} payload
   * @returns {Promise<Response>}
   */
  generateTests(payload) {
    return apiFetch('/generate-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /**
   * Execute a set of test cases against a base URL.
   *
   * @param {{ base_url: string, http_method: string, auth_config: object,
   *           timeout: number, test_cases: object[] }} payload
   * @returns {Promise<Response>}
   */
  runTests(payload) {
    return apiFetch('/run-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /**
   * Request an AI root-cause analysis for a single failed test result.
   *
   * @param {{ test_name: string, test_type: string, endpoint: string,
   *           method: string, expected_status: number, actual_status: number,
   *           error_message: string, request_data?: object,
   *           actual_response?: object, response_time?: number }} payload
   * @returns {Promise<Response>}
   */
  analyzeFailure(payload) {
    return apiFetch('/analyze-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /**
   * Retrieve paginated test-run history.
   *
   * @param {{ module?: string, limit?: number }} [params]
   * @returns {Promise<Response>}
   */
  getHistory({ module, limit = 10 } = {}) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (module) qs.set('module', module);
    return apiFetch(`/history/runs?${qs.toString()}`);
  },
};
