import React, { useState } from 'react';
import AIAnalysisPanel from '../../AIAnalysisPanel.jsx';
import { StatusBadge, getStatusColors } from '../ui/StatusBadge.jsx';
import { testingApi } from '../../services/api.js';

/**
 * TestResultItem
 *
 * Renders a single test result row with inline AI failure-analysis support.
 * Extracted from App.jsx and generalised so every testing module can reuse it.
 *
 * The visual design is intentionally identical to the original in App.jsx —
 * no new styles were introduced.
 *
 * @param {Object}  props
 * @param {Object}  props.result
 *   Shape expected from the /run-tests backend response:
 *   {
 *     test:            string,   // display name
 *     status:          string,   // 'PASS' | 'FAIL' | 'SKIP' | …
 *     details:         string,   // human-readable detail
 *     timestamp:       string,   // ISO or locale string
 *     endpoint?:       string,
 *     method?:         string,
 *     expected_status?: number,
 *     actual_status?:  number,
 *     request_data?:   object,
 *     response_data?:  object,
 *     ai_analysis?:    object,   // pre-populated for critical failures
 *   }
 * @param {number} props.idx - Zero-based index (used as React key upstream).
 */
const TestResultItem = ({ result, idx }) => {
  const [analyzing,    setAnalyzing]    = useState(false);
  const [aiAnalysis,   setAiAnalysis]   = useState(result.ai_analysis ?? null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Critical failures arrive with ai_analysis already populated
  const autoAnalyzed = result.ai_analysis !== undefined;

  const handleAnalyzeFailure = async () => {
    setAnalyzing(true);
    try {
      const response = await testingApi.analyzeFailure({
        test_name:       result.test,
        test_type:       'functional',
        endpoint:        result.endpoint        ?? 'Unknown',
        method:          result.method          ?? 'GET',
        expected_status: result.expected_status ?? 200,
        actual_status:   result.actual_status   ?? 0,
        error_message:   result.details,
        request_data:    result.request_data    ?? {},
        actual_response: result.response_data   ?? {},
        response_time:   result.response_data?.time ?? 0,
      });

      if (response.ok) {
        const data = await response.json();
        setAiAnalysis(data.analysis);
        setShowAnalysis(true);
      } else {
        console.error('AI analysis failed:', await response.text());
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const { bg, border } = getStatusColors(result.status);

  return (
    <div key={idx} className={`p-3 rounded-xl border-l-2 ${bg} ${border}`}>
      <div className="flex items-center gap-2">
        <StatusBadge status={result.status} />
        <span className="text-sm text-white font-medium">{result.test}</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{result.details}</div>
      <div className="text-xs text-slate-600 mt-0.5">🕐 {result.timestamp}</div>

      {result.status === 'FAIL' && (
        <AIAnalysisPanel
          analysis={showAnalysis || autoAnalyzed ? aiAnalysis : null}
          onAnalyze={!autoAnalyzed && !showAnalysis ? handleAnalyzeFailure : null}
          analyzing={analyzing}
          autoAnalyzed={autoAnalyzed}
        />
      )}
    </div>
  );
};

export default TestResultItem;
