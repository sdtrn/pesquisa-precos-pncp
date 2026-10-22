"""Pipeline completo de avaliação de Atas de Registro de Preços e Itens do PNCP."""

import html
import json
import re
from datetime import date, datetime
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from src.config import (
    DATA_ASSINATURA,
    DATA_PUBLICACAO,
    DATA_VIGENCIA,
    DIVERGENCIAS_LOG_PATH,
    ESCOPO_PE_RECIFE,
    ESCOPO_POR_ESTADO,
    ESCOPO_TODOS,
    ESCOPO_VALIDADE,
    STATUS_NAO_VIGENTES,
    STATUS_TODOS,
    STATUS_VIGENTES,
    TOP_N_ITENS_JANELA,
    TZ_RECIFE,
)
from src.municipios import ValidadorMunicipios
from src.parser_requisitos import avaliar_aderencia_item, sem_acentos_minusculo
from src.pncp_client import PNCPClient


def limpar_texto_exibicao(valor: Any) -> str:
    """
    Remove caracteres de controle invisíveis ilegais no Excel XML (`IllegalCharacterError`)
    e limpa tags HTML brutas (`<p>`, `<br>`, `<strong>`, `&nbsp;`) vindas do PNCP.
    """
    if valor is None:
        return ""
    s = str(valor)
    if not s:
        return ""
    s = html.unescape(s)
    s = re.sub(r"</?(?:p|br|strong|b|i|em|u|span|div|ul|ol|li|font|table|tr|td|th)\b[^>]*>", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_data_calendario_recife(valor: Optional[str]) -> Optional[date]:
    """
    Converte uma string de data ou data/hora do PNCP para `datetime.date` no calendário
    do fuso `America/Recife`, sem deslocar um dia por causa de UTC.
    """
    if not valor or not isinstance(valor, str):
        return None
    s = valor.strip()
    if not s:
        return None

    # Caso 1: Data pura YYYY-MM-DD (10 caracteres)
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        try:
            return date(int(s[0:4]), int(s[5:7]), int(s[8:10]))
        except ValueError:
            return None

    # Caso 2: Timestamp ISO-8601 (ex.: "2025-11-05T16:09:30.442963" ou com offset)
    try:
        # Python 3.11+ lida com frações de segundo arbitrárias em fromisoformat
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        # Trunca nanosegundos (> 6 dígitos após o ponto) se existirem (ex.: ".891311430")
        if "." in s:
            partes = s.split(".")
            frac = partes[1]
            tz_part = ""
            for sep in ["+", "-"]:
                if sep in frac:
                    idx = frac.index(sep)
                    tz_part = frac[idx:]
                    frac = frac[:idx]
                    break
            frac = frac[:6]
            s = f"{partes[0]}.{frac}{tz_part}"

        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt_recife = dt.astimezone(TZ_RECIFE)
            return dt_recife.date()
        # Timestamps sem timezone no PNCP já estão no horário oficial de Brasília/Recife (UTC-3)
        return dt.replace(tzinfo=TZ_RECIFE).date()
    except Exception:
        # Fallback seguro para os primeiros 10 caracteres YYYY-MM-DD se presentes
        if len(s) >= 10 and s[4] == "-" and s[7] == "-":
            try:
                return date(int(s[0:4]), int(s[5:7]), int(s[8:10]))
            except ValueError:
                return None
    return None


def formatar_data_br(dt: Optional[date]) -> str:
    """Formata um `date` para `DD/MM/AAAA` ou retorna `'não informado'`."""
    if dt is None:
        return "não informado"
    return dt.strftime("%d/%m/%Y")


def formatar_quantitativo_arp(
    quantidade: Any, unidade: Optional[str]
) -> Tuple[str, str]:
    """
    Formata o 'Quantitativo previsto na ARP' com a unidade (ex.: '120 rolo' ou '5250 UNIDADE').
    Se a API não informar, retorna 'não informado'; nunca estima.
    Retorna `(quantitativo_com_unidade, texto_apenas_quantidade)`.
    """
    if quantidade is None or str(quantidade).strip() == "":
        return "não informado", "não informado"
    try:
        val = float(quantidade)
        if val <= 0:
            return "não informado", "não informado"
        if abs(val - round(val)) < 1e-5:
            qtd_str = f"{int(round(val))}"
        else:
            qtd_str = f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "não informado", "não informado"

    un_str = (unidade or "").strip()
    if un_str:
        return f"{qtd_str} {un_str}", qtd_str
    return qtd_str, qtd_str


def registrar_divergencia_log(contexto: str, detalhes: Dict[str, Any]) -> None:
    """Registra no log JSONL qualquer divergência entre o filtro da API e a conferência local."""
    registro = {
        "timestamp": datetime.now(TZ_RECIFE).isoformat(),
        "contexto": contexto,
        "detalhes": detalhes,
    }
    with open(DIVERGENCIAS_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro, ensure_ascii=False) + "\n")


def verificar_periodo_local(
    tipo_data: str,
    data_inicial: Optional[date],
    data_final: Optional[date],
    dt_assinatura: Optional[date],
    dt_publicacao: Optional[date],
    dt_ini_vigencia: Optional[date],
    dt_fim_vigencia: Optional[date],
) -> Tuple[bool, bool, str]:
    """
    Verifica localmente se a ata cumpre o filtro de período no calendário `America/Recife`.
    Retorna `(dentro_do_periodo, requer_revisao_b_por_data_ausente, detalhe_motivo)`.
    """
    if data_inicial is None and data_final is None:
        return True, False, "Sem restrição de período"

    if tipo_data == DATA_ASSINATURA:
        if dt_assinatura is None:
            return (
                True,
                True,
                "Data de assinatura ausente na API (marcado como B para revisão manual)",
            )
        if data_inicial and dt_assinatura < data_inicial:
            return False, False, "fora do período"
        if data_final and dt_assinatura > data_final:
            return False, False, "fora do período"
        return True, False, f"Assinatura em {formatar_data_br(dt_assinatura)}"

    if tipo_data == DATA_PUBLICACAO:
        if dt_publicacao is None:
            return (
                True,
                True,
                "Data de publicação ausente na API (marcado como B para revisão manual)",
            )
        if data_inicial and dt_publicacao < data_inicial:
            return False, False, "fora do período"
        if data_final and dt_publicacao > data_final:
            return False, False, "fora do período"
        return True, False, f"Publicação em {formatar_data_br(dt_publicacao)}"

    if tipo_data == DATA_VIGENCIA:
        # A ata entra se tiver pelo menos um dia de vigência dentro do período:
        # [dt_ini_vigencia, dt_fim_vigencia] intersecta [data_inicial, data_final]
        if dt_ini_vigencia is None and dt_fim_vigencia is None:
            return (
                True,
                True,
                "Datas de vigência ausentes na API (marcado como B para revisão manual)",
            )
        if data_inicial and dt_fim_vigencia is not None and dt_fim_vigencia < data_inicial:
            return False, False, "fora do período"
        if data_final and dt_ini_vigencia is not None and dt_ini_vigencia > data_final:
            return False, False, "fora do período"
        return (
            True,
            False,
            f"Vigência {formatar_data_br(dt_ini_vigencia)} a {formatar_data_br(dt_fim_vigencia)}",
        )

    return True, False, "Período verificado"


def verificar_status_local(
    status_ui: str,
    dt_ini_vigencia: Optional[date],
    dt_fim_vigencia: Optional[date],
    cancelado: bool,
    hoje_recife: date,
) -> Tuple[bool, str]:
    """
    Confere localmente o status de vigência da ata no calendário `America/Recife`.
    Se a API retornou a ata sob determinado status e a conferência local divergir,
    retorna `(True, mensagem_divergencia)` para marcar o item como B (revisão manual)
    e registrar no log, conforme regra do prompt.
    """
    if cancelado:
        return True, "Ata sinalizada como CANCELADA na API (revisão manual B - R4)"

    if status_ui == STATUS_TODOS:
        return False, "Status Todos"

    if dt_fim_vigencia is None:
        return True, "Data final de vigência não informada para conferência local de status"

    vigente_local = dt_fim_vigencia >= hoje_recife
    if status_ui == STATUS_VIGENTES and not vigente_local:
        return (
            True,
            f"Divergência API vs Local: retornada em 'Vigentes' pela API, mas fim de vigência local ({formatar_data_br(dt_fim_vigencia)}) < hoje ({formatar_data_br(hoje_recife)})",
        )
    if status_ui == STATUS_NAO_VIGENTES and vigente_local:
        return (
            True,
            f"Divergência API vs Local: retornada em 'Não vigentes' pela API, mas fim de vigência local ({formatar_data_br(dt_fim_vigencia)}) >= hoje ({formatar_data_br(hoje_recife)})",
        )

    return False, "Status conferido localmente sem divergência"


def montar_identificacao_arp_licitacao(
    ata_search: Dict[str, Any],
    det_ata: Optional[Dict[str, Any]],
    det_compra: Optional[Dict[str, Any]],
) -> Tuple[str, str]:
    """
    Monta o texto da coluna 'Nº da ARP / Licitação' (ex.: 'ARP nº 12/2026 — Pregão - Eletrônico nº 81/2026')
    e retorna também o identificador único da ata para a Regra R6.
    """
    num_arp = ""
    ano_arp = ""
    if det_ata:
        num_arp = str(det_ata.get("numeroAtaRegistroPreco") or "").strip()
        ano_arp = str(det_ata.get("anoAta") or "").strip()

    if not num_arp:
        titulo = str(ata_search.get("title") or "").strip()
        if titulo:
            num_arp = titulo.replace("Ata nº", "").replace("Ata n°", "").strip()
        else:
            num_arp = str(ata_search.get("numero_sequencial") or "S/N").strip()

    if not ano_arp:
        ano_arp = str(ata_search.get("ano") or "").strip()

    if "/" in num_arp:
        arp_label = f"ARP nº {num_arp}"
    elif ano_arp:
        arp_label = f"ARP nº {num_arp}/{ano_arp}"
    else:
        arp_label = f"ARP nº {num_arp}"

    modalidade = (
        (det_compra.get("modalidadeNome") if det_compra else None)
        or (det_ata.get("modalidadeNome") if det_ata else None)
        or ata_search.get("modalidade_licitacao_nome")
        or ""
    )
    modalidade = str(modalidade).strip()

    num_compra = ""
    ano_compra = str(ata_search.get("ano") or "").strip()
    if det_compra:
        num_compra = str(det_compra.get("numeroCompra") or "").strip()
        if det_compra.get("anoCompra"):
            ano_compra = str(det_compra.get("anoCompra")).strip()

    if not num_compra:
        num_compra = str(ata_search.get("numero_sequencial_compra_ata") or "").strip()

    if modalidade and num_compra:
        if "/" in num_compra or not ano_compra:
            lic_label = f"{modalidade} nº {num_compra}"
        else:
            lic_label = f"{modalidade} nº {num_compra}/{ano_compra}"
        texto_final = f"{arp_label} — {lic_label}"
    elif modalidade:
        texto_final = f"{arp_label} — {modalidade}"
    else:
        texto_final = arp_label

    id_unico_ata = (
        str(ata_search.get("numero_controle_pncp") or "").strip()
        or str(det_ata.get("numeroControlePNCP") if det_ata else "").strip()
        or arp_label
    )
    return texto_final, id_unico_ata


def verificar_escopo_especial_orgao(
    escopo_orgaos: str,
    uf_selecionada: Optional[str],
    esfera_id: str,
    poder_id: str,
    uf_orgao: str,
    municipio_nome: str,
    codigo_ibge: str,
    orgao_nome: str,
    unidade_nome: str,
) -> Tuple[bool, str]:
    """
    Avalia os escopos especiais adicionados:
      - `ESCOPO_POR_ESTADO`: aceita apenas ARPs do Estado (Estadual/Distrital) e dos Municípios
        pertencentes à UF escolhida pelo usuário.
      - `ESCOPO_PE_RECIFE`: aceita apenas ARPs originárias do Governo do Estado de Pernambuco
        (Administração Direta e Indireta estadual do Poder Executivo de PE) e da Prefeitura
        do Município do Recife (Administração Direta e Indireta municipal do Poder Executivo do Recife),
        conforme regra para objetos com dedicação de mão de obra (CCT local).
    """
    esf = (esfera_id or "").strip().upper()
    pod = (poder_id or "").strip().upper()
    uf = (uf_orgao or "").strip().upper()
    mun_norm = sem_acentos_minusculo(municipio_nome or "")
    ibge = (codigo_ibge or "").strip()
    org_norm = sem_acentos_minusculo(f"{orgao_nome or ''} {unidade_nome or ''}")

    if escopo_orgaos == ESCOPO_POR_ESTADO:
        uf_alvo = (uf_selecionada or "PE").strip().upper()
        if not uf or uf != uf_alvo:
            return False, f"órgão de outra UF ({uf or 'não informada'} ≠ {uf_alvo})"
        if not esf:
            return False, "esfera não identificada"
        if esf == "F":
            return (
                False,
                f"órgão federal (escopo restrito ao Estado e municípios de {uf_alvo})",
            )
        if esf in {"E", "M", "D"}:
            return True, f"Órgão estadual/municipal da UF {uf_alvo}"
        return False, "esfera não identificada"

    if escopo_orgaos == ESCOPO_PE_RECIFE:
        if uf != "PE":
            return (
                False,
                f"órgão fora de Pernambuco (UF={uf or 'não informada'}) — escopo restrito ao Governo de PE e Prefeitura do Recife",
            )
        if not esf:
            return False, "esfera não identificada"

        # Descarta órgãos dos Poderes Legislativo e Judiciário ou órgãos autônomos (TCE, TJPE, MPPE, ALEPE, Câmara Municipal)
        termos_nao_executivo = [
            "tribunal de justica",
            "tribunal de contas",
            "assembleia legislativa",
            "camara municipal",
            "ministerio publico",
            "defensoria publica",
        ]
        if pod in {"L", "J"} or any(t in org_norm for t in termos_nao_executivo):
            return (
                False,
                "órgão do Legislativo/Judiciário/Controle Externo (escopo restrito ao Governo do Estado de PE e Prefeitura do Recife)",
            )

        # Caso 1: Governo do Estado de Pernambuco (esfera Estadual em PE, Poder Executivo)
        if esf == "E":
            return True, "Governo do Estado de Pernambuco"

        # Caso 2: Prefeitura do Município do Recife (esfera Municipal em PE, município Recife / IBGE 2611606)
        if esf == "M":
            eh_recife = (ibge == "2611606") or (mun_norm == "recife")
            if eh_recife:
                return True, "Prefeitura do Município do Recife"
            return (
                False,
                f"outro município de PE ({municipio_nome or 'não informado'} ≠ Recife) — escopo restrito ao Governo de PE e Prefeitura do Recife",
            )

        return (
            False,
            "órgão federal (escopo restrito ao Governo do Estado de PE e Prefeitura do Recife)",
        )

    return True, "Escopo padrão"


def executar_pipeline_pesquisa(
    descricao_objeto: str,
    termos_busca: List[str],
    requisitos: List[Dict[str, Any]],
    escopo_orgaos: str,
    status_ata: str,
    tipo_data_periodo: str,
    data_inicial: Optional[date] = None,
    data_final: Optional[date] = None,
    progresso_cb: Optional[Callable[[str, float], None]] = None,
    usar_cache: bool = True,
    uf_selecionada: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executa todo o pipeline de pesquisa no PNCP:
      1. Busca paginada de todas as atas e validação 'Todos = Vigentes + Não vigentes'.
      2. Validação de período local no calendário America/Recife.
      3. Validação do órgão gerenciador (Regras R1, R2, R3 e R7).
      4. Abertura dos itens das atas candidatas, avaliação de aderência (A, B, C) e Regra R5.
      5. Consulta aos resultados homologados (preço unitário > 0, fornecedor e quantitativo previsto).
      6. Aplicação da Regra R6 (no máximo 1 item por ata — o de menor valor que atenda;
         deduplicação por CNPJ, nº da ata, nº do item e prevenção de duplicidade entre atas da mesma compra).
      7. Separação transparente entre itens aprovados (A e B) e aba 'Descartados'.
    """
    momento_consulta = datetime.now(TZ_RECIFE)
    hoje_recife = momento_consulta.date()
    data_hora_consulta_str = momento_consulta.strftime("%d/%m/%Y %H:%M:%S")
    periodo_aplicado_str = (
        f"{tipo_data_periodo}: "
        f"{formatar_data_br(data_inicial) if data_inicial else 'sem início'} a "
        f"{formatar_data_br(data_final) if data_final else 'sem fim'}"
    )
    termos_usados_str = ", ".join(termos_busca)

    client = PNCPClient(usar_cache=usar_cache)
    validador_mun = ValidadorMunicipios()

    uf_filtro_api: Optional[str] = None
    if escopo_orgaos == ESCOPO_POR_ESTADO and uf_selecionada:
        uf_filtro_api = uf_selecionada.strip().upper()
    elif escopo_orgaos == ESCOPO_PE_RECIFE:
        uf_filtro_api = "PE"

    # 1. Busca todas as atas no PNCP (aplicando filtro nativo de UF na API quando pertinente)
    atas_brutas, conferencias_status_api = client.buscar_todas_atas_por_termos(
        termos=termos_busca,
        status_ui=status_ata,
        tipo_data=tipo_data_periodo,
        data_inicial=data_inicial,
        data_final=data_final,
        progresso_cb=progresso_cb,
        uf_filtro=uf_filtro_api,
    )

    descartados: List[Dict[str, Any]] = []
    itens_candidatos_aprovados: List[Dict[str, Any]] = []  # Itens A e B (1 por ata após R6)
    todos_itens_avaliados_count = 0
    atas_validas_escopo_periodo_count = 0

    # Chaves para deduplicação R6: (cnpj, numero_ata, numero_item) e (cnpj, ano_compra, seq_compra, numero_item)
    chaves_dedup_ata_item: Set[Tuple[str, str, str]] = set()
    chaves_dedup_compra_item: Set[Tuple[str, str, str, str]] = set()

    total_atas = len(atas_brutas)

    # 1.1 Se houver atas com esfera ausente ou esfera Municipal sem município/IBGE no resumo,
    # pré-carrega o detalhe dessas poucas atas em paralelo antes da triagem R1/R2/R7
    atas_para_detalhe_triagem: List[Tuple[str, str, str, str]] = []
    for ata_pre in atas_brutas:
        ch_pre = client.extrair_chaves_item_url(ata_pre)
        if not ch_pre:
            continue
        esf_p = str(ata_pre.get("esfera_id") or "").strip().upper()
        mun_p = str(ata_pre.get("municipio_nome") or "").strip()
        ibge_p = str(ata_pre.get("codigo_ibge") or "").strip()
        if not esf_p or (esf_p == "M" and not mun_p and not ibge_p):
            atas_para_detalhe_triagem.append(ch_pre)

    if atas_para_detalhe_triagem:
        client.pre_carregar_resultados_e_detalhes(
            itens_para_resultado=[],
            atas_para_detalhe=atas_para_detalhe_triagem,
            progresso_cb=None,
        )

    # 2. Fase de Triagem Local em Memória (Período no calendário America/Recife + Escopo R1/R2/R7)
    atas_aprovadas_triagem: List[Dict[str, Any]] = []
    compras_para_precarregar: List[Tuple[str, str, str]] = []
    compras_vistas_pre: Set[Tuple[str, str, str]] = set()

    for ata_s in atas_brutas:
        chaves_url = client.extrair_chaves_item_url(ata_s)
        if chaves_url:
            cnpj, ano_c, seq_compra, seq_ata = chaves_url
            link_pncp = client.montar_link_ata_pncp(cnpj, ano_c, seq_compra, seq_ata)
        else:
            cnpj = str(ata_s.get("orgao_cnpj") or "").strip()
            ano_c = str(ata_s.get("ano") or "").strip()
            seq_compra = str(ata_s.get("numero_sequencial_compra_ata") or "").strip()
            seq_ata = str(ata_s.get("numero_sequencial") or "").strip()
            link_pncp = "https://pncp.gov.br/app/atas"

        orgao_nome = str(ata_s.get("orgao_nome") or "").strip()
        unidade_nome = str(ata_s.get("unidade_nome") or "").strip()
        poder_nome = str(ata_s.get("poder_nome") or "").strip()
        tipo_orgao_str = (
            f"{unidade_nome} ({poder_nome})"
            if unidade_nome and poder_nome
            else (unidade_nome or poder_nome or "Órgão Gerenciador")
        )
        uf_s = str(ata_s.get("uf") or "").strip().upper()
        mun_s = str(ata_s.get("municipio_nome") or "").strip()
        cod_ibge_s = str(ata_s.get("codigo_ibge") or "").strip()
        esfera_id_s = str(ata_s.get("esfera_id") or "").strip().upper()
        situacao_ata_s = str(ata_s.get("situacao_nome") or "Divulgada no PNCP").strip()
        cancelado_s = bool(ata_s.get("cancelado") is True)

        dt_ass_s = parse_data_calendario_recife(ata_s.get("data_assinatura"))
        dt_pub_s = parse_data_calendario_recife(ata_s.get("data_publicacao_pncp"))
        dt_ini_vig_s = parse_data_calendario_recife(ata_s.get("data_inicio_vigencia"))
        dt_fim_vig_s = parse_data_calendario_recife(ata_s.get("data_fim_vigencia"))

        vigencia_str_s = (
            f"{formatar_data_br(dt_ini_vig_s)} a {formatar_data_br(dt_fim_vig_s)}"
        )
        orgao_uf_str = f"{orgao_nome}/{uf_s}" if uf_s else orgao_nome
        num_controle_ata = str(
            ata_s.get("numero_controle_pncp") or ata_s.get("title") or ""
        ).strip()

        det_ata_pre: Optional[Dict[str, Any]] = None
        if (not esfera_id_s or (esfera_id_s == "M" and not mun_s and not cod_ibge_s)) and chaves_url:
            det_ata_pre = client.obter_detalhe_ata(cnpj, ano_c, seq_compra, seq_ata)
            if det_ata_pre:
                org_ent = det_ata_pre.get("orgaoEntidade") or {}
                un_org = det_ata_pre.get("unidadeOrgao") or {}
                esfera_id_s = str(org_ent.get("esferaId") or esfera_id_s).strip().upper()
                mun_s = str(un_org.get("municipioNome") or mun_s).strip()
                cod_ibge_s = str(un_org.get("codigoIbge") or cod_ibge_s).strip()
                uf_s = str(un_org.get("ufSigla") or uf_s).strip().upper()
                orgao_uf_str = f"{orgao_nome}/{uf_s}" if uf_s else orgao_nome

        # Avaliação do órgão gerenciador (R1, R2, R7) — executada em AMBOS os escopos
        aval_orgao = validador_mun.avaliar_orgao_gerenciador(
            esfera_id=esfera_id_s,
            uf=uf_s,
            municipio_nome=mun_s,
            codigo_ibge=cod_ibge_s,
            payload_bruto_para_log=ata_s if escopo_orgaos == ESCOPO_VALIDADE else None,
        )
        atende_validade_bool = aval_orgao["atende_criterio_validade"]
        atende_validade_sim_nao = "Sim" if atende_validade_bool else "Não"
        esfera_norm = aval_orgao["esfera_normalizada"]

        # Conferência local de período (no calendário America/Recife)
        dentro_periodo, data_ausente_b, msg_periodo = verificar_periodo_local(
            tipo_data=tipo_data_periodo,
            data_inicial=data_inicial,
            data_final=data_final,
            dt_assinatura=dt_ass_s,
            dt_publicacao=dt_pub_s,
            dt_ini_vigencia=dt_ini_vig_s,
            dt_fim_vigencia=dt_fim_vig_s,
        )
        if not dentro_periodo:
            registrar_divergencia_log(
                "ata_fora_do_periodo_na_conferencia_local",
                {
                    "numero_controle_pncp": num_controle_ata,
                    "tipo_data": tipo_data_periodo,
                    "data_inicial": str(data_inicial),
                    "data_final": str(data_final),
                    "data_assinatura": ata_s.get("data_assinatura"),
                    "data_publicacao_pncp": ata_s.get("data_publicacao_pncp"),
                    "data_inicio_vigencia": ata_s.get("data_inicio_vigencia"),
                    "data_fim_vigencia": ata_s.get("data_fim_vigencia"),
                },
            )
            descartados.append(
                {
                    "Nível": "Ata",
                    "Motivo do Descarte": "fora do período",
                    "Nº da ARP / Controle PNCP": num_controle_ata,
                    "Órgão Gerenciador/UF": orgao_uf_str,
                    "Esfera": esfera_norm,
                    "Município": mun_s or "-",
                    "Nº do Item/Lote": "-",
                    "Descrição do Objeto / Item": str(ata_s.get("description") or ""),
                    "Valor Unitário (R$)": None,
                    "Unidade": "-",
                    "Data de Assinatura": formatar_data_br(dt_ass_s),
                    "Vigência da Ata": vigencia_str_s,
                    "Situação da Ata": situacao_ata_s,
                    "Link no PNCP": link_pncp,
                }
            )
            continue

        # No escopo (a) ("Critério de validade"), aplicar Regras R1, R2 e R7
        if escopo_orgaos == ESCOPO_VALIDADE and not atende_validade_bool:
            motivo_orgao = aval_orgao["motivo_descarte_escopo_a"] or "município fora da lista"
            descartados.append(
                {
                    "Nível": "Ata",
                    "Motivo do Descarte": motivo_orgao,
                    "Nº da ARP / Controle PNCP": num_controle_ata,
                    "Órgão Gerenciador/UF": orgao_uf_str,
                    "Esfera": esfera_norm,
                    "Município": mun_s or "-",
                    "Nº do Item/Lote": "-",
                    "Descrição do Objeto / Item": str(ata_s.get("description") or ""),
                    "Valor Unitário (R$)": None,
                    "Unidade": "-",
                    "Data de Assinatura": formatar_data_br(dt_ass_s),
                    "Vigência da Ata": vigencia_str_s,
                    "Situação da Ata": situacao_ata_s,
                    "Link no PNCP": link_pncp,
                }
            )
            continue

        # Nos escopos por Estado (UF) ou Governo de PE / Prefeitura do Recife, aplicar filtro específico
        if escopo_orgaos in {ESCOPO_POR_ESTADO, ESCOPO_PE_RECIFE}:
            poder_id_s = str(ata_s.get("poder_id") or "").strip().upper()
            ok_esp, motivo_esp = verificar_escopo_especial_orgao(
                escopo_orgaos=escopo_orgaos,
                uf_selecionada=uf_selecionada,
                esfera_id=esfera_id_s,
                poder_id=poder_id_s,
                uf_orgao=uf_s,
                municipio_nome=mun_s,
                codigo_ibge=cod_ibge_s,
                orgao_nome=orgao_nome,
                unidade_nome=unidade_nome,
            )
            if not ok_esp:
                descartados.append(
                    {
                        "Nível": "Ata",
                        "Motivo do Descarte": motivo_esp,
                        "Nº da ARP / Controle PNCP": num_controle_ata,
                        "Órgão Gerenciador/UF": orgao_uf_str,
                        "Esfera": esfera_norm,
                        "Município": mun_s or "-",
                        "Nº do Item/Lote": "-",
                        "Descrição do Objeto / Item": str(ata_s.get("description") or ""),
                        "Valor Unitário (R$)": None,
                        "Unidade": "-",
                        "Data de Assinatura": formatar_data_br(dt_ass_s),
                        "Vigência da Ata": vigencia_str_s,
                        "Situação da Ata": situacao_ata_s,
                        "Link no PNCP": link_pncp,
                    }
                )
                continue

        if not chaves_url:
            descartados.append(
                {
                    "Nível": "Ata",
                    "Motivo do Descarte": "link/chaves da ata ausentes na API do PNCP",
                    "Nº da ARP / Controle PNCP": num_controle_ata,
                    "Órgão Gerenciador/UF": orgao_uf_str,
                    "Esfera": esfera_norm,
                    "Município": mun_s or "-",
                    "Nº do Item/Lote": "-",
                    "Descrição do Objeto / Item": str(ata_s.get("description") or ""),
                    "Valor Unitário (R$)": None,
                    "Unidade": "-",
                    "Data de Assinatura": formatar_data_br(dt_ass_s),
                    "Vigência da Ata": vigencia_str_s,
                    "Situação da Ata": situacao_ata_s,
                    "Link no PNCP": link_pncp,
                }
            )
            continue

        atas_validas_escopo_periodo_count += 1
        chave_c = (cnpj, ano_c, seq_compra)
        if chave_c not in compras_vistas_pre:
            compras_vistas_pre.add(chave_c)
            compras_para_precarregar.append(chave_c)

        atas_aprovadas_triagem.append(
            {
                "ata_s": ata_s,
                "cnpj": cnpj,
                "ano_c": ano_c,
                "seq_compra": seq_compra,
                "seq_ata": seq_ata,
                "link_pncp": link_pncp,
                "orgao_nome": orgao_nome,
                "tipo_orgao_str": tipo_orgao_str,
                "uf_s": uf_s,
                "mun_s": mun_s,
                "cod_ibge_s": cod_ibge_s,
                "situacao_ata_s": situacao_ata_s,
                "cancelado_s": cancelado_s,
                "dt_ass_s": dt_ass_s,
                "dt_ini_vig_s": dt_ini_vig_s,
                "dt_fim_vig_s": dt_fim_vig_s,
                "vigencia_str_s": vigencia_str_s,
                "orgao_uf_str": orgao_uf_str,
                "num_controle_ata": num_controle_ata,
                "det_ata_pre": det_ata_pre,
                "atende_validade_sim_nao": atende_validade_sim_nao,
                "esfera_norm": esfera_norm,
                "data_ausente_b": data_ausente_b,
                "msg_periodo": msg_periodo,
            }
        )

    # 3. Pré-carrega em paralelo os itens de todas as compras que passaram na triagem de período e escopo
    client.pre_carregar_itens_compras(compras_para_precarregar, progresso_cb=progresso_cb)

    # 4. Triagem rápida de aderência textual em memória para identificar quais itens (A ou B)
    # precisam de consulta de resultado homologado e detalhe da ata em paralelo
    itens_para_resultado_paralelo: List[Tuple[str, str, str, str]] = []
    atas_para_detalhe_paralelo: List[Tuple[str, str, str, str]] = []
    itens_res_vistos: Set[Tuple[str, str, str, str]] = set()
    atas_det_vistas: Set[Tuple[str, str, str, str]] = set()
    cache_aderencia_por_ata_item: Dict[Tuple[int, str], Dict[str, Any]] = {}
    itens_b_permitidos_por_ata: Dict[int, Set[str]] = {}

    for idx_ctx, ctx in enumerate(atas_aprovadas_triagem):
        cnpj = ctx["cnpj"]
        ano_c = ctx["ano_c"]
        seq_compra = ctx["seq_compra"]
        seq_ata = ctx["seq_ata"]
        ata_s = ctx["ata_s"]
        obj_ata_str = str(ata_s.get("description") or "").strip()

        itens_compra = client.obter_todos_itens_compra(cnpj, ano_c, seq_compra)
        if not itens_compra:
            continue

        ata_tem_candidato = False
        candidatos_b_desta_ata: List[Tuple[Tuple[int, float, str], str]] = []

        for item_obj in itens_compra:
            num_item_str = str(item_obj.get("numeroItem") or "").strip()
            desc_item = str(item_obj.get("descricao") or "").strip()
            inf_comp_item = str(item_obj.get("informacaoComplementar") or "").strip()
            un_medida_item = str(item_obj.get("unidadeMedida") or "").strip()

            aval_item = avaliar_aderencia_item(
                descricao_item=desc_item,
                unidade_medida_api=un_medida_item,
                requisitos=requisitos,
                informacao_complementar_item=inf_comp_item,
                objeto_ata=obj_ata_str,
            )
            cache_aderencia_por_ata_item[(idx_ctx, num_item_str)] = aval_item

            if aval_item["aderencia"] == "C":
                continue

            sit_item_nome = str(item_obj.get("situacaoCompraItemNome") or "").strip().lower()
            if item_obj.get("temResultado") is False or (
                sit_item_nome and sit_item_nome not in {"homologado"}
            ):
                continue

            if aval_item["aderencia"] == "A":
                chave_item_res = (cnpj, ano_c, seq_compra, num_item_str)
                if chave_item_res not in itens_res_vistos:
                    itens_res_vistos.add(chave_item_res)
                    itens_para_resultado_paralelo.append(chave_item_res)
                ata_tem_candidato = True
            else:
                val_est = item_obj.get("valorUnitarioEstimado")
                try:
                    v_num = (
                        float(val_est)
                        if val_est is not None and float(val_est) > 0
                        else float("inf")
                    )
                except Exception:
                    v_num = float("inf")
                chave_ord_b = (
                    -len(aval_item.get("atendidos") or []),
                    v_num,
                    num_item_str,
                )
                candidatos_b_desta_ata.append((chave_ord_b, num_item_str))

        # Regra R6: Como cada ata comporta no máximo 1 item B (o de menor valor que atenda),
        # consultamos `/resultados` para os até 2 melhores candidatos B por ata, evitando centenas
        # de chamadas redundantes em atas genéricas com dezenas/centenas de itens B.
        if candidatos_b_desta_ata:
            candidatos_b_desta_ata.sort(key=lambda x: x[0])
            eleitos_b = {num_i for _, num_i in candidatos_b_desta_ata[:2]}
            itens_b_permitidos_por_ata[idx_ctx] = eleitos_b
            for num_i in eleitos_b:
                chave_item_res = (cnpj, ano_c, seq_compra, num_i)
                if chave_item_res not in itens_res_vistos:
                    itens_res_vistos.add(chave_item_res)
                    itens_para_resultado_paralelo.append(chave_item_res)
                ata_tem_candidato = True

        # Só busca o endpoint adicional `/atas/{seq}` se o resumo de `/api/search/` não trouxer
        # as datas essenciais da ata (assinatura e fim de vigência)
        precisa_detalhe_ata = (
            ctx["det_ata_pre"] is None
            and (ctx["dt_ass_s"] is None or ctx["dt_fim_vig_s"] is None)
        )
        if ata_tem_candidato and precisa_detalhe_ata:
            chave_ata_det = (cnpj, ano_c, seq_compra, seq_ata)
            if chave_ata_det not in atas_det_vistas:
                atas_det_vistas.add(chave_ata_det)
                atas_para_detalhe_paralelo.append(chave_ata_det)

    # 4.1 Busca em paralelo todos os resultados homologados e detalhes de atas necessários
    if itens_para_resultado_paralelo or atas_para_detalhe_paralelo:
        client.pre_carregar_resultados_e_detalhes(
            itens_para_resultado=itens_para_resultado_paralelo,
            atas_para_detalhe=atas_para_detalhe_paralelo,
            progresso_cb=progresso_cb,
        )

    # 5. Consolidação final em memória (todas as respostas HTTP já estão no cache em memória)
    total_aprovadas = len(atas_aprovadas_triagem)
    for idx_ctx, ctx in enumerate(atas_aprovadas_triagem):
        if progresso_cb and (idx_ctx % 25 == 0 or idx_ctx == total_aprovadas - 1):
            frac = 0.90 + 0.09 * ((idx_ctx + 1) / max(1, total_aprovadas))
            progresso_cb(
                f"Consolidando ata {idx_ctx + 1} de {total_aprovadas} ({ctx['orgao_nome']})...",
                min(0.99, frac),
            )

        ata_s = ctx["ata_s"]
        cnpj = ctx["cnpj"]
        ano_c = ctx["ano_c"]
        seq_compra = ctx["seq_compra"]
        seq_ata = ctx["seq_ata"]
        link_pncp = ctx["link_pncp"]
        orgao_nome = ctx["orgao_nome"]
        tipo_orgao_str = ctx["tipo_orgao_str"]
        uf_s = ctx["uf_s"]
        mun_s = ctx["mun_s"]
        cod_ibge_s = ctx["cod_ibge_s"]
        situacao_ata_s = ctx["situacao_ata_s"]
        cancelado_s = ctx["cancelado_s"]
        dt_ass_s = ctx["dt_ass_s"]
        dt_ini_vig_s = ctx["dt_ini_vig_s"]
        dt_fim_vig_s = ctx["dt_fim_vig_s"]
        vigencia_str_s = ctx["vigencia_str_s"]
        orgao_uf_str = ctx["orgao_uf_str"]
        num_controle_ata = ctx["num_controle_ata"]
        det_ata_pre = ctx["det_ata_pre"]
        atende_validade_sim_nao = ctx["atende_validade_sim_nao"]
        esfera_norm = ctx["esfera_norm"]
        data_ausente_b = ctx["data_ausente_b"]
        msg_periodo = ctx["msg_periodo"]
        obj_ata_str = str(ata_s.get("description") or "").strip()

        # Abre os itens da compra vinculada à ata (já em cache)
        itens_compra = client.obter_todos_itens_compra(cnpj, ano_c, seq_compra)
        if not itens_compra:
            descartados.append(
                {
                    "Nível": "Ata",
                    "Motivo do Descarte": "ata sem itens cadastrados na API do PNCP",
                    "Nº da ARP / Controle PNCP": num_controle_ata,
                    "Órgão Gerenciador/UF": orgao_uf_str,
                    "Esfera": esfera_norm,
                    "Município": mun_s or "-",
                    "Nº do Item/Lote": "-",
                    "Descrição do Objeto / Item": str(ata_s.get("description") or ""),
                    "Valor Unitário (R$)": None,
                    "Unidade": "-",
                    "Data de Assinatura": formatar_data_br(dt_ass_s),
                    "Vigência da Ata": vigencia_str_s,
                    "Situação da Ata": situacao_ata_s,
                    "Link no PNCP": link_pncp,
                }
            )
            continue

        det_ata: Optional[Dict[str, Any]] = det_ata_pre
        det_compra: Optional[Dict[str, Any]] = None
        itens_validos_desta_ata: List[Dict[str, Any]] = []

        for item_obj in itens_compra:
            todos_itens_avaliados_count += 1
            # Restrição técnica: forçar ITEM/LOTE como texto (string)
            num_item_str = str(item_obj.get("numeroItem") or "").strip()
            desc_item = limpar_texto_exibicao(item_obj.get("descricao"))
            inf_comp_item = limpar_texto_exibicao(item_obj.get("informacaoComplementar"))
            un_medida_item = limpar_texto_exibicao(item_obj.get("unidadeMedida"))
            qtd_item_compra = item_obj.get("quantidade")

            # Usa avaliação de aderência já calculada ou calcula na hora
            aval_item = cache_aderencia_por_ata_item.get((idx_ctx, num_item_str))
            if aval_item is None:
                aval_item = avaliar_aderencia_item(
                    descricao_item=desc_item,
                    unidade_medida_api=un_medida_item,
                    requisitos=requisitos,
                    informacao_complementar_item=inf_comp_item,
                    objeto_ata=obj_ata_str,
                )
            aderencia_item = aval_item["aderencia"]
            motivo_aderencia = aval_item["motivo"]

            if aderencia_item == "C":
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": f"Aderência C — {motivo_aderencia}",
                        "Nº da ARP / Controle PNCP": num_controle_ata,
                        "Órgão Gerenciador/UF": orgao_uf_str,
                        "Esfera": esfera_norm,
                        "Município": mun_s or "-",
                        "Nº do Item/Lote": num_item_str,
                        "Descrição do Objeto / Item": desc_item,
                        "Valor Unitário (R$)": item_obj.get("valorUnitarioEstimado"),
                        "Unidade": un_medida_item or "-",
                        "Data de Assinatura": formatar_data_br(dt_ass_s),
                        "Vigência da Ata": vigencia_str_s,
                        "Situação da Ata": situacao_ata_s,
                        "Link no PNCP": link_pncp,
                    }
                )
                continue

            # Se este mesmo item da mesma compra/licitação já foi incluído via outra ata irmã do mesmo processo (R6)
            if (cnpj, ano_c, seq_compra, num_item_str) in chaves_dedup_compra_item:
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": "item duplicado por (CNPJ, nº da ata/compra, nº do item) — Regra R6",
                        "Nº da ARP / Controle PNCP": num_controle_ata,
                        "Órgão Gerenciador/UF": orgao_uf_str,
                        "Esfera": esfera_norm,
                        "Município": mun_s or "-",
                        "Nº do Item/Lote": num_item_str,
                        "Descrição do Objeto / Item": desc_item,
                        "Valor Unitário (R$)": item_obj.get("valorUnitarioEstimado"),
                        "Unidade": un_medida_item or "-",
                        "Data de Assinatura": formatar_data_br(dt_ass_s),
                        "Vigência da Ata": vigencia_str_s,
                        "Situação da Ata": situacao_ata_s,
                        "Link no PNCP": link_pncp,
                    }
                )
                continue

            # Se a própria listagem do PNCP já indica que o item não tem resultado homologado (R5)
            sit_item_nome = str(item_obj.get("situacaoCompraItemNome") or "").strip().lower()
            if item_obj.get("temResultado") is False or (
                sit_item_nome and sit_item_nome not in {"homologado"}
            ):
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": "item sem resultado homologado/preço registrado na API do PNCP (R5)",
                        "Nº da ARP / Controle PNCP": num_controle_ata,
                        "Órgão Gerenciador/UF": orgao_uf_str,
                        "Esfera": esfera_norm,
                        "Município": mun_s or "-",
                        "Nº do Item/Lote": num_item_str,
                        "Descrição do Objeto / Item": desc_item,
                        "Valor Unitário (R$)": None,
                        "Unidade": un_medida_item or "-",
                        "Data de Assinatura": formatar_data_br(dt_ass_s),
                        "Vigência da Ata": vigencia_str_s,
                        "Situação da Ata": situacao_ata_s,
                        "Link no PNCP": link_pncp,
                    }
                )
                continue

            # Se o item é B e já existem candidatos B melhores/mais baratos na mesma ata (Regra R6: máx 1 item por ata)
            if aderencia_item == "B":
                eleitos_b_ata = itens_b_permitidos_por_ata.get(idx_ctx)
                if eleitos_b_ata is not None and num_item_str not in eleitos_b_ata:
                    descartados.append(
                        {
                            "Nível": "Item",
                            "Motivo do Descarte": "descartado pela Regra R6 (no máximo 1 item B por ata; mantido item de menor valor/maior aderência da mesma ata)",
                            "Nº da ARP / Controle PNCP": num_controle_ata,
                            "Órgão Gerenciador/UF": orgao_uf_str,
                            "Esfera": esfera_norm,
                            "Município": mun_s or "-",
                            "Nº do Item/Lote": num_item_str,
                            "Descrição do Objeto / Item": desc_item,
                            "Valor Unitário (R$)": item_obj.get("valorUnitarioEstimado"),
                            "Unidade": un_medida_item or "-",
                            "Data de Assinatura": formatar_data_br(dt_ass_s),
                            "Vigência da Ata": vigencia_str_s,
                            "Situação da Ata": situacao_ata_s,
                            "Link no PNCP": link_pncp,
                        }
                    )
                    continue

            # Consulta resultados homologados do item antes de abrir o detalhe complementar da ata
            resultados = client.obter_resultados_item(
                cnpj, ano_c, seq_compra, num_item_str
            )
            if not resultados:
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": "item sem resultado homologado/preço registrado na API do PNCP (R5)",
                        "Nº da ARP / Controle PNCP": num_controle_ata,
                        "Órgão Gerenciador/UF": orgao_uf_str,
                        "Esfera": esfera_norm,
                        "Município": mun_s or "-",
                        "Nº do Item/Lote": num_item_str,
                        "Descrição do Objeto / Item": desc_item,
                        "Valor Unitário (R$)": None,
                        "Unidade": un_medida_item or "-",
                        "Data de Assinatura": formatar_data_br(dt_ass_s),
                        "Vigência da Ata": vigencia_str_s,
                        "Situação da Ata": situacao_ata_s,
                        "Link no PNCP": link_pncp,
                    }
                )
                continue

            # Filtra resultados válidos (não cancelados e com valorUnitarioHomologado > 0)
            melhor_res: Optional[Dict[str, Any]] = None
            menor_val_res: Optional[float] = None
            motivo_falha_res = "preço unitário homologado ausente ou <= 0 (R5)"

            for r in resultados:
                if r.get("dataCancelamento") is not None or str(
                    r.get("situacaoCompraItemResultadoNome") or ""
                ).lower().startswith("cancel"):
                    motivo_falha_res = "resultado homologado cancelado no PNCP"
                    continue
                val_raw = r.get("valorUnitarioHomologado")
                try:
                    val_num = float(val_raw) if val_raw is not None else 0.0
                except Exception:
                    val_num = 0.0

                if val_num <= 0:
                    continue

                if menor_val_res is None or val_num < menor_val_res:
                    menor_val_res = val_num
                    melhor_res = r

            if melhor_res is None or menor_val_res is None:
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": motivo_falha_res,
                        "Nº da ARP / Controle PNCP": num_controle_ata,
                        "Órgão Gerenciador/UF": orgao_uf_str,
                        "Esfera": esfera_norm,
                        "Município": mun_s or "-",
                        "Nº do Item/Lote": num_item_str,
                        "Descrição do Objeto / Item": desc_item,
                        "Valor Unitário (R$)": None,
                        "Unidade": un_medida_item or "-",
                        "Data de Assinatura": formatar_data_br(dt_ass_s),
                        "Vigência da Ata": vigencia_str_s,
                        "Situação da Ata": situacao_ata_s,
                        "Link no PNCP": link_pncp,
                    }
                )
                continue

            # Só consulta o endpoint complementar `/atas/{seq}` caso alguma data essencial esteja ausente no resumo da busca
            if det_ata is None and (dt_ass_s is None or dt_fim_vig_s is None):
                det_ata = client.obter_detalhe_ata(cnpj, ano_c, seq_compra, seq_ata)

            # Atualiza datas e cancelamento com o detalhe da ata (se disponível) e verifica divergências
            dt_ass_final = (
                parse_data_calendario_recife(det_ata.get("dataAssinatura"))
                if det_ata and det_ata.get("dataAssinatura")
                else dt_ass_s
            )
            dt_ini_vig_final = (
                parse_data_calendario_recife(det_ata.get("dataVigenciaInicio"))
                if det_ata and det_ata.get("dataVigenciaInicio")
                else dt_ini_vig_s
            )
            dt_fim_vig_final = (
                parse_data_calendario_recife(det_ata.get("dataVigenciaFim"))
                if det_ata and det_ata.get("dataVigenciaFim")
                else dt_fim_vig_s
            )
            cancelado_final = bool(
                cancelado_s
                or (det_ata and det_ata.get("cancelado") is True)
                or (det_ata and det_ata.get("dataCancelamento") is not None)
            )
            vigencia_str_final = (
                f"{formatar_data_br(dt_ini_vig_final)} a {formatar_data_br(dt_fim_vig_final)}"
            )
            situacao_final = (
                f"CANCELADA ({situacao_ata_s})" if cancelado_final else situacao_ata_s
            )

            # Verifica divergência de status / cancelamento (R4)
            div_status, msg_div_status = verificar_status_local(
                status_ui=status_ata,
                dt_ini_vigencia=dt_ini_vig_final,
                dt_fim_vigencia=dt_fim_vig_final,
                cancelado=cancelado_final,
                hoje_recife=hoje_recife,
            )
            if div_status:
                registrar_divergencia_log(
                    "divergencia_status_ou_cancelamento",
                    {
                        "numero_controle_pncp": num_controle_ata,
                        "status_filtro": status_ata,
                        "mensagem": msg_div_status,
                    },
                )

            # Se a ata for cancelada (R4), ou tiver divergência local/API ou data ausente,
            # a aderência nunca pode ser A -> rebaixa A para B (revisão manual)
            aderencia_final = aderencia_item
            motivo_final = motivo_aderencia
            if aderencia_final == "A" and (cancelado_final or div_status or data_ausente_b):
                aderencia_final = "B"
                extras_b = [
                    m
                    for m in [
                        msg_div_status if div_status else "",
                        msg_periodo if data_ausente_b else "",
                    ]
                    if m
                ]
                motivo_final = f"{motivo_aderencia} | Revisão manual (B): {'; '.join(extras_b)}"

            # Quantitativo previsto na ARP: prioriza quantidadeHomologada; se ausente, usa quantidade do item
            qtd_bruta = (
                melhor_res.get("quantidadeHomologada")
                if melhor_res.get("quantidadeHomologada") is not None
                else qtd_item_compra
            )
            quantitativo_arp_str, apenas_qtd_str = formatar_quantitativo_arp(
                qtd_bruta, un_medida_item
            )

            fornecedor_nome = str(
                melhor_res.get("nomeRazaoSocialFornecedor") or ""
            ).strip()
            fornecedor_ni = str(melhor_res.get("niFornecedor") or "").strip()
            if fornecedor_nome and fornecedor_ni:
                fornecedor_fmt = f"{fornecedor_nome} ({fornecedor_ni})"
            else:
                fornecedor_fmt = fornecedor_nome or fornecedor_ni or "não informado"

            arp_licitacao_str, id_ata_r6 = montar_identificacao_arp_licitacao(
                ata_s, det_ata, det_compra
            )

            itens_validos_desta_ata.append(
                {
                    "descricao_objeto": desc_item,
                    "valor_unitario": round(menor_val_res, 4),
                    "quantitativo_previsto_arp": quantitativo_arp_str,
                    "quantidade_numerica_str": apenas_qtd_str,
                    "unidade_fornecimento": un_medida_item or "não informado",
                    "numero_arp_licitacao": arp_licitacao_str,
                    "id_ata_r6": id_ata_r6,
                    "orgao_gerenciador_uf": orgao_uf_str,
                    "orgao_nome": orgao_nome,
                    "uf": uf_s,
                    "municipio_nome": mun_s or "não informado",
                    "codigo_ibge": cod_ibge_s or "não informado",
                    "fornecedor": fornecedor_fmt,
                    "numero_item_lote": str(num_item_str),
                    "data_assinatura": formatar_data_br(dt_ass_final),
                    "vigencia_ata": vigencia_str_final,
                    "data_fim_vigencia": formatar_data_br(dt_fim_vig_final),
                    "situacao_ata": situacao_final,
                    "esfera": esfera_norm,
                    "tipo_orgao": tipo_orgao_str,
                    "cnpj_orgao": cnpj,
                    "ano_compra": ano_c,
                    "seq_compra": seq_compra,
                    "seq_ata": seq_ata,
                    "link_ata_pncp": link_pncp,
                    "aderencia": aderencia_final,
                    "detalhe_aderencia": motivo_final,
                    "orgao_atende_validade": atende_validade_sim_nao,
                    "data_hora_consulta": data_hora_consulta_str,
                    "escopo_escolhido": escopo_orgaos,
                    "status_escolhido": status_ata,
                    "periodo_aplicado": periodo_aplicado_str,
                    "termos_usados": termos_usados_str,
                }
            )

        if not itens_validos_desta_ata:
            continue

        # Regra R6:
        # 1. Deduplicar por (CNPJ do órgão, nº da ata, nº do item) e por (CNPJ, ano_compra, seq_compra, nº do item)
        # 2. No máximo UM item por ata (o de menor valor que atenda), para não distorcer a média.
        #    Nota: guardamos tanto o melhor item A da ata quanto o melhor item B da ata (caso não haja A,
        #    ou caso o usuário marque "Incluir itens de revisão manual (B)" e o item B tenha menor valor).
        itens_dedup_ata: List[Dict[str, Any]] = []
        for it in sorted(
            itens_validos_desta_ata,
            key=lambda x: (0 if x["aderencia"] == "A" else 1, x["valor_unitario"]),
        ):
            chave_r6 = (
                it["cnpj_orgao"],
                it["numero_arp_licitacao"],
                it["numero_item_lote"],
            )
            chave_compra = (
                it["cnpj_orgao"],
                it["ano_compra"],
                it["seq_compra"],
                it["numero_item_lote"],
            )
            if (
                chave_r6 in chaves_dedup_ata_item
                or chave_compra in chaves_dedup_compra_item
            ):
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": "item duplicado por (CNPJ, nº da ata/compra, nº do item) — Regra R6",
                        "Nº da ARP / Controle PNCP": it["numero_arp_licitacao"],
                        "Órgão Gerenciador/UF": it["orgao_gerenciador_uf"],
                        "Esfera": it["esfera"],
                        "Município": it["municipio_nome"],
                        "Nº do Item/Lote": it["numero_item_lote"],
                        "Descrição do Objeto / Item": it["descricao_objeto"],
                        "Valor Unitário (R$)": it["valor_unitario"],
                        "Unidade": it["unidade_fornecimento"],
                        "Data de Assinatura": it["data_assinatura"],
                        "Vigência da Ata": it["vigencia_ata"],
                        "Situação da Ata": it["situacao_ata"],
                        "Link no PNCP": it["link_ata_pncp"],
                    }
                )
                continue
            chaves_dedup_ata_item.add(chave_r6)
            chaves_dedup_compra_item.add(chave_compra)
            itens_dedup_ata.append(it)

        if not itens_dedup_ata:
            continue

        # Seleciona no máximo 1 item A por ata (o de menor valor) e 1 item B por ata (se menor que A ou se não houver A)
        itens_a = [i for i in itens_dedup_ata if i["aderencia"] == "A"]
        itens_b = [i for i in itens_dedup_ata if i["aderencia"] == "B"]

        escolhidos_ata: List[Dict[str, Any]] = []
        if itens_a:
            itens_a_ord = sorted(itens_a, key=lambda x: x["valor_unitario"])
            melhor_a = itens_a_ord[0]
            escolhidos_ata.append(melhor_a)
            for desc_a in itens_a_ord[1:]:
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": (
                            f"descartado pela Regra R6 (no máximo 1 item por ata; mantido item {melhor_a['numero_item_lote']} "
                            f"de menor valor R$ {melhor_a['valor_unitario']:.2f})"
                        ),
                        "Nº da ARP / Controle PNCP": desc_a["numero_arp_licitacao"],
                        "Órgão Gerenciador/UF": desc_a["orgao_gerenciador_uf"],
                        "Esfera": desc_a["esfera"],
                        "Município": desc_a["municipio_nome"],
                        "Nº do Item/Lote": desc_a["numero_item_lote"],
                        "Descrição do Objeto / Item": desc_a["descricao_objeto"],
                        "Valor Unitário (R$)": desc_a["valor_unitario"],
                        "Unidade": desc_a["unidade_fornecimento"],
                        "Data de Assinatura": desc_a["data_assinatura"],
                        "Vigência da Ata": desc_a["vigencia_ata"],
                        "Situação da Ata": desc_a["situacao_ata"],
                        "Link no PNCP": desc_a["link_ata_pncp"],
                    }
                )

        if itens_b:
            itens_b_ord = sorted(itens_b, key=lambda x: x["valor_unitario"])
            melhor_b = itens_b_ord[0]
            escolhidos_ata.append(melhor_b)
            for desc_b in itens_b_ord[1:]:
                descartados.append(
                    {
                        "Nível": "Item",
                        "Motivo do Descarte": (
                            f"descartado pela Regra R6 (no máximo 1 item B por ata; mantido item {melhor_b['numero_item_lote']} "
                            f"de menor valor R$ {melhor_b['valor_unitario']:.2f})"
                        ),
                        "Nº da ARP / Controle PNCP": desc_b["numero_arp_licitacao"],
                        "Órgão Gerenciador/UF": desc_b["orgao_gerenciador_uf"],
                        "Esfera": desc_b["esfera"],
                        "Município": desc_b["municipio_nome"],
                        "Nº do Item/Lote": desc_b["numero_item_lote"],
                        "Descrição do Objeto / Item": desc_b["descricao_objeto"],
                        "Valor Unitário (R$)": desc_b["valor_unitario"],
                        "Unidade": desc_b["unidade_fornecimento"],
                        "Data de Assinatura": desc_b["data_assinatura"],
                        "Vigência da Ata": desc_b["vigencia_ata"],
                        "Situação da Ata": desc_b["situacao_ata"],
                        "Link no PNCP": desc_b["link_ata_pncp"],
                    }
                )

        itens_candidatos_aprovados.extend(escolhidos_ata)

    client.flush_cache()

    if progresso_cb:
        progresso_cb("Consolidação concluída!", 1.0)

    # Resumo de motivos de descarte para auditoria
    resumo_descartes: Dict[str, int] = {}
    for d in descartados:
        mot = d["Motivo do Descarte"]
        # Agrupa motivos principais para estatística limpa
        if mot.startswith("Aderência C"):
            chave_mot = "Aderência C (não atende aos requisitos ou outro objeto na ata)"
        elif mot.startswith("descartado pela Regra R6"):
            chave_mot = "Regra R6 (mais de um item na mesma ata)"
        else:
            chave_mot = mot
        resumo_descartes[chave_mot] = resumo_descartes.get(chave_mot, 0) + 1

    return {
        "momento_consulta": data_hora_consulta_str,
        "escopo_orgaos": escopo_orgaos,
        "status_ata": status_ata,
        "tipo_data_periodo": tipo_data_periodo,
        "data_inicial": data_inicial,
        "data_final": data_final,
        "periodo_aplicado_str": periodo_aplicado_str,
        "termos_busca": termos_busca,
        "requisitos": requisitos,
        "total_atas_encontradas": total_atas,
        "atas_validas_escopo_periodo": atas_validas_escopo_periodo_count,
        "total_itens_avaliados": todos_itens_avaliados_count,
        "conferencias_status_api": conferencias_status_api,
        "itens_candidatos": itens_candidatos_aprovados,
        "descartados": descartados,
        "resumo_descartes": resumo_descartes,
    }


def selecionar_top_10_menores(
    itens_candidatos: List[Dict[str, Any]],
    incluir_revisao_b: bool = False,
    limite: int = TOP_N_ITENS_JANELA,
) -> List[Dict[str, Any]]:
    """
    Retorna os `limite` (padrão: 20) menores valores unitários em ordem crescente,
    garantindo estritamente NO MÁXIMO UM ITEM POR ATA (Regra R6).
    - Se `incluir_revisao_b == False`: considera apenas itens com `aderencia == 'A'`.
    - Se `incluir_revisao_b == True`: considera itens com `aderencia in ('A', 'B')`,
      mantendo apenas o de menor valor unitário por ata (`id_ata_r6`).
    """
    permitidos = {"A", "B"} if incluir_revisao_b else {"A"}
    filtrados = [it for it in itens_candidatos if it.get("aderencia") in permitidos]

    # Garante 1 único item por ata (o de menor valor unitário dentro do conjunto filtrado)
    melhor_por_ata: Dict[str, Dict[str, Any]] = {}
    for it in sorted(filtrados, key=lambda x: x["valor_unitario"]):
        chave_ata = f"{it.get('cnpj_orgao')}|{it.get('numero_arp_licitacao')}"
        if chave_ata not in melhor_por_ata:
            melhor_por_ata[chave_ata] = it

    ordenados = sorted(melhor_por_ata.values(), key=lambda x: x["valor_unitario"])
    top_res = ordenados[:limite]
    try:
        PNCPClient(usar_cache=True).enriquecer_itens_com_arquivos_ata(top_res)
    except Exception:
        pass
    return top_res


selecionar_top_20_menores = selecionar_top_10_menores
