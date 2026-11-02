"use client";

import React from "react";
import {
  ShieldCheck,
  History,
  Sun,
  Moon,
  Building2,
  Scale,
  Award,
} from "lucide-react";

interface HeaderInstitucionalProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  historicoCount: number;
  onOpenHistory: () => void;
  onOpenMunicipiosModal: () => void;
}

export function HeaderInstitucional({
  darkMode,
  onToggleDarkMode,
  historicoCount,
  onOpenHistory,
  onOpenMunicipiosModal,
}: HeaderInstitucionalProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      {/* Top Institutional Ribbon */}
      <div className="bg-gradient-to-r from-[#112240] via-[#1B365D] to-[#112240] text-white px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium tracking-wide">
            <Scale className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>
              GOVERNANÇA EM CONTRATAÇÕES PÚBLICAS • LEI Nº 14.133/2021 • IN SEGES/ME Nº 65/2021
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-200">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#F3E5AB]">
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
              Desenvolvido por Sérgio Dantas Torres
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation & Action Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1B365D] to-[#0F2442] dark:from-[#2B4C7E] dark:to-[#1B365D] flex items-center justify-center shadow-md border border-[#B59410]/40 shrink-0">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Pesquisa de Preços no PNCP
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1B365D]/10 text-[#1B365D] dark:bg-[#B59410]/20 dark:text-[#F3E5AB] border border-[#1B365D]/20 dark:border-[#B59410]/30">
                Auditoria R1–R7 Ativa
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Consulta auditável de Atas de Registro de Preços com validação de esfera, fuso{" "}
              <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                America/Recife
              </code>{" "}
              e geração de Relatório Consolidado em Excel e PDF
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMunicipiosModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-all"
            title="Consultar lista dos 177 municípios brasileiros com orçamento >= R$ 1 bilhão"
          >
            <Building2 className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" />
            <span>177 Municípios (≥ R$ 1 Bi)</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#1B365D] hover:bg-[#152a4a] dark:bg-[#244472] dark:hover:bg-[#1B365D] shadow-sm transition-all"
          >
            <History className="w-4 h-4 text-[#D4AF37]" />
            <span>Histórico de Pesquisas</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-mono bg-[#B59410] text-white">
              {historicoCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Alternar tema claro ou escuro"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
