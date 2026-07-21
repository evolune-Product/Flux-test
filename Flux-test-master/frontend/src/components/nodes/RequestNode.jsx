import { Handle, Position } from '@xyflow/react';

const METHOD_COLORS = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-yellow-500',
  PATCH: 'bg-orange-500',
  DELETE: 'bg-red-500',
};

function RequestNode({ data, selected }) {
  const methodColor = METHOD_COLORS[data.method] || 'bg-slate-500';
  const extractionCount = Array.isArray(data.extractions) ? data.extractions.length : 0;

  let ringClass = '';
  let overlayContent = null;

  if (data._result === 'RUNNING') {
    ringClass = 'ring-2 ring-cyan-400/60 animate-pulse';
  } else if (data._result === 'PASS') {
    ringClass = 'ring-2 ring-green-500/70';
    overlayContent = (
      <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  } else if (data._result === 'FAIL') {
    ringClass = 'ring-2 ring-red-500/70';
    overlayContent = (
      <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-slate-800 border rounded-lg min-w-[200px] max-w-[240px] shadow-xl transition-all duration-300
        ${selected ? 'border-blue-400/80 shadow-blue-500/20' : 'border-slate-600/60'}
        ${ringClass}
      `}
    >
      {/* Result badge overlay */}
      {overlayContent}

      {/* Input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-400 hover:!bg-blue-400 transition-colors"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${methodColor} shrink-0`}>
          {data.method || 'GET'}
        </span>
        <span className="text-white text-sm font-semibold truncate" title={data.label}>
          {data.label || 'Request'}
        </span>
      </div>

      {/* Endpoint */}
      <div className="px-3 pb-2">
        <code className="text-slate-300 text-xs font-mono break-all line-clamp-2" title={data.endpoint}>
          {data.endpoint || '/endpoint'}
        </code>
      </div>

      {/* Footer meta */}
      <div className="flex items-center gap-3 px-3 pb-3 border-t border-slate-700/50 pt-2 mt-1">
        <span className="text-slate-400 text-xs">
          Status: <span className="text-slate-300">{data.expected_status || 200}</span>
        </span>
        {extractionCount > 0 && (
          <span className="text-cyan-400 text-xs">
            {extractionCount} var{extractionCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Details tooltip when result exists */}
      {data._details && (
        <div className={`px-3 pb-2 text-xs truncate ${data._result === 'PASS' ? 'text-green-400' : 'text-red-400'}`}
          title={data._details}>
          {data._details}
        </div>
      )}

      {/* Output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-400 hover:!bg-blue-400 transition-colors"
      />
    </div>
  );
}

export default RequestNode;
