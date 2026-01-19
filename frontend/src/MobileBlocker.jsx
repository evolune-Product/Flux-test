import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, ExternalLink } from 'lucide-react';

const MobileBlocker = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // Check if it's a mobile device using multiple methods
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;

      // Check for mobile user agents
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
      const isMobileUA = mobileRegex.test(userAgent);

      // Check screen width (phones are typically < 768px)
      const isSmallScreen = window.innerWidth < 768;

      // Check touch capability combined with small screen
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Consider it mobile if it has mobile UA AND small screen
      // This allows tablets in landscape and desktops with touch screens
      const isMobileDevice = isMobileUA && isSmallScreen;

      // Check if user has requested desktop site (viewport meta tag check)
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      const hasDesktopViewport = viewportMeta && viewportMeta.content.includes('width=1024');

      // Don't show blocker if user has already dismissed it this session
      const sessionDismissed = sessionStorage.getItem('mobileBlockerDismissed');

      setIsMobile(isMobileDevice && !hasDesktopViewport);
      setShowBlocker(isMobileDevice && !hasDesktopViewport && !sessionDismissed);
    };

    checkDevice();

    // Re-check on resize (for orientation changes)
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBlocker(false);
    sessionStorage.setItem('mobileBlockerDismissed', 'true');
  };

  const handleEnableDesktopView = () => {
    // Try to enable desktop view by modifying viewport
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.content = 'width=1024, initial-scale=0.5, user-scalable=yes';
    } else {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=1024, initial-scale=0.5, user-scalable=yes';
      document.head.appendChild(viewportMeta);
    }

    // Store preference
    sessionStorage.setItem('desktopViewEnabled', 'true');
    setShowBlocker(false);
    setIsMobile(false);

    // Force reload to apply changes
    window.location.reload();
  };

  if (!showBlocker) {
    return children;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Smartphone className="w-20 h-20 text-red-400 animate-pulse" />
            <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
              <span className="text-white text-lg font-bold">!</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-white mb-4">
          Mobile Device Detected
        </h1>

        {/* Message */}
        <p className="text-gray-300 text-center mb-6 leading-relaxed">
          <span className="font-semibold text-purple-300">Evo-TFX</span> is optimized for
          <span className="text-cyan-300 font-semibold"> desktop, laptop, or tablet</span> devices.
          For the best experience, please use a larger screen.
        </p>

        {/* Recommended Devices */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400 mb-3 text-center">Recommended devices:</p>
          <div className="flex justify-center gap-6">
            <div className="flex flex-col items-center">
              <Monitor className="w-8 h-8 text-green-400 mb-1" />
              <span className="text-xs text-gray-300">Desktop</span>
            </div>
            <div className="flex flex-col items-center">
              <Monitor className="w-7 h-7 text-green-400 mb-1" />
              <span className="text-xs text-gray-300">Laptop</span>
            </div>
            <div className="flex flex-col items-center">
              <Tablet className="w-8 h-8 text-green-400 mb-1" />
              <span className="text-xs text-gray-300">iPad/Tablet</span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Enable Desktop View Button */}
          <button
            onClick={handleEnableDesktopView}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-purple-500/30 flex items-center justify-center gap-2"
          >
            <Monitor className="w-5 h-5" />
            Enable Desktop View
          </button>

          {/* Continue Anyway (smaller, less prominent) */}
          <button
            onClick={handleDismiss}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-sm transition-all border border-white/10"
          >
            Continue anyway (not recommended)
          </button>
        </div>

        {/* Warning Note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Some features may not work correctly on mobile devices.
          Desktop view provides full functionality.
        </p>

        {/* Brand */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500">
            Powered by <span className="text-purple-400 font-semibold">Evo-TFX</span> by EvoluneEdgeTech
          </p>
        </div>
      </div>
    </div>
  );
};

export default MobileBlocker;
