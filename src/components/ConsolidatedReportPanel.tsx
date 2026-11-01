"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  ListChecks,
  BookmarkPlus,
  ExternalLink,
  Download,
  FileArchive,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type {
  ItemCandidato,
  ResultadoPesquisa,
  EstatisticasPrecos,
} from "@/lib/domain/types";
import {
  gerarPlanilhaXlsx,
  descreverArquivosEvidenciaItem,
} from "@/lib/export/exporter-xlsx";
import { gerarCsvConsolidado } from "@/lib/export/exporter-csv";
import { gerarRelatorioPdfA4 } from "@/lib/export/exporter-pdf";
import { chaveItemUnica } from "@/lib/domain/statistics";

interface ConsolidatedReportPanelProps {
  descricaoObjeto: string;
  resultado: ResultadoPesquisa;
  candidatosTop20: ItemCandidato[];
  itensSelecionados: ItemCandidato[];
  indicesSelecionados: number[];
  estatisticas: EstatisticasPrecos;
  onOpenTop20Modal: () => void;
  onSaveToHistoryManual: () => void;
  savedNotice: string | null;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ConsolidatedReportPanel({
  descricaoObjeto,
  resultado,
  candidatosTop20,
  itensSelecionados,
  indicesSelecionados,
  estatisticas,
  onOpenTop20Modal,
  onSaveToHistoryManual,
  savedNotice,
}: ConsolidatedReportPanelProps) {
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadXlsx = async () => {
    try {
      setIsExportingXlsx(true);
      const buffer = await gerarPlanilhaXlsx(
        itensSelecionados,
        candidatosTop20,
        indicesSelecionados,
        resultado.descartados
      );
      const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      triggerBrowserDownload(blob, `pesquisa_precos_pncp_${stamp}.xlsx`);
    } finally {
      setIsExportingXlsx(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const bytes = await gerarRelatorioPdfA4(
        resultado,
        itensSelecionados,
        descricaoObjeto
      );
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      triggerBrowserDownload(blob, `parecer_tecnico_pncp_${stamp}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = gerarCsvConsolidado(itensSelecionados);
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerBrowserDownload(blob, `pesquisa_precos_pncp_${stamp}.csv`);
  };

  return (
    <section
      aria-label="Relatório Consolidado e Evidências Documentais"
      className="space-y-6 mb-10"
    >
      {/* Main Consolidated Card */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-md border border-[#1B365D]/20 dark:border-[#B59410]/30">
        {/* Top Action & Export Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-white">
                Planilha Consolidada para Parecer Técnico
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#1B365D] text-white dark:bg-[#B59410] dark:text-slate-950">
                {itensSelecionados.length} ARP(s) selecionada(s)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pesquisa realizada em{" "}
              <strong className="font-mono text-slate-700 dark:text-slate-200">
                {resultado.momento_consulta}
              </strong>{" "}
              (Horário de Recife)
            </p>
          </div>

          {/* Export & Selection Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenTop20Modal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#1B365D] dark:text-[#F3E5AB] bg-[#1B365D]/10 hover:bg-[#1B365D]/20 dark:bg-slate-800 border border-[#1B365D]/25 dark:border-[#B59410]/40 transition-all"
            >
              <ListChecks className="w-4 h-4" />
              <span>Selecionar entre os 20 menores preços</span>
            </button>

            <button
              type="button"
              onClick={onSaveToHistoryManual}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
              title="Salvar ou atualizar esta seleção no Histórico de Pesquisas"
            >
              <BookmarkPlus className="w-4 h-4 text-[#B59410]" />
              <span>Salvar no Histórico</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadXlsx}
              disabled={itensSelecionados.length === 0 || isExportingXlsx}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm disabled:opacity-50 transition-all"
            >
              {isExportingXlsx ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Baixar Excel (.xlsx A4)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={itensSelecionados.length === 0 || isExportingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1B365D] hover:bg-[#142949] shadow-sm disabled:opacity-50 transition-all"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-[#D4AF37]" />
              )}
              <span>Relatório em PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={itensSelecionados.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 disabled:opacity-50 transition-all"
            >
              <FileDown className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {savedNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Executive Statistical Highlight Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 my-5">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#1B365D] to-[#122644] text-white shadow-sm">
            <span className="text-[10px] uppercase tracking-wider text-slate-300 block">
              Média Unitária Final
            </span>
            <span className="font-mono text-lg font-bold text-[#F3E5AB] tabular-nums">
              {formatBRL(estatisticas.media)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Mediana
            </span>
            <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatBRL(estatisticas.mediana)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Menor Preço
            </span>
            <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {formatBRL(estatisticas.menor)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Maior Preço
            </span>
            <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {formatBRL(estatisticas.maior)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Desvio Padrão
            </span>
            <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {formatBRL(estatisticas.desvioPadrao)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Coef. Variação (CV%)
            </span>
            <span className="font-mono text-base font-bold text-[#1B365D] dark:text-[#D4AF37] tabular-nums">
              {estatisticas.coeficienteVariacao.toFixed(2).replace(".", ",")}%
            </span>
          </div>
        </div>

        {/* Consolidated Parecer Table */}
        {itensSelecionados.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
            Nenhum item selecionado para o parecer. Clique em{" "}
            <button
              type="button"
              onClick={onOpenTop20Modal}
              className="font-bold text-[#1B365D] dark:text-[#D4AF37] underline"
            >
              Selecionar entre os 20 menores preços
            </button>{" "}
            para compor sua cesta de preços.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B365D] text-white uppercase text-[11px]">
                  <th className="py-3 px-3">Descrição do objeto</th>
                  <th className="py-3 px-3 text-right">Valor Unitário (R$)</th>
                  <th className="py-3 px-3">Nº da ARP / Licitação</th>
                  <th className="py-3 px-2 text-center">Data de Assinatura</th>
                  <th className="py-3 px-3">Órgão Gerenciador/UF</th>
                  <th className="py-3 px-3">Fornecedor</th>
                  <th className="py-3 px-2 text-center">Link PNCP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {itensSelecionados.map((item) => (
                  <tr
                    key={chaveItemUnica(item)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white max-w-xs">
                      {item.descricao_objeto}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                      {formatBRL(item.valor_unitario)}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {item.numero_arp_licitacao}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] whitespace-nowrap">
                      {item.data_assinatura || "—"}
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.orgao_gerenciador_uf}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.esfera} • Vig: {item.data_fim_vigencia}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-700 dark:text-slate-300">
                      {item.fornecedor}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {(() => {
                        const ev = descreverArquivosEvidenciaItem(item);
                        return (
                          <div className="flex flex-col items-center gap-1">
                            {ev.linkPncp && (
                              <a
                                href={ev.linkPncp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1B365D]/10 text-[#1B365D] dark:bg-[#B59410]/20 dark:text-[#F3E5AB] font-semibold hover:underline whitespace-nowrap"
                              >
                                <span>ARP Inicial</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {ev.termosAditivos.map((adit, idxAdit) => (
                              <a
                                key={`${adit.url}-${idxAdit}`}
                                href={adit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={adit.rotulo}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold hover:underline whitespace-nowrap"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span className="max-w-[125px] truncate">
                                  {adit.rotulo}
                                </span>
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}

                {/* Final Highlighted Average Row */}
                <tr className="bg-[#D9E1F2] dark:bg-[#1B365D]/60 font-bold text-slate-900 dark:text-white border-t-2 border-[#1B365D] dark:border-[#B59410]">
                  <td className="py-3 px-3 font-heading uppercase tracking-wide">
                    MÉDIA DOS VALORES UNITÁRIOS
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm tabular-nums text-[#1B365D] dark:text-[#F3E5AB]">
                    {formatBRL(estatisticas.media)}
                  </td>
                  <td
                    colSpan={5}
                    className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 font-normal"
                  >
                    Fórmula na planilha Excel exportada:{" "}
                    <code className="font-mono font-semibold">
                      =AVERAGE(B2:B{itensSelecionados.length + 1})
                    </code>{" "}
                    • Mediana: <strong>{formatBRL(estatisticas.mediana)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documentary Evidence Cards: Direct PNCP Page Links, Initial ARP PDF & Termos Aditivos */}
      {itensSelecionados.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-[#B59410]" />
              Evidências Documentais: Links Diretos das ARPs Iniciais e Termos Aditivos (
              {itensSelecionados.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acesse diretamente a página oficial de cada Ata no PNCP, baixe o PDF da ARP Inicial e, quando houver, acesse os links diretos de todos os Termos Aditivos / Prorrogações vinculados à ARP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {itensSelecionados.map((ata) => {
              const ev = descreverArquivosEvidenciaItem(ata);

              return (
                <div
                  key={chaveItemUnica(ata)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#1B365D]/10 text-[#1B365D] dark:bg-[#B59410]/20 dark:text-[#F3E5AB]">
                        {ata.numero_arp_licitacao}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatBRL(ata.valor_unitario)}
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-2 mb-1">
                      {ata.orgao_gerenciador_uf}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Item {ata.numero_item_lote}: {ata.descricao_objeto}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {ev.linkPncp && (
                        <a
                          href={ev.linkPncp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#1B365D] text-white hover:bg-[#142949] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Página PNCP</span>
                        </a>
                      )}

                      {ev.arpInicial.url && (
                        <a
                          href={ev.arpInicial.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={ev.arpInicial.titulo}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-[#B59410]" />
                          <span>PDF ARP Inicial</span>
                        </a>
                      )}
                    </div>

                    {ev.termosAditivos.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-amber-300/70 dark:border-amber-700/50 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center justify-between">
                          <span>Termos Aditivos / Prorrogações</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 font-mono">
                            {ev.termosAditivos.length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {ev.termosAditivos.map((adit, idxAdit) => (
                            <a
                              key={`${adit.url}-${idxAdit}`}
                              href={adit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/60 transition-colors"
                            >
                              <span className="inline-flex items-center gap-1.5 truncate">
                                <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="truncate">{adit.rotulo}</span>
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
