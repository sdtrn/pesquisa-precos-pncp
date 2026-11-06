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
  Calculator,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  FileText,
  Tag,
  DollarSign,
  ShieldCheck,
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
import { formatarDocumentoIdentificacao } from "@/lib/domain/formatters";
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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpandItem = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Compute outlier flags across the Top 20 candidates
  const outlierKeys = useMemo(() => {
    return identificarOutliersIqr(candidatosTop20, criterioClassificacao);
  }, [candidatosTop20, criterioClassificacao]);

  const unidadeReferenciaAtiva = useMemo(() => {
    const itemNormalizado = candidatosTop20.find((c) => c.unidade_referencia);
    return itemNormalizado?.unidade_referencia || "R$";
  }, [candidatosTop20]);

  const rotuloColunaValor = useMemo(() => {
    if (criterioClassificacao === "maior_desconto") {
      return "Taxa de Desconto";
    }
    if (unidadeReferenciaAtiva && unidadeReferenciaAtiva !== "R$") {
      return `Valor Unitário (${unidadeReferenciaAtiva})`;
    }
    return "Valor Unitário (R$)";
  }, [criterioClassificacao, unidadeReferenciaAtiva]);

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
      const numLimpo = q.replace(/^item\s*/i, "").trim();
      return (
        item.descricao_objeto.toLowerCase().includes(q) ||
        item.orgao_gerenciador_uf.toLowerCase().includes(q) ||
        item.fornecedor.toLowerCase().includes(q) ||
        item.numero_arp_licitacao.toLowerCase().includes(q) ||
        item.numero_item_lote.toLowerCase().includes(q) ||
        `item ${item.numero_item_lote}`.toLowerCase().includes(q) ||
        (numLimpo.length > 0 && item.numero_item_lote.toLowerCase().includes(numLimpo))
      );
    });
  }, [candidatosTop20, buscaTexto, filtroUf, filtroEsfera, precoMin, precoMax]);

  const estatisticasSelecionados: EstatisticasPrecos = useMemo(() => {
    const precos = candidatosTop20
      .filter((c) => selectedKeys.has(chaveItemUnica(c)))
      .map((c) => c.valor_unitario);
    return calcularEstatisticasPrecos(precos, criterioClassificacao);
  }, [candidatosTop20, selectedKeys, criterioClassificacao]);

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
                Classificação por Item Homologado
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
                    <th className="py-2.5 px-2 text-center w-8" title="Expandir/Recolher Detalhes"></th>
                    <th className="py-2.5 px-3 text-center">Sel.</th>
                    <th className="py-2.5 px-2 text-center">#</th>
                    <th className="py-2.5 px-2 text-center">Ader.</th>
                    <th className="py-2.5 px-3 text-right">
                      {rotuloColunaValor}
                    </th>
                    <th className="py-2.5 px-2 text-center">Unid.</th>
                    <th className="py-2.5 px-2 text-right">Qtd. ARP</th>
                    <th className="py-2.5 px-2 text-center">Item/Lote</th>
                    <th className="py-2.5 px-2 text-center">Adesão</th>
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
                    const isExpanded = expandedKeys.has(key);

                    return (
                      <React.Fragment key={key}>
                        <tr
                          onClick={() => handleToggleItem(key)}
                          className={`cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-[#1B365D]/[0.05] dark:bg-[#B59410]/[0.08] hover:bg-[#1B365D]/[0.09]"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-75"
                          }`}
                        >
                          <td
                            className="py-2.5 px-2 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => toggleExpandItem(key)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                              title={
                                isExpanded
                                  ? "Recolher detalhes deste item"
                                  : "Expandir todos os detalhes deste item"
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
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
                              {item.normalizado && (
                                <span
                                  title={
                                    item.formula_normalizacao
                                      ? `Cálculo normalizado (Lei 14.133/2021):\n${item.formula_normalizacao}\nOriginal: ${item.valor_original !== undefined ? formatBRL(item.valor_original) : "não informado"}`
                                      : `Preço normalizado. Original: ${item.valor_original !== undefined ? formatBRL(item.valor_original) : "não informado"}`
                                  }
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-help"
                                >
                                  <Calculator className="w-3 h-3 shrink-0" />
                                  <span className="hidden sm:inline">Norm.</span>
                                </span>
                              )}
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
                            {item.normalizado && item.unidade_referencia ? (
                              <span
                                title={`Unidade de referência: ${item.unidade_referencia}${item.unidade_original ? ` (Original na ARP: ${item.unidade_original})` : ""}`}
                                className="text-blue-700 dark:text-blue-300 font-semibold cursor-help"
                              >
                                {item.unidade_referencia.replace("R$/", "")}
                              </span>
                            ) : (
                              item.unidade_fornecimento || "—"
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                            {item.quantitativo_previsto_arp === "não informado" ? (
                              <span className="italic text-slate-400 dark:text-slate-500 text-[10px]">
                                não informado
                              </span>
                            ) : (
                              item.quantitativo_previsto_arp
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span
                              className="inline-block px-1.5 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-[#1B365D] dark:text-[#D4AF37] border border-slate-200 dark:border-slate-700"
                              title={`Item/Lote da ARP: ${item.numero_item_lote}`}
                            >
                              {item.numero_item_lote.toLowerCase().includes("item")
                                ? item.numero_item_lote
                                : `Item ${item.numero_item_lote}`}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                item.possibilidade_adesao === "Sim"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                  : item.possibilidade_adesao === "Não"
                                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                              }`}
                              title={`Possibilidade de Adesão (carona PNCP): ${item.possibilidade_adesao || "Não informado"}`}
                            >
                              {item.possibilidade_adesao || "Não inf."}
                            </span>
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
                          <td className="py-2.5 px-3 max-w-[160px] truncate text-slate-600 dark:text-slate-300" title={item.fornecedor || "não informado"}>
                            {item.fornecedor || "—"}
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap font-mono text-[11px]">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.numero_arp_licitacao}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Item {item.numero_item_lote} • Vig: {item.data_fim_vigencia || "—"}
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

                        {/* Sublinha Expandida com Cartão Completo de Detalhes */}
                        {isExpanded && (
                          <tr className="bg-slate-50/95 dark:bg-slate-900/95 border-b-2 border-slate-300 dark:border-slate-700">
                            <td colSpan={14} className="p-4 sm:p-5">
                              <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 space-y-4">
                                {/* Header do Cartão */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-[#1B365D]/10 dark:bg-[#B59410]/20 text-[#1B365D] dark:text-[#D4AF37]">
                                      <FileText className="w-4 h-4" />
                                    </span>
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                        Detalhamento Completo do Item #{idx + 1}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        ARP: {item.numero_arp_licitacao} • {item.numero_item_lote.toLowerCase().includes("item") ? item.numero_item_lote : `Item ${item.numero_item_lote}`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        item.possibilidade_adesao === "Sim"
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                          : item.possibilidade_adesao === "Não"
                                          ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
                                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                      }`}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      <span>Possibilidade de Adesão (Carona): <strong>{item.possibilidade_adesao || "Não informado"}</strong></span>
                                    </span>

                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        item.aderencia === "A"
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                                      }`}
                                    >
                                      <span>Classe {item.aderencia}</span>
                                    </span>
                                  </div>
                                </div>

                                {/* Grid de Informações Estruturadas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                  {/* Bloco 1: Descrição e Especificação */}
                                  <div className="space-y-1.5 md:col-span-2 lg:col-span-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wide">
                                      Descrição Completa do Objeto
                                    </span>
                                    <p className="text-slate-900 dark:text-slate-100 leading-relaxed font-sans">
                                      {item.descricao_objeto}
                                    </p>
                                    {item.especificacao_complementar && (
                                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 block text-[10px] uppercase">
                                          Especificação Complementar (PNCP)
                                        </span>
                                        <p className="text-slate-700 dark:text-slate-300 text-[11px] italic mt-0.5">
                                          {item.especificacao_complementar}
                                        </p>
                                      </div>
                                    )}
                                    {item.detalhe_aderencia && (
                                      <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        <strong>Justificativa Técnica:</strong> {item.detalhe_aderencia}
                                      </div>
                                    )}
                                  </div>

                                  {/* Bloco 2: Órgão Gerenciador */}
                                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                                      <Building2 className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
                                      <span>Órgão Gerenciador</span>
                                    </div>
                                    <p className="font-bold text-slate-900 dark:text-white">
                                      {item.orgao_nome || item.orgao_gerenciador_uf}
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                      CNPJ: {formatarDocumentoIdentificacao(item.cnpj_orgao).numeroFormatado || item.cnpj_orgao}
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400">
                                      Esfera: <strong>{item.esfera}</strong> • UF: <strong>{item.uf}</strong>
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400">
                                      Município: {item.municipio_nome} (IBGE: {item.codigo_ibge})
                                    </p>
                                    {item.tipo_orgao && (
                                      <p className="text-slate-500 text-[10px]">
                                        Tipo: {item.tipo_orgao}
                                      </p>
                                    )}
                                  </div>

                                  {/* Bloco 3: Fornecedor e Contratação */}
                                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                                      <Tag className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
                                      <span>Fornecedor Homologado</span>
                                    </div>
                                    <p className="font-bold text-slate-900 dark:text-white">
                                      {item.fornecedor}
                                    </p>
                                    {item.fornecedor_cnpj && (
                                      <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                        Doc: {formatarDocumentoIdentificacao(item.fornecedor_cnpj).numeroFormatado}
                                      </p>
                                    )}
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-1">
                                      <p className="text-slate-600 dark:text-slate-400">
                                        Número Item/Lote: <strong>{item.numero_item_lote}</strong>
                                      </p>
                                      <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                        Controle PNCP: {item.id_ata_r6 || "—"}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Bloco 4: Vigência e Datas */}
                                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                                      <Calendar className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
                                      <span>Vigência e Situação</span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      Situação: <strong className="text-emerald-700 dark:text-emerald-400">{item.situacao_ata}</strong>
                                    </p>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      Data de Assinatura: <strong>{item.data_assinatura || "Não informada"}</strong>
                                    </p>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      Início da Vigência: <strong>{item.data_inicio_vigencia || "—"}</strong>
                                    </p>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      Fim da Vigência: <strong>{item.data_fim_vigencia || "—"}</strong>
                                    </p>
                                    <p className="text-slate-500 font-mono text-[10px]">
                                      Período: {item.vigencia_ata || "—"}
                                    </p>
                                  </div>

                                  {/* Bloco 5: Quantitativos e Unidades */}
                                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                                      <DollarSign className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
                                      <span>Quantitativos e Precificação</span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      Qtd Prevista na ARP: <strong>{item.quantitativo_previsto_arp}</strong>
                                    </p>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      Unidade Fornecimento: <strong>{item.unidade_fornecimento}</strong>
                                    </p>
                                    {item.unidade_referencia && (
                                      <p className="text-blue-700 dark:text-blue-300 font-semibold">
                                        Unidade Referência: {item.unidade_referencia}
                                      </p>
                                    )}
                                    {item.valor_original !== undefined && (
                                      <p className="text-slate-600 dark:text-slate-400">
                                        Valor Original Homologado: <strong>{formatBRL(item.valor_original)}</strong>
                                        {item.unidade_original ? ` / ${item.unidade_original}` : ""}
                                      </p>
                                    )}
                                    <p className="text-slate-900 dark:text-white font-bold text-sm pt-1">
                                      {rotuloColunaValor}: {formatValorOuTaxa(item.valor_unitario, criterioClassificacao)}
                                    </p>
                                  </div>

                                  {/* Bloco 6: Memória de Cálculo (Lei 14.133/2021) */}
                                  <div className="space-y-1.5 md:col-span-2 lg:col-span-2 bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200/80 dark:border-blue-900/60">
                                    <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300 text-[11px] uppercase tracking-wide">
                                      <Calculator className="w-3.5 h-3.5" />
                                      <span>Memória de Cálculo e Normalização (Lei nº 14.133/2021)</span>
                                    </div>
                                    {item.normalizado && item.formula_normalizacao ? (
                                      <div className="space-y-1">
                                        <p className="font-mono text-xs text-blue-950 dark:text-blue-200 bg-white dark:bg-slate-900 p-2 rounded border border-blue-200 dark:border-blue-800">
                                          {item.formula_normalizacao}
                                        </p>
                                        <p className="text-[11px] text-blue-800 dark:text-blue-300">
                                          Preço padronizado para comparação isonômica com base no quantitativo e período da contratação pública.
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-slate-600 dark:text-slate-400 italic">
                                        Item não exigiu normalização matemática de preços; valor homologado na ARP já corresponde à unidade padrão.
                                      </p>
                                    )}
                                  </div>

                                  {/* Bloco 7: Links e Evidências */}
                                  <div className="space-y-2 md:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {item.link_ata_pncp && (
                                        <a
                                          href={item.link_ata_pncp}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B365D] text-white hover:bg-[#142949] font-semibold text-xs transition-colors"
                                        >
                                          <span>Acessar ARP no Portal PNCP</span>
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}

                                      {item.link_download_arp && item.link_download_arp !== item.link_ata_pncp && (
                                        <a
                                          href={item.link_download_arp}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
                                        >
                                          <span>Documento ARP (Download)</span>
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}

                                      {item.arquivos_arp && item.arquivos_arp.length > 0 && (
                                        <span className="text-slate-500 text-[11px]">
                                          {item.arquivos_arp.length} arquivo(s) oficial(is) anexado(s)
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-[11px] text-slate-400 font-mono">
                                      Consulta: {item.data_hora_consulta}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
