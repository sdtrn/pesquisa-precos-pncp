"use client";

import React, { useState, useMemo } from "react";
import {
  FileCheck2,
  Filter,
  CheckCircle2,
  XCircle,
  BarChart3,
  ScatterChart as ScatterIcon,
  Table2,
  AlertOctagon,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { ResultadoPesquisa, EstatisticasPrecos } from "@/lib/domain/types";
import { chaveItemUnica } from "@/lib/domain/statistics";
import { HelpTooltip } from "@/components/HelpTooltip";

interface AuditAnalyticsDashboardProps {
  resultado: ResultadoPesquisa;
  selectedKeys: Set<string>;
  estatisticasSelecionados: EstatisticasPrecos;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AuditAnalyticsDashboard({
  resultado,
  selectedKeys,
  estatisticasSelecionados,
}: AuditAnalyticsDashboardProps) {
  const [activeAuditTab, setActiveAuditTab] = useState<
    "graficos" | "memoria" | "descartados"
  >("graficos");
  const [buscaMemoria, setBuscaMemoria] = useState("");
  const [filtroClasseMemoria, setFiltroClasseMemoria] = useState("TODAS");
  const [buscaDescarte, setBuscaDescarte] = useState("");
  const [filtroMotivoDescarte, setFiltroMotivoDescarte] = useState("TODOS");

  // Prepare Scatter Plot data from all qualified items (A and B)
  const scatterData = useMemo(() => {
    const sorted = [...resultado.itens_candidatos].sort(
      (a, b) => a.valor_unitario - b.valor_unitario
    );
    return sorted.map((item, idx) => {
      const k = chaveItemUnica(item);
      const isSel = selectedKeys.has(k);
      return {
        index: idx + 1,
        key: k,
        valorUnitario: item.valor_unitario,
        selecionado: isSel ? item.valor_unitario : null,
        naoSelecionado: !isSel ? item.valor_unitario : null,
        orgao: item.orgao_gerenciador_uf,
        uf: item.uf,
        arp: item.numero_arp_licitacao,
        fornecedor: item.fornecedor,
        descricao: item.descricao_objeto,
        classificacao: item.aderencia,
      };
    });
  }, [resultado.itens_candidatos, selectedKeys]);

  // Prepare UF Distribution Data
  const ufDistributionData = useMemo(() => {
    const counts = new Map<string, number>();
    resultado.itens_candidatos.forEach((item) => {
      const uf = item.uf || "N/I";
      counts.set(uf, (counts.get(uf) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([uf, total]) => ({ uf, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [resultado.itens_candidatos]);

  // Prepare Discard Reasons Data
  const discardReasonsData = useMemo(() => {
    return Object.entries(resultado.resumo_descartes || {})
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [resultado.resumo_descartes]);

  const motivosUnicosDescarte = useMemo(() => {
    const set = new Set<string>();
    resultado.descartados.forEach((d) => set.add(d["Motivo do Descarte"]));
    return Array.from(set);
  }, [resultado.descartados]);

  const memoriaFiltrada = useMemo(() => {
    const q = buscaMemoria.trim().toLowerCase();
    return resultado.itens_candidatos.filter((item) => {
      if (
        filtroClasseMemoria !== "TODAS" &&
        item.aderencia !== filtroClasseMemoria
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.descricao_objeto.toLowerCase().includes(q) ||
        item.orgao_gerenciador_uf.toLowerCase().includes(q) ||
        item.uf.toLowerCase().includes(q) ||
        item.fornecedor.toLowerCase().includes(q) ||
        item.numero_arp_licitacao.toLowerCase().includes(q)
      );
    });
  }, [resultado.itens_candidatos, buscaMemoria, filtroClasseMemoria]);

  const descartadosFiltrados = useMemo(() => {
    const q = buscaDescarte.trim().toLowerCase();
    return resultado.descartados.filter((reg) => {
      if (
        filtroMotivoDescarte !== "TODOS" &&
        reg["Motivo do Descarte"] !== filtroMotivoDescarte
      ) {
        return false;
      }
      if (!q) return true;
      return (
        reg["Motivo do Descarte"].toLowerCase().includes(q) ||
        reg["Descrição do Objeto / Item"].toLowerCase().includes(q) ||
        reg["Órgão Gerenciador/UF"].toLowerCase().includes(q) ||
        reg["Nº da ARP / Controle PNCP"].toLowerCase().includes(q)
      );
    });
  }, [resultado.descartados, buscaDescarte, filtroMotivoDescarte]);

  const countClasseA = resultado.itens_candidatos.filter(
    (i) => i.aderencia === "A"
  ).length;
  const countClasseB = resultado.itens_candidatos.filter(
    (i) => i.aderencia === "B"
  ).length;

  return (
    <section aria-label="Painel de Auditoria e Gráficos" className="mb-8 space-y-6">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border-l-4 border-l-[#1B365D]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase">Atas Encontradas (Bruto)</span>
            <FileCheck2 className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {resultado.total_atas_encontradas}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Retornadas pela API de consulta do PNCP
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-l-4 border-l-[#B59410]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase">Atas no Escopo e Período</span>
            <Filter className="w-4 h-4 text-[#B59410]" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#1B365D] dark:text-[#D4AF37] tabular-nums">
            {resultado.atas_validas_escopo_periodo}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Aprovadas nas regras R1, R2, R4 e R7
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase">Itens Qualificados (A + B)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {resultado.itens_candidatos.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Classe A: <strong>{countClasseA}</strong> • Classe B:{" "}
            <strong>{countClasseB}</strong> (de{" "}
            {resultado.total_itens_avaliados} avaliados)
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-l-4 border-l-rose-600">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase">Registros Descartados</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">
            {resultado.descartados.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Auditáveis individualmente com motivo exato
          </p>
        </div>
      </div>

      {/* API Status Verification Banner (Todos == Vigentes + Não vigentes) */}
      {resultado.conferencias_status_api &&
        resultado.conferencias_status_api.length > 0 && (
          <div className="glass-panel rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Verificação de Consistência da API PNCP (Todos = Vigentes + Não vigentes):
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {resultado.conferencias_status_api.map((v) => (
                <span
                  key={v.termo}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] border ${
                    v.equacao_valida
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <strong>{v.termo}</strong>: Todos ({v.todos}) = Vig (
                  {v.vigentes}) + NãoVig ({v.nao_vigentes}){" "}
                  {v.equacao_valida ? "✓" : "⚠"}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* Navigation Tabs: Gráficos de Dispersão | Memória de Pesquisa | Descartados */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 pt-3 flex flex-wrap items-center gap-2 bg-slate-50/70 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveAuditTab("graficos")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-colors ${
              activeAuditTab === "graficos"
                ? "border-[#1B365D] dark:border-[#D4AF37] text-[#1B365D] dark:text-[#D4AF37] bg-white dark:bg-slate-900"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <ScatterIcon className="w-4 h-4" />
            <span>Gráficos de Dispersão & Distribuição</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAuditTab("memoria")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-colors ${
              activeAuditTab === "memoria"
                ? "border-[#1B365D] dark:border-[#D4AF37] text-[#1B365D] dark:text-[#D4AF37] bg-white dark:bg-slate-900"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Table2 className="w-4 h-4" />
            <span>
              Memória de Pesquisa ({resultado.itens_candidatos.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAuditTab("descartados")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-colors ${
              activeAuditTab === "descartados"
                ? "border-[#1B365D] dark:border-[#D4AF37] text-[#1B365D] dark:text-[#D4AF37] bg-white dark:bg-slate-900"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Registros Descartados ({resultado.descartados.length})</span>
          </button>
        </div>

        <div className="p-5">
          {activeAuditTab === "graficos" && (
            <div className="space-y-6">
              {/* Chart 1: Price Dispersion Scatter Plot */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ScatterIcon className="w-4 h-4 text-[#B59410]" />
                      Gráfico de Dispersão dos Preços Unitários Homologados (R$)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pontos dourados indicam itens selecionados para o parecer; linhas tracejadas indicam a Média ({formatBRL(estatisticasSelecionados.media)}) e a Mediana ({formatBRL(estatisticasSelecionados.mediana)}) da seleção.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#B59410]" />
                      Selecionado no Parecer
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400" />
                      Demais Itens Qualificados
                    </span>
                  </div>
                </div>

                {scatterData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                    Sem itens qualificados para plotagem de dispersão.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={scatterData}
                        margin={{ top: 15, right: 25, bottom: 10, left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis
                          dataKey="index"
                          type="number"
                          name="Ordem"
                          tick={{ fontSize: 11 }}
                          domain={[0, scatterData.length + 1]}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `R$ ${v}`}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length)
                              return null;
                            const d = payload[0].payload;
                            return (
                              <div className="p-3 rounded-xl bg-slate-900 text-white text-xs shadow-xl border border-slate-700 max-w-xs">
                                <div className="font-bold text-[#F3E5AB] mb-1">
                                  {formatBRL(d.valorUnitario)} (Aderência{" "}
                                  {d.classificacao})
                                </div>
                                <div className="font-medium line-clamp-2 mb-1">
                                  {d.descricao}
                                </div>
                                <div className="text-slate-300 text-[11px]">
                                  Órgão: {d.orgao}
                                </div>
                                <div className="text-slate-400 text-[11px]">
                                  {d.arp} • Fornecedor: {d.fornecedor || "—"}
                                </div>
                              </div>
                            );
                          }}
                        />
                        {estatisticasSelecionados.quantidade > 0 && (
                          <>
                            <ReferenceLine
                              y={estatisticasSelecionados.media}
                              stroke="#1B365D"
                              strokeDasharray="5 5"
                              strokeWidth={2}
                              label={{
                                value: `Média: ${formatBRL(
                                  estatisticasSelecionados.media
                                )}`,
                                position: "insideTopRight",
                                fill: "#1B365D",
                                fontSize: 11,
                              }}
                            />
                            <ReferenceLine
                              y={estatisticasSelecionados.mediana}
                              stroke="#10B981"
                              strokeDasharray="3 3"
                              strokeWidth={2}
                              label={{
                                value: `Mediana: ${formatBRL(
                                  estatisticasSelecionados.mediana
                                )}`,
                                position: "insideBottomRight",
                                fill: "#10B981",
                                fontSize: 11,
                              }}
                            />
                          </>
                        )}
                        <Scatter
                          name="Selecionado"
                          dataKey="selecionado"
                          fill="#B59410"
                        />
                        <Scatter
                          name="Qualificado (Não Selecionado)"
                          dataKey="naoSelecionado"
                          fill="#94A3B8"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Charts 2 & 3: UF Distribution and Discard Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                  <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" />
                    Itens Qualificados por UF
                  </h4>
                  {ufDistributionData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                      Sem dados por UF.
                    </div>
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ufDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar
                            dataKey="total"
                            name="Itens"
                            radius={[6, 6, 0, 0]}
                          >
                            {ufDistributionData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={i === 0 ? "#B59410" : "#1B365D"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                  <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-600" />
                    Principais Motivos de Descarte (Auditoria R1–R7)
                  </h4>
                  {discardReasonsData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                      Nenhum registro descartado.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {discardReasonsData.map((d) => {
                        const max = discardReasonsData[0]?.total || 1;
                        const pct = Math.max(
                          6,
                          Math.round((d.total / max) * 100)
                        );
                        return (
                          <div key={d.motivo} className="text-xs">
                            <div className="flex justify-between mb-1">
                              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80%]">
                                {d.motivo}
                              </span>
                              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                {d.total}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-rose-500/80 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeAuditTab === "memoria" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={buscaMemoria}
                    onChange={(e) => setBuscaMemoria(e.target.value)}
                    placeholder="Pesquisar na Memória de Pesquisa por descrição, órgão, UF ou fornecedor..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={filtroClasseMemoria}
                    onChange={(e) => setFiltroClasseMemoria(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  >
                    <option value="TODAS">
                      Classes A e B ({resultado.itens_candidatos.length})
                    </option>
                    <option value="A">Somente Classe A ({countClasseA})</option>
                    <option value="B">Somente Classe B ({countClasseB})</option>
                  </select>
                  <HelpTooltip
                    title="Filtro de Classe na Memória de Pesquisa"
                    options={[
                      {
                        label: "Classes A e B",
                        description: "Exibe todos os itens qualificados na pesquisa.",
                      },
                      {
                        label: "Somente Classe A",
                        description:
                          "Exibe apenas itens com 100% dos requisitos comprovados no texto da API.",
                      },
                      {
                        label: "Somente Classe B",
                        description:
                          "Exibe itens aprovados com ressalva para revisão manual.",
                      },
                    ]}
                    align="right"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3">Aderência</th>
                      <th className="py-2 px-3 text-right">Valor Unit.</th>
                      <th className="py-2 px-2">Unid.</th>
                      <th className="py-2 px-3">Descrição do Objeto</th>
                      <th className="py-2 px-3">Órgão/UF</th>
                      <th className="py-2 px-3">ARP</th>
                      <th className="py-2 px-3">Detalhe da Aderência</th>
                      <th className="py-2 px-2 text-center">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {memoriaFiltrada.slice(0, 200).map((item, idx) => (
                      <tr
                        key={`${chaveItemUnica(item)}-${idx}`}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2 px-3 font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              item.aderencia === "A"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                            }`}
                          >
                            {item.aderencia}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {formatBRL(item.valor_unitario)}
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {item.unidade_fornecimento}
                        </td>
                        <td className="py-2 px-3 max-w-xs line-clamp-2">
                          {item.descricao_objeto}
                        </td>
                        <td className="py-2 px-3 max-w-[180px] truncate">
                          {item.orgao_gerenciador_uf}
                        </td>
                        <td className="py-2 px-3 font-mono whitespace-nowrap">
                          {item.numero_arp_licitacao}
                        </td>
                        <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate">
                          {item.detalhe_aderencia}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {item.link_ata_pncp && (
                            <a
                              href={item.link_ata_pncp}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex p-1 text-[#1B365D] dark:text-[#D4AF37]"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeAuditTab === "descartados" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={buscaDescarte}
                    onChange={(e) => setBuscaDescarte(e.target.value)}
                    placeholder="Pesquisar nos registros descartados por órgão, ARP ou descrição..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={filtroMotivoDescarte}
                    onChange={(e) => setFiltroMotivoDescarte(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="TODOS">
                      Todos os motivos ({resultado.descartados.length})
                    </option>
                    {motivosUnicosDescarte.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <HelpTooltip
                    title="Filtro por Motivo de Descarte"
                    summary="Permite isolar os itens ou atas descartados por cada regra de auditoria (ex.: fora do período, município fora da lista, Aderência C, Regra R6)."
                    align="right"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3">Nível</th>
                      <th className="py-2 px-3">Motivo do Descarte</th>
                      <th className="py-2 px-3">Descrição do Objeto / Item</th>
                      <th className="py-2 px-3">Órgão/UF</th>
                      <th className="py-2 px-2">Esfera</th>
                      <th className="py-2 px-3">Nº ARP / Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {descartadosFiltrados.slice(0, 200).map((reg, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2 px-3 font-mono font-semibold text-rose-600">
                          {reg.Nível}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                          {reg["Motivo do Descarte"]}
                        </td>
                        <td className="py-2 px-3 text-slate-500 max-w-md truncate">
                          {reg["Descrição do Objeto / Item"]}
                        </td>
                        <td className="py-2 px-3 max-w-[180px] truncate">
                          {reg["Órgão Gerenciador/UF"] || "—"}
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {reg.Esfera || "—"}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {reg["Nº da ARP / Controle PNCP"] || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
