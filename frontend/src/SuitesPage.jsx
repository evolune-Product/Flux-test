import { useNavigate } from 'react-router-dom';
import { SUITES } from './DesktopShell.jsx';

// App-style launcher for all test suites (replaces the marketing landing grid in desktop mode).
export default function SuitesPage() {
  const navigate = useNavigate();
  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-gray-200">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-white">Test Suites</h1>
        <p className="text-gray-500 mt-1 text-sm mb-8">Pick a testing approach. Each suite runs locally against your API.</p>
        <div className="grid grid-cols-3 gap-3">
          {SUITES.map(s => (
            <button key={s.path} onClick={() => navigate(s.path)}
              className="group text-left p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors">
              <s.icon size={22} className={`${s.color} mb-3`} />
              <h3 className="font-medium text-white text-sm">{s.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
