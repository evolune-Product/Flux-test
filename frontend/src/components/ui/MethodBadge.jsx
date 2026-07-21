import React from "react";

const METHOD_COLORS = {
  GET: "text-emerald-400",
  POST: "text-amber-400",
  PUT: "text-blue-400",
  PATCH: "text-purple-400",
  DELETE: "text-red-400",
  HEAD: "text-teal-400",
  OPTIONS: "text-pink-400",
};

const METHOD_BG = {
  GET: "bg-emerald-500/10",
  POST: "bg-amber-500/10",
  PUT: "bg-blue-500/10",
  PATCH: "bg-purple-500/10",
  DELETE: "bg-red-500/10",
  HEAD: "bg-teal-500/10",
  OPTIONS: "bg-pink-500/10",
};

/**
 * Renders a coloured HTTP method badge.
 *
 * @param {{ method: string, className?: string }} props
 */
export function MethodBadge({ method, className = "" }) {
  const m = (method || "GET").toUpperCase();
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
        METHOD_BG[m] || "bg-slate-500/10"
      } ${METHOD_COLORS[m] || "text-slate-400"} ${className}`}
    >
      {m}
    </span>
  );
}
