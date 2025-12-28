import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={24} className="text-green-500" />,
    error: <XCircle size={24} className="text-red-500" />,
    warning: <AlertCircle size={24} className="text-yellow-500" />,
    info: <AlertCircle size={24} className="text-blue-500" />
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  };

  const textColors = {
    success: 'text-green-800',
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800'
  };

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-slideDown">
      <div className={`${bgColors[type]} border-2 rounded-xl shadow-2xl p-4 pr-12 flex items-center gap-3 min-w-[400px] max-w-[600px]`}>
        {icons[type]}
        <div className="flex-1">
          <p className={`${textColors[type]} font-semibold text-sm`}>{message}</p>
        </div>
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 ${textColors[type]} hover:opacity-70 transition-opacity`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
