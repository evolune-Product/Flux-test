import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Generic modal overlay. Closes on backdrop click or Escape key.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   children: React.ReactNode,
 *   title?: string,
 *   maxWidth?: string,
 *   className?: string
 * }} props
 */
export function Modal({
  open,
  onClose,
  children,
  title,
  maxWidth = "max-w-lg",
  className = "",
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            {title && (
              <h3 className="text-base font-semibold text-white">{title}</h3>
            )}
            <button
              onClick={onClose}
              className="ml-auto text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
