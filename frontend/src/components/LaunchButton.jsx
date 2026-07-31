import { Rocket } from "lucide-react";
import { Link } from "react-router-dom";

export default function LaunchButton({
  label = "Launch",
  href = "https://www.flasqo.com",
  className = "",
  external = false,
  ...props
}) {
  const isExternal = external || href.startsWith("http");
  const baseClasses = `inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-cyan-400/20 px-3 py-2 text-sm font-semibold text-cyan-200 shadow-lg shadow-cyan-500/20 backdrop-blur transition hover:scale-[1.02] hover:border-cyan-300 hover:text-cyan-100 ${className}`;

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
        {...props}
      >
        <Rocket size={16} />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <Link
      to={href}
      className={baseClasses}
      {...props}
    >
      <Rocket size={16} />
      <span>{label}</span>
    </Link>
  );
}
