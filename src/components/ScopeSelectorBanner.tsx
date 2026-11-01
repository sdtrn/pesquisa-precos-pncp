"use client";

import React, { useState, useMemo } from "react";
import {
  Shield,
  Globe2,
  MapPin,
  Landmark,
  Info,
  Search,
  X,
  CheckCircle2,
  Building2,
} from "lucide-react";
import {
  OPCOES_ESCOPO,
  UFS_BRASIL,
  REGIOES_BRASIL,
  ESCOPO_VALIDADE,
  ESCOPO_TODOS,
  ESCOPO_POR_REGIAO,
  ESCOPO_PE_RECIFE,
} from "@/data/constants";
import municipiosData from "@/data/municipios-bilionarios.json";
import { HelpTooltip } from "@/components/HelpTooltip";

interface ScopeSelectorBannerProps {
  escopo: string;
  onChangeEscopo: (escopo: string) => void;
  regiaoFiltro: string;
  onChangeRegiaoFiltro: (regiao: string) => void;
  apenasMunicipiosBilionarios: boolean;
  onChangeApenasMunicipiosBilionarios: (val: boolean) => void;
  showMunicipiosModal: boolean;
  onCloseMunicipiosModal: () => void;
  onOpenMunicipiosModal: () => void;
}

const SCOPE_META: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    shortBadge: string;
    subtitle: string;
    explanation: string;
  }
> = {
  [ESCOPO_VALIDADE]: {
    icon: Shield,
    shortBadge: "Padrão Auditável (R1 + R2)",
    subtitle: "União, Estados, DF e Municípios (com ou sem regra de ≥ R$ 1 Bi)",
    explanation:
      "Considera Atas de Registro de Preços da União (Federal), dos 26 Estados, do Distrito Federal e dos Municípios brasileiros conforme a regra municipal escolhida ao lado (apenas os 177 municípios com orçamento ≥ R$ 1 bilhão ou todos os municípios).",
  },
  [ESCOPO_TODOS]: {
    icon: Globe2,
    shortBadge: "Escopo Nacional Amplo",
    subtitle: "Todas as esferas e municípios brasileiros",
    explanation:
      "Atas de Registro de Preços de todos os órgãos e entidades públicas do Brasil (União, Estados, Distrito Federal e todos os Municípios), registrando na Memória de Pesquisa se cada órgão atende ou não ao critério de validade (Sim/Não).",
  },
  [ESCOPO_POR_REGIAO]: {
    icon: MapPin,
    shortBadge: "Recorte Regional (5 Regiões)",
    subtitle: "Órgãos sediados na Região geográfica selecionada",
    explanation:
      "Filtra Atas de Registro de Preços pertencentes exclusivamente aos Estados e Municípios sediados na Região escolhida (Nordeste, Norte, Centro-Oeste, Sudeste ou Sul), permitindo optar entre apenas municípios bilionários (≥ R$ 1 bi) ou todos os municípios da região.",
  },
  [ESCOPO_PE_RECIFE]: {
    icon: Landmark,
    shortBadge: "Recorte Executivo PE / Recife",
    subtitle: "Poder Executivo Estadual de PE e Executivo do Recife",
    explanation:
      "Filtra estritamente Atas de Registro de Preços do Poder Executivo do Estado de Pernambuco (esfera Estadual, poder Executivo, UF PE) e do Poder Executivo do Município do Recife (esfera Municipal, poder Executivo, IBGE 2611606 / RECIFE-PE).",
  },
};

export function ScopeSelectorBanner({
  escopo,
  onChangeEscopo,
  regiaoFiltro,
  onChangeRegiaoFiltro,
  apenasMunicipiosBilionarios,
  onChangeApenasMunicipiosBilionarios,
  showMunicipiosModal,
  onCloseMunicipiosModal,
  onOpenMunicipiosModal,
}: ScopeSelectorBannerProps) {
  const [searchMun, setSearchMun] = useState("");
  const [filterUfMun, setFilterUfMun] = useState("TODAS");

  const filteredMunicipios = useMemo(() => {
    const q = searchMun.trim().toLowerCase();
    return municipiosData.filter((m) => {
      if (filterUfMun !== "TODAS" && m.uf !== filterUfMun) return false;
      if (!q) return true;
      return (
        m.municipio.toLowerCase().includes(q) ||
        m.codigo_ibge.includes(q) ||
        m.uf.toLowerCase().includes(q) ||
        m.estado.toLowerCase().includes(q)
      );
    });
  }, [searchMun, filterUfMun]);

  const activeMeta = SCOPE_META[escopo] || SCOPE_META[ESCOPO_VALIDADE];
  const regiaoObj =
    REGIOES_BRASIL.find((r) => r.nome === regiaoFiltro) || REGIOES_BRASIL[0];

  const permiteEscolherRegraMunicipal =
    escopo === ESCOPO_POR_REGIAO || escopo === ESCOPO_VALIDADE;

  return (
    <section aria-label="Seleção de Escopo de Órgãos" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B59410]" />
            <span>1. Escopo Institucional de Órgãos (Regras R1, R2 e R7)</span>
          </h2>
          <HelpTooltip
            title="Como funciona o Escopo Institucional de Órgãos?"
            summary="Define quais órgãos públicos terão suas Atas de Registro de Preços aceitas na pesquisa:"
            options={[
              {
                label: "Critério de validade (Padrão)",
                description:
                  "Aceita atas da União (Federal), dos 26 Estados, do Distrito Federal e dos Municípios (podendo escolher entre apenas os 177 municípios com orçamento ≥ R$ 1 bilhão ou todos).",
              },
              {
                label: "Todos os órgãos do Brasil",
                description:
                  "Aceita atas de qualquer órgão federal, estadual, distrital ou municipal do país sem restrição geográfica ou orçamentária.",
              },
              {
                label: "ARPs por Região",
                description:
                  "Restringe a pesquisa aos órgãos sediados em uma das 5 regiões do Brasil (Nordeste, Norte, Centro-Oeste, Sudeste ou Sul), permitindo escolher se aplica ou não a regra de municípios bilionários.",
              },
              {
                label: "Governo de Pernambuco e Prefeitura do Recife",
                description:
                  "Aceita exclusivamente atas do Poder Executivo do Estado de Pernambuco e da Prefeitura do Recife (descartando Legislativo, Judiciário e outros municípios).",
              },
            ]}
          />
        </div>

        <button
          type="button"
          onClick={onOpenMunicipiosModal}
          className="text-xs font-medium text-[#1B365D] dark:text-[#D4AF37] hover:underline flex items-center gap-1"
        >
          <Info className="w-3.5 h-3.5" />
          Ver tabela oficial dos 177 municípios (≥ R$ 1 bi)
        </button>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {OPCOES_ESCOPO.map((item) => {
          const meta = SCOPE_META[item] || SCOPE_META[ESCOPO_VALIDADE];
          const Icon = meta.icon;
          const isSelected = escopo === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => onChangeEscopo(item)}
              className={`group text-left p-4 rounded-xl border transition-all relative overflow-hidden ${
                isSelected
                  ? "bg-gradient-to-br from-[#1B365D] to-[#122644] text-white border-[#B59410] shadow-md ring-2 ring-[#B59410]/40"
                  : "glass-panel hover:border-[#1B365D]/40 dark:hover:border-[#D4AF37]/40 text-slate-800 dark:text-slate-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div
                  className={`p-2 rounded-lg ${
                    isSelected
                      ? "bg-white/15 text-[#F3E5AB]"
                      : "bg-[#1B365D]/10 dark:bg-slate-800 text-[#1B365D] dark:text-[#D4AF37]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? "bg-[#B59410] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {meta.shortBadge}
                </span>
              </div>

              <div className="font-heading font-bold text-sm leading-snug mb-1 flex items-center gap-1.5">
                <span>{item}</span>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                )}
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  isSelected
                    ? "text-slate-200"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {meta.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Dynamic Banner + Region Selector + Municipal Rule Selector */}
      <div className="mt-3 p-4 rounded-xl bg-[#1B365D]/[0.05] dark:bg-slate-800/70 border border-[#1B365D]/15 dark:border-slate-700 space-y-3">
        <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <Info className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">
              Regra ativa ({escopo}):{" "}
            </span>
            <span>{activeMeta.explanation}</span>
          </div>
        </div>

        {(escopo === ESCOPO_POR_REGIAO || permiteEscolherRegraMunicipal) && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Region Selector (visible when ARPs por Região is selected) */}
            {escopo === ESCOPO_POR_REGIAO && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="regiao-escopo-select"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
                  <span>Região Geográfica do Brasil:</span>
                  <HelpTooltip
                    title="Filtro por Região do Brasil"
                    summary="Filtra apenas as Atas de Registro de Preços dos órgãos localizados nos estados da região escolhida:"
                    options={REGIOES_BRASIL.map((r) => ({
                      label: `Região ${r.nome}`,
                      description: `Abrange os estados: ${r.descricaoUfs}.`,
                    }))}
                  />
                </label>
                <select
                  id="regiao-escopo-select"
                  value={regiaoFiltro}
                  onChange={(e) => onChangeRegiaoFiltro(e.target.value)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-[#1B365D]/30 dark:border-[#B59410]/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
                >
                  {REGIOES_BRASIL.map((r) => (
                    <option key={r.nome} value={r.nome}>
                      Região {r.nome} ({r.siglasUf.join(", ")})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Estados incluídos: <strong>{regiaoObj.descricaoUfs}</strong>
                </span>
              </div>
            )}

            {/* Municipal Criterion Selector (Billionaire Municipalities vs. All Municipalities) */}
            {permiteEscolherRegraMunicipal && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="regra-municipios-select"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#B59410]" />
                  <span>Critério quanto aos Municípios:</span>
                  <HelpTooltip
                    title="Filtro de Municípios (Bilionários vs. Todos)"
                    summary="Define quais prefeituras e órgãos municipais serão aceitos na pesquisa:"
                    options={[
                      {
                        label:
                          "Com regra de Municípios Bilionários (≥ R$ 1 bilhão)",
                        description:
                          "Aceita apenas atas municipais pertencentes aos 177 grandes municípios brasileiros com orçamento anual (LOA 2026) igual ou superior a R$ 1 bilhão, garantindo maior porte e segurança amostral (Regras R1 e R2).",
                      },
                      {
                        label: "Todos os Municípios (sem regra de orçamento)",
                        description:
                          "Aceita atas de qualquer prefeitura/município (dentro do escopo/região escolhida), independentemente do valor do orçamento municipal.",
                      },
                    ]}
                  />
                </label>
                <select
                  id="regra-municipios-select"
                  value={apenasMunicipiosBilionarios ? "BILIONARIOS" : "TODOS"}
                  onChange={(e) =>
                    onChangeApenasMunicipiosBilionarios(
                      e.target.value === "BILIONARIOS"
                    )
                  }
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-[#1B365D]/30 dark:border-[#B59410]/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
                >
                  <option value="BILIONARIOS">
                    Com regra de Municípios Bilionários (Orçamento ≥ R$ 1 bi — 177 municípios)
                  </option>
                  <option value="TODOS">
                    Todos os Municípios (sem restrição de orçamento)
                  </option>
                </select>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {apenasMunicipiosBilionarios
                    ? "Ativo: Apenas os 177 municípios com orçamento ≥ R$ 1 bilhão são aprovados."
                    : "Ativo: Todos os municípios são aceitos (sem filtro de porte orçamentário)."}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal of the 177 Billionaire Municipalities */}
      {showMunicipiosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-[#1B365D] text-white flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold">
                  177 Municípios Brasileiros com Orçamento ≥ R$ 1 Bilhão (LOA 2026)
                </h3>
                <p className="text-xs text-slate-200 mt-0.5">
                  Validação estrita por Código IBGE (7 dígitos) ou Nome Exato Normalizado + UF (Regra R2)
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseMunicipiosModal}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-slate-50 dark:bg-slate-900/50">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchMun}
                  onChange={(e) => setSearchMun(e.target.value)}
                  placeholder="Filtrar por nome do município, código IBGE ou UF..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={filterUfMun}
                onChange={(e) => setFilterUfMun(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              >
                <option value="TODAS">
                  Todas as UFs ({municipiosData.length})
                </option>
                {UFS_BRASIL.map((uf) => (
                  <option key={uf.sigla} value={uf.sigla}>
                    {uf.sigla} — {uf.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Código IBGE</th>
                    <th className="py-2 px-3">Município</th>
                    <th className="py-2 px-3">UF</th>
                    <th className="py-2 px-3">Perfil</th>
                    <th className="py-2 px-3 text-right">Porte Orçamentário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMunicipios.map((m, idx) => (
                    <tr
                      key={m.codigo_ibge}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2 px-3 font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-[#1B365D] dark:text-[#D4AF37]">
                        {m.codigo_ibge}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {m.municipio}
                      </td>
                      <td className="py-2 px-3 font-mono">{m.uf}</td>
                      <td className="py-2 px-3 text-slate-500">
                        {m.perfil_localizacao}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                        {m.porte_orcamentario}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                Exibindo <strong>{filteredMunicipios.length}</strong> de{" "}
                <strong>{municipiosData.length}</strong> municípios
              </span>
              <button
                type="button"
                onClick={onCloseMunicipiosModal}
                className="px-4 py-1.5 rounded-lg bg-[#1B365D] text-white font-semibold hover:bg-[#142949]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
