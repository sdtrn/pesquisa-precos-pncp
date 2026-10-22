"""Script de validação das Etapas (a) e (b): Endpoints do PNCP e Lista de Municípios Bilionários."""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.config import DATA_ASSINATURA, STATUS_VIGENTES
from src.municipios import ValidadorMunicipios
from src.pncp_client import PNCPClient


def main() -> None:
    print("=" * 72)
    print("ETAPA (a): TESTE DOS ENDPOINTS DO PNCP")
    print("=" * 72)
    client = PNCPClient(usar_cache=True)

    # 1. Conferência Todos = Vigentes + Não vigentes
    eq = client.conferir_equacao_status_api(
        termo="lona",
        tipo_data=DATA_ASSINATURA,
        data_inicial=None,
        data_final=None,
    )
    print(f"[1] Equação de Status para q='lona':")
    print(
        f"    Vigentes = {eq['vigentes']} | Não vigentes = {eq['nao_vigentes']} | "
        f"Soma = {eq['soma_vigentes_mais_nao_vigentes']} | Todos = {eq['todos']} | "
        f"Válida = {eq['equacao_valida']}"
    )
    assert eq["equacao_valida"], "Falha na equação Todos = Vigentes + Não vigentes!"

    # 2. Teste de busca e abertura de detalhe de ata, compra, itens e resultados
    pag = client.buscar_pagina_atas(
        termo="lona",
        status_ui=STATUS_VIGENTES,
        tipo_data=DATA_ASSINATURA,
        pagina=1,
        tam_pagina=5,
    )
    print(f"[2] Amostra de atas retornadas: {len(pag['items'])} itens na pág. 1")
    assert len(pag["items"]) > 0, "Nenhuma ata retornada na busca!"

    amostra = pag["items"][0]
    chaves = client.extrair_chaves_item_url(amostra)
    assert chaves is not None, "Não foi possível extrair chaves de item_url!"
    cnpj, ano, seq_compra, seq_ata = chaves

    det_ata = client.obter_detalhe_ata(cnpj, ano, seq_compra, seq_ata)
    det_compra = client.obter_detalhe_compra(cnpj, ano, seq_compra)
    itens = client.obter_todos_itens_compra(cnpj, ano, seq_compra)

    print(
        f"[3] Detalhe da Ata {cnpj}/{ano}/{seq_compra}/{seq_ata}: "
        f"Nº ARP = {det_ata.get('numeroAtaRegistroPreco') if det_ata else 'N/A'} | "
        f"Assinatura = {det_ata.get('dataAssinatura') if det_ata else 'N/A'} | "
        f"Itens na compra = {len(itens)}"
    )
    if itens:
        num_item = str(itens[0].get("numeroItem"))
        res_item = client.obter_resultados_item(cnpj, ano, seq_compra, num_item)
        print(
            f"[4] Resultado do item {num_item}: {len(res_item)} resultado(s) homologado(s)"
        )

    print("\n" + "=" * 72)
    print("ETAPA (b): VALIDAÇÃO DA LISTA DE MUNICÍPIOS (CSV + API IBGE)")
    print("=" * 72)
    validador = ValidadorMunicipios()
    total_csv = len(validador.df_csv)
    sem_ibge = (validador.df_csv["codigo_ibge"].str.strip() == "").sum()
    print(f"[1] Total de municípios carregados do CSV: {total_csv}")
    print(f"[2] Municípios com código IBGE confirmado na API do IBGE: {total_csv - sem_ibge}/{total_csv}")
    assert sem_ibge == 0, f"Há {sem_ibge} município(s) sem código IBGE!"

    # Teste de não-substring (Regra R2: "Vitória" != "Vitória da Conquista", "Vitória de Santo Antão" fora da lista)
    r_recife = validador.avaliar_orgao_gerenciador("M", "PE", "Recife", "2611606")
    r_vitoria_es = validador.avaliar_orgao_gerenciador("M", "ES", "Vitória", "")
    r_vitoria_santo_antao = validador.avaliar_orgao_gerenciador(
        "M", "PE", "Vitória de Santo Antão", ""
    )
    r_uniao = validador.avaliar_orgao_gerenciador("F", "DF", "Brasília", "")
    r_sem_esfera = validador.avaliar_orgao_gerenciador("", "PE", "Recife", "2611606")

    print(f"[3] Teste Recife/PE -> atende={r_recife['atende_criterio_validade']} ({r_recife['metodo_casamento_municipio']})")
    print(f"[4] Teste Vitória/ES -> atende={r_vitoria_es['atende_criterio_validade']} ({r_vitoria_es['metodo_casamento_municipio']})")
    print(f"[5] Teste Vitória de Santo Antão/PE -> atende={r_vitoria_santo_antao['atende_criterio_validade']} (motivo={r_vitoria_santo_antao['motivo_descarte_escopo_a']})")
    print(f"[6] Teste União (F) -> atende={r_uniao['atende_criterio_validade']}")
    print(f"[7] Teste Sem Esfera -> atende={r_sem_esfera['atende_criterio_validade']} (motivo={r_sem_esfera['motivo_descarte_escopo_a']})")

    assert r_recife["atende_criterio_validade"] is True
    assert r_vitoria_es["atende_criterio_validade"] is True
    assert r_vitoria_santo_antao["atende_criterio_validade"] is False
    assert r_vitoria_santo_antao["motivo_descarte_escopo_a"] == "município fora da lista"
    assert r_uniao["atende_criterio_validade"] is True
    assert r_sem_esfera["atende_criterio_validade"] is False
    assert r_sem_esfera["motivo_descarte_escopo_a"] == "esfera não identificada"
    print("\nSucesso total nas Etapas (a) e (b)!")


if __name__ == "__main__":
    main()
