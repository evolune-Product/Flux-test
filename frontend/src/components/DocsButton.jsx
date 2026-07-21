import { BookOpen } from "lucide-react";

export default function DocsButton({
  label = "Docs",
  href = "https://docs.flasqo.com",
  className = "",
  ...props
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur transition hover:border-cyan-400 hover:text-cyan-300 ${className}`}
      {...props}
    >
      <BookOpen size={16} />
      <span>{label}</span>
    </a>
  );
}
