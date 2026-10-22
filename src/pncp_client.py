"""Cliente HTTP de alta performance para consulta à API pública do PNCP com pool keep-alive, paginação paralela e cache em memória/SQLite."""

import hashlib
import json
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from typing import Any, Callable, Dict, List, Optional, Tuple
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.config import (
    BACKOFF_BASE_SECONDS,
    CACHE_DB_PATH,
    DATA_ASSINATURA,
    DATA_PUBLICACAO,
    DATA_VIGENCIA,
    ITEMS_PAGE_SIZE,
    MAX_PARALLEL_WORKERS,
    MAX_RETRIES,
    PAUSE_BETWEEN_REQUESTS_SECONDS,
    PNCP_API_V1_BASE,
    PNCP_APP_ATAS_BASE,
    PNCP_CONSULTA_V1_BASE,
    PNCP_SEARCH_URL,
    REQUEST_TIMEOUT_SECONDS,
    SEARCH_PAGE_SIZE,
    STATUS_NAO_VIGENTES,
    STATUS_TODOS,
    STATUS_TO_API_PARAM,
    STATUS_VIGENTES,
    TZ_RECIFE,
)

# Cache global em memória compartilhado entre execuções na mesma sessão do Streamlit
_GLOBAL_MEM_CACHE: Dict[str, Any] = {}
_GLOBAL_CACHE_LOADED: bool = False
_GLOBAL_LOCK = threading.Lock()


class PNCPClient:
    """
    Cliente responsável exclusivamente por consultar os endpoints oficiais do PNCP
    para Atas de Registro de Preços, Itens e Resultados Homologados.
    Utiliza pool de conexões persistentes (keep-alive) com retry automático no nível
    do socket (`urllib3.Retry`) e cache em memória sincronizado em lote com SQLite.
    """

    def __init__(self, usar_cache: bool = True) -> None:
        self.usar_cache = usar_cache
        self._db_lock = _GLOBAL_LOCK
        self._rate_lock = threading.Lock()
        self._pending_writes: List[Tuple[str, str, str, str, str]] = []
        self._last_request_ts: float = 0.0

        self.session = self._criar_sessao_http()
        self._init_and_load_cache_db()

    @staticmethod
    def _criar_sessao_http() -> requests.Session:
        sess = requests.Session()
        retry_strategy = Retry(
            total=MAX_RETRIES,
            connect=MAX_RETRIES,
            read=1,
            status=2,
            backoff_factor=BACKOFF_BASE_SECONDS,
            status_forcelist=[429, 502, 503, 504],
            allowed_methods=frozenset(["GET"]),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(
            pool_connections=MAX_PARALLEL_WORKERS * 2,
            pool_maxsize=MAX_PARALLEL_WORKERS * 2,
            max_retries=retry_strategy,
        )
        sess.mount("https://", adapter)
        sess.mount("http://", adapter)
        sess.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/130.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "pt-BR,pt;q=0.9",
            }
        )
        return sess

    def _init_and_load_cache_db(self) -> None:
        global _GLOBAL_CACHE_LOADED
        with self._db_lock:
            try:
                with sqlite3.connect(CACHE_DB_PATH, timeout=30) as conn:
                    conn.execute("PRAGMA journal_mode=WAL;")
                    conn.execute("PRAGMA synchronous=NORMAL;")
                    conn.execute(
                        """
                        CREATE TABLE IF NOT EXISTS http_cache (
                            cache_key TEXT PRIMARY KEY,
                            url TEXT NOT NULL,
                            params_json TEXT,
                            response_json TEXT NOT NULL,
                            created_at TEXT NOT NULL
                        )
                        """
                    )
                    if not _GLOBAL_CACHE_LOADED and self.usar_cache:
                        cur = conn.execute(
                            "SELECT cache_key, response_json FROM http_cache"
                        )
                        for k, v in cur.fetchall():
                            try:
                                _GLOBAL_MEM_CACHE[k] = json.loads(v)
                            except Exception:
                                pass
                        _GLOBAL_CACHE_LOADED = True
            except Exception:
                pass

    @staticmethod
    def _gerar_cache_key(url: str, params: Optional[Dict[str, Any]] = None) -> str:
        params_str = json.dumps(params or {}, sort_keys=True, ensure_ascii=False)
        raw = f"{url}?{params_str}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _ler_cache(self, cache_key: str) -> Optional[Any]:
        if not self.usar_cache:
            return None
        return _GLOBAL_MEM_CACHE.get(cache_key)

    def _gravar_cache(
        self,
        cache_key: str,
        url: str,
        params: Optional[Dict[str, Any]],
        dados: Any,
    ) -> None:
        if not self.usar_cache:
            return
        with self._db_lock:
            _GLOBAL_MEM_CACHE[cache_key] = dados
            self._pending_writes.append(
                (
                    cache_key,
                    url,
                    json.dumps(params or {}, sort_keys=True, ensure_ascii=False),
                    json.dumps(dados, ensure_ascii=False),
                    datetime.now(TZ_RECIFE).isoformat(),
                )
            )
            if len(self._pending_writes) >= 40:
                self._flush_cache_locked()

    def flush_cache(self) -> None:
        """Descarrega gravações pendentes do cache em memória para o SQLite em uma única transação."""
        with self._db_lock:
            self._flush_cache_locked()

    def _flush_cache_locked(self) -> None:
        if not self._pending_writes:
            return
        lote = list(self._pending_writes)
        self._pending_writes.clear()
        try:
            with sqlite3.connect(CACHE_DB_PATH, timeout=20) as conn:
                conn.executemany(
                    """
                    INSERT OR REPLACE INTO http_cache
                    (cache_key, url, params_json, response_json, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    lote,
                )
                conn.commit()
        except Exception:
            pass

    def _respeitar_pausa(self) -> None:
        if PAUSE_BETWEEN_REQUESTS_SECONDS <= 0:
            return
        with self._rate_lock:
            agora = time.monotonic()
            decorrido = agora - self._last_request_ts
            if decorrido < PAUSE_BETWEEN_REQUESTS_SECONDS:
                time.sleep(PAUSE_BETWEEN_REQUESTS_SECONDS - decorrido)
            self._last_request_ts = time.monotonic()

    def _get_json(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        usar_cache_nesta_chamada: bool = True,
        ignorar_404: bool = False,
    ) -> Any:
        cache_key = self._gerar_cache_key(url, params)
        if usar_cache_nesta_chamada:
            cached = self._ler_cache(cache_key)
            if cached is not None:
                return cached

        ultimo_erro: Optional[Exception] = None
        for tentativa in range(1, 3):
            try:
                self._respeitar_pausa()
                resp = self.session.get(
                    url,
                    params=params,
                    timeout=(4.0, float(REQUEST_TIMEOUT_SECONDS)),
                )
                if resp.status_code in {400, 404, 500} and ignorar_404:
                    if usar_cache_nesta_chamada:
                        self._gravar_cache(cache_key, url, params, [])
                    return None
                if resp.status_code == 204 or not resp.content:
                    if usar_cache_nesta_chamada:
                        self._gravar_cache(cache_key, url, params, [])
                    return None
                if resp.status_code == 429:
                    time.sleep(0.8 * tentativa)
                    continue
                resp.raise_for_status()
                dados = resp.json()
                if usar_cache_nesta_chamada:
                    self._gravar_cache(cache_key, url, params, dados)
                return dados
            except Exception as exc:
                ultimo_erro = exc
                if tentativa < 2:
                    time.sleep(0.2 * tentativa)

        if ignorar_404:
            if usar_cache_nesta_chamada:
                with self._db_lock:
                    _GLOBAL_MEM_CACHE[cache_key] = []
            return None
        raise RuntimeError(f"Falha ao consultar o PNCP ({url}): {ultimo_erro}")

    @staticmethod
    def montar_parametros_periodo_api(
        tipo_data: str,
        data_inicial: Optional[date],
        data_final: Optional[date],
    ) -> Dict[str, str]:
        """
        Monta os parâmetros de filtro de data suportados nativamente pelo endpoint
        `/api/search/` do PNCP, conforme documentado em `docs/ENDPOINTS.md`.
        """
        params: Dict[str, str] = {}
        dt_ini_str = data_inicial.strftime("%Y-%m-%d") if data_inicial else None
        dt_fim_str = data_final.strftime("%Y-%m-%d") if data_final else None

        if tipo_data == DATA_ASSINATURA:
            if dt_ini_str:
                params["data_assinatura_inicio"] = dt_ini_str
            if dt_fim_str:
                params["data_assinatura_fim"] = dt_fim_str
        elif tipo_data == DATA_PUBLICACAO:
            if dt_ini_str:
                params["data_publicacao_inicio"] = dt_ini_str
            if dt_fim_str:
                params["data_publicacao_fim"] = dt_fim_str
        elif tipo_data == DATA_VIGENCIA:
            if dt_fim_str:
                params["data_inicio_vigencia_fim"] = dt_fim_str

        return params

    def buscar_pagina_atas(
        self,
        termo: str,
        status_ui: str,
        tipo_data: str,
        data_inicial: Optional[date] = None,
        data_final: Optional[date] = None,
        pagina: int = 1,
        tam_pagina: int = SEARCH_PAGE_SIZE,
        usar_cache: bool = True,
        uf_filtro: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Consulta uma página de Atas de Registro de Preços em `/api/search/`."""
        status_api = STATUS_TO_API_PARAM.get(status_ui, "vigente")
        params: Dict[str, Any] = {
            "q": termo,
            "tipos_documento": "ata",
            "ordenacao": "-data",
            "pagina": pagina,
            "tam_pagina": tam_pagina,
            "status": status_api,
        }
        if uf_filtro and uf_filtro.strip():
            params["ufs"] = uf_filtro.strip().upper()
        params.update(
            self.montar_parametros_periodo_api(tipo_data, data_inicial, data_final)
        )
        dados = self._get_json(
            PNCP_SEARCH_URL,
            params=params,
            usar_cache_nesta_chamada=usar_cache,
        )
        if not isinstance(dados, dict):
            return {"items": [], "total": 0}
        return {
            "items": dados.get("items") or [],
            "total": int(dados.get("total") or 0),
            "params_enviados": params,
        }

    def conferir_equacao_status_api(
        self,
        termo: str,
        tipo_data: str,
        data_inicial: Optional[date] = None,
        data_final: Optional[date] = None,
        uf_filtro: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Verifica na API do PNCP que o total de atas em 'Todos' é igual à soma de
        'Vigentes' + 'Não vigentes' para o mesmo termo e período (executado em paralelo).
        """
        status_list = [STATUS_VIGENTES, STATUS_NAO_VIGENTES, STATUS_TODOS]
        resultados_st: Dict[str, int] = {}

        def _fetch_st(st_ui: str) -> Tuple[str, int]:
            r = self.buscar_pagina_atas(
                termo=termo,
                status_ui=st_ui,
                tipo_data=tipo_data,
                data_inicial=data_inicial,
                data_final=data_final,
                pagina=1,
                tam_pagina=1,
                uf_filtro=uf_filtro,
            )
            return st_ui, r["total"]

        with ThreadPoolExecutor(max_workers=3) as ex:
            for st_ui, tot in ex.map(_fetch_st, status_list):
                resultados_st[st_ui] = tot

        tot_vig = resultados_st.get(STATUS_VIGENTES, 0)
        tot_nvig = resultados_st.get(STATUS_NAO_VIGENTES, 0)
        tot_todos = resultados_st.get(STATUS_TODOS, 0)
        soma = tot_vig + tot_nvig

        return {
            "termo": termo,
            "vigentes": tot_vig,
            "nao_vigentes": tot_nvig,
            "soma_vigentes_mais_nao_vigentes": soma,
            "todos": tot_todos,
            "equacao_valida": (tot_todos == soma),
        }

    def buscar_todas_atas_por_termos(
        self,
        termos: List[str],
        status_ui: str,
        tipo_data: str,
        data_inicial: Optional[date] = None,
        data_final: Optional[date] = None,
        progresso_cb: Optional[Callable[[str, float], None]] = None,
        uf_filtro: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Percorre TODAS as páginas de resultados para os termos informados usando paginação paralela,
        unificando as atas sem duplicidade (por `numero_controle_pncp` ou `item_url`).
        """
        atas_por_chave: Dict[str, Dict[str, Any]] = {}
        conferencias_status: List[Dict[str, Any]] = []

        termos_limpos = [t.strip() for t in termos if t and t.strip()]
        if not termos_limpos:
            return [], []

        def _acumular(itens: List[Dict[str, Any]], termo_origem: str) -> None:
            for item in itens:
                chave = (
                    str(item.get("numero_controle_pncp") or "").strip()
                    or str(item.get("item_url") or "").strip()
                    or str(item.get("id") or "").strip()
                )
                if not chave:
                    continue
                if chave not in atas_por_chave:
                    copia = dict(item)
                    copia["_termos_encontrados"] = [termo_origem]
                    atas_por_chave[chave] = copia
                else:
                    if (
                        termo_origem
                        not in atas_por_chave[chave]["_termos_encontrados"]
                    ):
                        atas_por_chave[chave]["_termos_encontrados"].append(
                            termo_origem
                        )

        for idx_t, termo in enumerate(termos_limpos):
            if progresso_cb:
                progresso_cb(
                    f"Consultando PNCP para o termo '{termo}' ({idx_t + 1}/{len(termos_limpos)})...",
                    0.02 + 0.18 * (idx_t / max(1, len(termos_limpos))),
                )

            conf = self.conferir_equacao_status_api(
                termo=termo,
                tipo_data=tipo_data,
                data_inicial=data_inicial,
                data_final=data_final,
                uf_filtro=uf_filtro,
            )
            conferencias_status.append(conf)

            primeira = self.buscar_pagina_atas(
                termo=termo,
                status_ui=status_ui,
                tipo_data=tipo_data,
                data_inicial=data_inicial,
                data_final=data_final,
                pagina=1,
                tam_pagina=SEARCH_PAGE_SIZE,
                uf_filtro=uf_filtro,
            )
            total = min(primeira["total"], 9990)
            _acumular(primeira["items"], termo)

            total_paginas = (total + SEARCH_PAGE_SIZE - 1) // SEARCH_PAGE_SIZE
            if total_paginas > 1:
                paginas_restantes = list(range(2, total_paginas + 1))
                concluidas = 1

                def _baixar_pag(p: int) -> List[Dict[str, Any]]:
                    res_p = self.buscar_pagina_atas(
                        termo=termo,
                        status_ui=status_ui,
                        tipo_data=tipo_data,
                        data_inicial=data_inicial,
                        data_final=data_final,
                        pagina=p,
                        tam_pagina=SEARCH_PAGE_SIZE,
                        uf_filtro=uf_filtro,
                    )
                    return res_p["items"]

                with ThreadPoolExecutor(max_workers=MAX_PARALLEL_WORKERS) as executor:
                    futures = {
                        executor.submit(_baixar_pag, p): p for p in paginas_restantes
                    }
                    for fut in as_completed(futures):
                        concluidas += 1
                        try:
                            itens_p = fut.result()
                            if itens_p:
                                _acumular(itens_p, termo)
                        except Exception:
                            pass
                        if progresso_cb and (
                            concluidas % 3 == 0 or concluidas == total_paginas
                        ):
                            frac = 0.02 + 0.18 * (
                                (idx_t + (concluidas / total_paginas))
                                / max(1, len(termos_limpos))
                            )
                            progresso_cb(
                                f"Termo '{termo}': baixando páginas de atas ({concluidas}/{total_paginas})...",
                                min(0.20, frac),
                            )

        self.flush_cache()
        return list(atas_por_chave.values()), conferencias_status

    @staticmethod
    def extrair_chaves_item_url(
        ata_search_item: Dict[str, Any]
    ) -> Optional[Tuple[str, str, str, str]]:
        """
        Extrai `(cnpj, ano, sequencial_compra, sequencial_ata)` a partir de `item_url`
        (ex.: `"/atas/10565000000192/2024/904/2"`) ou dos campos canônicos do item de busca.
        """
        item_url = str(ata_search_item.get("item_url") or "").strip()
        if item_url.startswith("/atas/"):
            partes = [p for p in item_url.split("/") if p]
            if len(partes) >= 5:
                return partes[1], partes[2], partes[3], partes[4]

        cnpj = str(ata_search_item.get("orgao_cnpj") or "").strip()
        ano = str(ata_search_item.get("ano") or "").strip()
        seq_compra = str(
            ata_search_item.get("numero_sequencial_compra_ata") or ""
        ).strip()
        seq_ata = str(ata_search_item.get("numero_sequencial") or "").strip()
        if cnpj and ano and seq_compra and seq_ata:
            return cnpj, ano, seq_compra, seq_ata

        return None

    @staticmethod
    def montar_link_ata_pncp(
        cnpj: str, ano: str, seq_compra: str, seq_ata: str
    ) -> str:
        """Retorna o link público direto da ata no portal PNCP."""
        return f"{PNCP_APP_ATAS_BASE}/{cnpj}/{ano}/{seq_compra}/{seq_ata}"

    def obter_detalhe_ata(
        self, cnpj: str, ano: str, seq_compra: str, seq_ata: str
    ) -> Optional[Dict[str, Any]]:
        """Consulta `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq_compra}/atas/{seq_ata}`."""
        url = (
            f"{PNCP_API_V1_BASE}/orgaos/{cnpj}/compras/{ano}/{seq_compra}/atas/{seq_ata}"
        )
        dados = self._get_json(url, ignorar_404=True)
        return dados if isinstance(dados, dict) else None

    def obter_arquivos_ata(
        self, cnpj: str, ano: str, seq_compra: str, seq_ata: str
    ) -> List[Dict[str, Any]]:
        """
        Consulta a lista de arquivos/documentos oficiais (PDFs assinados, aditivos etc.)
        da Ata de Registro de Preços no PNCP:
        `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq_compra}/atas/{seq_ata}/arquivos`
        """
        if not (cnpj and ano and seq_compra and seq_ata):
            return []
        url = (
            f"{PNCP_API_V1_BASE}/orgaos/{cnpj}/compras/{ano}/{seq_compra}"
            f"/atas/{seq_ata}/arquivos"
        )
        dados = self._get_json(url, ignorar_404=True)
        if not isinstance(dados, list):
            return []
        arquivos_limpos: List[Dict[str, Any]] = []
        for arq in dados:
            if not isinstance(arq, dict):
                continue
            url_arq = str(arq.get("url") or "").strip()
            if not url_arq:
                seq_doc = arq.get("sequencialDocumento")
                if seq_doc:
                    url_arq = (
                        f"https://pncp.gov.br/pncp-api/v1/orgaos/{cnpj}/compras/"
                        f"{ano}/{seq_compra}/atas/{seq_ata}/arquivos/{seq_doc}"
                    )
            if url_arq:
                arquivos_limpos.append(
                    {
                        "titulo": str(
                            arq.get("titulo")
                            or arq.get("tipoDocumentoNome")
                            or "Arquivo da ARP"
                        ).strip(),
                        "tipo": str(
                            arq.get("tipoDocumentoNome") or "Ata de Registro de Preços"
                        ).strip(),
                        "url": url_arq,
                    }
                )
        return arquivos_limpos

    def enriquecer_itens_com_arquivos_ata(
        self, itens: List[Dict[str, Any]]
    ) -> None:
        """
        Para uma lista de itens (ex.: os itens da janela Top 10 ou selecionados pelo auditor),
        busca em paralelo os links diretos de download dos arquivos PDF das ARPs no PNCP.
        """
        if not itens:
            return

        def _worker_arq(it: Dict[str, Any]) -> None:
            if "arquivos_arp" in it and it["arquivos_arp"] is not None:
                return
            c = str(it.get("cnpj_orgao") or "").strip()
            a = str(it.get("ano_compra") or "").strip()
            sc = str(it.get("seq_compra") or "").strip()
            sa = str(it.get("seq_ata") or "").strip()
            arqs = self.obter_arquivos_ata(c, a, sc, sa)
            it["arquivos_arp"] = arqs
            if arqs:
                it["link_download_arp"] = arqs[0]["url"]
            else:
                it["link_download_arp"] = str(it.get("link_ata_pncp") or "")

        with ThreadPoolExecutor(max_workers=min(10, len(itens))) as executor:
            list(executor.map(_worker_arq, itens))
        self.flush_cache()

    def obter_detalhe_compra(
        self, cnpj: str, ano: str, seq_compra: str
    ) -> Optional[Dict[str, Any]]:
        """Consulta `GET /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq_compra}`."""
        url = f"{PNCP_CONSULTA_V1_BASE}/orgaos/{cnpj}/compras/{ano}/{seq_compra}"
        dados = self._get_json(url, ignorar_404=True)
        return dados if isinstance(dados, dict) else None

    def obter_todos_itens_compra(
        self, cnpj: str, ano: str, seq_compra: str
    ) -> List[Dict[str, Any]]:
        """
        Percorre todas as páginas de itens da compra vinculada à ata:
        `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq_compra}/itens?pagina={p}&tamanhoPagina=500`
        (Aproveita o cache existente de tamanhoPagina=50 caso já tenha sido salvo anteriormente).
        """
        url_itens = f"{PNCP_API_V1_BASE}/orgaos/{cnpj}/compras/{ano}/{seq_compra}/itens"
        todos_itens: List[Dict[str, Any]] = []

        key_50 = self._gerar_cache_key(url_itens, {"pagina": 1, "tamanhoPagina": 50})
        tam_pag = 50 if self._ler_cache(key_50) is not None else ITEMS_PAGE_SIZE

        pag = 1
        while True:
            dados_pag = self._get_json(
                url_itens,
                params={"pagina": pag, "tamanhoPagina": tam_pag},
                ignorar_404=True,
            )
            if not isinstance(dados_pag, list) or not dados_pag:
                break
            todos_itens.extend(dados_pag)
            if len(dados_pag) < tam_pag:
                break
            pag += 1

        return todos_itens

    def obter_resultados_item(
        self, cnpj: str, ano: str, seq_compra: str, numero_item: str
    ) -> List[Dict[str, Any]]:
        """
        Consulta os resultados homologados de um item:
        `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq_compra}/itens/{numeroItem}/resultados`
        """
        url = (
            f"{PNCP_API_V1_BASE}/orgaos/{cnpj}/compras/{ano}/{seq_compra}"
            f"/itens/{numero_item}/resultados"
        )
        dados = self._get_json(url, ignorar_404=True)
        if isinstance(dados, list):
            return dados
        if isinstance(dados, dict):
            return [dados]
        return []

    def pre_carregar_itens_compras(
        self,
        compras_unicas: List[Tuple[str, str, str]],
        progresso_cb: Optional[Callable[[str, float], None]] = None,
    ) -> None:
        """
        Pré-carrega os itens das compras candidatas em paralelo (`MAX_PARALLEL_WORKERS`),
        pulando instantaneamente as que já estão em memória.
        """
        if not compras_unicas:
            return
        total = len(compras_unicas)
        concluidos = 0

        def _worker(chave: Tuple[str, str, str]) -> None:
            c, a, s = chave
            try:
                self.obter_todos_itens_compra(c, a, s)
            except Exception:
                pass

        with ThreadPoolExecutor(max_workers=MAX_PARALLEL_WORKERS) as executor:
            futures = [executor.submit(_worker, ch) for ch in compras_unicas]
            for _ in as_completed(futures):
                concluidos += 1
                if progresso_cb and (concluidos % 5 == 0 or concluidos == total):
                    frac = 0.20 + 0.45 * (concluidos / max(1, total))
                    progresso_cb(
                        f"Abrindo itens das atas candidatas ({concluidos}/{total} processos únicos)...",
                        min(0.65, frac),
                    )
        self.flush_cache()

    def pre_carregar_resultados_e_detalhes(
        self,
        itens_para_resultado: List[Tuple[str, str, str, str]],
        atas_para_detalhe: List[Tuple[str, str, str, str]],
        progresso_cb: Optional[Callable[[str, float], None]] = None,
    ) -> None:
        """
        Busca em paralelo todos os `/resultados` e `/atas/{seq}` apenas para os itens
        que passaram na classificação de aderência (A ou B), eliminando qualquer espera
        sequencial na etapa final de consolidação.
        """
        tarefas_total = len(itens_para_resultado) + len(atas_para_detalhe)
        if tarefas_total == 0:
            return
        concluidos = 0

        def _worker_res(ch: Tuple[str, str, str, str]) -> None:
            c, a, sc, num_i = ch
            try:
                self.obter_resultados_item(c, a, sc, num_i)
            except Exception:
                pass

        def _worker_ata(ch: Tuple[str, str, str, str]) -> None:
            c, a, sc, sa = ch
            try:
                self.obter_detalhe_ata(c, a, sc, sa)
            except Exception:
                pass

        with ThreadPoolExecutor(max_workers=MAX_PARALLEL_WORKERS) as executor:
            futures = [
                executor.submit(_worker_res, ch) for ch in itens_para_resultado
            ] + [executor.submit(_worker_ata, ch) for ch in atas_para_detalhe]
            for _ in as_completed(futures):
                concluidos += 1
                if progresso_cb and (
                    concluidos % 5 == 0 or concluidos == tarefas_total
                ):
                    frac = 0.70 + 0.25 * (concluidos / max(1, tarefas_total))
                    progresso_cb(
                        f"Obtendo preços homologados e detalhes das atas compatíveis ({concluidos}/{tarefas_total})...",
                        min(0.95, frac),
                    )
        self.flush_cache()
