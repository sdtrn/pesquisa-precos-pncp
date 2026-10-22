"""Aplicação Streamlit para Pesquisa de Preços em Atas de Registro de Preços (PNCP)."""

from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
import streamlit as st

# Restrição técnica obrigatória antes de manipular DataFrames
pd.set_option("future.infer_string", False)

from src.config import (
    DATA_ASSINATURA,
    DATA_PUBLICACAO,
    DATA_VIGENCIA,
    ESCOPO_PE_RECIFE,
    ESCOPO_POR_ESTADO,
    ESCOPO_TODOS,
    ESCOPO_VALIDADE,
    STATUS_NAO_VIGENTES,
    STATUS_TODOS,
    STATUS_VIGENTES,
    TOP_N_ITENS_JANELA,
    TZ_RECIFE,
    UFS_BRASIL,
)
from src.exporter import (
    gerar_csv_consolidado,
    gerar_planilha_xlsx,
    sanitizar_celula_excel,
)
from src.parser_requisitos import extrair_requisitos_minimos, gerar_termos_busca
from src.pipeline import executar_pipeline_pesquisa, selecionar_top_20_menores
from src.pncp_client import PNCPClient

st.set_page_config(
    page_title="Pesquisa de Preços em Atas — PNCP",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Estilo visual sóbrio: Azul-marinho (#1B365D), Latão (#B59410), fonte IBM Plex Sans, sem marcas institucionais
st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        html, body, [class*="css"], .stApp, .stMarkdown, .stRadio, .stButton, .stTextInput, .stTextArea, .stDateInput {
            font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
        }

        .cabecalho-sistema {
            background-color: #1B365D;
            color: #FFFFFF;
            padding: 1.1rem 1.5rem;
            border-bottom: 4px solid #B59410;
            border-radius: 6px;
            margin-bottom: 1rem;
        }
        .cabecalho-sistema h1 {
            color: #FFFFFF !important;
            font-size: 1.45rem !important;
            font-weight: 600 !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .cabecalho-sistema p {
            color: #E2E8F0 !important;
            font-size: 0.9rem !important;
            margin: 0.25rem 0 0 0 !important;
        }

        .legenda-escopo-fixa {
            background-color: #EDF1F7;
            border-left: 5px solid #B59410;
            color: #1B365D;
            padding: 0.65rem 1rem;
            border-radius: 4px;
            font-size: 0.92rem;
            font-weight: 500;
            margin-bottom: 1rem;
        }

        .rodape-janela-vivo {
            background-color: #1B365D;
            color: #FFFFFF;
            border-left: 5px solid #B59410;
            padding: 0.75rem 1.1rem;
            border-radius: 4px;
            font-size: 1.02rem;
            font-weight: 600;
            margin: 0.6rem 0 0.8rem 0;
        }

        .rodape-autor {
            background-color: #EDF1F7;
            border-top: 2px solid #B59410;
            color: #1B365D;
            padding: 0.7rem 1.2rem;
            border-radius: 6px;
            font-size: 0.88rem;
            font-weight: 500;
            text-align: center;
            margin-top: 1.8rem;
        }

        .card-evidencia-arp {
            background-color: #F8FAFC;
            border: 1px solid #CBD5E1;
            border-left: 4px solid #1B365D;
            padding: 0.7rem 1rem;
            border-radius: 4px;
            margin-bottom: 0.55rem;
            font-size: 0.9rem;
        }

        /* Amplia a janela st.dialog para exibir confortavelmente todas as colunas */
        div[data-testid="stDialog"] div[role="dialog"] {
            width: 92vw !important;
            max-width: 1380px !important;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


def formatar_moeda_br(valor: float) -> str:
    """Formata float como moeda em Real (R$ 1.234,56)."""
    texto = f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def inicializar_estado() -> None:
    defaults: Dict[str, Any] = {
        "etapa_revisao_ativa": False,
        "termos_gerados_str": "",
        "df_requisitos_edit": pd.DataFrame(),
        "resultado_pesquisa": None,
        "abrir_dialog_top10": False,
        "incluir_revisao_b": False,
        "selecoes_janela": [],
        "editor_version": 0,
        "req_editor_version": 0,
        "tabela_consolidada_confirmada": False,
        "itens_selecionados_finais": [],
        "indices_selecionados_finais": [],
        "itens_janela_finais": [],
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


inicializar_estado()


@st.dialog(
    f"Seleção dos {TOP_N_ITENS_JANELA} Menores Valores Unitários Encontrados no PNCP",
    width="large",
)
def exibir_janela_20_menores() -> None:
    """
    Janela modal (st.dialog, largura ampla) aberta automaticamente ao fim da busca
    e ANTES de qualquer planilha.
    """
    res = st.session_state.get("resultado_pesquisa")
    if not res:
        st.warning("Nenhum resultado de pesquisa carregado.")
        return

    uf_info = (
        f" (UF: {res['uf_selecionada']})"
        if res.get("escopo_orgaos") == ESCOPO_POR_ESTADO and res.get("uf_selecionada")
        else ""
    )
    st.caption(
        f"**Escopo ativo:** {res['escopo_orgaos']}{uf_info} | "
        f"**Status:** {res['status_ata']} | "
        f"**Período ({res['periodo_aplicado_str']})**"
    )

    incluir_b_novo = st.checkbox(
        "Incluir itens de revisão manual (B)",
        value=bool(st.session_state.get("incluir_revisao_b", False)),
        help=(
            "Desligado por padrão (mostra apenas itens de aderência A, que atendem todos os requisitos verificáveis). "
            f"Quando ligado, acrescenta a coluna 'Aderência' e recalcula os {TOP_N_ITENS_JANELA} menores incluindo itens B."
        ),
    )
    if incluir_b_novo != st.session_state.get("incluir_revisao_b", False):
        st.session_state["incluir_revisao_b"] = incluir_b_novo
        st.session_state["selecoes_janela"] = []
        st.session_state["editor_version"] += 1
        st.rerun()

    top_itens = selecionar_top_20_menores(
        res["itens_candidatos"],
        incluir_revisao_b=st.session_state["incluir_revisao_b"],
        limite=TOP_N_ITENS_JANELA,
    )
    qtd_itens = len(top_itens)

    if qtd_itens == 0:
        st.warning(
            "Não foram encontrados itens válidos com aderência 'A' para os filtros selecionados. "
            "Você pode marcar a opção 'Incluir itens de revisão manual (B)' acima para inspecionar itens "
            "com especificação parcial ou clicar em 'Voltar' para ajustar os parâmetros."
        )
        if st.button("Voltar", use_container_width=False):
            st.session_state["abrir_dialog_top10"] = False
            st.rerun()
        return

    if qtd_itens < TOP_N_ITENS_JANELA:
        st.info(
            f"⚠️ Atenção: Foram encontrados apenas **{qtd_itens}** item(ns) válido(s) (menos de {TOP_N_ITENS_JANELA}) "
            f"que atendem aos critérios e requisitos definidos (1 item por ata — Regra R6)."
        )
    else:
        st.markdown(
            f"Exibindo os **{TOP_N_ITENS_JANELA} menores valores unitários** em ordem crescente (1 item por ata — Regra R6). "
            "Marque na **primeira coluna à esquerda** quais itens deseja utilizar no Parecer Técnico:"
        )

    if len(st.session_state["selecoes_janela"]) != qtd_itens:
        st.session_state["selecoes_janela"] = [False] * qtd_itens

    col_btn1, col_btn2, _ = st.columns([1.3, 1.4, 5.3])
    with col_btn1:
        if st.button("Marcar todas", use_container_width=True):
            st.session_state["selecoes_janela"] = [True] * qtd_itens
            st.session_state["editor_version"] += 1
            st.rerun()
    with col_btn2:
        if st.button("Desmarcar todas", use_container_width=True):
            st.session_state["selecoes_janela"] = [False] * qtd_itens
            st.session_state["editor_version"] += 1
            st.rerun()

    # Monta DataFrame para o st.data_editor com caixa de seleção na PRIMEIRA coluna à esquerda
    linhas_df: List[Dict[str, Any]] = []
    for i, it in enumerate(top_itens):
        linha: Dict[str, Any] = {
            "Selecionar": bool(st.session_state["selecoes_janela"][i]),
        }
        if st.session_state["incluir_revisao_b"]:
            linha["Aderência"] = str(it.get("aderencia") or "")
        linha["Descrição do objeto"] = sanitizar_celula_excel(it.get("descricao_objeto") or "")
        linha["Valor Unitário (R$)"] = float(it.get("valor_unitario") or 0.0)
        linha["Quantitativo previsto na ARP"] = str(
            it.get("quantitativo_previsto_arp") or "não informado"
        )
        linha["Nº da ARP / Licitação"] = str(it.get("numero_arp_licitacao") or "")
        linha["Data de Assinatura"] = str(it.get("data_assinatura") or "não informado")
        linha["Órgão Gerenciador/UF"] = str(it.get("orgao_gerenciador_uf") or "")
        linha["Fornecedor"] = str(it.get("fornecedor") or "")
        linhas_df.append(linha)

    df_janela = pd.DataFrame(linhas_df)
    colunas_somente_leitura = [c for c in df_janela.columns if c != "Selecionar"]

    col_config: Dict[str, Any] = {
        "Selecionar": st.column_config.CheckboxColumn(
            "✓",
            help="Selecione para incluir este item na Tabela Consolidada e no Parecer",
            default=False,
            width="small",
        ),
        "Descrição do objeto": st.column_config.TextColumn(
            "Descrição do objeto", width="large"
        ),
        "Valor Unitário (R$)": st.column_config.NumberColumn(
            "Valor Unitário (R$)", format="R$ %.2f", width="small"
        ),
        "Quantitativo previsto na ARP": st.column_config.TextColumn(
            "Quantitativo previsto na ARP", width="small"
        ),
        "Nº da ARP / Licitação": st.column_config.TextColumn(
            "Nº da ARP / Licitação", width="medium"
        ),
        "Data de Assinatura": st.column_config.TextColumn(
            "Data de Assinatura", width="small"
        ),
        "Órgão Gerenciador/UF": st.column_config.TextColumn(
            "Órgão Gerenciador/UF", width="medium"
        ),
        "Fornecedor": st.column_config.TextColumn("Fornecedor", width="medium"),
    }
    if st.session_state["incluir_revisao_b"]:
        col_config["Aderência"] = st.column_config.TextColumn(
            "Aderência", width="small"
        )

    editor_key = (
        f"editor_top20_{int(st.session_state['incluir_revisao_b'])}_"
        f"{st.session_state['editor_version']}"
    )
    df_editado = st.data_editor(
        df_janela,
        column_config=col_config,
        disabled=colunas_somente_leitura,
        hide_index=True,
        use_container_width=True,
        key=editor_key,
    )

    selecoes_atuais = [bool(x) for x in df_editado["Selecionar"].tolist()]
    st.session_state["selecoes_janela"] = selecoes_atuais

    indices_marcados = [idx for idx, flag in enumerate(selecoes_atuais) if flag]
    n_selecionados = len(indices_marcados)
    if n_selecionados > 0:
        valores_marcados = [float(top_itens[idx]["valor_unitario"]) for idx in indices_marcados]
        media_selecionados = sum(valores_marcados) / n_selecionados
        media_str = formatar_moeda_br(media_selecionados)
    else:
        media_str = "R$ 0,00"

    st.markdown(
        f'<div class="rodape-janela-vivo">'
        f"Selecionados: {n_selecionados} &nbsp;|&nbsp; Média dos valores unitários: {media_str}"
        f"</div>",
        unsafe_allow_html=True,
    )

    col_acao1, col_acao2, _ = st.columns([2.2, 1.4, 4.4])
    with col_acao1:
        confirmar_btn = st.button(
            "Gerar tabela consolidada",
            type="primary",
            disabled=(n_selecionados == 0),
            use_container_width=True,
        )
    with col_acao2:
        voltar_btn = st.button("Voltar", use_container_width=True)

    if confirmar_btn and n_selecionados > 0:
        st.session_state["itens_selecionados_finais"] = [
            top_itens[idx] for idx in indices_marcados
        ]
        st.session_state["indices_selecionados_finais"] = indices_marcados
        st.session_state["itens_janela_finais"] = top_itens
        st.session_state["tabela_consolidada_confirmada"] = True
        st.session_state["abrir_dialog_top10"] = False
        st.rerun()

    if voltar_btn:
        st.session_state["abrir_dialog_top10"] = False
        st.rerun()


# =============================================================================
# CABEÇALHO E SELETOR DE ESCOPO NO TOPO (SEMPRE VISÍVEL)
# =============================================================================
st.markdown(
    """
    <div class="cabecalho-sistema" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
            <h1>Sistema de Pesquisa de Preços em Atas de Registro de Preços (PNCP)</h1>
            <p>Levantamento auditável de preços unitários homologados (Lei nº 14.133/2021) — Fonte exclusiva: Portal Nacional de Contratações Públicas</p>
        </div>
        <div style="text-align: right; color: #F4EFE0; font-size: 0.86rem; font-weight: 500; border-left: 2px solid #B59410; padding-left: 0.85rem;">
            Desenvolvido por<br><strong style="color: #FFFFFF; font-size: 0.95rem;">Sérgio Dantas Torres</strong>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

escopo_selecionado = st.radio(
    "Escopo dos órgãos",
    options=[
        ESCOPO_VALIDADE,
        ESCOPO_TODOS,
        ESCOPO_POR_ESTADO,
        ESCOPO_PE_RECIFE,
    ],
    index=0,
    horizontal=True,
    help=(
        "1) Critério de validade: União, Estados, DF e municípios com orçamento >= R$ 1 bilhão (municipios_bilionarios_2026.csv). "
        "2) Todos os órgãos do Brasil: municipais, estaduais, distritais e federais sem restrição. "
        "3) ARPs por Estado (UF): apenas ARPs do Estado escolhido (Governo Estadual + todos os Municípios daquela UF). "
        "4) Governo de Pernambuco e Prefeitura do Recife: apenas ARPs do Poder Executivo Estadual de PE e/ou da Prefeitura Municipal do Recife (ideal para objetos com dedicação de mão de obra sujeitos a CCT local)."
    ),
)

uf_escolhida = "PE"
if escopo_selecionado == ESCOPO_POR_ESTADO:
    siglas_ufs = list(UFS_BRASIL.keys())
    idx_padrao_pe = siglas_ufs.index("PE") if "PE" in siglas_ufs else 0
    col_uf_sel, _ = st.columns([2.2, 5.8])
    with col_uf_sel:
        uf_escolhida = st.selectbox(
            "Selecione o Estado (UF) desejado",
            options=siglas_ufs,
            index=idx_padrao_pe,
            format_func=lambda uf: f"{uf} — {UFS_BRASIL.get(uf, uf)}",
            help="Filtra a pesquisa para retornar exclusivamente ARPs do Estado selecionado, incluindo órgãos estaduais e todos os municípios daquela UF.",
        )

if escopo_selecionado == ESCOPO_VALIDADE:
    texto_legenda_escopo = (
        "📌 <b>Escopo em uso nesta sessão:</b> Critério de validade — "
        "Aceita exclusivamente órgãos gerenciadores da <b>União (Federal)</b>, dos <b>Estados</b>, "
        "do <b>Distrito Federal</b> e dos <b>Municípios constantes em <code>municipios_bilionarios_2026.csv</code></b> "
        "(orçamento anual ≥ R$ 1 bilhão, casados por código IBGE e/ou igualdade exata de Nome+UF)."
    )
elif escopo_selecionado == ESCOPO_TODOS:
    texto_legenda_escopo = (
        "📌 <b>Escopo em uso nesta sessão:</b> Todos os órgãos do Brasil — "
        "Aceita órgãos gerenciadores municipais, estaduais, distritais e federais de todo o país, "
        "sem restrição de orçamento ou lista de municípios (mantendo o registro de validade na memória de pesquisa)."
    )
elif escopo_selecionado == ESCOPO_POR_ESTADO:
    nome_uf_sel = UFS_BRASIL.get(uf_escolhida, uf_escolhida)
    texto_legenda_escopo = (
        f"📌 <b>Escopo em uso nesta sessão:</b> ARPs por Estado (UF: <b>{uf_escolhida} — {nome_uf_sel}</b>) — "
        f"Retorna exclusivamente Atas de Registro de Preços de órgãos estaduais/distritais e de <b>todos os municípios</b> "
        f"pertencentes à UF <b>{uf_escolhida} ({nome_uf_sel})</b>."
    )
else:
    texto_legenda_escopo = (
        "📌 <b>Escopo em uso nesta sessão:</b> Governo de Pernambuco e Prefeitura do Recife — "
        "Retorna exclusivamente Atas de Registro de Preços originárias do <b>Governo do Estado de Pernambuco</b> "
        "(Administração Direta e Indireta Estadual) e/ou da <b>Prefeitura Municipal do Recife</b> "
        "(Administração Direta e Indireta Municipal). Indicado para <b>objetos de mão de obra</b> vinculados a Convenções Coletivas de Trabalho (CCT) locais."
    )

st.markdown(
    f'<div class="legenda-escopo-fixa">{texto_legenda_escopo}</div>',
    unsafe_allow_html=True,
)

# =============================================================================
# PARÂMETROS DA TELA INICIAL
# =============================================================================
with st.container(border=True):
    st.subheader("1. Parâmetros da Pesquisa de Preços")

    descricao_padrao = (
        "Rolo de lona em plástico medindo no mínimo 8MX100M. "
        "Rolo de lona - em plástico resistente, novo de primeiro uso, acondicionado em bobina, "
        "cor preto fosco medindo no mínimo 8mX100m com no mínimo 200 micras (0,200mm). "
        "Pesando no mínimo 110 kg."
    )
    objeto_pesquisa = st.text_area(
        "Objeto da pesquisa (descrição detalhada do item pretendido)",
        value=descricao_padrao,
        height=110,
        placeholder="Digite ou cole aqui a especificação técnica completa do item...",
    )

    col_f1, col_f2, col_f3 = st.columns([1.2, 1.5, 1.5])

    with col_f1:
        status_ata = st.radio(
            "Status",
            options=[STATUS_VIGENTES, STATUS_NAO_VIGENTES, STATUS_TODOS],
            index=0,
        )

    with col_f2:
        tipo_data_periodo = st.radio(
            "Data usada no período",
            options=[DATA_ASSINATURA, DATA_PUBLICACAO, DATA_VIGENCIA],
            index=0,
            help=(
                "Data de assinatura da ata (`data_assinatura`), "
                "Data de publicação no PNCP (`data_publicacao_pncp`) ou "
                "Vigência (`data_inicio_vigencia` a `data_fim_vigencia` com pelo menos 1 dia dentro do período)."
            ),
        )

    with col_f3:
        st.markdown("**Período (opcional, limites inclusivos)**")
        c_dt1, c_dt2 = st.columns(2)
        with c_dt1:
            data_inicial = st.date_input(
                "Data inicial",
                value=None,
                format="DD/MM/YYYY",
            )
        with c_dt2:
            data_final = st.date_input(
                "Data final",
                value=None,
                format="DD/MM/YYYY",
            )

    periodo_invalido = bool(
        data_inicial is not None
        and data_final is not None
        and data_inicial > data_final
    )
    if periodo_invalido:
        st.warning(
            "⚠️ Atenção: A **Data inicial** não pode ser maior que a **Data final**. "
            "Por favor, corrija o período antes de pesquisar."
        )

    clicou_pesquisar = st.button(
        "Pesquisar",
        type="primary",
        disabled=periodo_invalido or not objeto_pesquisa.strip(),
    )

    if clicou_pesquisar and not periodo_invalido:
        termos_sugeridos = gerar_termos_busca(objeto_pesquisa)
        requisitos_sugeridos = extrair_requisitos_minimos(objeto_pesquisa)
        st.session_state["termos_gerados_str"] = ", ".join(termos_sugeridos)
        st.session_state["df_requisitos_edit"] = pd.DataFrame(requisitos_sugeridos)
        st.session_state["req_editor_version"] = st.session_state.get("req_editor_version", 0) + 1
        st.session_state["etapa_revisao_ativa"] = True
        st.session_state["tabela_consolidada_confirmada"] = False

# =============================================================================
# ETAPA DE CONFIRMAÇÃO DE TERMOS DE BUSCA E REQUISITOS MÍNIMOS
# =============================================================================
if st.session_state.get("etapa_revisao_ativa") and not periodo_invalido:
    with st.container(border=True):
        st.subheader("2. Conferência de Termos de Busca e Requisitos Mínimos Extraídos")
        st.markdown(
            "Confira abaixo os **termos de busca** (usados para localizar as atas no PNCP) e os "
            "**requisitos mínimos** extraídos da descrição (usados para classificar os itens de cada ata em **A**, **B** ou **C**). "
            "Você pode editar qualquer campo antes de iniciar a busca:"
        )

        termos_editados_str = st.text_input(
            "Termos de busca no PNCP (separados por vírgula)",
            value=st.session_state["termos_gerados_str"],
            key=f"input_termos_busca_{st.session_state.get('req_editor_version', 0)}",
            help="A busca do PNCP consulta o objeto geral da ata. Termos compostos evitam trazer milhares de atas genéricas.",
        )

        df_req_atual = st.data_editor(
            st.session_state["df_requisitos_edit"],
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            column_config={
                "Atributo": st.column_config.TextColumn("Atributo", required=True),
                "Operador": st.column_config.SelectboxColumn(
                    "Operador",
                    options=["contém", "=", ">=", "<=", "compatível"],
                    required=True,
                ),
                "Valor": st.column_config.TextColumn("Valor Mínimo / Esperado", required=True),
                "Unidade": st.column_config.TextColumn("Unidade"),
                "Obrigatorio": st.column_config.CheckboxColumn("Obrigatório?", default=True),
            },
            key=f"editor_requisitos_minimos_{st.session_state.get('req_editor_version', 0)}",
        )

        iniciar_busca_btn = st.button(
            "Confirmar Termos/Requisitos e Iniciar Busca no PNCP",
            type="primary",
        )

        if iniciar_busca_btn:
            termos_lista = [
                t.strip() for t in termos_editados_str.split(",") if t.strip()
            ]
            requisitos_lista = df_req_atual.to_dict(orient="records")

            barra = st.progress(0.0, text="Iniciando consulta ao PNCP...")
            status_txt = st.empty()

            def atualizar_progresso(msg: str, frac: float) -> None:
                barra.progress(min(1.0, max(0.0, float(frac))), text=msg)
                status_txt.caption(msg)

            resultado = executar_pipeline_pesquisa(
                descricao_objeto=objeto_pesquisa,
                termos_busca=termos_lista,
                requisitos=requisitos_lista,
                escopo_orgaos=escopo_selecionado,
                status_ata=status_ata,
                tipo_data_periodo=tipo_data_periodo,
                data_inicial=data_inicial,
                data_final=data_final,
                progresso_cb=atualizar_progresso,
                usar_cache=True,
                uf_selecionada=uf_escolhida,
            )

            barra.empty()
            status_txt.empty()

            st.session_state["resultado_pesquisa"] = resultado
            st.session_state["incluir_revisao_b"] = False
            st.session_state["selecoes_janela"] = []
            st.session_state["editor_version"] += 1
            st.session_state["tabela_consolidada_confirmada"] = False
            st.session_state["abrir_dialog_top10"] = True
            st.rerun()

# =============================================================================
# RESUMO DA BUSCA E REABERTURA DA JANELA DOS 20 MENORES
# =============================================================================
res_atual = st.session_state.get("resultado_pesquisa")
if res_atual is not None:
    with st.container(border=True):
        st.subheader("Resumo da Avaliação de Atas e Itens (Auditoria)")
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Atas Encontradas no PNCP", res_atual["total_atas_encontradas"])
        c2.metric("Atas no Escopo/Período", res_atual["atas_validas_escopo_periodo"])
        c3.metric("Itens Avaliados nas Atas", res_atual["total_itens_avaliados"])
        c4.metric("Registros em 'Descartados'", len(res_atual["descartados"]))

        # Validação Todos = Vigentes + Não vigentes
        for conf in res_atual.get("conferencias_status_api", []):
            icone = "✅" if conf["equacao_valida"] else "⚠️"
            st.caption(
                f"{icone} **Conferência de Status no PNCP (termo `{conf['termo']}`):** "
                f"Vigentes ({conf['vigentes']}) + Não vigentes ({conf['nao_vigentes']}) = "
                f"**{conf['soma_vigentes_mais_nao_vigentes']}** | "
                f"Todos = **{conf['todos']}**"
            )

        with st.expander("Ver detalhamento de descartes por motivo"):
            resumo_desc = res_atual.get("resumo_descartes") or {}
            if resumo_desc:
                df_motivos = pd.DataFrame(
                    [
                        {"Motivo do Descarte": k, "Quantidade": v}
                        for k, v in sorted(
                            resumo_desc.items(), key=lambda x: x[1], reverse=True
                        )
                    ]
                )
                st.dataframe(df_motivos, hide_index=True, use_container_width=True)
            else:
                st.write("Nenhum descarte registrado.")

        if st.button(f"Reabrir Janela dos {TOP_N_ITENS_JANELA} Menores Valores Unitários"):
            st.session_state["abrir_dialog_top10"] = True
            st.rerun()

# =============================================================================
# TABELA CONSOLIDADA, EVIDÊNCIAS (LINKS DAS ARPs) E EXPORTAÇÃO .XLSX / .CSV
# =============================================================================
if st.session_state.get("tabela_consolidada_confirmada") and res_atual is not None:
    itens_sel = st.session_state.get("itens_selecionados_finais") or []
    if itens_sel:
        try:
            PNCPClient(usar_cache=True).enriquecer_itens_com_arquivos_ata(itens_sel)
        except Exception:
            pass

        with st.container(border=True):
            st.subheader("3. Tabela Consolidada — Tópico 'Pesquisa de Preços' do Parecer Técnico")

            linhas_consolidadas: List[Dict[str, str]] = []
            soma_valores = 0.0
            for it in itens_sel:
                val = float(it.get("valor_unitario") or 0.0)
                soma_valores += val
                linhas_consolidadas.append(
                    {
                        "Descrição do objeto": sanitizar_celula_excel(it.get("descricao_objeto") or ""),
                        "Valor Unitário (R$)": formatar_moeda_br(val),
                        "Nº da ARP / Licitação": sanitizar_celula_excel(it.get("numero_arp_licitacao") or ""),
                        "Data de Assinatura": sanitizar_celula_excel(it.get("data_assinatura") or "não informado"),
                        "Órgão Gerenciador/UF": sanitizar_celula_excel(it.get("orgao_gerenciador_uf") or ""),
                        "Fornecedor": sanitizar_celula_excel(it.get("fornecedor") or ""),
                    }
                )

            media_final = soma_valores / len(itens_sel)
            linhas_consolidadas.append(
                {
                    "Descrição do objeto": "MÉDIA DOS VALORES UNITÁRIOS",
                    "Valor Unitário (R$)": formatar_moeda_br(media_final),
                    "Nº da ARP / Licitação": "—",
                    "Data de Assinatura": "—",
                    "Órgão Gerenciador/UF": "—",
                    "Fornecedor": "—",
                }
            )

            df_consolidado = pd.DataFrame(linhas_consolidadas)
            st.dataframe(
                df_consolidado,
                hide_index=True,
                use_container_width=True,
            )

            bytes_xlsx = gerar_planilha_xlsx(
                itens_selecionados=itens_sel,
                itens_janela_top10=st.session_state.get("itens_janela_finais") or [],
                indices_selecionados=st.session_state.get("indices_selecionados_finais")
                or [],
                descartados=res_atual.get("descartados") or [],
            )
            bytes_csv = gerar_csv_consolidado(itens_selecionados=itens_sel)

            carimbo_arq = datetime.now(TZ_RECIFE).strftime("%Y%m%d_%H%M%S")
            nome_arquivo_xlsx = f"Pesquisa_de_Precos_PNCP_A4_{carimbo_arq}.xlsx"
            nome_arquivo_csv = f"Pesquisa_de_Precos_PNCP_{carimbo_arq}.csv"

            col_dl1, col_dl2 = st.columns(2)
            with col_dl1:
                st.download_button(
                    label="📥 Baixar Planilha Consolidada Formatada A4 (.xlsx — 3 Abas + Fórmula =AVERAGE)",
                    data=bytes_xlsx,
                    file_name=nome_arquivo_xlsx,
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    type="primary",
                    use_container_width=True,
                )
            with col_dl2:
                st.download_button(
                    label="📄 Baixar Tabela Consolidada e Links (.csv)",
                    data=bytes_csv,
                    file_name=nome_arquivo_csv,
                    mime="text/csv",
                    use_container_width=True,
                )

            st.divider()
            st.markdown(
                "#### 📎 Links Diretos das ARPs Selecionadas — Evidências e Papéis de Trabalho (Controle Interno)"
            )
            st.caption(
                "Utilize os links diretos abaixo para acessar a página oficial de cada Ata no PNCP ou baixar diretamente o arquivo PDF da ARP assinada para anexação aos autos do processo:"
            )

            linhas_evidencias: List[Dict[str, str]] = []
            for idx_ev, it in enumerate(itens_sel, 1):
                arp_id = sanitizar_celula_excel(it.get("numero_arp_licitacao") or "")
                orgao_id = sanitizar_celula_excel(it.get("orgao_gerenciador_uf") or "")
                dt_ass = sanitizar_celula_excel(it.get("data_assinatura") or "não informado")
                val_str = formatar_moeda_br(float(it.get("valor_unitario") or 0.0))
                link_pncp = str(it.get("link_ata_pncp") or "").strip()
                arqs = it.get("arquivos_arp") or []
                link_pdf_principal = (
                    str(arqs[0].get("url") or link_pncp).strip()
                    if arqs
                    else str(it.get("link_download_arp") or link_pncp).strip()
                )

                linhas_evidencias.append(
                    {
                        "Nº da ARP / Licitação": arp_id,
                        "Data de Assinatura": dt_ass,
                        "Órgão Gerenciador/UF": orgao_id,
                        "Valor Unitário (R$)": val_str,
                        "Página da ARP no PNCP": link_pncp,
                        "Download Direto do Arquivo/PDF da ARP": link_pdf_principal,
                    }
                )

                links_html_arqs = [
                    f'<a href="{link_pncp}" target="_blank" style="color: #1B365D; font-weight: 600; text-decoration: underline;">🔗 Abrir Página da ARP no Portal PNCP</a>'
                ]
                for arq in arqs:
                    u_a = str(arq.get("url") or "").strip()
                    t_a = sanitizar_celula_excel(arq.get("titulo") or "Arquivo da ARP")
                    if u_a:
                        links_html_arqs.append(
                            f'<a href="{u_a}" target="_blank" style="color: #8C6D08; font-weight: 600; text-decoration: underline;">📥 Baixar "{t_a}"</a>'
                        )

                st.markdown(
                    f'<div class="card-evidencia-arp">'
                    f"<b>{idx_ev}. {arp_id}</b> — <b>{orgao_id}</b> "
                    f"(Assinatura: <b>{dt_ass}</b> | Valor Unitário: <b>{val_str}</b>)<br>"
                    f'{" &nbsp;&nbsp;|&nbsp;&nbsp; ".join(links_html_arqs)}'
                    f"</div>",
                    unsafe_allow_html=True,
                )

            df_evidencias = pd.DataFrame(linhas_evidencias)
            st.dataframe(
                df_evidencias,
                column_config={
                    "Página da ARP no PNCP": st.column_config.LinkColumn(
                        "Página da ARP no PNCP",
                        display_text="Abrir no PNCP ↗",
                    ),
                    "Download Direto do Arquivo/PDF da ARP": st.column_config.LinkColumn(
                        "Download Direto do Arquivo/PDF da ARP",
                        display_text="Baixar Arquivo/PDF da ARP 📥",
                    ),
                },
                hide_index=True,
                use_container_width=True,
            )

# Rodapé institucional com crédito de autoria
st.markdown(
    """
    <div class="rodape-autor">
        Sistema de Pesquisa de Preços em Atas de Registro de Preços (PNCP) &nbsp;|&nbsp;
        <strong>Desenvolvido por Sérgio Dantas Torres</strong>
    </div>
    """,
    unsafe_allow_html=True,
)

# Abre automaticamente a janela dos 20 menores valores quando sinalizado
if st.session_state.get("abrir_dialog_top10"):
    exibir_janela_20_menores()
