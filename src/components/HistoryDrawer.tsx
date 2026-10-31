"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  X,
  History,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  CalendarClock,
  Search,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import type { RegistroHistoricoPesquisa } from "@/lib/domain/types";
import { selecionarTop20Menores } from "@/lib/domain/pipeline";
import { gerarPlanilhaXlsx } from "@/lib/export/exporter-xlsx";
import { gerarRelatorioPdfA4 } from "@/lib/export/exporter-pdf";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  historico: RegistroHistoricoPesquisa[];
  onRestoreEntry: (entry: RegistroHistoricoPesquisa) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onExportJson: () => void;
  onImportJson: (jsonText: string) => void;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function HistoryDrawer({
  isOpen,
  onClose,
  historico,
  onRestoreEntry,
  onDeleteEntry,
  onClearAll,
  onExportJson,
  onImportJson,
}: HistoryDrawerProps) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const historicoFiltrado = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    if (!q) return historico;
    return historico.filter(
      (h) =>
        h.descricaoObjeto.toLowerCase().includes(q) ||
        h.dataHoraPesquisa.toLowerCase().includes(q) ||
        h.escopoOrgaos.toLowerCase().includes(q)
    );
  }, [historico, filtroTexto]);

  if (!isOpen) return null;

  const handleExportEntryXlsx = async (entry: RegistroHistoricoPesquisa) => {
    const top20 = selecionarTop20Menores(
      entry.resultado.itens_candidatos,
      entry.incluirRevisaoB
    );
    const idxSet = new Set(entry.indicesSelecionados);
    const selecionados = top20.filter((_, i) => idxSet.has(i));
    const buf = await gerarPlanilhaXlsx(
      selecionados,
      top20,
      entry.indicesSelecionados,
      entry.resultado.descartados
    );
    const blob = new Blob([new Uint8Array(buf)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `historico_pncp_${entry.id.slice(0, 10)}.xlsx`);
  };

  const handleExportEntryPdf = async (entry: RegistroHistoricoPesquisa) => {
    const top20 = selecionarTop20Menores(
      entry.resultado.itens_candidatos,
      entry.incluirRevisaoB
    );
    const idxSet = new Set(entry.indicesSelecionados);
    const selecionados = top20.filter((_, i) => idxSet.has(i));
    const bytes = await gerarRelatorioPdfA4(
      entry.resultado,
      selecionados,
      entry.descricaoObjeto
    );
    const blob = new Blob([new Uint8Array(bytes)], {
      type: "application/pdf",
    });
    downloadBlob(blob, `historico_parecer_${entry.id.slice(0, 10)}.pdf`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImportJson(text);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#112240] to-[#1B365D] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h2 className="font-heading text-base font-bold">
                Histórico de Pesquisas Salvas
              </h2>
              <p className="text-xs text-slate-300">
                Armazenado localmente no navegador com a data/hora exata de cada consulta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Backup Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Filtrar por objeto, data da pesquisa ou escopo..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExportJson}
                disabled={historico.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
                <span>Exportar Backup JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Importar JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {historico.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Tudo</span>
              </button>
            )}
          </div>
        </div>

        {/* Saved Searches List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {historicoFiltrado.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma pesquisa salva encontrada no histórico.
            </div>
          ) : (
            historicoFiltrado.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-[#1B365D]/40 dark:hover:border-[#B59410]/40 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1B365D]/10 dark:bg-[#B59410]/20 text-[#1B365D] dark:text-[#F3E5AB] text-[11px] font-mono font-semibold mb-1.5">
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Data da Pesquisa: {entry.dataHoraPesquisa}</span>
                    </div>
                    <h3 className="font-heading text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {entry.descricaoObjeto}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteEntry(entry.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Excluir pesquisa do histórico"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata Badges */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Escopo: <strong>{entry.escopoOrgaos}</strong>
                    {entry.ufSelecionada ? ` (${entry.ufSelecionada})` : ""}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Status: <strong>{entry.statusAta}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                    {entry.periodoAplicado}
                  </span>
                </div>

                {/* Metrics Summary */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Selecionados
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {entry.itensSelecionadosCount} ARP(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Média Unitária
                    </span>
                    <span className="font-mono font-bold text-[#1B365D] dark:text-[#D4AF37]">
                      {formatBRL(entry.mediaSelecionados)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreEntry(entry);
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-[#1B365D] hover:bg-[#142949] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Restaurar Pesquisa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportEntryXlsx(entry)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 hover:opacity-90"
                    title="Baixar planilha Excel (.xlsx) desta pesquisa salva"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportEntryPdf(entry)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:opacity-90"
                    title="Baixar relatório PDF (.pdf) desta pesquisa salva"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
