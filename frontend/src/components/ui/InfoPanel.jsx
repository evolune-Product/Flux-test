import React from "react";

/**
 * Slate key-value card for displaying metadata / summary rows.
 *
 * @param {{
 *   title?: string,
 *   rows: Array<{ label: string, value: React.ReactNode }>,
 *   className?: string
 * }} props
 */
export function InfoPanel({ title, rows = [], className = "" }) {
  return (
    <div
      className={`bg-slate-800/60 border border-slate-700 rounded-xl p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      )}
      <div className="space-y-2">
        {rows.map(({ label, value }, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
            <span className="text-xs text-white text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
