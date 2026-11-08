import {
  ESCOPO_PE_RECIFE,
  ESCOPO_POR_ESTADO,
  ESCOPO_POR_REGIAO,
  ESCOPO_TODOS,
  ESCOPO_VALIDADE,
  MAPA_REGIAO_UFS,
  TOP_N_ITENS_JANELA,
} from "@/data/constants";
import {
  avaliarOrgaoGerenciador,
  verificarEscopoEspecialOrgao,
} from "@/lib/domain/municipios";
import {
  avaliarAderenciaItem,
  verificarCompatibilidadePreliminarAta,
} from "@/lib/domain/parser-requisitos";
import {
  extrairTaxaDescontoDePdf,
  parseTaxaDesconto,
} from "@/lib/domain/pdf-parser";
import {
  formatarDocumentoIdentificacao,
  formatarFornecedorComDocumento,
} from "@/lib/domain/formatters";
import {
  calcularPrecoNormalizado,
  detectarModoNormalizacaoSugerido,
} from "@/lib/domain/normalizador-precos";
import { selecionarTop20Menores } from "@/lib/domain/selection";
import type { ArquivoArp, ConferenciaStatusApi } from "@/lib/domain/types";
import { PNCPClient } from "@/lib/domain/pncp-client";
import {
  agoraRecifeFormatado,
  formatarDataBr,
  hojeRecifeIso,
  parseDataCalendarioRecife,
  verificarPeriodoLocal,
  verificarStatusLocal,
} from "@/lib/domain/tz-recife";
import type {
  CriterioClassificacao,
  ItemCandidato,
  ModoNormalizacaoPreco,
  NivelAderencia,
  ParametrosPipeline,
  RegistroDescartado,
  ResultadoAderencia,
  ResultadoPesquisa,
} from "@/lib/domain/types";

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * Remove caracteres de controle invisíveis ilegais no XML/Excel
 * e limpa tags HTML brutas vindas do PNCP.
 */
export function limparTextoExibicao(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  let s = String(valor);
  if (!s) return "";

  s = s.replace(
    /&(?:nbsp|amp|quot|#39|apos|lt|gt);/gi,
    (m) => HTML_ENTITIES[m.toLowerCase()] || " "
  );
  s = s.replace(
    /<\/?(?:p|br|strong|b|i|em|u|span|div|ul|ol|li|font|table|tr|td|th)\b[^>]*>/gi,
    " "
  );
  s = s.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Formata o 'Quantitativo previsto na ARP' com a unidade.
 * Se a API não informar, retorna 'não informado'; nunca estima.
 */
export function formatarQuantitativoArp(
  quantidade: unknown,
  unidade?: string | null
): [string, string] {
  if (
    quantidade === null ||
    quantidade === undefined ||
    String(quantidade).trim() === ""
  ) {
    return ["não informado", "não informado"];
  }
  const val = Number(quantidade);
  if (!Number.isFinite(val) || val <= 0) {
    return ["não informado", "não informado"];
  }

  let qtdStr: string;
  if (Math.abs(val - Math.round(val)) < 1e-5) {
    qtdStr = `${Math.round(val)}`;
  } else {
    qtdStr = val.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const unStr = (unidade || "").trim();
  if (unStr) {
    return [`${qtdStr} ${unStr}`, qtdStr];
  }
  return [qtdStr, qtdStr];
}

/**
 * Normaliza o valor de adesão do PNCP para 'Sim' | 'Não' | 'Não informado'.
 */
export function normalizarPossibilidadeAdesao(
  valor: unknown
): "Sim" | "Não" | "Não informado" {
  if (valor === true) return "Sim";
  if (valor === false) return "Não";
  if (typeof valor === "string") {
    const s = valor.trim().toLowerCase();
    if (s === "sim" || s === "true" || s === "s" || s === "1") return "Sim";
    if (s === "não" || s === "nao" || s === "false" || s === "n" || s === "0") return "Não";
  }
  if (valor === 1) return "Sim";
  if (valor === 0) return "Não";
  return "Não informado";
}

export function montarIdentificacaoArpLicitacao(
  ataSearch: Record<string, unknown>,
  detAta?: Record<string, unknown> | null,
  detCompra?: Record<string, unknown> | null
): [string, string] {
  let numArp = "";
  let anoArp = "";
  if (detAta) {
    numArp = String(detAta.numeroAtaRegistroPreco || "").trim();
    anoArp = String(detAta.anoAta || "").trim();
  }

  if (!numArp) {
    const titulo = String(ataSearch.title || "").trim();
    if (titulo) {
      numArp = titulo.replace(/Ata n[º°]/i, "").trim();
    } else {
      numArp = String(ataSearch.numero_sequencial || "S/N").trim();
    }
  }

  if (!anoArp) {
    anoArp = String(ataSearch.ano || "").trim();
  }

  let arpLabel: string;
  if (numArp.includes("/")) {
    arpLabel = `ARP nº ${numArp}`;
  } else if (anoArp) {
    arpLabel = `ARP nº ${numArp}/${anoArp}`;
  } else {
    arpLabel = `ARP nº ${numArp}`;
  }

  const modalidade = String(
    detCompra?.modalidadeNome ||
      detAta?.modalidadeNome ||
      ataSearch.modalidade_licitacao_nome ||
      ""
  ).trim();

  let numCompra = "";
  let anoCompra = String(ataSearch.ano || "").trim();
  if (detCompra) {
    numCompra = String(detCompra.numeroCompra || "").trim();
    if (detCompra.anoCompra) {
      anoCompra = String(detCompra.anoCompra).trim();
    }
  }
  if (!numCompra) {
    numCompra = String(ataSearch.numero_sequencial_compra_ata || "").trim();
  }

  let textoFinal: string;
  if (modalidade && numCompra) {
    const licLabel =
      numCompra.includes("/") || !anoCompra
        ? `${modalidade} nº ${numCompra}`
        : `${modalidade} nº ${numCompra}/${anoCompra}`;
    textoFinal = `${arpLabel} — ${licLabel}`;
  } else if (modalidade) {
    textoFinal = `${arpLabel} — ${modalidade}`;
  } else {
    textoFinal = arpLabel;
  }

  const idUnicoAta =
    String(ataSearch.numero_controle_pncp || "").trim() ||
    String(detAta?.numeroControlePNCP || "").trim() ||
    arpLabel;

  return [textoFinal, idUnicoAta];
}

interface AtaAprovadaTriagem {
  ataS: Record<string, unknown>;
  cnpj: string;
  anoC: string;
  seqCompra: string;
  seqAta: string;
  linkPncp: string;
  orgaoNome: string;
  tipoOrgaoStr: string;
  ufS: string;
  munS: string;
  codIbgeS: string;
  situacaoAtaS: string;
  canceladoS: boolean;
  dtAssS: string | null;
  dtIniVigS: string | null;
  dtFimVigS: string | null;
  vigenciaStrS: string;
  orgaoUfStr: string;
  numControleAta: string;
  detAtaPre: Record<string, unknown> | null;
  atendeValidadeSimNao: "Sim" | "Não";
  esferaNorm: string;
  dataAusenteB: boolean;
  msgPeriodo: string;
}

/**
 * Infere rapidamente a esfera governamental (F, E, D, M) tratando corretamente
 * Consórcios Públicos Intermunicipais e Interestaduais onde o PNCP envia esfera_id = "N" ("Não se aplica").
 */
export function inferirEsferaRapida(
  esferaId: string,
  orgaoNome: string,
  unidadeNome: string,
  ufSigla = ""
): string {
  const esferaAtual = String(esferaId || "").trim().toUpperCase();
  // CRÍTICO: "N" ("Não se aplica") é retornado pelo PNCP para Consórcios Públicos.
  // Só retornar imediatamente se já for uma das 4 esferas válidas (F, E, D, M).
  if (esferaAtual && ["F", "E", "D", "M"].includes(esferaAtual)) {
    return esferaAtual;
  }

  const texto = `${orgaoNome || ""} ${unidadeNome || ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!texto) return "";

  const termosEstaduais = [
    "estado de ",
    "estado do ",
    "estadual",
    "governo do estado",
    "secretaria de estado",
    "tribunal de justica",
    "assembleia legislativa",
    "policia militar do estado",
    "consorcio interestadual",
  ];
  if (termosEstaduais.some((t) => texto.includes(t))) return "E";

  const termosMunicipais = [
    "municipio",
    "prefeitura",
    "camara municipal",
    "fundo municipal",
    "secretaria municipal",
    "autarquia municipal",
    "fundacao municipal",
    "consorcio publico",
    "consorcio intermunicipal",
    "consorcio multifinalitario",
    "cim ",
    "cis ",
  ];
  if (termosMunicipais.some((t) => texto.includes(t))) return "M";

  const termosFederais = [
    "federal",
    "ministerio ",
    "universidade federal",
    "instituto federal",
    "comando da ",
    "comando do ",
    "justica federal",
    "tribunal regional federal",
    "uniao",
  ];
  if (termosFederais.some((t) => texto.includes(t))) return "F";

  if (ufSigla.trim().toUpperCase() === "DF" && texto.includes("distrito federal")) {
    return "D";
  }

  // Se veio "N" e é um consórcio não interestadual, assumir Municipal ("M")
  if (esferaAtual === "N" && texto.includes("consorcio")) return "M";

  return "";
}

/**
 * Executa todo o pipeline auditável de pesquisa de preços em Atas do PNCP (Regras R1 a R7).
 */
export async function executarPipelinePesquisa(
  params: ParametrosPipeline,
  progressoCb?: (
    msg: string,
    frac: number,
    parcial?: Record<string, number>
  ) => void
): Promise<ResultadoPesquisa> {
  const agora = new Date();
  const hojeRecife = hojeRecifeIso(agora);
  const dataHoraConsultaStr = agoraRecifeFormatado(agora);

  const modoNormalizacaoEfetivo: ModoNormalizacaoPreco =
    !params.modoNormalizacao || params.modoNormalizacao === "auto"
      ? detectarModoNormalizacaoSugerido(params.descricaoObjeto || "")
      : params.modoNormalizacao;

  const dtIni = params.dataInicial?.trim() || null;
  const dtFim = params.dataFinal?.trim() || null;

  const periodoAplicadoStr = `${params.tipoDataPeriodo}: ${
    dtIni ? formatarDataBr(dtIni) : "sem início"
  } a ${dtFim ? formatarDataBr(dtFim) : "sem fim"}`;

  const termosUsadosStr = params.termosBusca.join(", ");
  const client = new PNCPClient(params.usarCache ?? true);

  let atasBrutas: Record<string, unknown>[] = [];
  let conferenciasStatusApi: ConferenciaStatusApi[] = [];

  const regiaoKey = String(params.regiaoSelecionada || params.ufSelecionada || "Nordeste")
    .trim()
    .toUpperCase();
  const ufsDaRegiao =
    params.escopoOrgaos === ESCOPO_POR_REGIAO &&
    (!params.ufSelecionada || MAPA_REGIAO_UFS[params.ufSelecionada.trim().toUpperCase()])
      ? MAPA_REGIAO_UFS[regiaoKey] || null
      : null;

  if (params.escopoOrgaos === ESCOPO_POR_REGIAO && ufsDaRegiao && ufsDaRegiao.length > 0) {
    // Busca direcionada por cada UF da região selecionada para não perder atas no limite global
    const vistas = new Set<string>();
    const confPorTermo = new Map<string, { vigentes: number; nao_vigentes: number; todos: number }>();

    for (let i = 0; i < ufsDaRegiao.length; i += 3) {
      const loteUfs = ufsDaRegiao.slice(i, i + 3);
      const resultadosLote = await Promise.all(
        loteUfs.map((ufRegiao) =>
          client.buscarTodasAtasPorTermos({
            termos: params.termosBusca,
            statusUi: params.statusAta,
            tipoData: params.tipoDataPeriodo,
            dataInicial: dtIni,
            dataFinal: dtFim,
            progressoCb: (msg, frac) =>
              progressoCb?.(
                `[${ufRegiao}] ${msg}`,
                0.02 + 0.18 * ((i + frac) / Math.max(1, ufsDaRegiao.length))
              ),
            ufFiltro: ufRegiao,
          })
        )
      );

      for (const resUf of resultadosLote) {
        for (const ata of resUf.atas) {
          const chave =
            String(ata.numero_controle_pncp || "").trim() ||
            String(ata.item_url || "").trim() ||
            String(ata.id || "").trim();
          if (chave && !vistas.has(chave)) {
            vistas.add(chave);
            atasBrutas.push(ata);
          }
        }
        for (const c of resUf.conferenciasStatus) {
          const atual = confPorTermo.get(c.termo) || { vigentes: 0, nao_vigentes: 0, todos: 0 };
          atual.vigentes += c.vigentes;
          atual.nao_vigentes += c.nao_vigentes;
          atual.todos += c.todos;
          confPorTermo.set(c.termo, atual);
        }
      }
    }

    conferenciasStatusApi = Array.from(confPorTermo.entries()).map(([termo, tot]) => {
      const soma = tot.vigentes + tot.nao_vigentes;
      return {
        termo,
        vigentes: tot.vigentes,
        nao_vigentes: tot.nao_vigentes,
        soma_vigentes_mais_nao_vigentes: soma,
        todos: tot.todos,
        equacao_valida: tot.todos === soma,
      };
    });
  } else {
    let ufFiltroApi: string | null = null;
    if (
      (params.escopoOrgaos === ESCOPO_POR_ESTADO || params.escopoOrgaos === ESCOPO_POR_REGIAO) &&
      params.ufSelecionada &&
      params.ufSelecionada.trim().length === 2
    ) {
      ufFiltroApi = params.ufSelecionada.trim().toUpperCase();
    } else if (params.escopoOrgaos === ESCOPO_PE_RECIFE) {
      ufFiltroApi = "PE";
    }

    // 1. Busca paginada de todas as atas no PNCP
    const resBusca = await client.buscarTodasAtasPorTermos({
      termos: params.termosBusca,
      statusUi: params.statusAta,
      tipoData: params.tipoDataPeriodo,
      dataInicial: dtIni,
      dataFinal: dtFim,
      progressoCb: (msg, frac) => progressoCb?.(msg, frac),
      ufFiltro: ufFiltroApi,
    });
    atasBrutas = resBusca.atas;
    conferenciasStatusApi = resBusca.conferenciasStatus;
  }

  const descartados: RegistroDescartado[] = [];
  const itensCandidatosAprovados: ItemCandidato[] = [];
  let todosItensAvaliadosCount = 0;
  let atasValidasEscopoPeriodoCount = 0;

  const chavesDedupAtaItem = new Set<string>();
  const chavesDedupCompraItem = new Set<string>();
  const totalAtas = atasBrutas.length;

  const apenasBilionarios =
    params.apenasMunicipiosBilionarios !== undefined
      ? Boolean(params.apenasMunicipiosBilionarios)
      : true;

  // 2. Triagem Local (Período em America/Recife + Compatibilidade Preliminar + Escopo R1/R2/R7)
  const atasAprovadasTriagem: AtaAprovadaTriagem[] = [];
  const comprasParaPrecarregar: Array<[string, string, string]> = [];
  const comprasVistasPre = new Set<string>();

  for (const ataS of atasBrutas) {
    const chavesUrl = PNCPClient.extrairChavesItemUrl(ataS);
    let cnpj = "";
    let anoC = "";
    let seqCompra = "";
    let seqAta = "";
    let linkPncp = "https://pncp.gov.br/app/atas";

    if (chavesUrl) {
      [cnpj, anoC, seqCompra, seqAta] = chavesUrl;
      linkPncp = PNCPClient.montarLinkAtaPncp(cnpj, anoC, seqCompra, seqAta);
    } else {
      cnpj = String(ataS.orgao_cnpj || ataS.orgaoCnpj || "").trim();
      anoC = String(ataS.ano || ataS.anoCompra || "").trim();
      seqCompra = String(
        ataS.numero_sequencial_compra_ata ||
          ataS.numeroSequencialCompraAta ||
          ataS.sequencialCompra ||
          ""
      ).trim().replace(/^0+/, "") || "0";
      seqAta = String(
        ataS.numero_sequencial ||
          ataS.numeroSequencial ||
          ataS.sequencialAta ||
          ""
      ).trim().replace(/^0+/, "") || "0";
      if (cnpj && anoC && seqCompra && seqAta) {
        linkPncp = PNCPClient.montarLinkAtaPncp(cnpj, anoC, seqCompra, seqAta);
      }
    }

    const orgaoNome = String(ataS.orgao_nome || "").trim();
    const unidadeNome = String(ataS.unidade_nome || "").trim();
    const poderNome = String(ataS.poder_nome || "").trim();
    const tipoOrgaoStr =
      unidadeNome && poderNome
        ? `${unidadeNome} (${poderNome})`
        : unidadeNome || poderNome || "Órgão Gerenciador";

    let ufS = String(ataS.uf || "").trim().toUpperCase();
    let munS = String(ataS.municipio_nome || "").trim();
    let codIbgeS = String(ataS.codigo_ibge || "").trim();
    let esferaIdS = inferirEsferaRapida(
      String(ataS.esfera_id || "").trim().toUpperCase(),
      orgaoNome,
      unidadeNome,
      ufS
    );
    const situacaoAtaS = String(
      ataS.situacao_nome || "Divulgada no PNCP"
    ).trim();
    const canceladoS = ataS.cancelado === true;

    const dtAssS = parseDataCalendarioRecife(
      ataS.data_assinatura as string | null
    );
    const dtPubS = parseDataCalendarioRecife(
      ataS.data_publicacao_pncp as string | null
    );
    const dtIniVigS = parseDataCalendarioRecife(
      ataS.data_inicio_vigencia as string | null
    );
    const dtFimVigS = parseDataCalendarioRecife(
      ataS.data_fim_vigencia as string | null
    );

    const vigenciaStrS = `${formatarDataBr(dtIniVigS)} a ${formatarDataBr(
      dtFimVigS
    )}`;
    let orgaoUfStr = ufS ? `${orgaoNome}/${ufS}` : orgaoNome;
    const numControleAta = String(
      ataS.numero_controle_pncp || ataS.title || ""
    ).trim();

    // 2.1 Verifica período em memória (0ms) ANTES de qualquer chamada de rede
    const {
      dentroDoPeriodo,
      requerRevisaoBPorDataAusente,
      detalheMotivo: msgPeriodo,
    } = verificarPeriodoLocal(
      params.tipoDataPeriodo,
      dtIni,
      dtFim,
      dtAssS,
      dtPubS,
      dtIniVigS,
      dtFimVigS
    );

    if (!dentroDoPeriodo) {
      const avalTemp = avaliarOrgaoGerenciador(esferaIdS, ufS, munS, codIbgeS);
      descartados.push({
        Nível: "Ata",
        "Motivo do Descarte": "fora do período",
        "Nº da ARP / Controle PNCP": numControleAta,
        "Órgão Gerenciador/UF": orgaoUfStr,
        Esfera: avalTemp.esferaNormalizada,
        Município: munS || "-",
        "Nº do Item/Lote": "-",
        "Descrição do Objeto / Item": String(ataS.description || ""),
        "Valor Unitário (R$)": null,
        Unidade: "-",
        "Data de Assinatura": formatarDataBr(dtAssS),
        "Vigência da Ata": vigenciaStrS,
        "Situação da Ata": situacaoAtaS,
        "Link no PNCP": linkPncp,
      });
      continue;
    }

    // 2.2 Verifica compatibilidade preliminar do objeto da Ata em memória (0ms)
    const compatAta = verificarCompatibilidadePreliminarAta(
      String(ataS.description || ""),
      String(ataS.title || ""),
      params.requisitos
    );
    if (!compatAta.compativel) {
      const avalTemp = avaliarOrgaoGerenciador(esferaIdS, ufS, munS, codIbgeS);
      descartados.push({
        Nível: "Ata",
        "Motivo do Descarte": `Aderência C — ${compatAta.motivo}`,
        "Nº da ARP / Controle PNCP": numControleAta,
        "Órgão Gerenciador/UF": orgaoUfStr,
        Esfera: avalTemp.esferaNormalizada,
        Município: munS || "-",
        "Nº do Item/Lote": "-",
        "Descrição do Objeto / Item": String(ataS.description || ""),
        "Valor Unitário (R$)": null,
        Unidade: "-",
        "Data de Assinatura": formatarDataBr(dtAssS),
        "Vigência da Ata": vigenciaStrS,
        "Situação da Ata": situacaoAtaS,
        "Link no PNCP": linkPncp,
      });
      continue;
    }

    // 2.3 Só busca detalhe da ata na rede se realmente necessário para validar município bilionário
    let detAtaPre: Record<string, unknown> | null = null;
    const precisaValidarMunicipioBilionario =
      apenasBilionarios || params.escopoOrgaos === ESCOPO_PE_RECIFE;
    if (
      precisaValidarMunicipioBilionario &&
      (!esferaIdS || (esferaIdS === "M" && !munS && !codIbgeS)) &&
      chavesUrl
    ) {
      detAtaPre = await client.obterDetalheAta(cnpj, anoC, seqCompra, seqAta);
      if (detAtaPre) {
        const orgEnt = (detAtaPre.orgaoEntidade as Record<string, unknown>) || {};
        const unOrg = (detAtaPre.unidadeOrgao as Record<string, unknown>) || {};
        munS = String(unOrg.municipioNome || munS).trim();
        codIbgeS = String(unOrg.codigoIbge || codIbgeS).trim();
        ufS = String(unOrg.ufSigla || ufS)
          .trim()
          .toUpperCase();
        esferaIdS = inferirEsferaRapida(
          String(orgEnt.esferaId || esferaIdS),
          orgaoNome,
          unidadeNome,
          ufS
        );
        orgaoUfStr = ufS ? `${orgaoNome}/${ufS}` : orgaoNome;
      }
    }

    const avalOrgao = avaliarOrgaoGerenciador(
      esferaIdS,
      ufS,
      munS,
      codIbgeS
    );
    const atendeValidadeBool = avalOrgao.atendeCriterioValidade;
    const atendeValidadeSimNao: "Sim" | "Não" = atendeValidadeBool
      ? "Sim"
      : "Não";
    const esferaNorm = avalOrgao.esferaNormalizada;

    if (
      params.escopoOrgaos === ESCOPO_TODOS ||
      params.escopoOrgaos === ESCOPO_VALIDADE
    ) {
      const aprovadoNacional = apenasBilionarios
        ? atendeValidadeBool
        : Boolean(
            ["F", "E", "D", "M"].includes(esferaIdS) ||
              orgaoNome ||
              cnpj
          );

      if (!aprovadoNacional) {
        const motivoOrgao =
          avalOrgao.motivoDescarteEscopoA || "município fora da lista";
        descartados.push({
          Nível: "Ata",
          "Motivo do Descarte": motivoOrgao,
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": "-",
          "Descrição do Objeto / Item": String(ataS.description || ""),
          "Valor Unitário (R$)": null,
          Unidade: "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }
    }

    if (
      params.escopoOrgaos === ESCOPO_POR_REGIAO ||
      params.escopoOrgaos === ESCOPO_POR_ESTADO ||
      params.escopoOrgaos === ESCOPO_PE_RECIFE
    ) {
      const poderIdS = String(ataS.poder_id || "").trim().toUpperCase();
      const paramFiltroGeografico =
        params.escopoOrgaos === ESCOPO_POR_REGIAO
          ? params.regiaoSelecionada || params.ufSelecionada || "Nordeste"
          : params.ufSelecionada;
      const { aprovado, motivo: motivoEsp } = verificarEscopoEspecialOrgao(
        params.escopoOrgaos,
        paramFiltroGeografico,
        esferaIdS,
        poderIdS,
        ufS,
        munS,
        codIbgeS,
        orgaoNome,
        unidadeNome,
        apenasBilionarios
      );
      if (!aprovado) {
        descartados.push({
          Nível: "Ata",
          "Motivo do Descarte": motivoEsp,
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": "-",
          "Descrição do Objeto / Item": String(ataS.description || ""),
          "Valor Unitário (R$)": null,
          Unidade: "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }
    }

    if (!chavesUrl) {
      descartados.push({
        Nível: "Ata",
        "Motivo do Descarte": "link/chaves da ata ausentes na API do PNCP",
        "Nº da ARP / Controle PNCP": numControleAta,
        "Órgão Gerenciador/UF": orgaoUfStr,
        Esfera: esferaNorm,
        Município: munS || "-",
        "Nº do Item/Lote": "-",
        "Descrição do Objeto / Item": String(ataS.description || ""),
        "Valor Unitário (R$)": null,
        Unidade: "-",
        "Data de Assinatura": formatarDataBr(dtAssS),
        "Vigência da Ata": vigenciaStrS,
        "Situação da Ata": situacaoAtaS,
        "Link no PNCP": linkPncp,
      });
      continue;
    }

    atasValidasEscopoPeriodoCount++;
    const chaveC = `${cnpj}|${anoC}|${seqCompra}`;
    if (!comprasVistasPre.has(chaveC)) {
      comprasVistasPre.add(chaveC);
      comprasParaPrecarregar.push([cnpj, anoC, seqCompra]);
    }

    atasAprovadasTriagem.push({
      ataS,
      cnpj,
      anoC,
      seqCompra,
      seqAta,
      linkPncp,
      orgaoNome,
      tipoOrgaoStr,
      ufS,
      munS,
      codIbgeS,
      situacaoAtaS,
      canceladoS,
      dtAssS,
      dtIniVigS,
      dtFimVigS,
      vigenciaStrS,
      orgaoUfStr,
      numControleAta,
      detAtaPre,
      atendeValidadeSimNao,
      esferaNorm,
      dataAusenteB: requerRevisaoBPorDataAusente,
      msgPeriodo,
    });
  }

  // 3. Pré-carrega em paralelo os itens de todas as compras que passaram na triagem
  await client.preCarregarItensCompras(comprasParaPrecarregar, (msg, frac) =>
    progressoCb?.(msg, frac, {
      totalAtasEncontradas: totalAtas,
      atasValidasEscopoPeriodo: atasValidasEscopoPeriodoCount,
    })
  );

  // 4. Triagem de aderência textual em memória para identificar quais itens (A ou B) precisam de /resultados
  const itensParaResultadoParalelo: Array<[string, string, string, string]> = [];
  const atasParaDetalheParalelo: Array<[string, string, string, string]> = [];
  const itensResVistos = new Set<string>();
  const atasDetVistas = new Set<string>();
  const cacheAderenciaPorCompraItem = new Map<string, ResultadoAderencia>();
  const itensBPermitidosPorCompra = new Map<string, Set<string>>();
  const comprasComCandidato = new Set<string>();
  const comprasJaAvaliadasStep4 = new Set<string>();

  for (let idxCtx = 0; idxCtx < atasAprovadasTriagem.length; idxCtx++) {
    const ctx = atasAprovadasTriagem[idxCtx];
    const { cnpj, anoC, seqCompra, seqAta, ataS } = ctx;
    const chaveCompra = `${cnpj}|${anoC}|${seqCompra}`;
    const objAtaStr = String(ataS.description || "").trim();

    if (!comprasJaAvaliadasStep4.has(chaveCompra)) {
      comprasJaAvaliadasStep4.add(chaveCompra);

      const itensCompra = await client.obterTodosItensCompra(
        cnpj,
        anoC,
        seqCompra
      );
      if (itensCompra.length === 0) continue;

      let compraTemCandidato = false;
      const candidatosBDestaCompra: Array<{
        atendidosCount: number;
        vNum: number;
        numItemStr: string;
      }> = [];

      for (const itemObj of itensCompra) {
        const numItemStr = String(itemObj.numeroItem || "").trim();
        const descItem = String(itemObj.descricao || "").trim();
        const infCompItem = String(itemObj.informacaoComplementar || "").trim();
        const unMedidaItem = String(itemObj.unidadeMedida || "").trim();

        const avalItem = avaliarAderenciaItem(
          descItem,
          unMedidaItem,
          params.requisitos,
          infCompItem,
          objAtaStr
        );
        cacheAderenciaPorCompraItem.set(
          `${chaveCompra}|${numItemStr}`,
          avalItem
        );

        if (avalItem.aderencia === "C") continue;

        const sitItemNome = String(itemObj.situacaoCompraItemNome || "")
          .trim()
          .toLowerCase();
        if (
          itemObj.temResultado === false ||
          (sitItemNome && sitItemNome !== "homologado")
        ) {
          continue;
        }

        if (avalItem.aderencia === "A") {
          const chaveRes = `${chaveCompra}|${numItemStr}`;
          if (!itensResVistos.has(chaveRes)) {
            itensResVistos.add(chaveRes);
            itensParaResultadoParalelo.push([cnpj, anoC, seqCompra, numItemStr]);
          }
          compraTemCandidato = true;
        } else {
          const valEst = Number(itemObj.valorUnitarioEstimado);
          const vNum =
            Number.isFinite(valEst) && valEst > 0
              ? valEst
              : Number.POSITIVE_INFINITY;
          candidatosBDestaCompra.push({
            atendidosCount: avalItem.atendidos.length,
            vNum,
            numItemStr,
          });
        }
      }

      if (candidatosBDestaCompra.length > 0) {
        candidatosBDestaCompra.sort((a, b) => {
          if (b.atendidosCount !== a.atendidosCount) {
            return b.atendidosCount - a.atendidosCount;
          }
          if (a.vNum !== b.vNum) {
            return a.vNum - b.vNum;
          }
          return a.numItemStr.localeCompare(b.numItemStr);
        });
        const eleitosB = new Set(
          candidatosBDestaCompra.slice(0, 2).map((x) => x.numItemStr)
        );
        itensBPermitidosPorCompra.set(chaveCompra, eleitosB);
        for (const numI of eleitosB) {
          const chaveRes = `${chaveCompra}|${numI}`;
          if (!itensResVistos.has(chaveRes)) {
            itensResVistos.add(chaveRes);
            itensParaResultadoParalelo.push([cnpj, anoC, seqCompra, numI]);
          }
          compraTemCandidato = true;
        }
      }

      if (compraTemCandidato) {
        comprasComCandidato.add(chaveCompra);
      }
    }

    const precisaDetalheAta =
      ctx.detAtaPre === null &&
      (ctx.dtAssS === null || ctx.dtFimVigS === null);
    if (comprasComCandidato.has(chaveCompra) && precisaDetalheAta) {
      const chaveAtaDet = `${cnpj}|${anoC}|${seqCompra}|${seqAta}`;
      if (!atasDetVistas.has(chaveAtaDet)) {
        atasDetVistas.add(chaveAtaDet);
        atasParaDetalheParalelo.push([cnpj, anoC, seqCompra, seqAta]);
      }
    }
  }

  // 4.1 Busca em paralelo todos os resultados homologados e detalhes de atas
  if (
    itensParaResultadoParalelo.length > 0 ||
    atasParaDetalheParalelo.length > 0
  ) {
    await client.preCarregarResultadosEDetalhes(
      itensParaResultadoParalelo,
      atasParaDetalheParalelo,
      (msg, frac) =>
        progressoCb?.(msg, frac, {
          totalAtasEncontradas: totalAtas,
          atasValidasEscopoPeriodo: atasValidasEscopoPeriodoCount,
        })
    );
  }

  // 5. Consolidação final
  const cacheTaxaDescontoPorAta = new Map<string, number>();
  const cacheArquivosPorAta = new Map<string, ArquivoArp[]>();
  const totalAprovadas = atasAprovadasTriagem.length;
  for (let idxCtx = 0; idxCtx < totalAprovadas; idxCtx++) {
    const ctx = atasAprovadasTriagem[idxCtx];
    if (
      progressoCb &&
      (idxCtx % 20 === 0 || idxCtx === totalAprovadas - 1)
    ) {
      const frac = 0.92 + 0.07 * ((idxCtx + 1) / Math.max(1, totalAprovadas));
      progressoCb(
        `Consolidando ata ${idxCtx + 1} de ${totalAprovadas} (${ctx.orgaoNome})...`,
        Math.min(0.99, frac),
        {
          totalAtasEncontradas: totalAtas,
          atasValidasEscopoPeriodo: atasValidasEscopoPeriodoCount,
          totalItensAvaliados: todosItensAvaliadosCount,
        }
      );
    }

    const {
      ataS,
      cnpj,
      anoC,
      seqCompra,
      seqAta,
      linkPncp,
      orgaoNome,
      tipoOrgaoStr,
      ufS,
      munS,
      codIbgeS,
      situacaoAtaS,
      canceladoS,
      dtAssS,
      dtIniVigS,
      dtFimVigS,
      vigenciaStrS,
      orgaoUfStr,
      numControleAta,
      atendeValidadeSimNao,
      esferaNorm,
      dataAusenteB,
      msgPeriodo,
    } = ctx;
    const objAtaStr = String(ataS.description || "").trim();

    const itensCompra = await client.obterTodosItensCompra(
      cnpj,
      anoC,
      seqCompra
    );
    if (itensCompra.length === 0) {
      descartados.push({
        Nível: "Ata",
        "Motivo do Descarte": "ata sem itens cadastrados na API do PNCP",
        "Nº da ARP / Controle PNCP": numControleAta,
        "Órgão Gerenciador/UF": orgaoUfStr,
        Esfera: esferaNorm,
        Município: munS || "-",
        "Nº do Item/Lote": "-",
        "Descrição do Objeto / Item": String(ataS.description || ""),
        "Valor Unitário (R$)": null,
        Unidade: "-",
        "Data de Assinatura": formatarDataBr(dtAssS),
        "Vigência da Ata": vigenciaStrS,
        "Situação da Ata": situacaoAtaS,
        "Link no PNCP": linkPncp,
      });
      continue;
    }

    let detAta: Record<string, unknown> | null = ctx.detAtaPre;
    const itensValidosDestaAta: ItemCandidato[] = [];

    for (const itemObj of itensCompra) {
      todosItensAvaliadosCount++;
      const numItemStr = String(itemObj.numeroItem || "").trim();
      const descItem = limparTextoExibicao(itemObj.descricao);
      const infCompItem = limparTextoExibicao(itemObj.informacaoComplementar);
      const unMedidaItem = limparTextoExibicao(itemObj.unidadeMedida);
      const qtdItemCompra = itemObj.quantidade;
      const qtdItemCompraNum =
        itemObj.quantidade !== null &&
        itemObj.quantidade !== undefined &&
        Number.isFinite(Number(itemObj.quantidade))
          ? Number(itemObj.quantidade)
          : undefined;
      const valEstimadoNum =
        itemObj.valorUnitarioEstimado !== null &&
        itemObj.valorUnitarioEstimado !== undefined &&
        Number.isFinite(Number(itemObj.valorUnitarioEstimado))
          ? Number(itemObj.valorUnitarioEstimado)
          : null;

      let avalItem = cacheAderenciaPorCompraItem.get(
        `${cnpj}|${anoC}|${seqCompra}|${numItemStr}`
      );
      if (!avalItem) {
        avalItem = avaliarAderenciaItem(
          descItem,
          unMedidaItem,
          params.requisitos,
          infCompItem,
          objAtaStr
        );
      }

      const aderenciaItem = avalItem.aderencia;
      const motivoAderencia = avalItem.motivo;

      if (aderenciaItem === "C") {
        descartados.push({
          Nível: "Item",
          "Motivo do Descarte": `Aderência C — ${motivoAderencia}`,
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": numItemStr,
          "Descrição do Objeto / Item": descItem,
          "Valor Unitário (R$)": valEstimadoNum,
          Unidade: unMedidaItem || "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }

      const chaveCompraDedup = `${cnpj}|${anoC}|${seqCompra}|${numItemStr}`;
      if (chavesDedupCompraItem.has(chaveCompraDedup)) {
        descartados.push({
          Nível: "Item",
          "Motivo do Descarte":
            "item duplicado por (CNPJ, nº da ata/compra, nº do item) — Regra R6",
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": numItemStr,
          "Descrição do Objeto / Item": descItem,
          "Valor Unitário (R$)": valEstimadoNum,
          Unidade: unMedidaItem || "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }

      const sitItemNome = String(itemObj.situacaoCompraItemNome || "")
        .trim()
        .toLowerCase();
      if (
        itemObj.temResultado === false ||
        (sitItemNome && sitItemNome !== "homologado")
      ) {
        descartados.push({
          Nível: "Item",
          "Motivo do Descarte":
            "item sem resultado homologado/preço registrado na API do PNCP (R5)",
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": numItemStr,
          "Descrição do Objeto / Item": descItem,
          "Valor Unitário (R$)": null,
          Unidade: unMedidaItem || "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }

      if (aderenciaItem === "B") {
        const eleitosBAta = itensBPermitidosPorCompra.get(
          `${cnpj}|${anoC}|${seqCompra}`
        );
        if (eleitosBAta && !eleitosBAta.has(numItemStr)) {
          descartados.push({
            Nível: "Item",
            "Motivo do Descarte":
              "descartado pela Regra R6 (no máximo 1 item B por ata; mantido item de menor valor/maior aderência da mesma ata)",
            "Nº da ARP / Controle PNCP": numControleAta,
            "Órgão Gerenciador/UF": orgaoUfStr,
            Esfera: esferaNorm,
            Município: munS || "-",
            "Nº do Item/Lote": numItemStr,
            "Descrição do Objeto / Item": descItem,
            "Valor Unitário (R$)": valEstimadoNum,
            Unidade: unMedidaItem || "-",
            "Data de Assinatura": formatarDataBr(dtAssS),
            "Vigência da Ata": vigenciaStrS,
            "Situação da Ata": situacaoAtaS,
            "Link no PNCP": linkPncp,
          });
          continue;
        }
      }

      const resultados = await client.obterResultadosItem(
        cnpj,
        anoC,
        seqCompra,
        numItemStr
      );
      if (resultados.length === 0) {
        descartados.push({
          Nível: "Item",
          "Motivo do Descarte":
            "item sem resultado homologado/preço registrado na API do PNCP (R5)",
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": numItemStr,
          "Descrição do Objeto / Item": descItem,
          "Valor Unitário (R$)": null,
          Unidade: unMedidaItem || "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }

      const ehDesconto = params.criterioClassificacao === "maior_desconto";
      let melhorRes: Record<string, unknown> | null = null;
      let menorValRes: number | null = null;
      let taxaDescontoCalculada: number | null = null;
      let motivoFalhaRes = ehDesconto
        ? "item sem resultado homologado ativo no PNCP"
        : "preço unitário homologado ausente ou <= 0 (R5)";

      if (ehDesconto) {
        // No critério de Maior Desconto:
        // Localiza qualquer resultado ativo/homologado
        for (const r of resultados) {
          const sitResNome = String(
            r.situacaoCompraItemResultadoNome || ""
          ).toLowerCase();
          if (r.dataCancelamento || sitResNome.startsWith("cancel")) {
            motivoFalhaRes = "resultado homologado cancelado no PNCP";
            continue;
          }
          melhorRes = r;
          break;
        }

        if (melhorRes) {
          const chaveAtaAtual = `${cnpj}|${anoC}|${seqCompra}|${seqAta}`;
          if (cacheTaxaDescontoPorAta.has(chaveAtaAtual)) {
            taxaDescontoCalculada = cacheTaxaDescontoPorAta.get(chaveAtaAtual)!;
          } else {
            // Camada 1: percentualDesconto vindo direto da API PNCP se preenchido
            const percApi = Number(melhorRes.percentualDesconto);
            if (Number.isFinite(percApi) && percApi > 0) {
              taxaDescontoCalculada = Math.round(percApi * 10000) / 10000;
            }

            // Camada 2: Metadados textuais da compra/item/ata
            if (taxaDescontoCalculada === null) {
              const textosParaBusca = [
                infCompItem,
                descItem,
                detAta ? String(detAta.objetoAta || "") : "",
                objAtaStr,
              ].filter(Boolean);

              for (const txt of textosParaBusca) {
                const matchTexto = parseTaxaDesconto(txt);
                if (matchTexto) {
                  taxaDescontoCalculada = matchTexto.taxa;
                  break;
                }
              }
            }

            // Camada 3: Inspeção do Arquivo PDF da Ata (/arquivos)
            if (taxaDescontoCalculada === null) {
              let arqs = cacheArquivosPorAta.get(chaveAtaAtual);
              if (!arqs) {
                arqs = await client.obterArquivosAta(cnpj, anoC, seqCompra, seqAta);
                cacheArquivosPorAta.set(chaveAtaAtual, arqs);
              }

              const arqPrincipal =
                arqs.find((a) => /ata|arp/i.test(a.titulo) || /ata/i.test(a.tipo)) ||
                arqs[0];

              if (arqPrincipal && arqPrincipal.url) {
                const pdfBuf = await client.baixarArquivoBuffer(arqPrincipal.url);
                if (pdfBuf) {
                  const matchPdf = extrairTaxaDescontoDePdf(pdfBuf);
                  if (matchPdf) {
                    taxaDescontoCalculada = matchPdf.taxa;
                  }
                }
              }
            }

            // Camada 4: Fallback padrão para 0.00% conforme regra de negócio
            if (taxaDescontoCalculada === null) {
              taxaDescontoCalculada = 0.0;
            }

            cacheTaxaDescontoPorAta.set(chaveAtaAtual, taxaDescontoCalculada);
          }
        }
      } else {
        // Critério padrão: Menor Preço
        for (const r of resultados) {
          const sitResNome = String(
            r.situacaoCompraItemResultadoNome || ""
          ).toLowerCase();
          if (r.dataCancelamento || sitResNome.startsWith("cancel")) {
            motivoFalhaRes = "resultado homologado cancelado no PNCP";
            continue;
          }
          const valNum = Number(r.valorUnitarioHomologado);
          if (!Number.isFinite(valNum) || valNum <= 0) {
            continue;
          }
          if (menorValRes === null || valNum < menorValRes) {
            menorValRes = valNum;
            melhorRes = r;
          }
        }
      }

      if (!melhorRes || (!ehDesconto && menorValRes === null)) {
        descartados.push({
          Nível: "Item",
          "Motivo do Descarte": motivoFalhaRes,
          "Nº da ARP / Controle PNCP": numControleAta,
          "Órgão Gerenciador/UF": orgaoUfStr,
          Esfera: esferaNorm,
          Município: munS || "-",
          "Nº do Item/Lote": numItemStr,
          "Descrição do Objeto / Item": descItem,
          "Valor Unitário (R$)": null,
          Unidade: unMedidaItem || "-",
          "Data de Assinatura": formatarDataBr(dtAssS),
          "Vigência da Ata": vigenciaStrS,
          "Situação da Ata": situacaoAtaS,
          "Link no PNCP": linkPncp,
        });
        continue;
      }

      if (!detAta && (dtAssS === null || dtFimVigS === null)) {
        detAta = await client.obterDetalheAta(cnpj, anoC, seqCompra, seqAta);
      }

      const dtAssFinal =
        detAta && detAta.dataAssinatura
          ? parseDataCalendarioRecife(String(detAta.dataAssinatura))
          : dtAssS;
      const dtIniVigFinal =
        detAta && detAta.dataVigenciaInicio
          ? parseDataCalendarioRecife(String(detAta.dataVigenciaInicio))
          : dtIniVigS;
      const dtFimVigFinal =
        detAta && detAta.dataVigenciaFim
          ? parseDataCalendarioRecife(String(detAta.dataVigenciaFim))
          : dtFimVigS;

      const canceladoFinal = Boolean(
        canceladoS ||
          (detAta && detAta.cancelado === true) ||
          (detAta &&
            detAta.dataCancelamento !== null &&
            detAta.dataCancelamento !== undefined)
      );

      const vigenciaStrFinal = `${formatarDataBr(
        dtIniVigFinal
      )} a ${formatarDataBr(dtFimVigFinal)}`;
      const situacaoFinal = canceladoFinal
        ? `CANCELADA (${situacaoAtaS})`
        : situacaoAtaS;

      const { divergencia: divStatus, mensagem: msgDivStatus } =
        verificarStatusLocal(
          params.statusAta,
          dtIniVigFinal,
          dtFimVigFinal,
          canceladoFinal,
          hojeRecife
        );

      let aderenciaFinal: NivelAderencia = aderenciaItem;
      let motivoFinal = motivoAderencia;
      if (
        aderenciaFinal === "A" &&
        (canceladoFinal || divStatus || dataAusenteB)
      ) {
        aderenciaFinal = "B";
        const extrasB = [
          divStatus ? msgDivStatus : "",
          dataAusenteB ? msgPeriodo : "",
        ].filter(Boolean);
        motivoFinal = `${motivoAderencia} | Revisão manual (B): ${extrasB.join(
          "; "
        )}`;
      }

      const qtdBruta =
        melhorRes.quantidadeHomologada !== null &&
        melhorRes.quantidadeHomologada !== undefined
          ? melhorRes.quantidadeHomologada
          : qtdItemCompra;
      const [quantitativoArpStr, apenasQtdStr] = formatarQuantitativoArp(
        qtdBruta,
        unMedidaItem
      );

      const fornecedorNome = String(
        melhorRes.nomeRazaoSocialFornecedor || ""
      ).trim();
      const fornecedorNi = String(melhorRes.niFornecedor || "").trim();
      const fornecedorFmt =
        formatarFornecedorComDocumento(fornecedorNome, fornecedorNi) || "não informado";
      const fornecedorCnpjFormatado = fornecedorNi
        ? formatarDocumentoIdentificacao(fornecedorNi).numeroFormatado || undefined
        : undefined;

      const rawAdesao =
        detAta &&
        detAta.possibilidadeAdesao !== undefined &&
        detAta.possibilidadeAdesao !== null &&
        detAta.possibilidadeAdesao !== ""
          ? detAta.possibilidadeAdesao
          : ataS?.permite_adesao !== undefined &&
            ataS?.permite_adesao !== null &&
            ataS?.permite_adesao !== ""
          ? ataS.permite_adesao
          : (detAta?.permiteAdesao ?? detAta?.permite_adesao ?? ataS?.possibilidadeAdesao);

      const possibilidadeAdesaoFinal = normalizarPossibilidadeAdesao(rawAdesao);

      const dataInicioVigenciaFinal =
        dtIniVigFinal && formatarDataBr(dtIniVigFinal) !== "não informado"
          ? formatarDataBr(dtIniVigFinal)
          : undefined;

      const [arpLicitacaoStr, idAtaR6] = montarIdentificacaoArpLicitacao(
        ataS,
        detAta,
        null
      );

      const chaveAtaAtual = `${cnpj}|${anoC}|${seqCompra}|${seqAta}`;
      const arqsDestaAta = cacheArquivosPorAta.get(chaveAtaAtual);

      let valorFinal: number;
      let valorOriginal: number | undefined;
      let unidadeOriginal: string | undefined;
      let formulaNormalizacao: string | undefined;
      let unidadeReferencia: string | undefined;
      let normalizado: boolean | undefined;
      let quantitativoPrevistoArpFinal = quantitativoArpStr;

      if (ehDesconto) {
        valorFinal = taxaDescontoCalculada ?? 0;
      } else {
        const qtdHom =
          melhorRes.quantidadeHomologada !== null &&
          melhorRes.quantidadeHomologada !== undefined &&
          Number.isFinite(Number(melhorRes.quantidadeHomologada))
            ? Number(melhorRes.quantidadeHomologada)
            : undefined;

        const resNorm = calcularPrecoNormalizado({
          valorHomologado: menorValRes!,
          quantidadeHomologada: qtdHom,
          descricaoItem: descItem,
          informacaoComplementar: infCompItem,
          unidadeMedidaItem: unMedidaItem,
          quantidadeItem: qtdItemCompraNum,
          modoNormalizacao: modoNormalizacaoEfetivo,
        });

        valorFinal = Math.round(resNorm.valorNormalizado * 10000) / 10000;
        valorOriginal = resNorm.valorOriginal;
        unidadeOriginal = resNorm.unidadeOriginal || unMedidaItem || "não informado";
        formulaNormalizacao = resNorm.formula;
        unidadeReferencia = resNorm.unidadeReferencia;
        normalizado = resNorm.normalizado;
      }

      const ehItemSintetico = Boolean(itemObj._ehItemSinteticoAta);
      const numItemExibicao = ehItemSintetico ? "Item Corporativo" : numItemStr;
      const detalheAderenciaFinal = ehItemSintetico
        ? `${motivoFinal} | Item corporativo da ARP (detalhamento de postos e aditivos nos documentos oficiais anexos)`
        : motivoFinal;

      itensValidosDestaAta.push({
        descricao_objeto: descItem,
        valor_unitario: valorFinal,
        valor_original: valorOriginal,
        unidade_original: unidadeOriginal,
        formula_normalizacao: formulaNormalizacao,
        unidade_referencia: unidadeReferencia,
        normalizado: normalizado,
        quantitativo_previsto_arp: quantitativoPrevistoArpFinal,
        quantidade_numerica_str: apenasQtdStr,
        unidade_fornecimento: unMedidaItem || "não informado",
        numero_arp_licitacao: arpLicitacaoStr,
        id_ata_r6: idAtaR6,
        orgao_gerenciador_uf: orgaoUfStr,
        orgao_nome: orgaoNome,
        uf: ufS,
        municipio_nome: munS || "não informado",
        codigo_ibge: codIbgeS || "não informado",
        fornecedor: fornecedorFmt,
        fornecedor_cnpj: fornecedorCnpjFormatado,
        numero_item_lote: numItemExibicao,
        data_assinatura: formatarDataBr(dtAssFinal),
        vigencia_ata: vigenciaStrFinal,
        data_inicio_vigencia: dataInicioVigenciaFinal,
        data_fim_vigencia: formatarDataBr(dtFimVigFinal),
        situacao_ata: situacaoFinal,
        possibilidade_adesao: possibilidadeAdesaoFinal,
        especificacao_complementar: infCompItem || undefined,
        esfera: esferaNorm,
        tipo_orgao: tipoOrgaoStr,
        cnpj_orgao: cnpj,
        ano_compra: anoC,
        seq_compra: seqCompra,
        seq_ata: seqAta,
        link_ata_pncp: linkPncp,
        link_download_arp: arqsDestaAta && arqsDestaAta.length > 0 ? arqsDestaAta[0].url : linkPncp,
        arquivos_arp: arqsDestaAta,
        aderencia: aderenciaFinal,
        detalhe_aderencia: detalheAderenciaFinal,
        orgao_atende_validade: atendeValidadeSimNao,
        data_hora_consulta: dataHoraConsultaStr,
        escopo_escolhido: params.escopoOrgaos,
        status_escolhido: params.statusAta,
        periodo_aplicado: periodoAplicadoStr,
        termos_usados: termosUsadosStr,
        eh_item_sintetico_ata: ehItemSintetico,
      });
    }

    if (itensValidosDestaAta.length === 0) continue;

    // Regra R6: deduplicação por chave única (CNPJ + ata + nº do item)
    const ehDescontoR6 = params.criterioClassificacao === "maior_desconto";
    const itensDedupAta: ItemCandidato[] = [];
    const ordenadosAta = [...itensValidosDestaAta].sort((a, b) => {
      const ordA = a.aderencia === "A" ? 0 : 1;
      const ordB = b.aderencia === "A" ? 0 : 1;
      if (ordA !== ordB) return ordA - ordB;
      return ehDescontoR6
        ? b.valor_unitario - a.valor_unitario
        : a.valor_unitario - b.valor_unitario;
    });

    for (const it of ordenadosAta) {
      const chaveR6 = `${it.cnpj_orgao}|${it.numero_arp_licitacao}|${it.numero_item_lote}`;
      const chaveCompra = `${it.cnpj_orgao}|${it.ano_compra}|${it.seq_compra}|${it.numero_item_lote}`;
      if (
        chavesDedupAtaItem.has(chaveR6) ||
        chavesDedupCompraItem.has(chaveCompra)
      ) {
        descartados.push({
          Nível: "Item",
          "Motivo do Descarte":
            "item duplicado por (CNPJ, nº da ata/compra, nº do item) — Regra R6",
          "Nº da ARP / Controle PNCP": it.numero_arp_licitacao,
          "Órgão Gerenciador/UF": it.orgao_gerenciador_uf,
          Esfera: it.esfera,
          Município: it.municipio_nome,
          "Nº do Item/Lote": it.numero_item_lote,
          "Descrição do Objeto / Item": it.descricao_objeto,
          "Valor Unitário (R$)": it.valor_unitario,
          Unidade: it.unidade_fornecimento,
          "Data de Assinatura": it.data_assinatura,
          "Vigência da Ata": it.vigencia_ata,
          "Situação da Ata": it.situacao_ata,
          "Link no PNCP": it.link_ata_pncp,
        });
        continue;
      }
      chavesDedupAtaItem.add(chaveR6);
      chavesDedupCompraItem.add(chaveCompra);
      itensDedupAta.push(it);
    }

    if (itensDedupAta.length === 0) continue;

    const itensA = itensDedupAta
      .filter((i) => i.aderencia === "A")
      .sort((a, b) => a.valor_unitario - b.valor_unitario);
    const itensB = itensDedupAta
      .filter((i) => i.aderencia === "B")
      .sort((a, b) => a.valor_unitario - b.valor_unitario);

    if (itensA.length > 0) {
      itensCandidatosAprovados.push(...itensA);
    }

    if (itensB.length > 0) {
      itensCandidatosAprovados.push(...itensB);
    }
  }

  // Enriquecer os top 20 candidatos A e A+B com os links diretos de PDF das ARPs (ARP inicial + Termos Aditivos)
  try {
    const top20AB = selecionarTop20Menores(
      itensCandidatosAprovados,
      true,
      TOP_N_ITENS_JANELA,
      params.criterioClassificacao
    );
    const top20A = selecionarTop20Menores(
      itensCandidatosAprovados,
      false,
      TOP_N_ITENS_JANELA,
      params.criterioClassificacao
    );
    const unicosParaPdf = new Map<string, ItemCandidato>();
    for (const it of [...top20A, ...top20AB]) {
      const chaveAtaArq = `${it.cnpj_orgao}|${it.ano_compra}|${it.seq_compra}|${it.seq_ata}`;
      if (!unicosParaPdf.has(chaveAtaArq)) {
        unicosParaPdf.set(chaveAtaArq, it);
      }
    }
    await client.enriquecerItensComArquivosAta(
      Array.from(unicosParaPdf.values())
    );
    // Propagar arquivos_arp para quaisquer outros itens aprovados da mesma ARP
    for (const it of itensCandidatosAprovados) {
      const chaveAtaArq = `${it.cnpj_orgao}|${it.ano_compra}|${it.seq_compra}|${it.seq_ata}`;
      const ref = unicosParaPdf.get(chaveAtaArq);
      if (ref && ref.arquivos_arp) {
        it.arquivos_arp = ref.arquivos_arp;
        it.link_download_arp = ref.link_download_arp;
      }
    }
  } catch {
    // Segue normalmente se algum endpoint de arquivo oscilar
  }

  progressoCb?.("Consolidação concluída!", 1.0, {
    totalAtasEncontradas: totalAtas,
    atasValidasEscopoPeriodo: atasValidasEscopoPeriodoCount,
    totalItensAvaliados: todosItensAvaliadosCount,
  });

  const resumoDescartes: Record<string, number> = {};
  for (const d of descartados) {
    const mot = d["Motivo do Descarte"];
    let chaveMot = mot;
    if (mot.startsWith("Aderência C")) {
      chaveMot = "Aderência C (não atende aos requisitos ou outro objeto na ata)";
    } else if (mot.includes("Regra R6")) {
      chaveMot = "Regra R6 (item duplicado por CNPJ, ata e nº do item)";
    }
    resumoDescartes[chaveMot] = (resumoDescartes[chaveMot] || 0) + 1;
  }

  const ehDesconto = params.criterioClassificacao === "maior_desconto";

  return {
    momento_consulta: dataHoraConsultaStr,
    escopo_orgaos: params.escopoOrgaos,
    criterio_classificacao: params.criterioClassificacao || "menor_preco",
    modo_normalizacao_escolhido: params.modoNormalizacao || "auto",
    modo_normalizacao_aplicado: modoNormalizacaoEfetivo,
    unidade_referencia_padrao:
      ehDesconto
        ? "%"
        : modoNormalizacaoEfetivo === "posto_mes"
        ? "R$/mês/posto"
        : modoNormalizacaoEfetivo === "veiculo_mes"
        ? "R$/mês/veículo"
        : "R$",
    uf_selecionada: params.ufSelecionada || null,
    regiao_selecionada: params.regiaoSelecionada || null,
    apenas_municipios_bilionarios:
      params.apenasMunicipiosBilionarios !== undefined
        ? Boolean(params.apenasMunicipiosBilionarios)
        : true,
    status_ata: params.statusAta,
    tipo_data_periodo: params.tipoDataPeriodo,
    data_inicial: dtIni,
    data_final: dtFim,
    periodo_aplicado_str: periodoAplicadoStr,
    termos_busca: params.termosBusca,
    requisitos: params.requisitos,
    total_atas_encontradas: totalAtas,
    atas_validas_escopo_periodo: atasValidasEscopoPeriodoCount,
    total_itens_avaliados: todosItensAvaliadosCount,
    conferencias_status_api: conferenciasStatusApi,
    itens_candidatos: itensCandidatosAprovados,
    descartados,
    resumo_descartes: resumoDescartes,
  };
}

export { selecionarTop20Menores } from "@/lib/domain/selection";
