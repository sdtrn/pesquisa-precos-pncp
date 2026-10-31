"use client";

import React from "react";
import { Loader2, StopCircle, CheckCircle2 } from "lucide-react";

export interface ProgressoStream {
  msg: string;
  frac: number;
  parcial?: {
    totalAtasEncontradas?: number;
    atasValidasEscopoPeriodo?: number;
    totalItensAvaliados?: number;
  };
}

interface LiveProgressBannerProps {
  progresso: ProgressoStream | null;
  isSearching: boolean;
  onCancel: () => void;
}

export function LiveProgressBanner({
  progresso,
  isSearching,
  onCancel,
}: LiveProgressBannerProps) {
  if (!isSearching && !progresso) return null;

  const pct = progresso
    ? Math.min(100, Math.max(3, Math.round((progresso.frac || 0) * 100)))
    : 10;

  return (
    <div className="mb-6 rounded-2xl border border-[#1B365D]/30 dark:border-[#B59410]/40 bg-gradient-to-r from-[#1B365D]/[0.07] via-white to-[#B59410]/[0.07] dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-800 p-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-[#1B365D] dark:text-[#D4AF37] animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <div>
            <h4 className="font-heading text-sm font-bold text-slate-900 dark:text-white">
              {isSearching
                ? `Varredura Auditável PNCP em Andamento (${pct}%)`
                : "Varredura Concluída com Sucesso"}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {progresso?.msg ??
                "Conectando aos serviços de consulta e resultados do Portal Nacional de Contratações Públicas..."}
            </p>
          </div>
        </div>

        {isSearching && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300 transition-colors self-start sm:self-auto"
          >
            <StopCircle className="w-4 h-4" />
            <span>Interromper</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-[#1B365D] via-[#2B548E] to-[#B59410] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Real-time Counters */}
      {progresso?.parcial && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              Atas Encontradas (Bruto):
            </span>
            <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
              {progresso.parcial.totalAtasEncontradas ?? 0}
            </span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              Atas no Escopo/Período:
            </span>
            <span className="font-mono font-bold tabular-nums text-[#1B365D] dark:text-[#D4AF37]">
              {progresso.parcial.atasValidasEscopoPeriodo ?? 0}
            </span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              Itens Avaliados:
            </span>
            <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {progresso.parcial.totalItensAvaliados ?? 0}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
