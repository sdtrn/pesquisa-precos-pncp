import crypto from "crypto";
import {
  DADOS_ABERTOS_BASE,
  DATA_ASSINATURA,
  DATA_PUBLICACAO,
  DATA_VIGENCIA,
  ITEMS_PAGE_SIZE,
  MAX_PARALLEL_WORKERS,
  MAX_RETRIES,
  PNCP_API_V1_BASE,
  PNCP_APP_ATAS_BASE,
  PNCP_CONSULTA_V1_BASE,
  PNCP_SEARCH_URL,
  REQUEST_TIMEOUT_MS,
  SEARCH_PAGE_SIZE,
  STATUS_NAO_VIGENTES,
  STATUS_TODOS,
  STATUS_TO_API_PARAM,
  STATUS_VIGENTES,
} from "@/data/constants";
import type { ArquivoArp, ConferenciaStatusApi, ItemCandidato } from "@/lib/domain/types";

// Cache global em memória reutilizado entre invocações na instância Fluid Compute da Vercel
const GLOBAL_MEM_CACHE = new Map<string, { data: unknown; ts: number }>();
const MAX_CACHE_ENTRIES = 6000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 horas

// Cache em memória de resultados homologados (preços e fornecedores)
const GLOBAL_RESULTADOS_HOMOLOGADOS_CACHE = new Map<string, Record<string, unknown>[]>();

// Circuit Breaker para evitar travamento da pipeline quando a API v1 do PNCP estiver em 503
let circuitBreakerApiV1Failures = 0;
let circuitBreakerApiV1TrippedUntil = 0;

function isCircuitBreakerApiV1Open(): boolean {
  return Date.now() < circuitBreakerApiV1TrippedUntil;
}

function recordApiV1Success(): void {
  circuitBreakerApiV1Failures = 0;
}

function recordApiV1Failure(): void {
  circuitBreakerApiV1Failures++;
  if (circuitBreakerApiV1Failures >= 10) {
    // 10 segundos de circuito aberto para a API v1 para não bloquear requisições
    circuitBreakerApiV1TrippedUntil = Date.now() + 10000;
  }
}

function getFromCache(key: string): unknown | undefined {
  const entry = GLOBAL_MEM_CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    GLOBAL_MEM_CACHE.delete(key);
    return undefined;
  }
  return entry.data;
}

function setInCache(key: string, data: unknown): void {
  if (GLOBAL_MEM_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = GLOBAL_MEM_CACHE.keys().next().value;
    if (firstKey) GLOBAL_MEM_CACHE.delete(firstKey);
  }
  GLOBAL_MEM_CACHE.set(key, { data, ts: Date.now() });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let currentIndex = 0;

  async function next(): Promise<void> {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workersCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workersCount }, () => next()));
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PNCPClient {
  private usarCache: boolean;

  constructor(usarCache = true) {
    this.usarCache = usarCache;
  }

  static gerarCacheKey(url: string, params?: Record<string, string | number | undefined>): string {
    const sortedEntries = Object.entries(params || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b));
    const raw = `${url}?${JSON.stringify(sortedEntries)}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  private async getJson(
    url: string,
    params?: Record<string, string | number | undefined>,
    usarCacheNestaChamada = true,
    ignorar404 = false
  ): Promise<unknown> {
    const cacheKey = PNCPClient.gerarCacheKey(url, params);
    if (this.usarCache && usarCacheNestaChamada) {
      const cached = getFromCache(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Se o circuit breaker da API v1 estiver aberto e for uma chamada tolerante a falha, encerra em 0ms
    if (ignorar404 && url.includes(PNCP_API_V1_BASE) && isCircuitBreakerApiV1Open()) {
      return null;
    }

    const urlObj = new URL(url);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && String(v) !== "") {
          urlObj.searchParams.set(k, String(v));
        }
      }
    }
    const fullUrl = urlObj.toString();

    let ultimoErro: unknown = null;
    for (let tentativa = 1; tentativa <= MAX_RETRIES + 1; tentativa++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const resp = await fetch(fullUrl, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if ([400, 404, 500, 502, 503, 504].includes(resp.status) && ignorar404) {
          if (fullUrl.includes(PNCP_API_V1_BASE) && resp.status >= 500) {
            recordApiV1Failure();
          }
          if (this.usarCache && usarCacheNestaChamada) {
            setInCache(cacheKey, []);
          }
          return null;
        }

        if (resp.status === 204) {
          if (this.usarCache && usarCacheNestaChamada) {
            setInCache(cacheKey, []);
          }
          return null;
        }

        if (resp.status === 429) {
          await sleep(600 * tentativa);
          continue;
        }

        if (!resp.ok) {
          if (fullUrl.includes(PNCP_API_V1_BASE) && resp.status >= 500) {
            recordApiV1Failure();
          }
          throw new Error(`HTTP ${resp.status} em ${fullUrl}`);
        }

        if (fullUrl.includes(PNCP_API_V1_BASE)) {
          recordApiV1Success();
        }

        const text = await resp.text();
        if (!text || !text.trim()) {
          if (this.usarCache && usarCacheNestaChamada) {
            setInCache(cacheKey, []);
          }
          return null;
        }

        const dados = JSON.parse(text);
        if (this.usarCache && usarCacheNestaChamada) {
          setInCache(cacheKey, dados);
        }
        return dados;
      } catch (err) {
        clearTimeout(timeoutId);
        ultimoErro = err;
        if (fullUrl.includes(PNCP_API_V1_BASE)) {
          recordApiV1Failure();
        }
        // Se for requisição secundária (ignorar404) e deu timeout ou falha de rede, não insiste para não travar
        if (ignorar404) {
          if (this.usarCache && usarCacheNestaChamada) {
            setInCache(cacheKey, []);
          }
          return null;
        }
        if (tentativa <= MAX_RETRIES) {
          await sleep(200 * tentativa);
        }
      }
    }

    if (ignorar404) {
      if (this.usarCache && usarCacheNestaChamada) {
        setInCache(cacheKey, []);
      }
      return null;
    }

    throw new Error(`Falha ao consultar o PNCP (${url}): ${String(ultimoErro)}`);
  }

  static montarParametrosPeriodoApi(
    tipoData: string,
    dataInicial?: string | null,
    dataFinal?: string | null
  ): Record<string, string> {
    const params: Record<string, string> = {};
    const dtIni = dataInicial?.trim() || "";
    const dtFim = dataFinal?.trim() || "";

    if (tipoData === DATA_ASSINATURA) {
      if (dtIni) params.data_assinatura_inicio = dtIni;
      if (dtFim) params.data_assinatura_fim = dtFim;
    } else if (tipoData === DATA_PUBLICACAO) {
      if (dtIni) params.data_publicacao_inicio = dtIni;
      if (dtFim) params.data_publicacao_fim = dtFim;
    } else if (tipoData === DATA_VIGENCIA) {
      if (dtFim) params.data_inicio_vigencia_fim = dtFim;
    }

    return params;
  }

  /**
   * Normaliza o termo enviado ao endpoint `/api/search/` do PNCP removendo preposições
   * e palavras genéricas de ruído ("aparelho", "ar", "de") que causariam falso-positivos
   * massivos na busca booleana OR do índice do PNCP, preservando 100% do recall real.
   */
  static normalizarTermoParaApiSearch(termo: string): string {
    const limpo = termo
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!limpo) return termo.trim();

    if (/\b(?:ar[\s-]*condicionado|condicionador(?:es)?\s+de\s+ar)\b/.test(limpo)) {
      if (limpo.includes("split") && limpo.includes("inverter")) {
        return "split inverter";
      }
      if (limpo.includes("split")) {
        return "ar condicionado split";
      }
      if (limpo.includes("inverter")) {
        return "ar condicionado inverter";
      }
      return "ar condicionado";
    }

    if (/\bsplit\s+inverter\b/.test(limpo)) {
      return "split inverter";
    }

    if (/\bcondicionado\b/.test(limpo) && !limpo.includes("ar")) {
      return "condicionado";
    }
    if (/\bcondicionador(?:es)?\b/.test(limpo)) {
      return "condicionador";
    }
    if (/^lona(?:\s+(?:plastica|preta|polietileno))+$/.test(limpo)) {
      return "lona";
    }

    const tokensRuido = new Set([
      "de",
      "da",
      "do",
      "das",
      "dos",
      "em",
      "no",
      "na",
      "com",
      "sem",
      "por",
      "para",
      "um",
      "uma",
      "tipo",
      "aparelho",
      "aparelhos",
      "capacidade",
      "potencia",
      "minima",
      "minimo",
    ]);
    const partes = limpo
      .split(" ")
      .filter((p) => p.length >= 2 && !tokensRuido.has(p));

    return partes.length > 0 ? partes.join(" ") : limpo;
  }

  async buscarPaginaAtas(options: {
    termo: string;
    statusUi: string;
    tipoData: string;
    dataInicial?: string | null;
    dataFinal?: string | null;
    pagina?: number;
    tamPagina?: number;
    usarCache?: boolean;
    ufFiltro?: string | null;
  }): Promise<{ items: Record<string, unknown>[]; total: number; paramsEnviados: Record<string, string | number> }> {
    const statusApi = STATUS_TO_API_PARAM[options.statusUi] || "vigente";
    const termoQuery = PNCPClient.normalizarTermoParaApiSearch(options.termo);
    const params: Record<string, string | number> = {
      q: termoQuery,
      tipos_documento: "ata",
      ordenacao: "-data",
      pagina: options.pagina ?? 1,
      tam_pagina: options.tamPagina ?? SEARCH_PAGE_SIZE,
      status: statusApi,
      ...PNCPClient.montarParametrosPeriodoApi(
        options.tipoData,
        options.dataInicial,
        options.dataFinal
      ),
    };

    if (options.ufFiltro && options.ufFiltro.trim()) {
      params.ufs = options.ufFiltro.trim().toUpperCase();
    }

    const dados = (await this.getJson(
      PNCP_SEARCH_URL,
      params,
      options.usarCache ?? true,
      false
    )) as Record<string, unknown> | null;

    if (!dados || typeof dados !== "object") {
      return { items: [], total: 0, paramsEnviados: params };
    }

    const items = Array.isArray(dados.items) ? (dados.items as Record<string, unknown>[]) : [];
    const total = Number(dados.total || 0);
    return { items, total, paramsEnviados: params };
  }

  async conferirEquacaoStatusApi(options: {
    termo: string;
    tipoData: string;
    dataInicial?: string | null;
    dataFinal?: string | null;
    ufFiltro?: string | null;
    statusConhecido?: { statusUi: string; total: number };
  }): Promise<ConferenciaStatusApi> {
    const statusList = [STATUS_VIGENTES, STATUS_NAO_VIGENTES, STATUS_TODOS];
    const resultados = await Promise.all(
      statusList.map(async (stUi) => {
        if (options.statusConhecido && options.statusConhecido.statusUi === stUi) {
          return [stUi, options.statusConhecido.total] as const;
        }
        const r = await this.buscarPaginaAtas({
          termo: options.termo,
          statusUi: stUi,
          tipoData: options.tipoData,
          dataInicial: options.dataInicial,
          dataFinal: options.dataFinal,
          pagina: 1,
          tamPagina: 1,
          ufFiltro: options.ufFiltro,
        });
        return [stUi, r.total] as const;
      })
    );

    const mapa = Object.fromEntries(resultados);
    const totVig = mapa[STATUS_VIGENTES] ?? 0;
    const totNvig = mapa[STATUS_NAO_VIGENTES] ?? 0;
    const totTodos = mapa[STATUS_TODOS] ?? 0;
    const soma = totVig + totNvig;

    return {
      termo: options.termo,
      vigentes: totVig,
      nao_vigentes: totNvig,
      soma_vigentes_mais_nao_vigentes: soma,
      todos: totTodos,
      equacao_valida: totTodos === soma,
    };
  }

  async buscarTodasAtasPorTermos(options: {
    termos: string[];
    statusUi: string;
    tipoData: string;
    dataInicial?: string | null;
    dataFinal?: string | null;
    progressoCb?: (msg: string, frac: number) => void;
    ufFiltro?: string | null;
  }): Promise<{ atas: Record<string, unknown>[]; conferenciasStatus: ConferenciaStatusApi[] }> {
    const atasPorChave = new Map<string, Record<string, unknown>>();
    const conferenciasStatus: ConferenciaStatusApi[] = [];

    const termosLimpos = options.termos.map((t) => t.trim()).filter(Boolean);
    if (termosLimpos.length === 0) {
      return { atas: [], conferenciasStatus: [] };
    }

    const acumular = (itens: Record<string, unknown>[], termoOrigem: string) => {
      for (const item of itens) {
        const chave =
          String(item.numero_controle_pncp || "").trim() ||
          String(item.item_url || "").trim() ||
          String(item.id || "").trim();
        if (!chave) continue;
        const existente = atasPorChave.get(chave);
        if (!existente) {
          atasPorChave.set(chave, {
            ...item,
            _termos_encontrados: [termoOrigem],
          });
        } else {
          const lista = (existente._termos_encontrados as string[]) || [];
          if (!lista.includes(termoOrigem)) {
            lista.push(termoOrigem);
          }
        }
      }
    };

    const queriesNormalizadasJaPaginadas = new Set<string>();

    for (let idxT = 0; idxT < termosLimpos.length; idxT++) {
      const termo = termosLimpos[idxT];
      const queryNorm = PNCPClient.normalizarTermoParaApiSearch(termo);

      options.progressoCb?.(
        `Consultando PNCP para o termo '${termo}' (${idxT + 1}/${termosLimpos.length})...`,
        0.02 + 0.18 * (idxT / Math.max(1, termosLimpos.length))
      );

      const primeira = await this.buscarPaginaAtas({
        termo,
        statusUi: options.statusUi,
        tipoData: options.tipoData,
        dataInicial: options.dataInicial,
        dataFinal: options.dataFinal,
        pagina: 1,
        tamPagina: SEARCH_PAGE_SIZE,
        ufFiltro: options.ufFiltro,
      });

      const conf = await this.conferirEquacaoStatusApi({
        termo,
        tipoData: options.tipoData,
        dataInicial: options.dataInicial,
        dataFinal: options.dataFinal,
        ufFiltro: options.ufFiltro,
        statusConhecido: { statusUi: options.statusUi, total: primeira.total },
      });

      conferenciasStatus.push(conf);
      const total = Math.min(primeira.total, 9990);
      acumular(primeira.items, termo);

      if (queriesNormalizadasJaPaginadas.has(queryNorm)) {
        continue;
      }
      queriesNormalizadasJaPaginadas.add(queryNorm);

      const totalPaginas = Math.ceil(total / SEARCH_PAGE_SIZE);
      if (totalPaginas > 1) {
        const paginasRestantes = Array.from(
          { length: totalPaginas - 1 },
          (_, i) => i + 2
        );
        let concluidas = 1;

        await runWithConcurrency(
          paginasRestantes,
          MAX_PARALLEL_WORKERS,
          async (pag) => {
            try {
              const resP = await this.buscarPaginaAtas({
                termo,
                statusUi: options.statusUi,
                tipoData: options.tipoData,
                dataInicial: options.dataInicial,
                dataFinal: options.dataFinal,
                pagina: pag,
                tamPagina: SEARCH_PAGE_SIZE,
                ufFiltro: options.ufFiltro,
              });
              if (resP.items.length > 0) {
                acumular(resP.items, termo);
              }
            } catch {
              // Ignora falha individual de página secundária mantendo resiliência
            } finally {
              concluidas++;
              if (
                options.progressoCb &&
                (concluidas % 3 === 0 || concluidas === totalPaginas)
              ) {
                const frac =
                  0.02 +
                  0.18 *
                    ((idxT + concluidas / totalPaginas) /
                      Math.max(1, termosLimpos.length));
                options.progressoCb(
                  `Termo '${termo}': baixando páginas de atas (${concluidas}/${totalPaginas})...`,
                  Math.min(0.2, frac)
                );
              }
            }
          }
        );
      }
    }

    return {
      atas: Array.from(atasPorChave.values()),
      conferenciasStatus,
    };
  }

  static extrairChavesItemUrl(
    ataSearchItem: Record<string, unknown>
  ): [string, string, string, string] | null {
    // 1. Tenta extrair a partir do número de controle oficial do PNCP: CNPJ-1-seqCompra/ano-seqAta
    const numControle = String(
      ataSearchItem.numero_controle_pncp || ataSearchItem.numeroControlePNCP || ""
    ).trim();
    const matchControle = numControle.match(
      /^(\d{14})-\d+-(\d+)\/(\d{4})-(\d+)$/
    );
    if (matchControle) {
      const cnpj = matchControle[1];
      const seqCompra = matchControle[2].replace(/^0+/, "") || "0";
      const ano = matchControle[3];
      const seqAta = matchControle[4].replace(/^0+/, "") || "0";
      return [cnpj, ano, seqCompra, seqAta];
    }

    // 2. Tenta extrair a partir do item_url oficial do endpoint de busca: /atas/CNPJ/ANO/seqCompra/seqAta
    const itemUrl = String(ataSearchItem.item_url || ataSearchItem.itemUrl || "").trim();
    if (itemUrl.startsWith("/atas/")) {
      const partes = itemUrl.split("/").filter(Boolean);
      if (partes.length >= 5) {
        return [
          partes[1],
          partes[2],
          partes[3].replace(/^0+/, "") || "0",
          partes[4].replace(/^0+/, "") || "0",
        ];
      }
    }

    // 3. Fallback: campos individuais do registro da API
    const cnpj = String(ataSearchItem.orgao_cnpj || ataSearchItem.orgaoCnpj || "").trim();
    const ano = String(ataSearchItem.ano || ataSearchItem.anoCompra || "").trim();
    const seqCompraBruto = String(
      ataSearchItem.numero_sequencial_compra_ata ||
        ataSearchItem.numeroSequencialCompraAta ||
        ataSearchItem.sequencialCompra ||
        ""
    ).trim();
    const seqAtaBruto = String(
      ataSearchItem.numero_sequencial ||
        ataSearchItem.numeroSequencial ||
        ataSearchItem.sequencialAta ||
        ""
    ).trim();

    if (cnpj && ano && seqCompraBruto && seqAtaBruto) {
      return [
        cnpj,
        ano,
        seqCompraBruto.replace(/^0+/, "") || "0",
        seqAtaBruto.replace(/^0+/, "") || "0",
      ];
    }

    return null;
  }

  static montarLinkAtaPncp(
    cnpj: string,
    ano: string,
    seqCompra: string,
    seqAta: string
  ): string {
    return `${PNCP_APP_ATAS_BASE}/${cnpj}/${ano}/${seqCompra}/${seqAta}`;
  }

  async obterDetalheAta(
    cnpj: string,
    ano: string,
    seqCompra: string,
    seqAta: string
  ): Promise<Record<string, unknown> | null> {
    const url = `${PNCP_API_V1_BASE}/orgaos/${cnpj}/compras/${ano}/${seqCompra}/atas/${seqAta}`;
    const dados = await this.getJson(url, undefined, true, true);
    return dados && typeof dados === "object" && !Array.isArray(dados)
      ? (dados as Record<string, unknown>)
      : null;
  }

  async obterDetalheCompra(
    cnpj: string,
    ano: string,
    seqCompra: string
  ): Promise<Record<string, unknown> | null> {
    const url = `${PNCP_CONSULTA_V1_BASE}/orgaos/${cnpj}/compras/${ano}/${seqCompra}`;
    const dados = await this.getJson(url, undefined, true, true);
    return dados && typeof dados === "object" && !Array.isArray(dados)
      ? (dados as Record<string, unknown>)
      : null;
  }

  async obterTodosItensCompra(
    cnpj: string,
    ano: string,
    seqCompra: string
  ): Promise<Record<string, unknown>[]> {
    const chaveCompra = `${cnpj}|${ano}|${seqCompra}`;
    if (this.usarCache) {
      const cached = getFromCache(`itens_compra_${chaveCompra}`);
      if (Array.isArray(cached) && cached.length > 0) {
        return cached as Record<string, unknown>[];
      }
    }

    // 1. Tenta primeiramente via Dados Abertos (Compras.gov.br) — ultra rápido (~40ms)
    try {
      const seqFormatado = String(seqCompra).padStart(6, "0");
      const codigoCompra = `${cnpj}-1-${seqFormatado}/${ano}`;
      const urlDadosAbertos = `${DADOS_ABERTOS_BASE}/modulo-contratacoes/2.1_consultarItensContratacoes_PNCP_14133_Id?tipo=numeroControlePNCPCompra&codigo=${encodeURIComponent(
        codigoCompra
      )}`;

      const dadosDA = (await this.getJson(
        urlDadosAbertos,
        undefined,
        true,
        true
      )) as Record<string, unknown> | null;

      if (
        dadosDA &&
        typeof dadosDA === "object" &&
        Array.isArray(dadosDA.resultado) &&
        dadosDA.resultado.length > 0
      ) {
        const itensMapeados: Record<string, unknown>[] = [];
        for (const it of dadosDA.resultado as Record<string, unknown>[]) {
          const numItem = Number(it.numeroItemPncp || it.numeroItem || 0);
          const descDet = String(it.descricaodetalhada || "").trim();
          const descRes = String(it.descricaoResumida || "").trim();
          const unMed = String(it.unidadeMedida || "").trim();
          const valEst =
            it.valorUnitarioEstimado !== null &&
            it.valorUnitarioEstimado !== undefined
              ? Number(it.valorUnitarioEstimado)
              : null;
          const valRes =
            it.valorUnitarioResultado !== null &&
            it.valorUnitarioResultado !== undefined
              ? Number(it.valorUnitarioResultado)
              : null;
          const fornecedor = String(it.nomeFornecedor || "").trim();

          const itemFormatado: Record<string, unknown> = {
            numeroItem: numItem,
            descricao: descDet || descRes,
            informacaoComplementar: descRes,
            unidadeMedida: unMed,
            quantidade:
              it.quantidade !== null && it.quantidade !== undefined
                ? Number(it.quantidade)
                : null,
            valorUnitarioEstimado: Number.isFinite(valEst) ? valEst : null,
            temResultado: Boolean(valRes && valRes > 0),
            situacaoCompraItemNome: "Homologado",
          };

          if (valRes && valRes > 0) {
            const resObj = {
              numeroItem: numItem,
              valorUnitarioHomologado: valRes,
              nomeRazaoSocialFornecedor: fornecedor,
              situacaoCompraItemResultadoNome: "Homologado",
            };
            itemFormatado._resultadoHomologado = resObj;
            GLOBAL_RESULTADOS_HOMOLOGADOS_CACHE.set(
              `${chaveCompra}|${numItem}`,
              [resObj]
            );
          }

          itensMapeados.push(itemFormatado);
        }

        if (this.usarCache) {
          setInCache(`itens_compra_${chaveCompra}`, itensMapeados);
        }
        return itensMapeados;
      }
    } catch {
      // Ignora erro em Dados Abertos e recorre ao PNCP oficial
    }

    // 2. Fallback resiliente: endpoint oficial do PNCP (/api/pncp/v1)
    const todosItens: Record<string, unknown>[] = [];
    if (!isCircuitBreakerApiV1Open()) {
      const urlItens = `${PNCP_API_V1_BASE}/orgaos/${cnpj}/compras/${ano}/${seqCompra}/itens`;
      let pag = 1;

      while (true) {
        const dadosPag = await this.getJson(
          urlItens,
          { pagina: pag, tamanhoPagina: ITEMS_PAGE_SIZE },
          true,
          true
        );
        if (!Array.isArray(dadosPag) || dadosPag.length === 0) {
          break;
        }
        todosItens.push(...(dadosPag as Record<string, unknown>[]));
        if (dadosPag.length < ITEMS_PAGE_SIZE || pag >= 4) {
          break;
        }
        pag++;
      }
    }

    // 3. Fallback inteligente quando a API de itens não retorna registros (503, indisponibilidade ou ausência no PNCP)
    if (todosItens.length === 0) {
      try {
        const detCompra = await this.obterDetalheCompra(cnpj, ano, seqCompra);
        if (detCompra && detCompra.objetoCompra) {
          const valHom = Number(detCompra.valorTotalHomologado);
          const valEst = Number(detCompra.valorTotalEstimado);
          const valFinal =
            Number.isFinite(valHom) && valHom > 0
              ? valHom
              : Number.isFinite(valEst) && valEst > 0
              ? valEst
              : null;

          const itemSintetico: Record<string, unknown> = {
            numeroItem: 1,
            descricao: String(detCompra.objetoCompra || "").trim(),
            informacaoComplementar: [
              detCompra.processo ? `Processo: ${detCompra.processo}` : "",
              detCompra.modalidadeNome ? `Modalidade: ${detCompra.modalidadeNome}` : "",
              detCompra.linkSistemaOrigem ? `Sistema Origem: ${detCompra.linkSistemaOrigem}` : "",
            ]
              .filter(Boolean)
              .join(" | "),
            unidadeMedida: "Posto / Mês",
            quantidade: 1,
            valorUnitarioEstimado:
              Number.isFinite(valEst) && valEst > 0 ? valEst : valFinal,
            temResultado: Boolean(valFinal && valFinal > 0),
            situacaoCompraItemNome: "Homologado",
            _ehItemSinteticoAta: true,
          };

          if (valFinal && valFinal > 0) {
            const fornecedorNome = detCompra.processo
              ? `Detentoras da ARP (Processo ${detCompra.processo})`
              : "Detentoras da ARP (consulte documento oficial)";
            const resObj = {
              numeroItem: 1,
              valorUnitarioHomologado: valFinal,
              nomeRazaoSocialFornecedor: fornecedorNome,
              situacaoCompraItemResultadoNome: "Homologado",
            };
            itemSintetico._resultadoHomologado = resObj;
            GLOBAL_RESULTADOS_HOMOLOGADOS_CACHE.set(
              `${chaveCompra}|1`,
              [resObj]
            );
          }

          todosItens.push(itemSintetico);
        }
      } catch {
        // Ignora falha de detalhe
      }
    }

    if (this.usarCache && todosItens.length > 0) {
      setInCache(`itens_compra_${chaveCompra}`, todosItens);
    }

    return todosItens;
  }

  async obterResultadosItem(
    cnpj: string,
    ano: string,
    seqCompra: string,
    numeroItem: string
  ): Promise<Record<string, unknown>[]> {
    const chave = `${cnpj}|${ano}|${seqCompra}|${numeroItem}`;
    const cachedResultado = GLOBAL_RESULTADOS_HOMOLOGADOS_CACHE.get(chave);
    if (cachedResultado && cachedResultado.length > 0) {
      return cachedResultado;
    }

    if (isCircuitBreakerApiV1Open()) {
      return [];
    }

    const url = `${PNCP_API_V1_BASE}/orgaos/${cnpj}/compras/${ano}/${seqCompra}/itens/${numeroItem}/resultados`;
    const dados = await this.getJson(url, undefined, true, true);
    if (Array.isArray(dados)) {
      if (dados.length > 0) {
        GLOBAL_RESULTADOS_HOMOLOGADOS_CACHE.set(chave, dados as Record<string, unknown>[]);
      }
      return dados as Record<string, unknown>[];
    }
    if (dados && typeof dados === "object") {
      const arr = [dados as Record<string, unknown>];
      GLOBAL_RESULTADOS_HOMOLOGADOS_CACHE.set(chave, arr);
      return arr;
    }
    return [];
  }

  async obterArquivosAta(
    cnpj: string,
    ano: string,
    seqCompra: string,
    seqAta: string
  ): Promise<ArquivoArp[]> {
    if (!(cnpj && ano && seqCompra && seqAta)) {
      return [];
    }
    const url = `${PNCP_API_V1_BASE}/orgaos/${cnpj}/compras/${ano}/${seqCompra}/atas/${seqAta}/arquivos`;
    const dados = await this.getJson(url, undefined, true, true);
    if (!Array.isArray(dados)) {
      return [];
    }

    const itensBrutos = dados.filter(
      (arq): arq is Record<string, unknown> =>
        Boolean(arq && typeof arq === "object" && (arq as Record<string, unknown>).statusAtivo !== false)
    );

    // Ordenar pelo sequencialDocumento crescente para garantir que a ARP Inicial venha primeiro
    // e eventuais Termos Aditivos / Apostilamentos / Prorrogações venham na sequência cronológica
    itensBrutos.sort((a, b) => {
      const seqA = Number(a.sequencialDocumento || 0);
      const seqB = Number(b.sequencialDocumento || 0);
      if (seqA && seqB && seqA !== seqB) return seqA - seqB;
      return 0;
    });

    const regexAditivo =
      /aditiv|prorroga|apostil|renova|reajust|repactua|altera|errata|retifica/i;

    const arquivosLimpos: ArquivoArp[] = [];
    for (let idx = 0; idx < itensBrutos.length; idx++) {
      const a = itensBrutos[idx];
      const seqDoc = Number(a.sequencialDocumento || idx + 1);
      let urlArq = String(a.url || a.uri || "").trim();
      if (!urlArq && a.sequencialDocumento) {
        urlArq = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seqCompra}/atas/${seqAta}/arquivos/${a.sequencialDocumento}`;
      } else if (urlArq.startsWith("/")) {
        urlArq = `https://pncp.gov.br${urlArq}`;
      }
      if (urlArq) {
        const tipoStr = String(
          a.tipoDocumentoNome || "Ata de Registro de Preços"
        ).trim();
        const tituloBruto = String(
          a.titulo || a.tipoDocumentoNome || `Arquivo ${seqDoc}`
        ).trim();
        const ehAditivo =
          regexAditivo.test(tipoStr) ||
          regexAditivo.test(tituloBruto) ||
          idx > 0;
        const dtPub = String(
          a.dataPublicacaoPncp || a.dataInclusao || ""
        ).trim();

        arquivosLimpos.push({
          titulo: tituloBruto,
          tipo: tipoStr,
          url: urlArq,
          sequencial: seqDoc,
          dataPublicacao: dtPub || undefined,
          ehTermoAditivo: ehAditivo,
        });
      }
    }
    return arquivosLimpos;
  }

  async enriquecerItensComArquivosAta(itens: ItemCandidato[]): Promise<void> {
    if (!itens || itens.length === 0) return;
    await runWithConcurrency(
      itens,
      Math.min(MAX_PARALLEL_WORKERS, itens.length),
      async (it) => {
        if (Array.isArray(it.arquivos_arp) && it.arquivos_arp.length > 0) {
          return;
        }
        const c = String(it.cnpj_orgao || "").trim();
        const a = String(it.ano_compra || "").trim();
        const sc = String(it.seq_compra || "").trim();
        const sa = String(it.seq_ata || "").trim();
        try {
          const arqs = await this.obterArquivosAta(c, a, sc, sa);
          it.arquivos_arp = arqs;
          it.link_download_arp =
            arqs.length > 0 ? arqs[0].url : String(it.link_ata_pncp || "");
        } catch {
          it.arquivos_arp = [];
          it.link_download_arp = String(it.link_ata_pncp || "");
        }
      }
    );
  }

  async preCarregarItensCompras(
    comprasUnicas: Array<[string, string, string]>,
    progressoCb?: (msg: string, frac: number) => void
  ): Promise<void> {
    if (comprasUnicas.length === 0) return;
    const total = comprasUnicas.length;
    let concluidos = 0;

    await runWithConcurrency(
      comprasUnicas,
      MAX_PARALLEL_WORKERS,
      async ([c, a, s]) => {
        try {
          await this.obterTodosItensCompra(c, a, s);
        } catch {
          // Ignora falha individual
        } finally {
          concluidos++;
          if (
            progressoCb &&
            (concluidos % 4 === 0 || concluidos === total)
          ) {
            const frac = 0.2 + 0.45 * (concluidos / Math.max(1, total));
            progressoCb(
              `Abrindo itens das atas candidatas (${concluidos}/${total} processos únicos)...`,
              Math.min(0.65, frac)
            );
          }
        }
      }
    );
  }

  async preCarregarResultadosEDetalhes(
    itensParaResultado: Array<[string, string, string, string]>,
    atasParaDetalhe: Array<[string, string, string, string]>,
    progressoCb?: (msg: string, frac: number) => void
  ): Promise<void> {
    const tarefas: Array<() => Promise<void>> = [
      ...itensParaResultado.map(
        ([c, a, sc, numI]) =>
          async () => {
            try {
              await this.obterResultadosItem(c, a, sc, numI);
            } catch {
              // Ignora
            }
          }
      ),
      ...atasParaDetalhe.map(
        ([c, a, sc, sa]) =>
          async () => {
            try {
              await this.obterDetalheAta(c, a, sc, sa);
            } catch {
              // Ignora
            }
          }
      ),
    ];

    const tarefasTotal = tarefas.length;
    if (tarefasTotal === 0) return;
    let concluidos = 0;

    await runWithConcurrency(tarefas, MAX_PARALLEL_WORKERS, async (fn) => {
      await fn();
      concluidos++;
      if (
        progressoCb &&
        (concluidos % 5 === 0 || concluidos === tarefasTotal)
      ) {
        const frac = 0.7 + 0.22 * (concluidos / Math.max(1, tarefasTotal));
        progressoCb(
          `Obtendo preços homologados e detalhes das atas compatíveis (${concluidos}/${tarefasTotal})...`,
          Math.min(0.92, frac)
        );
      }
    });
  }

  /**
   * Baixa o conteúdo binário de um arquivo oficial do PNCP (ex: PDF da Ata)
   * em memória com cabeçalhos de navegador e cache automático.
   */
  async baixarArquivoBuffer(url: string, timeoutMs = 25000): Promise<Buffer | null> {
    if (!url || typeof url !== "string") return null;
    const cacheKey = `buffer_${url}`;
    if (this.usarCache) {
      const cached = getFromCache(cacheKey);
      if (Buffer.isBuffer(cached)) {
        return cached;
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/pdf, application/octet-stream, */*",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return null;
      }

      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (this.usarCache && buf.length > 0) {
        if (buf.length <= 10 * 1024 * 1024) {
          setInCache(cacheKey, buf);
        }
      }
      return buf;
    } catch {
      return null;
    }
  }
}
