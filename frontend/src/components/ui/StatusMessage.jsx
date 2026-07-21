import React from "react";
import { Loader } from "lucide-react";

/**
 * Loading spinner + status message box. Renders nothing when both
 * loading is false and message is falsy.
 *
 * @param {{
 *   loading: boolean,
 *   message: string,
 *   className?: string
 * }} props
 */
export function StatusMessage({ loading, message, className = "" }) {
  if (!loading && !message) return null;

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-slate-800/60 border border-slate-700 rounded-xl ${className}`}
    >
      {loading && (
        <Loader size={16} className="text-violet-400 animate-spin flex-shrink-0" />
      )}
      {message && (
        <span className="text-sm text-slate-300">{message}</span>
      )}
    </div>
  );
}
