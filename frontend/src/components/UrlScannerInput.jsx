import React, { useState } from 'react';
import { Globe, XCircle, Zap, ArrowRight } from 'lucide-react';

export default function UrlScannerInput({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
  disabled,
  error,
  showError = true,
  buttonLabel = "RUN FULLSEND",
  inputRef,
  containerClassName = "",
  buttonClassName = ""
}) {
  const [focusActive, setFocusActive] = useState(false);
  const hasValue = !!value?.trim();

  return (
    <div className={`relative ${containerClassName}`.trim()}>
      
      {/* Dynamic Glass Panel Container */}
      <div 
        className={`relative rounded-2xl border transition-all duration-300 ease-out backdrop-blur-xl ${
          focusActive 
            ? "bg-white/[0.03] border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)]" 
            : "bg-white/[0.01] border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
        }`}
      >
        <form onSubmit={onSubmit}>
          
          {/* Input Section */}
          <div className="flex items-center gap-4 px-5 py-4">
            
            {/* Blended Globe Icon Container */}
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                focusActive
                  ? "bg-cyan-500/10 border-cyan-400/20"
                  : "bg-white/[0.03] border-white/[0.05]"
              }`}
            >
              <Globe
                size={18}
                className={`transition-colors duration-300 ${
                  focusActive ? "text-cyan-400" : "text-slate-400"
                }`}
              />
            </div>

            {/* Main Input Text Field */}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={onChange}
              onFocus={() => setFocusActive(true)}
              onBlur={() => setFocusActive(false)}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-base md:text-lg font-medium selection:bg-cyan-500/30"
            />

            {/* Clear Input Action */}
            {value && (
              <button
                type="button"
                onClick={onClear}
                className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 p-1 rounded-full hover:bg-white/5"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>

          {/* Error Message Module */}
          {showError && error && (
            <div className="mx-5 mb-4 flex items-start gap-2.5 p-3.5 rounded-xl text-sm text-red-400 border border-red-500/20 bg-red-500/10 backdrop-blur-md transition-all duration-200">
              <XCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="px-5 pb-5 pt-1">
            <button
              type="submit"
              disabled={disabled || !hasValue}
              className={`
                w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl 
                font-bold text-[13px] uppercase tracking-[0.18em]
                transition-all duration-300 group active:scale-[0.99]
                disabled:cursor-not-allowed
                ${
                  hasValue
                    ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:brightness-110"
                    : "bg-white/[0.04] text-slate-500 border border-white/[0.05] opacity-40"
                } 
                ${buttonClassName}
              `.trim()}
            >
              <Zap
                size={14}
                className={`transition-all duration-200 ${hasValue ? "text-cyan-200 animate-pulse" : ""}`}
              />
              
              <span>{buttonLabel}</span>
              
              <ArrowRight
                size={14}
                className="transform group-hover:translate-x-1 transition-transform duration-200 ease-out"
              />
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}