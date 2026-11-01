"use client";

import React, { useState } from "react";
import { HelpCircle } from "lucide-react";

export interface HelpOptionExplanation {
  label: string;
  description: string;
}

interface HelpTooltipProps {
  title: string;
  summary?: string;
  options?: HelpOptionExplanation[];
  align?: "left" | "center" | "right";
}

export function HelpTooltip({
  title,
  summary,
  options,
  align = "left",
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  const alignClass =
    align === "right"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0";

  return (
    <span
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Ajuda sobre: ${title}`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[#1B365D] dark:text-[#D4AF37] bg-[#1B365D]/10 dark:bg-[#B59410]/20 hover:bg-[#1B365D] hover:text-white dark:hover:bg-[#D4AF37] dark:hover:text-slate-950 transition-colors cursor-help shrink-0"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-50 top-full mt-2 ${alignClass} w-72 sm:w-80 p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-white shadow-2xl border border-slate-700/90 text-left font-normal normal-case tracking-normal leading-relaxed pointer-events-auto`}
        >
          <div className="font-heading text-xs font-bold text-[#F3E5AB] mb-1.5 border-b border-slate-800 pb-1.5">
            {title}
          </div>

          {summary && (
            <p className="text-[11px] text-slate-200 mb-2 leading-relaxed">
              {summary}
            </p>
          )}

          {options && options.length > 0 && (
            <ul className="space-y-1.5 text-[11px]">
              {options.map((opt) => (
                <li
                  key={opt.label}
                  className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60"
                >
                  <span className="font-semibold text-[#D4AF37] block mb-0.5">
                    • {opt.label}:
                  </span>
                  <span className="text-slate-200 block leading-snug">
                    {opt.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
