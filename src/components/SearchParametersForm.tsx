"use client";

import React, { useMemo } from "react";
import {
  Search,
  Sparkles,
  Calendar,
  Filter,
  BookmarkCheck,
  AlertCircle,
  SlidersHorizontal,
  RotateCcw,
  Percent,
  DollarSign,
  Calculator,
} from "lucide-react";
import {
  STATUS_VIGENTES,
  STATUS_NAO_VIGENTES,
  STATUS_TODOS,
  DATA_ASSINATURA,
  DATA_PUBLICACAO,
  DATA_VIGENCIA,
  PRESETS_EXEMPLOS,
  CRITERIO_MENOR_PRECO,
  CRITERIO_MAIOR_DESCONTO,
  OPCOES_CRITERIO,
  MODO_NORMALIZACAO_AUTO,
  OPCOES_MODO_NORMALIZACAO,
} from "@/data/constants";
import type { CriterioClassificacao, ModoNormalizacaoPreco } from "@/lib/domain/types";
import { detectarModoNormalizacaoSugerido } from "@/lib/domain/normalizador-precos";
import { HelpTooltip } from "@/components/HelpTooltip";

const OPCOES_STATUS = [STATUS_VIGENTES, STATUS_NAO_VIGENTES, STATUS_TODOS];
const OPCOES_DATA = [DATA_ASSINATURA, DATA_PUBLICACAO, DATA_VIGENCIA];

const RESUMO_TIPO_DATA: Record<string, string> = {
  [DATA_ASSINATURA]:
    "Filtra pela data em que a Ata foi assinada dentro do intervalo Inicial e Final.",
  [DATA_PUBLICACAO]:
    "Filtra pela data em que a Ata foi divulgada oficialmente no portal PNCP.",
  [DATA_VIGENCIA]:
    "Filtra atas cujo prazo de validade tenha pelo menos 1 dia dentro do intervalo Inicial e Final.",
};

interface SearchParametersFormProps {
  descricaoObjeto: string;
  onChangeDescricao: (val: string) => void;
  criterioClassificacao?: CriterioClassificacao;
  onChangeCriterioClassificacao?: (val: CriterioClassificacao) => void;
  modoNormalizacao?: ModoNormalizacaoPreco;
  onChangeModoNormalizacao?: (modo: ModoNormalizacaoPreco) => void;
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
  onResetSearch: () => void;
  hasActiveData?: boolean;
  isSearching: boolean;
}

export function SearchParametersForm({
  descricaoObjeto,
  onChangeDescricao,
  criterioClassificacao = CRITERIO_MENOR_PRECO,
  onChangeCriterioClassificacao,
  modoNormalizacao = MODO_NORMALIZACAO_AUTO,
  onChangeModoNormalizacao,
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
  onResetSearch,
  hasActiveData = false,
  isSearching,
}: SearchParametersFormProps) {
  const modoDetectado = useMemo(() => {
    return detectarModoNormalizacaoSugerido(descricaoObjeto);
  }, [descricaoObjeto]);
  const isDateInvalid = Boolean(
    dataInicial && dataFinal && dataInicial > dataFinal
  );

  return (
    <section
      aria-label="Parâmetros da Pesquisa"
      className="glass-panel rounded-2xl p-5 sm:p-6 shadow-sm mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1B365D] dark:bg-[#D4AF37]" />
            <span>2. Especificação do Objeto e Filtros Temporais</span>
          </h2>
          <HelpTooltip
            title="Como configurar a Especificação e os Filtros Temporais?"
            summary="Informe o texto do objeto que deseja cotar e defina o recorte de vigência e datas das Atas:"
            options={[
              {
                label: "Objeto da compra",
                description:
                  "Cole a descrição do item do seu Termo de Referência. O sistema extrai automaticamente os termos-chave e requisitos mínimos (capacidade, dimensões, potência, etc.).",
              },
              {
                label: "Status da ARP",
                description:
                  "Escolha se deseja consultar apenas atas Vigentes hoje, apenas Não vigentes (vencidas) ou Todas.",
              },
              {
                label: "Filtrar período por (Padrão: Data de assinatura da ata)",
                description:
                  "Define qual data da Ata será comparada com a Data inicial e a Data final escolhidas ao lado.",
              },
            ]}
          />
        </div>

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
              onClick={() => {
                onChangeDescricao(preset.descricao);
                if (preset.criterioSugerido && onChangeCriterioClassificacao) {
                  onChangeCriterioClassificacao(preset.criterioSugerido);
                } else if (!preset.criterioSugerido && onChangeCriterioClassificacao) {
                  onChangeCriterioClassificacao(CRITERIO_MENOR_PRECO);
                }
                if (onChangeModoNormalizacao) {
                  if (preset.modoNormalizacaoSugerido) {
                    onChangeModoNormalizacao(preset.modoNormalizacaoSugerido);
                  } else {
                    onChangeModoNormalizacao(MODO_NORMALIZACAO_AUTO);
                  }
                }
              }}
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
          className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5"
        >
          <span>
            Objeto da compra (com especificações técnicas mínimas e unidade desejada)
          </span>
          <HelpTooltip
            title="Campo: Objeto da Compra"
            summary="Descreva o bem ou serviço que deseja pesquisar no PNCP."
            options={[
              {
                label: "Termos de busca automáticos",
                description:
                  "O sistema identifica o núcleo do objeto (ex.: 'ar condicionado split 12000', 'locação veículo hatch') para consultar na API do PNCP.",
              },
              {
                label: "Requisitos mínimos (Classificação A, B e C)",
                description:
                  "Medidas como '12000 BTUs', '8m x 100m', '200 micras' ou 'motor 1.0' viram regras automáticas: itens que atendem tudo recebem Classe A; itens com dados omissos recebem Classe B; itens inferiores são descartados (Classe C).",
              },
            ]}
          />
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

      {/* Critério de Julgamento / Classificação */}
      <div className="mb-5 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
            <span>Critério de Julgamento / Classificação da Melhor ARP</span>
            <HelpTooltip
              title="Critério de Julgamento da ARP (Lei 14.133/2021)"
              summary="Define a métrica de vantajosidade e classificação das Atas no Top 20:"
              options={[
                {
                  label: "Menor Preço Unitário (R$) - Padrão",
                  description:
                    "Para aquisições comuns de materiais, locações e equipamentos, onde a ata mais vantajosa é a de menor valor monetário.",
                },
                {
                  label: "Maior Taxa de Desconto (%)",
                  description:
                    "Para gerenciamento de frota com fornecimento de combustível em rede credenciada de postos, cartões ou passagens aéreas, onde a melhor ata é a que oferece o maior percentual de desconto sobre a tabela de referência.",
                },
              ]}
            />
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {criterioClassificacao === CRITERIO_MAIOR_DESCONTO
              ? "Classificando por maior % de desconto (ordem decrescente)"
              : "Classificando por menor valor em R$ (ordem crescente)"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {OPCOES_CRITERIO.map((opt) => {
            const isSelected = criterioClassificacao === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeCriterioClassificacao?.(opt.id)}
                disabled={isSearching}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "bg-white dark:bg-slate-800 border-[#1B365D] dark:border-[#D4AF37] ring-1 ring-[#1B365D] dark:ring-[#D4AF37] shadow-xs"
                    : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div
                  className={`mt-0.5 p-1 rounded-md ${
                    isSelected
                      ? "bg-[#1B365D]/10 text-[#1B365D] dark:bg-[#D4AF37]/20 dark:text-[#F3E5AB]"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {opt.id === CRITERIO_MAIOR_DESCONTO ? (
                    <Percent className="w-3.5 h-3.5" />
                  ) : (
                    <DollarSign className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <div
                    className={`text-xs font-semibold ${
                      isSelected
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {opt.nome}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    {opt.descricaoCurta}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Padronização de Preço Unitário (Lei 14.133/2021) */}
      <div className="mb-5 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Calculator className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
            <span>Padronização de Preço Unitário (Lei 14.133/2021)</span>
            <HelpTooltip
              title="Padronização de Preço Unitário (Lei 14.133/2021)"
              summary="Permite comparar valores unitários homogêneos (mensal por posto ou veículo) dividindo valores globais ou anuais:"
              options={[
                {
                  label: "⚡ Automático (Detectado)",
                  description:
                    "Identifica automaticamente no objeto termos de postos de trabalho (vigilância, portaria, limpeza) ou locação de veículos/máquinas e aplica a normalização mensal por unidade.",
                },
                {
                  label: "🛡️ Mensal por Posto (R$/mês/posto)",
                  description:
                    "Calcula o valor unitário mensal por posto de serviço, dividindo pelo quantitativo de postos e vigência em meses.",
                },
                {
                  label: "🚗 Mensal por Veículo (R$/mês/veículo)",
                  description:
                    "Calcula o valor unitário mensal por veículo locado, dividindo pela frota e meses contratados.",
                },
                {
                  label: "⏹️ Desativado (Preço Bruto da Ata)",
                  description:
                    "Compara diretamente o valor homologado registrado no PNCP sem realizar normalização por unidade ou meses.",
                },
              ]}
            />
          </div>

          {modoNormalizacao === "auto" && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span>
                {modoDetectado === "posto_mes"
                  ? "⚡ Auto (Detectado: Mensal por Posto)"
                  : modoDetectado === "veiculo_mes"
                  ? "⚡ Auto (Detectado: Mensal por Veículo)"
                  : "⚡ Auto (Preço Bruto da Ata)"}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {OPCOES_MODO_NORMALIZACAO.map((opt) => {
            const isSelected = modoNormalizacao === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeModoNormalizacao?.(opt.id)}
                disabled={isSearching}
                className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "bg-white dark:bg-slate-800 border-[#1B365D] dark:border-[#D4AF37] ring-1 ring-[#1B365D] dark:ring-[#D4AF37] shadow-xs"
                    : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div
                  className={`text-xs font-semibold ${
                    isSelected
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {opt.nome}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight mt-1">
                  {opt.descricaoCurta}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Grid: Status, Date Mode, Start Date, End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* Filter 1: Status da ARP */}
        <div>
          <label
            htmlFor="status-arp-select"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
            <span>Status da ARP</span>
            <HelpTooltip
              title="Filtro: Status da ARP"
              summary="Filtra as Atas de Registro de Preços conforme sua validade atual no calendário de Recife (UTC-3):"
              options={[
                {
                  label: "Vigentes (Recomendado)",
                  description:
                    "Retorna apenas atas cujo prazo de vigência ainda está ativo hoje e que não foram canceladas (em conformidade com a Lei 14.133/2021).",
                },
                {
                  label: "Não vigentes",
                  description:
                    "Retorna apenas atas cujo prazo de validade já encerrou (útil para séries históricas ou auditoria retroativa).",
                },
                {
                  label: "Todos",
                  description:
                    "Consulta simultaneamente atas vigentes e não vigentes, conferindo se Todos = Vigentes + Não vigentes na API do PNCP.",
                },
              ]}
            />
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

        {/* Filter 2: Filtrar período por */}
        <div>
          <label
            htmlFor="tipo-data-select"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF37]" />
            <span>Filtrar período por</span>
            <HelpTooltip
              title="Filtro: Filtrar período por"
              summary="Escolhe qual data da Ata será verificada dentro do intervalo [Data inicial até Data final]:"
              options={[
                {
                  label: "Data de assinatura da ata (Pré-selecionado)",
                  description:
                    "Aceita apenas atas que foram ASSINADAS entre a Data inicial e a Data final. É a opção mais direta para garantir preços pactuados recentemente (ex.: últimos 12 meses).",
                },
                {
                  label: "Data de publicação no PNCP",
                  description:
                    "Aceita apenas atas que foram PUBLICADAS/DIVULGADAS no Portal Nacional de Contratações Públicas entre a Data inicial e a Data final.",
                },
                {
                  label: "Vigência (Interseção de validade)",
                  description:
                    "Aceita qualquer ata cujo período de validade (início ao fim da vigência) tenha pelo menos 1 dia em comum com o intervalo entre a Data inicial e a Data final.",
                },
              ]}
            />
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
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
            {RESUMO_TIPO_DATA[tipoData] || RESUMO_TIPO_DATA[DATA_ASSINATURA]}
          </p>
        </div>

        {/* Filter 3: Data inicial */}
        <div>
          <label
            htmlFor="data-inicial-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
          >
            <span>Data inicial (inclusiva)</span>
            <HelpTooltip
              title="Filtro: Data Inicial (Inclusiva)"
              summary="Define o primeiro dia aceito para o período da pesquisa (no calendário oficial America/Recife)."
              options={[
                {
                  label: "Com Data de assinatura da ata",
                  description:
                    "Descarta atas assinadas antes desta data inicial.",
                },
                {
                  label: "Com Data de publicação no PNCP",
                  description:
                    "Descarta atas publicadas no PNCP antes desta data inicial.",
                },
                {
                  label: "Com Vigência",
                  description:
                    "Descarta atas cuja vigência tenha terminado antes desta data inicial.",
                },
              ]}
              align="center"
            />
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

        {/* Filter 4: Data final */}
        <div>
          <label
            htmlFor="data-final-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
          >
            <span>Data final (inclusiva)</span>
            <HelpTooltip
              title="Filtro: Data Final (Inclusiva)"
              summary="Define o último dia aceito para o período da pesquisa (no calendário oficial America/Recife)."
              options={[
                {
                  label: "Com Data de assinatura da ata",
                  description:
                    "Descarta atas assinadas após esta data final.",
                },
                {
                  label: "Com Data de publicação no PNCP",
                  description:
                    "Descarta atas publicadas no PNCP após esta data final.",
                },
                {
                  label: "Com Vigência",
                  description:
                    "Descarta atas cuja vigência só comece depois desta data final.",
                },
              ]}
              align="right"
            />
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
        <div className="flex items-center gap-2">
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
                <span>
                  Salvar automaticamente no Histórico de Pesquisas (com data/hora da consulta)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Armazena localmente a pesquisa com carimbo{" "}
                <code className="font-mono">DD/MM/AAAA HH:MM:SS</code> para restauração instantânea
              </p>
            </div>
          </label>
          <HelpTooltip
            title="Opção: Salvar no Histórico de Pesquisas"
            summary="Controla se esta pesquisa será gravada automaticamente no banco de dados do seu navegador (IndexedDB):"
            options={[
              {
                label: "Ativado (Recomendado)",
                description:
                  "Assim que a busca terminar, salva todos os resultados, gráficos e a data/hora exata da consulta no menu 'Histórico de Pesquisas'.",
              },
              {
                label: "Desativado",
                description:
                  "Não salva automaticamente ao concluir a busca (mas você ainda poderá clicar no botão 'Salvar no Histórico' manualmente depois, se desejar).",
              },
            ]}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onResetSearch}
            disabled={!descricaoObjeto.trim() && !hasActiveData && !isSearching}
            title="Limpar descrição, filtros, requisitos e resultados para iniciar uma nova pesquisa do zero"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800/80 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 border border-slate-300/80 dark:border-slate-700 disabled:opacity-40 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar / Nova Pesquisa</span>
          </button>

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
