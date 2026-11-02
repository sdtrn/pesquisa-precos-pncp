"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  CheckSquare,
  Square,
  Sparkles,
  Search,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type {
  ItemCandidato,
  EstatisticasPrecos,
  CriterioClassificacao,
} from "@/lib/domain/types";
import {
  calcularEstatisticasPrecos,
  identificarOutliersIqr,
  chaveItemUnica,
  formatValorOuTaxa,
} from "@/lib/domain/statistics";
import { HelpTooltip } from "@/components/HelpTooltip";

interface Top20SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidatosTop20: ItemCandidato[];
  selectedKeys: Set<string>;
  onChangeSelectedKeys: (next: Set<string>) => void;
  incluirClasseB: boolean;
  onChangeIncluirClasseB: (val: boolean) => void;
  totalClasseBDisponiveis: number;
  criterioClassificacao?: CriterioClassificacao;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function Top20SelectionModal({
  isOpen,
  onClose,
  candidatosTop20,
  selectedKeys,
  onChangeSelectedKeys,
  incluirClasseB,
  onChangeIncluirClasseB,
  totalClasseBDisponiveis,
  criterioClassificacao = "menor_preco",
}: Top20SelectionModalProps) {
  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroUf, setFiltroUf] = useState("TODAS");
  const [filtroEsfera, setFiltroEsfera] = useState("TODAS");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");

  // Compute outlier flags across the Top 20 candidates
  const outlierKeys = useMemo(() => {
    return identificarOutliersIqr(candidatosTop20, criterioClassificacao);
  }, [candidatosTop20, criterioClassificacao]);

  const ufsDisponiveis = useMemo(() => {
    const set = new Set<string>();
    candidatosTop20.forEach((c) => {
      if (c.uf) set.add(c.uf);
    });
    return Array.from(set).sort();
  }, [candidatosTop20]);

  const candidatosFiltrados = useMemo(() => {
    const q = buscaTexto.trim().toLowerCase();
    const min = precoMin ? Number(precoMin) : null;
    const max = precoMax ? Number(precoMax) : null;

    return candidatosTop20.filter((item) => {
      if (filtroUf !== "TODAS" && item.uf !== filtroUf) return false;
      if (filtroEsfera !== "TODAS" && item.esfera !== filtroEsfera)
        return false;
      if (min !== null && !Number.isNaN(min) && item.valor_unitario < min)
        return false;
      if (max !== null && !Number.isNaN(max) && item.valor_unitario > max)
        return false;
      if (!q) return true;
      return (
        item.descricao_objeto.toLowerCase().includes(q) ||
        item.orgao_gerenciador_uf.toLowerCase().includes(q) ||
        item.fornecedor.toLowerCase().includes(q) ||
        item.numero_arp_licitacao.toLowerCase().includes(q)
      );
    });
  }, [candidatosTop20, buscaTexto, filtroUf, filtroEsfera, precoMin, precoMax]);

  const estatisticasSelecionados: EstatisticasPrecos = useMemo(() => {
    const precos = candidatosTop20
      .filter((c) => selectedKeys.has(chaveItemUnica(c)))
      .map((c) => c.valor_unitario);
    return calcularEstatisticasPrecos(precos);
  }, [candidatosTop20, selectedKeys]);

  if (!isOpen) return null;

  const handleToggleItem = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChangeSelectedKeys(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedKeys);
    candidatosFiltrados.forEach((c) => next.add(chaveItemUnica(c)));
    onChangeSelectedKeys(next);
  };

  const handleDeselectAll = () => {
    onChangeSelectedKeys(new Set());
  };

  const handleSanitizeOutliers = () => {
    const next = new Set<string>();
    candidatosTop20.forEach((c) => {
      const k = chaveItemUnica(c);
      if (!outlierKeys.has(k)) {
        next.add(k);
      }
    });
    onChangeSelectedKeys(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#112240] via-[#1B365D] to-[#112240] text-white flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base sm:text-lg font-bold">
                {criterioClassificacao === "maior_desconto"
                  ? "Seleção Auditável das 20 Maiores Taxas de Desconto (Regra R6)"
                  : "Seleção Auditável dos 20 Menores Preços Unitários (Regra R6)"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#B59410] text-white">
                Máx. 1 item por ARP
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-0.5">
              Selecione as Atas de Registro de Preços que comporão a cesta final da Pesquisa de Preços e o cálculo da Média e Mediana.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Fechar janela de seleção"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls & Filters Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
          {/* Top Row: Class B Toggle + Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirClasseB}
                  onChange={(e) => onChangeIncluirClasseB(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#1B365D] focus:ring-[#1B365D]"
                />
                <span>
                  Incluir itens de revisão manual (<strong>Aderência B</strong>) nos candidatos
                  {totalClasseBDisponiveis > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono text-[11px]">
                      +{totalClasseBDisponiveis} disponível(is)
                    </span>
                  )}
                </span>
              </label>
              <HelpTooltip
                title="Filtro: Incluir Itens de Aderência B"
                summary="Define se os itens classificados como 'B' entram na lista dos 20 menores preços:"
                options={[
                  {
                    label: "Desmarcado (Apenas Classe A — Padrão)",
                    description:
                      "Exibe apenas itens que comprovaram explicitamente 100% dos requisitos técnicos no texto do PNCP.",
                  },
                  {
                    label: "Marcado (Classes A + B)",
                    description:
                      "Inclui também itens compatíveis onde alguma especificação secundária não foi detalhada no resumo da API (exigindo conferência visual no PDF da ata).",
                  },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1B365D] text-white hover:bg-[#142949] transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Marcar todas ({candidatosFiltrados.length})</span>
              </button>

              <button
                type="button"
                onClick={handleDeselectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Desmarcar todas</span>
              </button>

              <button
                type="button"
                onClick={handleSanitizeOutliers}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-300 border border-amber-500/30 transition-colors"
                title="Desmarca automaticamente preços identificados como discrepantes (outliers) pelo critério de Intervalo Interquartil (IQR) ou desvio da mediana (IN SEGES 65/2021)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Sugerir Saneamento Estatístico (IQR)</span>
              </button>
            </div>
          </div>

          {/* Second Row: Live Filter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            <div className="sm:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                placeholder="Filtrar por descrição, órgão, fornecedor ou ARP..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={filtroUf}
              onChange={(e) => setFiltroUf(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
            >
              <option value="TODAS">
                Todas as UFs ({ufsDisponiveis.length})
              </option>
              {ufsDisponiveis.map((uf) => (
                <option key={uf} value={uf}>
                  UF: {uf}
                </option>
              ))}
            </select>

            <select
              value={filtroEsfera}
              onChange={(e) => setFiltroEsfera(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            >
              <option value="TODAS">Todas as Esferas</option>
              <option value="Federal">Federal</option>
              <option value="Estadual">Estadual</option>
              <option value="Distrital">Distrital</option>
              <option value="Municipal">Municipal</option>
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.01"
                value={precoMin}
                onChange={(e) => setPrecoMin(e.target.value)}
                placeholder={criterioClassificacao === "maior_desconto" ? "% Mín" : "R$ Mín"}
                className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
              />
              <input
                type="number"
                step="0.01"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
                placeholder={criterioClassificacao === "maior_desconto" ? "% Máx" : "R$ Máx"}
                className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {candidatosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum item encontrado com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-center">Sel.</th>
                    <th className="py-2.5 px-2 text-center">#</th>
                    <th className="py-2.5 px-2 text-center">Ader.</th>
                    <th className="py-2.5 px-3 text-right">
                      {criterioClassificacao === "maior_desconto" ? "Taxa de Desconto" : "Valor Unitário"}
                    </th>
                    <th className="py-2.5 px-2 text-center">Unid.</th>
                    <th className="py-2.5 px-2 text-right">Qtd. ARP</th>
                    <th className="py-2.5 px-3">Descrição do Objeto</th>
                    <th className="py-2.5 px-3">Órgão Gerenciador/UF</th>
                    <th className="py-2.5 px-3">Fornecedor</th>
                    <th className="py-2.5 px-2">ARP / Vigência</th>
                    <th className="py-2.5 px-2 text-center">PNCP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {candidatosFiltrados.map((item, idx) => {
                    const key = chaveItemUnica(item);
                    const isChecked = selectedKeys.has(key);
                    const isOutlier = outlierKeys.has(key);

                    return (
                      <tr
                        key={key}
                        onClick={() => handleToggleItem(key)}
                        className={`cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-[#1B365D]/[0.05] dark:bg-[#B59410]/[0.08] hover:bg-[#1B365D]/[0.09]"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-75"
                        }`}
                      >
                        <td
                          className="py-2.5 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleItem(key)}
                            className="w-4 h-4 rounded border-slate-300 text-[#1B365D] focus:ring-[#1B365D]"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                              item.aderencia === "A"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                            }`}
                            title={item.detalhe_aderencia}
                          >
                            {item.aderencia}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOutlier && (
                              <span
                                title={
                                  criterioClassificacao === "maior_desconto"
                                    ? "Taxa apontada como potencialmente discrepante (Outlier IQR)"
                                    : "Preço apontado como potencialmente discrepante (Outlier IQR / Mediana)"
                                }
                                className="text-amber-500"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span>
                              {formatValorOuTaxa(item.valor_unitario, criterioClassificacao)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.unidade_fornecimento}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                          {item.quantitativo_previsto_arp}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="font-medium text-slate-900 dark:text-white line-clamp-2">
                            {item.descricao_objeto}
                          </div>
                          {item.aderencia === "B" && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 line-clamp-1">
                              {item.detalhe_aderencia}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px]">
                          <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                            {item.orgao_gerenciador_uf}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {item.esfera} • {item.municipio_nome}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 max-w-[160px] truncate text-slate-600 dark:text-slate-300">
                          {item.fornecedor || "—"}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap font-mono text-[11px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.numero_arp_licitacao}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Vig: {item.data_fim_vigencia || "—"}
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.link_ata_pncp && (
                            <a
                              href={item.link_ata_pncp}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex p-1.5 rounded-lg text-[#1B365D] dark:text-[#D4AF37] hover:bg-slate-200 dark:hover:bg-slate-800"
                              title="Abrir ARP no Portal PNCP"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sticky Live Statistical Summary Footer */}
        <div className="px-5 py-4 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                Selecionados
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                {estatisticasSelecionados.quantidade} de{" "}
                {candidatosTop20.length}
              </span>
            </div>

            <div className="h-7 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                {criterioClassificacao === "maior_desconto" ? "Média dos Descontos" : "Média Unitária"}
              </span>
              <span className="font-mono font-bold text-sm text-[#1B365D] dark:text-[#D4AF37] tabular-nums">
                {formatValorOuTaxa(estatisticasSelecionados.media, criterioClassificacao)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                Mediana
              </span>
              <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatValorOuTaxa(estatisticasSelecionados.mediana, criterioClassificacao)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                Amplitude (Mín – Máx)
              </span>
              <span className="font-mono font-semibold text-xs text-slate-800 dark:text-slate-200 tabular-nums">
                {formatValorOuTaxa(estatisticasSelecionados.menor, criterioClassificacao)} –{" "}
                {formatValorOuTaxa(estatisticasSelecionados.maior, criterioClassificacao)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                Coef. Variação (CV%)
              </span>
              <span
                className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full inline-block ${
                  estatisticasSelecionados.coeficienteVariacao <= 25
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                }`}
              >
                {estatisticasSelecionados.coeficienteVariacao
                  .toFixed(1)
                  .replace(".", ",")}
                %{" "}
                {estatisticasSelecionados.coeficienteVariacao <= 25
                  ? "(Homogênea)"
                  : "(Dispersão Alta)"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={estatisticasSelecionados.quantidade === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#1B365D] to-[#142949] hover:from-[#142949] hover:to-[#0f203a] dark:from-[#B59410] dark:to-[#9A7D0A] dark:text-slate-950 shadow-md disabled:opacity-50 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Confirmar Seleção ({estatisticasSelecionados.quantidade}) e Gerar Relatório
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
