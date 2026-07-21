import React, { useState } from 'react';
import { Brain, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, Shield, Zap } from 'lucide-react';

/**
 * AI Root Cause Analysis Panel Component
 *
 * Production-ready, reusable component for displaying AI analysis of test failures.
 * Implements Hybrid Option 3: Auto-displays for critical failures, manual trigger for others.
 *
 * Features:
 * - CTO-level professional presentation
 * - Severity-based color coding
 * - Expandable/collapsible sections
 * - Copy-to-clipboard for sharing
 * - Mobile-responsive design
 *
 * @param {Object} props
 * @param {Object} props.analysis - AI analysis result object
 * @param {Function} props.onAnalyze - Callback for manual analysis trigger
 * @param {Boolean} props.analyzing - Whether analysis is in progress
 * @param {Boolean} props.autoAnalyzed - Whether this was auto-analyzed (critical failure)
 */
const AIAnalysisPanel = ({
  analysis,
  onAnalyze,
  analyzing = false,
  autoAnalyzed = false
}) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Severity color mappings (professional, accessible colors)
  const severityConfig = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-900',
      badge: 'bg-red-500 text-white',
      icon: XCircle,
      label: 'CRITICAL'
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-500',
      text: 'text-orange-900',
      badge: 'bg-orange-500 text-white',
      icon: AlertTriangle,
      label: 'HIGH'
    },
    medium: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'text-yellow-900',
      badge: 'bg-yellow-500 text-white',
      icon: AlertTriangle,
      label: 'MEDIUM'
    },
    low: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-900',
      badge: 'bg-blue-500 text-white',
      icon: CheckCircle,
      label: 'LOW'
    },
    unknown: {
      bg: 'bg-gray-50',
      border: 'border-gray-500',
      text: 'text-gray-900',
      badge: 'bg-gray-500 text-white',
      icon: AlertTriangle,
      label: 'UNKNOWN'
    }
  };

  const severity = analysis?.severity?.toLowerCase() || 'unknown';
  const config = severityConfig[severity] || severityConfig.unknown;
  const SeverityIcon = config.icon;

  // If no analysis and no ability to analyze, don't render
  if (!analysis && !onAnalyze) {
    return null;
  }

  // Handle copy to clipboard
  const handleCopy = () => {
    const text = `
AI Root Cause Analysis
======================
${analysis.root_cause}

Severity: ${analysis.severity}
Category: ${analysis.category}
Confidence: ${(analysis.confidence_score * 100).toFixed(0)}%

Technical Details:
${analysis.technical_details || 'N/A'}

Business Impact:
${analysis.business_impact || 'N/A'}

Recommendations:
${analysis.recommendations?.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'None'}

Next Steps:
${analysis.next_steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'None'}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show analyze button if no analysis yet
  if (!analysis && onAnalyze) {
    return (
      <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-purple-600" />
            <div>
              <h4 className="font-semibold text-purple-900">AI Root Cause Analysis</h4>
              <p className="text-sm text-purple-700">Get CTO-level insights on this failure</p>
            </div>
          </div>
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                     disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all
                     flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            {analyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Analyze with AI
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Render full analysis
  return (
    <div className={`mt-4 border-l-4 rounded-lg shadow-md ${config.border} ${config.bg}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Brain className="w-7 h-7 text-purple-600 mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-lg text-gray-900">AI Root Cause Analysis</h4>
                {autoAnalyzed && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                    Auto-analyzed
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.badge}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Professional engineering analysis powered by GPT-4
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-5 space-y-4">
          {/* Root Cause - Primary Information */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SeverityIcon className={`w-5 h-5 ${config.text}`} />
              <h5 className="font-bold text-gray-900">Root Cause</h5>
            </div>
            <p className={`text-base leading-relaxed ${config.text} bg-white p-4 rounded-lg border ${config.border}`}>
              {analysis.root_cause}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="font-semibold text-gray-600 mb-1">Severity</div>
              <div className={`font-bold ${config.text}`}>{analysis.severity?.toUpperCase()}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="font-semibold text-gray-600 mb-1">Category</div>
              <div className="font-medium text-gray-900">{analysis.category}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="font-semibold text-gray-600 mb-1">Confidence</div>
              <div className="font-bold text-green-600">
                {(analysis.confidence_score * 100).toFixed(0)}%
              </div>
            </div>
            {analysis.estimated_fix_time && (
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Est. Fix Time
                </div>
                <div className="font-medium text-gray-900">{analysis.estimated_fix_time}</div>
              </div>
            )}
          </div>

          {/* Technical Details */}
          {analysis.technical_details && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <h5 className="font-bold text-gray-900">Technical Details</h5>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-gray-800 leading-relaxed">{analysis.technical_details}</p>
              </div>
            </div>
          )}

          {/* Business Impact */}
          {analysis.business_impact && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <h5 className="font-bold text-gray-900">Business Impact</h5>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-gray-800 leading-relaxed">{analysis.business_impact}</p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <h5 className="font-bold text-gray-900">Recommendations</h5>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <ol className="space-y-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="font-bold text-green-600 min-w-[24px]">{idx + 1}.</span>
                      <span className="text-gray-800 leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Next Steps */}
          {analysis.next_steps && analysis.next_steps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-purple-600" />
                <h5 className="font-bold text-gray-900">Next Steps</h5>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                <ol className="space-y-2">
                  {analysis.next_steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="font-bold text-purple-600 min-w-[24px]">{idx + 1}.</span>
                      <span className="text-gray-900 font-medium leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Related Issues */}
          {analysis.related_issues && analysis.related_issues.length > 0 && (
            <div>
              <h5 className="font-bold text-gray-900 mb-2">Related Common Issues</h5>
              <ul className="space-y-1">
                {analysis.related_issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-400">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="pt-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
            <span>
              Analyzed: {analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString() : 'N/A'}
            </span>
            {analysis.analyzer_version && (
              <span>Analyzer v{analysis.analyzer_version}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPanel;
