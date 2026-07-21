import React from "react";

/**
 * Reusable auth type <select> + credential fields.
 *
 * @param {{
 *   value: { type: string, token?: string, username?: string, password?: string,
 *            key?: string, value?: string, add_to?: string },
 *   onChange: (config: object) => void,
 *   className?: string
 * }} props
 */
export function AuthSelector({ value, onChange, className = "" }) {
  const cfg = value || { type: "none" };

  const set = (patch) => onChange({ ...cfg, ...patch });

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Auth Type</label>
        <select
          value={cfg.type}
          onChange={(e) => set({ type: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
        >
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="api_key">API Key</option>
        </select>
      </div>

      {cfg.type === "bearer" && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Token</label>
          <input
            type="text"
            value={cfg.token || ""}
            onChange={(e) => set({ token: e.target.value })}
            placeholder="Bearer token"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
      )}

      {cfg.type === "basic" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={cfg.username || ""}
              onChange={(e) => set({ username: e.target.value })}
              placeholder="Username"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={cfg.password || ""}
              onChange={(e) => set({ password: e.target.value })}
              placeholder="Password"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
      )}

      {cfg.type === "api_key" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Key</label>
              <input
                type="text"
                value={cfg.key || ""}
                onChange={(e) => set({ key: e.target.value })}
                placeholder="Key name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Value</label>
              <input
                type="text"
                value={cfg.value || ""}
                onChange={(e) => set({ value: e.target.value })}
                placeholder="Key value"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Add To</label>
            <select
              value={cfg.add_to || "header"}
              onChange={(e) => set({ add_to: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
