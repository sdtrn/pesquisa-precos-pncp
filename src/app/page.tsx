"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { HeaderInstitucional } from "@/components/HeaderInstitucional";
import { ScopeSelectorBanner } from "@/components/ScopeSelectorBanner";
import { SearchParametersForm } from "@/components/SearchParametersForm";
import { RequirementsReviewPanel } from "@/components/RequirementsReviewPanel";
import {
  LiveProgressBanner,
  type ProgressoStream,
} from "@/components/LiveProgressBanner";
import { Top20SelectionModal } from "@/components/Top20SelectionModal";
import { AuditAnalyticsDashboard } from "@/components/AuditAnalyticsDashboard";
import { ConsolidatedReportPanel } from "@/components/ConsolidatedReportPanel";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import {
  ESCOPO_TODOS,
  ESCOPO_POR_REGIAO,
  STATUS_VIGENTES,
  DATA_ASSINATURA,
  CRITERIO_MENOR_PRECO,
  TOP_N_ITENS_JANELA,
} from "@/data/constants";
import type {
  CriterioClassificacao,
  RequisitoMinimo,
  ParametrosPipeline,
  ResultadoPesquisa,
  RegistroHistoricoPesquisa,
} from "@/lib/domain/types";
import { selecionarTop20Menores } from "@/lib/domain/selection";
import {
  gerarTermosBusca,
  extrairRequisitosMinimos,
} from "@/lib/domain/parser-requisitos";
import {
  calcularEstatisticasPrecos,
  chaveItemUnica,
} from "@/lib/domain/statistics";
import { hojeRecifeIso } from "@/lib/domain/tz-recife";
import {
  listarHistoricoPesquisas,
  criarRegistroHistorico,
  salvarPesquisaHistorico,
  removerPesquisaHistorico,
  limparTodoHistorico,
  exportarHistoricoJson,
  importarHistoricoJson,
} from "@/lib/storage/history-db";
import { AlertTriangle, Award, ShieldCheck } from "lucide-react";

function getDefaultDateRange(): { inicio: string; fim: string } {
  const fim = hojeRecifeIso();
  const [anoStr, mesStr, diaStr] = fim.split("-");
  const inicio = `${Number(anoStr) - 1}-${mesStr}-${diaStr}`;
  return { inicio, fim };
}

export default function HomePage() {
  const [darkMode, setDarkMode] = useState(false);

  // Scope & Parameters State
  const [escopo, setEscopo] = useState<string>(ESCOPO_TODOS);
  const [regiaoFiltro, setRegiaoFiltro] = useState<string>("Nordeste");
  const [apenasMunicipiosBilionarios, setApenasMunicipiosBilionarios] =
    useState<boolean>(true);
  const [descricaoObjeto, setDescricaoObjeto] = useState<string>("");
  const [criterioClassificacao, setCriterioClassificacao] =
    useState<CriterioClassificacao>(CRITERIO_MENOR_PRECO);
  const [statusArp, setStatusArp] = useState<string>(STATUS_VIGENTES);
  // Pré-selecionado "Data de assinatura da ata" conforme solicitação do usuário
  const [tipoData, setTipoData] = useState<string>(DATA_ASSINATURA);
  const [dataInicial, setDataInicial] = useState<string>("");
  const [dataFinal, setDataFinal] = useState<string>("");
  const [salvarNoHistorico, setSalvarNoHistorico] = useState<boolean>(true);

  // Extracted Requirements Studio State
  const [showRequirementsPanel, setShowRequirementsPanel] =
    useState<boolean>(false);
  const [termosBusca, setTermosBusca] = useState<string[]>([]);
  const [requisitos, setRequisitos] = useState<RequisitoMinimo[]>([]);

  // Search Execution & Results State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [progresso, setProgresso] = useState<ProgressoStream | null>(null);
  const [erroPesquisa, setErroPesquisa] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoPesquisa | null>(null);
  const [incluirClasseB, setIncluirClasseB] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [currentHistoryId, setCurrentHistoryId] = useState<string | undefined>(
    undefined
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Modals & Drawers
  const [showTop20Modal, setShowTop20Modal] = useState<boolean>(false);
  const [showMunicipiosModal, setShowMunicipiosModal] =
    useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [historico, setHistorico] = useState<RegistroHistoricoPesquisa[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize dates & load history on mount
  useEffect(() => {
    const { inicio, fim } = getDefaultDateRange();
    setDataInicial(inicio);
    setDataFinal(fim);

    listarHistoricoPesquisas()
      .then((list) => setHistorico(list))
      .catch(() => {});
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  // Mantém os termos e requisitos sincronizados quando a descrição muda
  const handleChangeDescricao = (novaDescricao: string) => {
    setDescricaoObjeto(novaDescricao);
    if (!novaDescricao.trim()) {
      setTermosBusca([]);
      setRequisitos([]);
      setShowRequirementsPanel(false);
    } else if (showRequirementsPanel || termosBusca.length > 0) {
      setTermosBusca(gerarTermosBusca(novaDescricao));
      setRequisitos(extrairRequisitosMinimos(novaDescricao));
    }
  };

  // Extract terms & requirements from object description instantaneously
  const handleAnalyzeRequirements = () => {
    if (!descricaoObjeto.trim()) return;
    setTermosBusca(gerarTermosBusca(descricaoObjeto));
    setRequisitos(extrairRequisitosMinimos(descricaoObjeto));
    setShowRequirementsPanel(true);
  };

  // Limpa/reseta todos os filtros, requisitos e resultados para iniciar nova pesquisa
  const handleResetSearch = () => {
    abortControllerRef.current?.abort();
    setIsSearching(false);
    setProgresso(null);
    setErroPesquisa(null);
    setSavedNotice(null);
    setResultado(null);
    setSelectedKeys(new Set());
    setIncluirClasseB(false);
    setCurrentHistoryId(undefined);
    setShowTop20Modal(false);

    setDescricaoObjeto("");
    setCriterioClassificacao(CRITERIO_MENOR_PRECO);
    setTermosBusca([]);
    setRequisitos([]);
    setShowRequirementsPanel(false);

    setEscopo(ESCOPO_TODOS);
    setRegiaoFiltro("Nordeste");
    setApenasMunicipiosBilionarios(true);
    setStatusArp(STATUS_VIGENTES);
    setTipoData(DATA_ASSINATURA);
    const { inicio, fim } = getDefaultDateRange();
    setDataInicial(inicio);
    setDataFinal(fim);
  };

  // Recompute Top 20 when `incluirClasseB` or `criterioClassificacao` toggles
  const candidatosTop20Ativos = useMemo(() => {
    if (!resultado) return [];
    return selecionarTop20Menores(
      resultado.itens_candidatos,
      incluirClasseB,
      TOP_N_ITENS_JANELA,
      criterioClassificacao
    );
  }, [resultado, incluirClasseB, criterioClassificacao]);

  const totalClasseBDisponiveis = useMemo(() => {
    if (!resultado) return 0;
    return resultado.itens_candidatos.filter((i) => i.aderencia === "B").length;
  }, [resultado]);

  const handleToggleIncluirClasseB = (val: boolean) => {
    setIncluirClasseB(val);
    if (resultado) {
      const novosTop20 = selecionarTop20Menores(
        resultado.itens_candidatos,
        val,
        TOP_N_ITENS_JANELA,
        criterioClassificacao
      );
      setSelectedKeys(new Set(novosTop20.map((i) => chaveItemUnica(i))));
    }
  };

  const itensSelecionados = useMemo(() => {
    return candidatosTop20Ativos.filter((item) =>
      selectedKeys.has(chaveItemUnica(item))
    );
  }, [candidatosTop20Ativos, selectedKeys]);

  const indicesSelecionados = useMemo(() => {
    const indices: number[] = [];
    candidatosTop20Ativos.forEach((item, idx) => {
      if (selectedKeys.has(chaveItemUnica(item))) {
        indices.push(idx);
      }
    });
    return indices;
  }, [candidatosTop20Ativos, selectedKeys]);

  const estatisticasSelecionados = useMemo(() => {
    return calcularEstatisticasPrecos(
      itensSelecionados.map((i) => i.valor_unitario),
      criterioClassificacao
    );
  }, [itensSelecionados, criterioClassificacao]);

  // Execute streaming search against /api/pesquisar
  const handleExecuteSearch = async () => {
    if (!descricaoObjeto.trim()) return;
    setErroPesquisa(null);
    setSavedNotice(null);
    setIsSearching(true);
    setProgresso({
      msg: "Analisando objeto e iniciando consulta no PNCP...",
      frac: 0.02,
    });

    let termosParaUsar = termosBusca;
    let reqsParaUsar = requisitos;

    if (termosParaUsar.length === 0) {
      termosParaUsar = gerarTermosBusca(descricaoObjeto);
      reqsParaUsar = extrairRequisitosMinimos(descricaoObjeto);
      setTermosBusca(termosParaUsar);
      setRequisitos(reqsParaUsar);
    }

    if (termosParaUsar.length === 0) {
      termosParaUsar = [descricaoObjeto.trim().slice(0, 50)];
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const payload: ParametrosPipeline = {
      descricaoObjeto,
      termosBusca: termosParaUsar,
      requisitos: reqsParaUsar,
      escopoOrgaos: escopo,
      criterioClassificacao,
      regiaoSelecionada: escopo === ESCOPO_POR_REGIAO ? regiaoFiltro : null,
      apenasMunicipiosBilionarios,
      statusAta: statusArp,
      tipoDataPeriodo: tipoData,
      dataInicial,
      dataFinal,
      usarCache: true,
    };

    try {
      const res = await fetch("/api/pesquisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error || `Falha HTTP ${res.status} ao consultar o PNCP.`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let recebeuResultado = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace(/^data:\s*/, "");
          if (!jsonStr) continue;
          const msg = JSON.parse(jsonStr);

          if (msg.type === "progress") {
            setProgresso({
              msg: msg.msg,
              frac: msg.frac,
              parcial: msg.parcial,
            });
          } else if (msg.type === "error") {
            throw new Error(msg.error || "Erro durante o processamento PNCP.");
          } else if (msg.type === "result") {
            recebeuResultado = true;
            const finalResult = msg.data as ResultadoPesquisa;
            setResultado(finalResult);
            const critFinal =
              finalResult.criterio_classificacao || criterioClassificacao;
            if (finalResult.criterio_classificacao) {
              setCriterioClassificacao(finalResult.criterio_classificacao);
            }
            const initialTop20 = selecionarTop20Menores(
              finalResult.itens_candidatos,
              incluirClasseB,
              TOP_N_ITENS_JANELA,
              critFinal
            );
            const initialKeys = initialTop20.map((i) => chaveItemUnica(i));
            setSelectedKeys(new Set(initialKeys));

            if (initialTop20.length > 0) {
              setShowTop20Modal(true);
            }

            // Auto-save to history if toggle is enabled
            if (salvarNoHistorico) {
              const allIndices = initialTop20.map((_, idx) => idx);
              const reg = criarRegistroHistorico(
                finalResult,
                descricaoObjeto,
                initialTop20,
                allIndices,
                incluirClasseB
              );
              setCurrentHistoryId(reg.id);
              await salvarPesquisaHistorico(reg);
              const updated = await listarHistoricoPesquisas();
              setHistorico(updated);
              setSavedNotice(
                `Pesquisa salva automaticamente no Histórico com data ${finalResult.momento_consulta}.`
              );
            }
          }
        }
      }

      if (!recebeuResultado) {
        throw new Error(
          "A conexão com o servidor foi encerrada antes da conclusão da pesquisa. Por favor, tente novamente."
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setErroPesquisa("Pesquisa interrompida pelo usuário.");
      } else {
        setErroPesquisa(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao realizar pesquisa."
        );
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelSearch = () => {
    abortControllerRef.current?.abort();
    setIsSearching(false);
  };

  const handleSaveToHistoryManual = async () => {
    if (!resultado) return;
    const reg = criarRegistroHistorico(
      resultado,
      descricaoObjeto,
      itensSelecionados,
      indicesSelecionados,
      incluirClasseB,
      currentHistoryId
    );
    setCurrentHistoryId(reg.id);
    await salvarPesquisaHistorico(reg);
    const updated = await listarHistoricoPesquisas();
    setHistorico(updated);
    setSavedNotice(
      `Pesquisa salva/atualizada no Histórico (${resultado.momento_consulta}) com ${itensSelecionados.length} ARP(s) selecionada(s).`
    );
  };

  const handleRestoreHistoryEntry = (entry: RegistroHistoricoPesquisa) => {
    setDescricaoObjeto(entry.descricaoObjeto);
    setTermosBusca(entry.termosBusca);
    setRequisitos(entry.resultado.requisitos || []);
    const escopoRestaurado =
      entry.escopoOrgaos.startsWith("Critério de validade")
        ? ESCOPO_TODOS
        : entry.escopoOrgaos;
    setEscopo(escopoRestaurado);
    if (entry.regiaoSelecionada) {
      setRegiaoFiltro(entry.regiaoSelecionada);
    }
    if (entry.escopoOrgaos.startsWith("Critério de validade")) {
      setApenasMunicipiosBilionarios(true);
    } else if (entry.apenasMunicipiosBilionarios !== undefined) {
      setApenasMunicipiosBilionarios(entry.apenasMunicipiosBilionarios);
    }
    setStatusArp(entry.statusAta);
    setTipoData(entry.resultado.tipo_data_periodo || DATA_ASSINATURA);
    if (entry.resultado.data_inicial) {
      setDataInicial(entry.resultado.data_inicial);
    }
    if (entry.resultado.data_final) {
      setDataFinal(entry.resultado.data_final);
    }
    const critHist =
      entry.criterioClassificacao ||
      entry.resultado.criterio_classificacao ||
      CRITERIO_MENOR_PRECO;
    setCriterioClassificacao(critHist);
    setIncluirClasseB(entry.incluirRevisaoB);
    setResultado(entry.resultado);

    const top20 = selecionarTop20Menores(
      entry.resultado.itens_candidatos,
      entry.incluirRevisaoB,
      TOP_N_ITENS_JANELA,
      critHist
    );
    const idxSet = new Set(entry.indicesSelecionados);
    const keys = top20
      .filter((_, idx) => idxSet.has(idx))
      .map((i) => chaveItemUnica(i));
    setSelectedKeys(new Set(keys));
    setCurrentHistoryId(entry.id);
    setErroPesquisa(null);
    setSavedNotice(
      `Pesquisa de ${entry.dataHoraPesquisa} restaurada do Histórico.`
    );
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    await removerPesquisaHistorico(id);
    const updated = await listarHistoricoPesquisas();
    setHistorico(updated);
  };

  const handleClearAllHistory = async () => {
    await limparTodoHistorico();
    setHistorico([]);
  };

  const handleExportHistoryJson = () => {
    const json = exportarHistoricoJson(historico);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_historico_pncp_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportHistoryJson = async (jsonText: string) => {
    try {
      const importados = importarHistoricoJson(jsonText);
      for (const reg of importados) {
        await salvarPesquisaHistorico(reg);
      }
      const updated = await listarHistoricoPesquisas();
      setHistorico(updated);
    } catch {
      alert("Arquivo JSON inválido para importação de histórico.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderInstitucional
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        historicoCount={historico.length}
        onOpenHistory={() => setShowHistoryDrawer(true)}
        onOpenMunicipiosModal={() => setShowMunicipiosModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 1. Scope Selector Banner */}
        <ScopeSelectorBanner
          escopo={escopo}
          onChangeEscopo={setEscopo}
          regiaoFiltro={regiaoFiltro}
          onChangeRegiaoFiltro={setRegiaoFiltro}
          apenasMunicipiosBilionarios={apenasMunicipiosBilionarios}
          onChangeApenasMunicipiosBilionarios={setApenasMunicipiosBilionarios}
          showMunicipiosModal={showMunicipiosModal}
          onCloseMunicipiosModal={() => setShowMunicipiosModal(false)}
          onOpenMunicipiosModal={() => setShowMunicipiosModal(true)}
        />

        {/* 2. Search Parameters Form */}
        <SearchParametersForm
          descricaoObjeto={descricaoObjeto}
          onChangeDescricao={handleChangeDescricao}
          criterioClassificacao={criterioClassificacao}
          onChangeCriterioClassificacao={setCriterioClassificacao}
          statusArp={statusArp}
          onChangeStatusArp={setStatusArp}
          tipoData={tipoData}
          onChangeTipoData={setTipoData}
          dataInicial={dataInicial}
          onChangeDataInicial={setDataInicial}
          dataFinal={dataFinal}
          onChangeDataFinal={setDataFinal}
          salvarNoHistorico={salvarNoHistorico}
          onChangeSalvarNoHistorico={setSalvarNoHistorico}
          onAnalyzeRequirements={handleAnalyzeRequirements}
          onExecuteSearch={handleExecuteSearch}
          onResetSearch={handleResetSearch}
          hasActiveData={Boolean(
            resultado ||
              showRequirementsPanel ||
              termosBusca.length > 0 ||
              erroPesquisa
          )}
          isSearching={isSearching}
        />

        {/* 3. Requirements & Search Terms Studio (when opened or populated) */}
        {(showRequirementsPanel || termosBusca.length > 0) && (
          <RequirementsReviewPanel
            termosBusca={termosBusca}
            onChangeTermosBusca={setTermosBusca}
            requisitos={requisitos}
            onChangeRequisitos={setRequisitos}
            onReextractFromText={handleAnalyzeRequirements}
          />
        )}

        {/* 4. Real-Time Streaming Progress */}
        <LiveProgressBanner
          progresso={progresso}
          isSearching={isSearching}
          onCancel={handleCancelSearch}
        />

        {/* Error Alert */}
        {erroPesquisa && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <div className="font-bold">Aviso na Execução da Pesquisa</div>
              <div>{erroPesquisa}</div>
            </div>
          </div>
        )}

        {/* 5. Results Section: Consolidated Report + Analytics & Audit Dashboard */}
        {resultado && (
          <>
            <ConsolidatedReportPanel
              descricaoObjeto={descricaoObjeto}
              resultado={resultado}
              candidatosTop20={candidatosTop20Ativos}
              itensSelecionados={itensSelecionados}
              indicesSelecionados={indicesSelecionados}
              estatisticas={estatisticasSelecionados}
              criterioClassificacao={criterioClassificacao}
              onOpenTop20Modal={() => setShowTop20Modal(true)}
              onSaveToHistoryManual={handleSaveToHistoryManual}
              savedNotice={savedNotice}
            />

            <AuditAnalyticsDashboard
              resultado={resultado}
              selectedKeys={selectedKeys}
              estatisticasSelecionados={estatisticasSelecionados}
              criterioClassificacao={criterioClassificacao}
            />
          </>
        )}
      </main>

      {/* Top 20 Selection Modal */}
      {resultado && (
        <Top20SelectionModal
          isOpen={showTop20Modal}
          onClose={() => setShowTop20Modal(false)}
          candidatosTop20={candidatosTop20Ativos}
          selectedKeys={selectedKeys}
          onChangeSelectedKeys={setSelectedKeys}
          incluirClasseB={incluirClasseB}
          onChangeIncluirClasseB={handleToggleIncluirClasseB}
          totalClasseBDisponiveis={totalClasseBDisponiveis}
          criterioClassificacao={criterioClassificacao}
        />
      )}

      {/* Saved Search History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        historico={historico}
        onRestoreEntry={handleRestoreHistoryEntry}
        onDeleteEntry={handleDeleteHistoryEntry}
        onClearAll={handleClearAllHistory}
        onExportJson={handleExportHistoryJson}
        onImportJson={handleImportHistoryJson}
      />

      {/* Institutional Footer & Legal Disclaimers */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm pt-8 pb-10 px-4 mt-16 transition-colors">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Independence Declaration & Disclaimer Box */}
          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 p-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-3.5">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-2.5">
                <div>
                  <h4 className="font-heading font-bold text-slate-900 dark:text-amber-200 text-sm">
                    Declaração de Independência Institucional e Termo de Uso (Disclaimer)
                  </h4>
                  <p className="mt-1 font-semibold text-amber-950 dark:text-amber-300">
                    Ferramenta independente desenvolvida pela iniciativa privada, sem vínculo institucional com o Ministério da Gestão e da Inovação em Serviços Públicos (MGI) ou com o Governo Federal.
                  </p>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Este sistema realiza consultas automatizadas e extração de dados públicos disponibilizados pela API oficial do Portal Nacional de Contratações Públicas (PNCP) estritamente <em>“as is”</em> (no estado em que se encontram). O desenvolvedor não se responsabiliza por eventuais instabilidades técnicas, indisponibilidades da infraestrutura governamental, omissões, dados incompletos ou erros de lançamento contidos nos dados originais fornecidos pelos órgãos licitantes.
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-slate-200">Atenção ao Usuário e Agente Público:</strong> É dever e responsabilidade do usuário final conferir e validar o inteiro teor da Ata de Registro de Preços, seus Termos Aditivos e a vigência diretamente na fonte oficial do PNCP antes da instrução processual ou tomada de decisão administrativa (Lei nº 14.133/2021).
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar: System & Author Identification */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" />
              <span>
                <strong>Pesquisa de Preços PNCP</strong> • Auditoria R1–R7 • Fuso Horário Oficial <code className="font-mono font-semibold">America/Recife</code>
              </span>
            </div>
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <Award className="w-4 h-4 text-[#B59410]" />
              <span>Desenvolvido por Sérgio Dantas Torres</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
