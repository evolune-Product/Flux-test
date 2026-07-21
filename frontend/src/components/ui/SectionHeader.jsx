import React from "react";

/**
 * Standard page / section title + optional subtitle.
 *
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   className?: string,
 *   titleClassName?: string,
 *   subtitleClassName?: string
 * }} props
 */
export function SectionHeader({
  title,
  subtitle,
  className = "",
  titleClassName = "",
  subtitleClassName = "",
}) {
  return (
    <div className={className}>
      <h2 className={`text-lg font-semibold text-white ${titleClassName}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-sm text-slate-400 mt-0.5 ${subtitleClassName}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
