"use client";

import React from "react";
import {
  Search,
  Sparkles,
  Calendar,
  Filter,
  BookmarkCheck,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import {
  STATUS_VIGENTES,
  STATUS_NAO_VIGENTES,
  STATUS_TODOS,
  DATA_ASSINATURA,
  DATA_PUBLICACAO,
  DATA_VIGENCIA,
  PRESETS_EXEMPLOS,
} from "@/data/constants";

const OPCOES_STATUS = [STATUS_VIGENTES, STATUS_NAO_VIGENTES, STATUS_TODOS];
const OPCOES_DATA = [DATA_ASSINATURA, DATA_PUBLICACAO, DATA_VIGENCIA];

interface SearchParametersFormProps {
  descricaoObjeto: string;
  onChangeDescricao: (val: string) => void;
  statusArp: string;
  onChangeStatusArp: (val: string) => void;
  tipoData: string;
  onChangeTipoData: (val: string) => void;
  dataInicial: string;
  onChangeDataInicial: (val: string) => void;
  dataFinal: string;
  onChangeDataFinal: (val: string) => void;
  salvarNoHistorico: boolean;
  onChangeSalvarNoHistorico: (val: boolean) => void;
  onAnalyzeRequirements: () => void;
  onExecuteSearch: () => void;
  isSearching: boolean;
}

export function SearchParametersForm({
  descricaoObjeto,
  onChangeDescricao,
  statusArp,
  onChangeStatusArp,
  tipoData,
  onChangeTipoData,
  dataInicial,
  onChangeDataInicial,
  dataFinal,
  onChangeDataFinal,
  salvarNoHistorico,
  onChangeSalvarNoHistorico,
  onAnalyzeRequirements,
  onExecuteSearch,
  isSearching,
}: SearchParametersFormProps) {
  const isDateInvalid = Boolean(
    dataInicial && dataFinal && dataInicial > dataFinal
  );

  return (
    <section
      aria-label="Parâmetros da Pesquisa"
      className="glass-panel rounded-2xl p-5 sm:p-6 shadow-sm mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1B365D] dark:bg-[#D4AF37]" />
          2. Especificação do Objeto e Filtros Temporais
        </h2>

        {/* Quick Preset Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#B59410]" />
            Exemplos rápidos:
          </span>
          {PRESETS_EXEMPLOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChangeDescricao(preset.descricao)}
              disabled={isSearching}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-[#1B365D] hover:text-white dark:bg-slate-800 dark:hover:bg-[#B59410] dark:hover:text-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {preset.titulo}
            </button>
          ))}
        </div>
      </div>

      {/* Object Specification Textarea */}
      <div className="mb-5">
        <label
          htmlFor="objeto-textarea"
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
        >
          Objeto da compra (com especificações técnicas mínimas e unidade desejada)
        </label>
        <textarea
          id="objeto-textarea"
          rows={3}
          value={descricaoObjeto}
          onChange={(e) => onChangeDescricao(e.target.value)}
          disabled={isSearching}
          placeholder="Ex.: Aparelho de ar condicionado tipo split inverter, capacidade de 12000 BTUs, ciclo frio, cor branca."
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] transition-shadow"
        />
      </div>

      {/* Filters Grid: Status, Date Mode, Start Date, End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div>
          <label
            htmlFor="status-arp-select"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
            Status da ARP
          </label>
          <select
            id="status-arp-select"
            value={statusArp}
            onChange={(e) => onChangeStatusArp(e.target.value)}
            disabled={isSearching}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
          >
            {OPCOES_STATUS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="tipo-data-select"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
            Filtrar período por
          </label>
          <select
            id="tipo-data-select"
            value={tipoData}
            onChange={(e) => onChangeTipoData(e.target.value)}
            disabled={isSearching}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
          >
            {OPCOES_DATA.map((td) => (
              <option key={td} value={td}>
                {td}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="data-inicial-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Data inicial (inclusiva)
          </label>
          <input
            id="data-inicial-input"
            type="date"
            value={dataInicial}
            onChange={(e) => onChangeDataInicial(e.target.value)}
            disabled={isSearching}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
          />
        </div>

        <div>
          <label
            htmlFor="data-final-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Data final (inclusiva)
          </label>
          <input
            id="data-final-input"
            type="date"
            value={dataFinal}
            onChange={(e) => onChangeDataFinal(e.target.value)}
            disabled={isSearching}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
          />
        </div>
      </div>

      {isDateInvalid && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            A <strong>Data inicial</strong> não pode ser posterior à{" "}
            <strong>Data final</strong>. Corrija o intervalo para prosseguir.
          </span>
        </div>
      )}

      {/* Bottom Bar: History Toggle + Action Buttons */}
      <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <label className="inline-flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={salvarNoHistorico}
              onChange={(e) => onChangeSalvarNoHistorico(e.target.checked)}
              disabled={isSearching}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-[#1B365D] dark:peer-checked:bg-[#B59410] transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <BookmarkCheck className="w-3.5 h-3.5 text-[#B59410]" />
              Salvar automaticamente no Histórico de Pesquisas (com data/hora da consulta)
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Armazena localmente a pesquisa com carimbo{" "}
              <code className="font-mono">DD/MM/AAAA HH:MM:SS</code> para restauração instantânea
            </p>
          </div>
        </label>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onAnalyzeRequirements}
            disabled={isSearching || !descricaoObjeto.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#1B365D] dark:text-[#F3E5AB] bg-[#1B365D]/10 hover:bg-[#1B365D]/15 dark:bg-slate-800 dark:hover:bg-slate-700 border border-[#1B365D]/20 dark:border-[#B59410]/30 disabled:opacity-50 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Revisar Termos & Requisitos</span>
          </button>

          <button
            type="button"
            onClick={onExecuteSearch}
            disabled={isSearching || !descricaoObjeto.trim() || isDateInvalid}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#1B365D] to-[#142949] hover:from-[#142949] hover:to-[#0f203a] dark:from-[#B59410] dark:to-[#9A7D0A] dark:text-slate-950 shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
          >
            <Search className="w-4 h-4" />
            <span>
              {isSearching ? "Consultando PNCP..." : "Pesquisar Atas no PNCP"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
