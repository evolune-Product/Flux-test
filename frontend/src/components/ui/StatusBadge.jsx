import React from "react";

/**
 * Renders a PASS / FAIL (or any status) badge with appropriate colouring.
 * Also exports the helper getStatusColors() for use outside JSX.
 *
 * @param {{ status: string, className?: string }} props
 */
export function StatusBadge({ status, className = "" }) {
  const { badge } = getStatusColors(status);
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge} ${className}`}>
      {status}
    </span>
  );
}

/**
 * Returns Tailwind class strings for PASS/FAIL (or ERROR/SKIP) status values.
 * @param {string} status
 * @returns {{ badge: string, border: string, bg: string }}
 */
export function getStatusColors(status) {
  const s = (status || "").toUpperCase();
  if (s === "PASS" || s === "PASSED" || s === "SUCCESS") {
    return {
      badge: "bg-green-500/20 text-green-400",
      border: "border-green-500",
      bg: "bg-green-500/5",
    };
  }
  if (s === "FAIL" || s === "FAILED" || s === "ERROR") {
    return {
      badge: "bg-red-500/20 text-red-400",
      border: "border-red-500",
      bg: "bg-red-500/5",
    };
  }
  if (s === "SKIP" || s === "SKIPPED" || s === "WARNING") {
    return {
      badge: "bg-yellow-500/20 text-yellow-400",
      border: "border-yellow-500",
      bg: "bg-yellow-500/5",
    };
  }
  return {
    badge: "bg-slate-500/20 text-slate-400",
    border: "border-slate-500",
    bg: "bg-slate-500/5",
  };
}
