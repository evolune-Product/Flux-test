import { useState, useCallback } from "react";
import Toast from "../Toast.jsx";
import React from "react";

/**
 * Drop-in toast hook. Returns showToast() to trigger a notification and
 * ToastEl — a React element that renders the Toast component when visible.
 *
 * Usage:
 *   const { showToast, ToastEl } = useToast();
 *   // In JSX: {ToastEl}
 *   // To trigger: showToast('Saved!', 'success')
 */
export function useToast() {
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((t) => ({ ...t, show: false }));
  }, []);

  const ToastEl = toast.show
    ? React.createElement(Toast, {
        message: toast.message,
        type: toast.type,
        onClose: hideToast,
      })
    : null;

  return { showToast, ToastEl };
}
