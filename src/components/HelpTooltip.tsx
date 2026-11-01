"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUpward: boolean;
    maxWidth: number;
  }>({ top: 0, left: 0, openUpward: false, maxWidth: 720 });

  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Wide horizontal layout when there are multiple options
    const optCount = options?.length || 0;
    const desiredWidth =
      optCount >= 3 ? 760 : optCount === 2 ? 560 : 440;
    const cardWidth = Math.min(vw - 24, desiredWidth);

    // Center relative to the icon, clamped inside viewport margins [12px .. vw - cardWidth - 12px]
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    left = Math.max(12, Math.min(left, vw - cardWidth - 12));

    // Check vertical space below vs above
    const spaceBelow = vh - rect.bottom;
    const estimatedHeight = optCount > 0 ? 190 : 110;
    const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;

    const top = openUpward ? rect.top - 10 : rect.bottom + 10;

    setCoords({
      top,
      left,
      openUpward,
      maxWidth: cardWidth,
    });
  }, [options?.length]);

  const handleOpen = () => {
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  const gridColsClass =
    (options?.length || 0) >= 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : (options?.length || 0) === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : (options?.length || 0) === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1";

  return (
    <span
      className="relative inline-flex items-center align-middle"
      onMouseEnter={handleOpen}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!open) {
            handleOpen();
          } else {
            setOpen(false);
          }
        }}
        onFocus={handleOpen}
        onBlur={() => setOpen(false)}
        aria-label={`Ajuda sobre: ${title}`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[#1B365D] dark:text-[#D4AF37] bg-[#1B365D]/10 dark:bg-[#B59410]/20 hover:bg-[#1B365D] hover:text-white dark:hover:bg-[#D4AF37] dark:hover:text-slate-950 transition-colors cursor-help shrink-0"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.maxWidth,
              transform: coords.openUpward ? "translateY(-100%)" : "none",
              zIndex: 9999,
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => e.stopPropagation()}
            className="p-4 rounded-2xl bg-slate-900/98 dark:bg-slate-950/98 text-white shadow-2xl border border-[#B59410]/50 text-left font-normal normal-case tracking-normal leading-relaxed backdrop-blur-md"
          >
            <div className="font-heading text-xs sm:text-sm font-bold text-[#F3E5AB] mb-1.5 border-b border-slate-800 pb-1.5 flex items-center justify-between gap-2">
              <span>{title}</span>
            </div>

            {summary && (
              <p className="text-xs text-slate-200 mb-3 leading-relaxed">
                {summary}
              </p>
            )}

            {options && options.length > 0 && (
              <div className={`grid ${gridColsClass} gap-2.5 text-xs`}>
                {options.map((opt) => (
                  <div
                    key={opt.label}
                    className="bg-slate-800/90 rounded-xl p-3 border border-slate-700/80 flex flex-col justify-start"
                  >
                    <span className="font-bold text-[#D4AF37] block mb-1 leading-snug">
                      • {opt.label}
                    </span>
                    <span className="text-slate-200 text-[11px] block leading-relaxed">
                      {opt.description}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </span>
  );
}
