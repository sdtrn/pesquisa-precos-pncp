"""Extração inteligente de termos de busca, requisitos mínimos e motor de classificação de aderência (A, B, C)."""

import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


def sem_acentos_minusculo(texto: Optional[str]) -> str:
    """Remove acentos e converte o texto para minúsculas."""
    if not texto or not isinstance(texto, str):
        return ""
    nfkd = unicodedata.normalize("NFKD", texto)
    limpo = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(limpo.lower().split())


def _parse_float_ptbr(val_str: str) -> Optional[float]:
    """Converte número em formato brasileiro ou internacional ('8,00', '0,200', '1.250,50') para float."""
    if not val_str:
        return None
    s = val_str.strip()
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


# Palavras administrativas/contratuais que NUNCA devem ser usadas sozinhas como termo único de busca
PALAVRAS_MODALIDADE_CONTRATACAO = {
    "locacao",
    "aluguel",
    "aquisicao",
    "compra",
    "contratacao",
    "fornecimento",
    "prestacao",
    "servico",
    "servicos",
    "registro",
    "preco",
    "precos",
    "ata",
    "arp",
    "futura",
    "futuro",
    "eventual",
    "empresa",
    "especializada",
    "sistema",
    "manutencao",
    "confeccao",
    "instalacao",
    "terceirizacao",
    "terceirizado",
    "terceirizados",
    "terceirizada",
    "terceirizadas",
    "dedicacao",
    "exclusiva",
    "continuado",
    "continuados",
    "continuada",
    "continuadas",
}

STOPWORDS_GERAIS = {
    "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
    "com", "sem", "para", "por", "um", "uma", "uns", "umas", "ao", "aos",
    "minimo", "maximo", "medindo", "pesando", "aproximadamente", "novo",
    "nova", "novos", "novas", "primeiro", "uso", "acondicionado",
    "acondicionada", "cor", "tipo", "modelo", "marca", "referencia",
    "conforme", "edital", "termo", "item", "itens", "lote", "unidade",
    "unidades", "rolo", "bobina", "caixa", "pacote", "frasco", "peca",
    "objeto", "descricao", "especificacao", "especificacoes", "atender",
    "necessidades", "secretaria", "municipio", "municipal", "estadual",
    "federal", "prefeitura", "orgao", "valor", "mensal", "anual", "diaria",
}


def _extrair_nucleo_substantivo(texto_norm: str) -> Tuple[Optional[str], List[str]]:
    """
    Separa eventual palavra de modalidade ('locacao', 'manutencao') e a lista de
    substantivos específicos do objeto (ignorando palavras genéricas de licitação).
    """
    acao_principal: Optional[str] = None
    for acao in ["locacao", "manutencao"]:
        if re.search(rf"\b{acao}\b", texto_norm):
            acao_principal = acao
            break

    palavras = re.findall(r"[a-z0-9]{3,}", texto_norm)
    substantivos: List[str] = []
    for p in palavras:
        if p in STOPWORDS_GERAIS or p in PALAVRAS_MODALIDADE_CONTRATACAO:
            continue
        if p.isdigit():
            continue
        if p not in substantivos:
            substantivos.append(p)

    return acao_principal, substantivos


def gerar_termos_busca(descricao: str) -> List[str]:
    """
    Gera termos de busca enxutos e específicos para consultar o endpoint `/api/search/` do PNCP.
    NUNCA gera palavras genéricas isoladas (como 'locacao', 'aquisicao', 'fornecimento', 'servico'),
    evitando baixar dezenas de milhares de atas de objetos estranhos.
    """
    texto_norm = sem_acentos_minusculo(descricao)
    if not texto_norm:
        return []

    # Caso clássico de Lona Plástica / Bobina de Lona
    if re.search(r"\blonas?\b", texto_norm):
        termos_lona = ["lona"]
        if "plast" in texto_norm or "polietileno" in texto_norm:
            termos_lona.append("lona plastica")
        if "preta" in texto_norm or "preto" in texto_norm:
            termos_lona.append("lona preta")
        return termos_lona

    acao, substantivos = _extrair_nucleo_substantivo(texto_norm)
    termos: List[str] = []

    if acao and substantivos:
        # Ex.: "locacao de veiculos" (nunca "locacao" sozinho!)
        obj1 = substantivos[0]
        termo_composto = f"{acao} de {obj1}"
        termos.append(termo_composto)
        if len(substantivos) >= 2:
            termo_esp = f"{acao} {obj1} {substantivos[1]}"
            if termo_esp not in termos:
                termos.append(termo_esp)
        return termos

    if substantivos:
        if len(substantivos) >= 2:
            # Prefere o termo composto específico (ex.: "ar condicionado", "cadeira giratoria", "cafe torrado")
            termos.append(f"{substantivos[0]} {substantivos[1]}")
            # Só adiciona o 1º substantivo isolado se ele não for amplo demais
            palavras_amplas = {
                "veiculo", "veiculos", "equipamento", "material", " maquina",
                "maquinas", "aparelho", "produto", "conjunto", "kit", "papel",
                "tubo", "cabo", "placa", "caixa", "cadeira", "mesa",
            }
            if substantivos[0] not in palavras_amplas:
                termos.insert(0, substantivos[0])
        else:
            termos.append(substantivos[0])
        return termos

    return [texto_norm[:40].strip()]


def extrair_requisitos_minimos(descricao: str) -> List[Dict[str, Any]]:
    """
    Extrai da descrição digitada uma lista estruturada de requisitos mínimos:
    `[{"Atributo": ..., "Operador": ..., "Valor": ..., "Unidade": ..., "Obrigatorio": True}, ...]`
    """
    texto_norm = sem_acentos_minusculo(descricao)
    requisitos: List[Dict[str, Any]] = []

    if not texto_norm:
        return requisitos

    # 1. Objeto Principal (nunca usa palavra genérica isolada como 'locacao')
    if re.search(r"\blonas?\b", texto_norm):
        requisitos.append(
            {
                "Atributo": "Objeto principal",
                "Operador": "contém",
                "Valor": "lona",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    else:
        acao, substantivos = _extrair_nucleo_substantivo(texto_norm)
        if acao and substantivos:
            valor_obj = f"{acao} {substantivos[0]}"
        elif len(substantivos) >= 2:
            valor_obj = f"{substantivos[0]} {substantivos[1]}"
        elif substantivos:
            valor_obj = substantivos[0]
        else:
            valor_obj = texto_norm[:30]

        requisitos.append(
            {
                "Atributo": "Objeto principal",
                "Operador": "contém",
                "Valor": valor_obj,
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )

    # 2. Tipo / Categoria (para veículos, máquinas ou equipamentos, quando citado)
    tipos_veiculo_equip = [
        (["hatch", "hatchback"], "hatch"),
        (["sedan", "seda"], "sedan"),
        (["picape", "pickup", "pick-up", "caminhonete", "camionete"], "picape/caminhonete"),
        (["suv", "utilitario esportivo"], "suv"),
        (["van", "minivan", "furgao"], "van/furgão"),
        (["micro-onibus", "microonibus", "micro onibus"], "micro-ônibus"),
        (["onibus"], "ônibus"),
        (["caminhao"], "caminhão"),
        (["ambulancia"], "ambulância"),
        (["motocicleta", "moto"], "motocicleta"),
        (["passeio"], "passeio"),
        (["split"], "split"),
        (["inverter"], "inverter"),
    ]
    tipos_encontrados: List[str] = []
    for variantes, nome_tipo in tipos_veiculo_equip:
        if any(re.search(rf"\b{re.escape(v)}\b", texto_norm) for v in variantes):
            if nome_tipo not in tipos_encontrados:
                tipos_encontrados.append(nome_tipo)
    if tipos_encontrados:
        requisitos.append(
            {
                "Atributo": "Tipo / Categoria",
                "Operador": "=",
                "Valor": " / ".join(tipos_encontrados),
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )

    # 3. Material (quando especificado)
    if any(m in texto_norm for m in ["plastico", "plastica", "polietileno", "pebd", "pead"]):
        requisitos.append(
            {
                "Atributo": "Material",
                "Operador": "=",
                "Valor": "plástico",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    elif "aco inox" in texto_norm or "inoxidavel" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Material",
                "Operador": "=",
                "Valor": "aço inox",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    elif "aluminio" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Material",
                "Operador": "=",
                "Valor": "alumínio",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    elif "algodao" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Material",
                "Operador": "=",
                "Valor": "algodão",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )

    # 4. Cor
    cores_conhecidas = [
        (["preto", "preta"], "preta"),
        (["azul"], "azul"),
        (["amarelo", "amarela"], "amarela"),
        (["branco", "branca"], "branca"),
        (["verde"], "verde"),
        (["transparente", "cristal"], "transparente"),
        (["cinza", "prata"], "cinza/prata"),
    ]
    for variantes, cor_canonica in cores_conhecidas:
        if any(re.search(rf"\b{v}\b", texto_norm) for v in variantes):
            requisitos.append(
                {
                    "Atributo": "Cor",
                    "Operador": "=",
                    "Valor": cor_canonica,
                    "Unidade": "-",
                    "Obrigatorio": True,
                }
            )
            break

    # 5. Dimensões: Largura x Comprimento (ex.: "8MX100M", "8m x 100m", "8,00 X 100,00")
    match_dim = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)?\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\b",
        texto_norm,
    )
    if match_dim:
        v1 = _parse_float_ptbr(match_dim.group(1))
        v2 = _parse_float_ptbr(match_dim.group(2))
        if v1 is not None and v2 is not None:
            largura = min(v1, v2)
            comprimento = max(v1, v2)
            requisitos.append(
                {
                    "Atributo": "Largura",
                    "Operador": ">=",
                    "Valor": f"{largura:g}",
                    "Unidade": "m",
                    "Obrigatorio": True,
                }
            )
            requisitos.append(
                {
                    "Atributo": "Comprimento",
                    "Operador": ">=",
                    "Valor": f"{comprimento:g}",
                    "Unidade": "m",
                    "Obrigatorio": True,
                }
            )

    # 6. Espessura em micras ou milímetros (ex.: "200 micras", "0,200mm", "200 µ")
    match_micras = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:micras?|micra|µm?|mc)\b", texto_norm
    )
    if match_micras:
        esp = _parse_float_ptbr(match_micras.group(1))
        if esp is not None:
            requisitos.append(
                {
                    "Atributo": "Espessura",
                    "Operador": ">=",
                    "Valor": f"{esp:g}",
                    "Unidade": "micras",
                    "Obrigatorio": True,
                }
            )
    else:
        match_mm = re.search(r"(\d+(?:[.,]\d+)?)\s*mm\b", texto_norm)
        if match_mm:
            mm_val = _parse_float_ptbr(match_mm.group(1))
            if mm_val is not None and mm_val < 5.0:
                requisitos.append(
                    {
                        "Atributo": "Espessura",
                        "Operador": ">=",
                        "Valor": f"{mm_val * 1000:g}",
                        "Unidade": "micras",
                        "Obrigatorio": True,
                    }
                )

    # 7. Peso mínimo em kg (ex.: "110 kg", "110 kilos")
    match_peso = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|quilogramas?)\b", texto_norm
    )
    if match_peso:
        peso = _parse_float_ptbr(match_peso.group(1))
        if peso is not None:
            requisitos.append(
                {
                    "Atributo": "Peso",
                    "Operador": ">=",
                    "Valor": f"{peso:g}",
                    "Unidade": "kg",
                    "Obrigatorio": True,
                }
            )

    # 8. Atributos específicos de veículos / equipamentos (quando presentes na descrição)
    # 8a. Motorização (ex.: "1.0", "1.4", "1.6", "2.0")
    eh_contexto_veiculo = any(
        w in texto_norm
        for w in [
            "veiculo", "veiculos", "automovel", "automoveis", "automotor",
            "hatch", "sedan", "suv", "picape", "caminhonete", "camionete", "carro",
        ]
    )
    match_motor = re.search(
        r"(?:motor(?:izacao)?(?:\s+minima|\s+de)?\s*|cilindrada\s*)(\d[.,]\d)\b|\b([12][.,][034568])\s*(?:flex|diesel|gasolina|turbo|8v|12v|16v)\b",
        texto_norm,
    )
    if not match_motor and eh_contexto_veiculo:
        match_motor = re.search(r"\b([12]\.[034568])\b", texto_norm)
    if match_motor:
        m_str = match_motor.group(1) or (match_motor.group(2) if match_motor.lastindex and match_motor.lastindex >= 2 else None)
        m_val = _parse_float_ptbr(m_str)
        if m_val is not None and 1.0 <= m_val <= 6.0:
            requisitos.append(
                {
                    "Atributo": "Motorização",
                    "Operador": ">=",
                    "Valor": f"{m_val:.1f}",
                    "Unidade": "L",
                    "Obrigatorio": True,
                }
            )

    # 8b. Potência (CV / HP / BTUs)
    match_cv = re.search(r"(\d{2,4})\s*(?:cv|hp|cavalos)\b", texto_norm)
    if match_cv:
        requisitos.append(
            {
                "Atributo": "Potência",
                "Operador": ">=",
                "Valor": match_cv.group(1),
                "Unidade": "cv",
                "Obrigatorio": True,
            }
        )
    match_btu = re.search(r"(\d{4,6}(?:[.,]\d{3})?)\s*btus?\b", texto_norm)
    if match_btu:
        btu_limpo = match_btu.group(1).replace(".", "").replace(",", "")
        requisitos.append(
            {
                "Atributo": "Potência",
                "Operador": ">=",
                "Valor": btu_limpo,
                "Unidade": "BTUs",
                "Obrigatorio": True,
            }
        )

    # 8c. Combustível
    for comb_vars, comb_nome in [
        (["flex", "bicombustivel"], "flex"),
        (["diesel"], "diesel"),
        (["gasolina"], "gasolina"),
        (["eletrico", "hibrido"], "elétrico/híbrido"),
    ]:
        if any(re.search(rf"\b{c}\b", texto_norm) for c in comb_vars):
            requisitos.append(
                {
                    "Atributo": "Combustível",
                    "Operador": "=",
                    "Valor": comb_nome,
                    "Unidade": "-",
                    "Obrigatorio": True,
                }
            )
            break

    # 8d. Quantidade de portas (ex.: "4 portas", "04 portas")
    match_portas = re.search(r"0?(\d)\s*portas\b", texto_norm)
    if match_portas:
        requisitos.append(
            {
                "Atributo": "Portas",
                "Operador": ">=",
                "Valor": match_portas.group(1),
                "Unidade": "portas",
                "Obrigatorio": True,
            }
        )

    # 8e. Capacidade de passageiros / lugares (ex.: "5 passageiros", "7 lugares")
    match_lug = re.search(
        r"0?(\d{1,2})\s*(?:passageiros|lugares|ocupantes|pessoas)\b", texto_norm
    )
    if match_lug:
        requisitos.append(
            {
                "Atributo": "Capacidade",
                "Operador": ">=",
                "Valor": match_lug.group(1),
                "Unidade": "lugares",
                "Obrigatorio": True,
            }
        )

    # 8f. Ar-condicionado / Direção / Tração / Motorista
    if "ar condicionado" in texto_norm or "ar-condicionado" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Acessório",
                "Operador": "contém",
                "Valor": "ar condicionado",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    if "4x4" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Tração",
                "Operador": "=",
                "Valor": "4x4",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    if "sem motorista" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Regime",
                "Operador": "contém",
                "Valor": "sem motorista",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )
    elif "com motorista" in texto_norm:
        requisitos.append(
            {
                "Atributo": "Regime",
                "Operador": "contém",
                "Valor": "com motorista",
                "Unidade": "-",
                "Obrigatorio": True,
            }
        )

    # 9. Unidade de fornecimento esperada
    if any(u in texto_norm for u in ["rolo", "rolos", "bobina", "bobinas"]):
        requisitos.append(
            {
                "Atributo": "Unidade de fornecimento",
                "Operador": "compatível",
                "Valor": "rolo/bobina",
                "Unidade": "rolo/bobina",
                "Obrigatorio": True,
            }
        )
    elif any(re.search(rf"\b{u}\b", texto_norm) for u in ["mensal", "mensais", "mes", "meses"]):
        requisitos.append(
            {
                "Atributo": "Unidade de fornecimento",
                "Operador": "compatível",
                "Valor": "mensal/mês",
                "Unidade": "mês",
                "Obrigatorio": True,
            }
        )
    elif any(re.search(rf"\b{u}\b", texto_norm) for u in ["diaria", "diarias"]):
        requisitos.append(
            {
                "Atributo": "Unidade de fornecimento",
                "Operador": "compatível",
                "Valor": "diária",
                "Unidade": "diária",
                "Obrigatorio": True,
            }
        )

    return requisitos


def extrair_dimensoes_item(texto_norm: str) -> Optional[Tuple[float, float]]:
    """
    Extrai `(largura_m, comprimento_m)` da descrição de um item, interpretando formatos variados:
    - '8x100', '8 m x 100 m', '8,00 X 100,00', '08 x 100 mts', '8mx100m', '100m x 8m'
    - 'medindo 8 m de largura e 100 metros de comprimento'
    - '4 metros largura x 100 metros de comprimento'
    - 'largura de 8m ... comprimento de 100m'
    """
    m_larg = re.search(
        r"(?:largura(?:\s+minima|\s+de)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)?)"
        r"|(?:(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\s+(?:de\s+)?largura)",
        texto_norm,
    )
    m_comp = re.search(
        r"(?:comprimento(?:\s+minimo|\s+de)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)?)"
        r"|(?:(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\s+(?:de\s+)?comprimento)",
        texto_norm,
    )
    if m_larg and m_comp:
        str_l = m_larg.group(1) or m_larg.group(2)
        str_c = m_comp.group(1) or m_comp.group(2)
        val_l = _parse_float_ptbr(str_l)
        val_c = _parse_float_ptbr(str_c)
        if val_l is not None and val_c is not None and val_l > 0 and val_c > 0:
            return (min(val_l, val_c), max(val_l, val_c))

    padroes_axb = re.finditer(
        r"(?<!\d)(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m|mt|mts|metros?)?(?:\s+(?:de\s+)?largura)?\s*[xX*]\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m|mt|mts|metros?)?(?!\s*(?:cm|mm)\b)",
        texto_norm,
    )
    for m in padroes_axb:
        v1 = _parse_float_ptbr(m.group(1))
        v2 = _parse_float_ptbr(m.group(2))
        if v1 is not None and v2 is not None and v1 > 0 and v2 > 0:
            # Ignora tração 4x4 ou 4x2
            if (v1, v2) in {(4.0, 4.0), (4.0, 2.0), (2.0, 4.0)}:
                continue
            pos_fim = m.end()
            trecho_pos = texto_norm[pos_fim : pos_fim + 15]
            if re.match(r"^\s*[xX*]\s*\d+", trecho_pos):
                continue
            return (min(v1, v2), max(v1, v2))

    if m_larg and not m_comp:
        str_l = m_larg.group(1) or m_larg.group(2)
        val_l = _parse_float_ptbr(str_l)
        if val_l is not None and val_l > 0:
            return (val_l, -1.0)

    return None


def extrair_espessura_micras_item(texto_norm: str) -> Optional[float]:
    """
    Extrai a espessura em micras a partir da descrição do item, interpretando:
    - '200 micras', '200 micra', '200 µ', '200µm', '200 mc', '200 micras (0,20mm)'
    - '0,2mm', '0,20mm', '0,200mm', '0,20 milimetros' (converte mm -> micras * 1000)
    """
    m_micra = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:micras?|micra|µm?|mc|microns?)\b",
        texto_norm,
    )
    if m_micra:
        val = _parse_float_ptbr(m_micra.group(1))
        if val is not None and val >= 5:
            return val

    m_mm = re.search(
        r"(\d+[.,]\d+)\s*(?:mm|milimetros?)\b",
        texto_norm,
    )
    if m_mm:
        val_mm = _parse_float_ptbr(m_mm.group(1))
        if val_mm is not None and 0.01 <= val_mm <= 3.0:
            return round(val_mm * 1000.0, 2)

    return None


def extrair_peso_kg_item(texto_norm: str) -> Optional[float]:
    """Extrai o peso em kg a partir da descrição do item."""
    matches = re.finditer(
        r"(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|quilogramas?)(?!\s*/\s*m)",
        texto_norm,
    )
    pesos_encontrados: List[float] = []
    for m in matches:
        val = _parse_float_ptbr(m.group(1))
        if val is not None and val > 0:
            pesos_encontrados.append(val)

    if pesos_encontrados:
        return max(pesos_encontrados)
    return None


def verificar_unidade_compativel(
    valor_esperado: str, unidade_api: Optional[str], texto_item_norm: str
) -> Tuple[bool, str]:
    """
    Verifica a Regra R5: unidade de fornecimento compatível com o objeto,
    sem converter unidades para 'encaixar' itens menores.
    """
    un_api = sem_acentos_minusculo(unidade_api or "")
    esp = sem_acentos_minusculo(valor_esperado)

    if "rolo" in esp or "bobina" in esp:
        unidades_incompativeis = {
            "metro", "metros", "m", "mt", "mts",
            "m2", "m²", "metro quadrado", "metros quadrados",
            "kg", "quilograma", "quilogramas", "quilo", "quilos", "grama", "gramas",
            "lote", "kit", "conjunto", "par", "litro", "litros", "caixa", "pacote",
        }
        if un_api in unidades_incompativeis or any(
            un_api.startswith(x + " ") for x in ["metro", "quilograma", "lote"]
        ):
            return (
                False,
                f"Unidade incompatível na ARP ('{unidade_api}') para objeto em rolo/bobina (R5)",
            )

        if any(k in un_api for k in ["rolo", "rl", "bobina", "bob", "rlo"]):
            return True, f"Unidade '{unidade_api}' compatível (rolo/bobina)"

        if un_api in {"unidade", "un", "und", "unid", "unid.", "peca", "pc", "pç"}:
            if any(
                re.search(rf"\b{p}\b", texto_item_norm)
                for p in ["rolo", "rolos", "bobina", "bobinas"]
            ):
                return (
                    True,
                    f"Unidade '{unidade_api}' com descrição explícita de rolo/bobina",
                )
            return (
                False,
                f"Unidade '{unidade_api}' sem indicação de rolo/bobina na descrição (R5)",
            )

        if not un_api:
            return False, "Unidade de fornecimento não informada na ARP"
        return False, f"Unidade '{unidade_api}' incompatível com rolo/bobina"

    if "mensal" in esp or "mes" in esp:
        if any(k in un_api for k in ["diaria", "dia", "km", "quilometro", "hora", "hr", "litro"]):
            return False, f"Unidade '{unidade_api}' incompatível com regime mensal (R5)"
        return True, f"Unidade '{unidade_api or 'mensal'}'"

    if "diaria" in esp:
        if any(k in un_api for k in ["mes", "mensal", "km", "quilometro", "hora", "anual"]):
            return False, f"Unidade '{unidade_api}' incompatível com diária (R5)"
        return True, f"Unidade '{unidade_api or 'diária'}'"

    if not un_api:
        return False, "Unidade de fornecimento não informada"
    if un_api == "lote":
        return False, "Item cadastrado como LOTE sem unidade individual (R5)"
    return True, f"Unidade '{unidade_api}'"


def _palavra_presente_ou_sinonimo(
    palavra: str, texto_item_norm: str, texto_contexto_ata_norm: str = ""
) -> bool:
    """
    Verifica se `palavra` (ou plural/singular/sinônimo direto do domínio) consta no item.
    Para palavras de modalidade ('locacao'), aceita também que conste no objeto da ata.
    """
    if palavra in {"locacao", "aluguel"}:
        padrao_loc = r"\b(locacao|locacoes|aluguel|locar|mensal|diaria)\b"
        return bool(
            re.search(padrao_loc, texto_item_norm)
            or re.search(padrao_loc, texto_contexto_ata_norm)
        )

    if palavra in {"veiculo", "veiculos", "automovel", "automoveis"}:
        padrao_veic = (
            r"\b(veiculos?|automoveis|automovel|automotor|carro|caminhonetes?|"
            r"camionetes?|picapes?|pickup|sedan|seda|hatch|suv|utilitarios?|"
            r"vans?|furgao|onibus|micro-?onibus|caminhao|ambulancias?|motocicletas?)\b"
        )
        return bool(re.search(padrao_veic, texto_item_norm))

    # Singular/plural geral em português
    base = palavra.rstrip("s")
    if len(base) >= 3:
        return bool(re.search(rf"\b{re.escape(base)}(?:s|es)?\b", texto_item_norm))
    return palavra in texto_item_norm


def avaliar_aderencia_item(
    descricao_item: Optional[str],
    unidade_medida_api: Optional[str],
    requisitos: List[Dict[str, Any]],
    informacao_complementar_item: Optional[str] = None,
    objeto_ata: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Classifica o item da ARP em:
      - 'A': Atende TODOS os requisitos mínimos verificáveis na descrição do item.
      - 'B': Atende ao objeto e não viola nenhum requisito, mas possui atributo(s)
             ausente(s) na descrição ou informação insuficiente (revisão manual).
             Regra inegociável: Atributo ausente na descrição NUNCA resulta em A.
      - 'C': Não atende (viola algum requisito mínimo, é outro objeto ou tem unidade incompatível).
    """
    texto_completo = f"{descricao_item or ''} {informacao_complementar_item or ''}".strip()
    texto_norm = sem_acentos_minusculo(texto_completo)
    # Normaliza numerais por extenso comuns em especificações de itens (ex.: "quatro portas" -> "4 portas")
    for ext, dig in [
        ("duas", "2"),
        ("dois", "2"),
        ("tres", "3"),
        ("quatro", "4"),
        ("cinco", "5"),
        ("seis", "6"),
        ("sete", "7"),
        ("oito", "8"),
    ]:
        texto_norm = re.sub(
            rf"\b{ext}\s+(portas|passageiros|lugares|ocupantes|pessoas)\b",
            rf"{dig} \1",
            texto_norm,
        )
    texto_ata_norm = sem_acentos_minusculo(objeto_ata or "")

    if not texto_norm:
        return {
            "aderencia": "C",
            "motivo": "Descrição do item vazia na ARP",
            "atendidos": [],
            "ausentes": [],
            "reprovados": ["Descrição vazia"],
        }

    atendidos: List[str] = []
    ausentes: List[str] = []
    reprovados: List[str] = []

    dimensoes_item = extrair_dimensoes_item(texto_norm)
    espessura_item = extrair_espessura_micras_item(texto_norm)
    peso_item = extrair_peso_kg_item(texto_norm)

    for req in requisitos:
        if not req.get("Obrigatorio", True):
            continue

        atrib = str(req.get("Atributo") or "").strip()
        atrib_norm = sem_acentos_minusculo(atrib)
        operador = str(req.get("Operador") or "").strip()
        valor_str = str(req.get("Valor") or "").strip()
        valor_norm = sem_acentos_minusculo(valor_str)
        unidade_req = str(req.get("Unidade") or "").strip()

        # 1. Objeto principal
        if "objeto" in atrib_norm:
            palavras_obj = [
                p for p in valor_norm.split() if len(p) >= 3 and p not in STOPWORDS_GERAIS
            ]
            if not palavras_obj:
                palavras_obj = [valor_norm]

            if not all(
                _palavra_presente_ou_sinonimo(p, texto_norm, texto_ata_norm)
                for p in palavras_obj
            ):
                return {
                    "aderencia": "C",
                    "motivo": f"Item não corresponde ao objeto pesquisado ('{valor_str}' ausente na descrição do item)",
                    "atendidos": atendidos,
                    "ausentes": ausentes,
                    "reprovados": [f"Objeto '{valor_str}' não encontrado"],
                }

            # Se o objeto pesquisado for lona plástica, descarta serviços de locação/banner/freio
            if "lona" in valor_norm and "locacao" not in valor_norm:
                if any(
                    s in texto_norm
                    for s in [
                        "locacao de lona",
                        "servico de instalacao",
                        "confeccao de banner",
                        "impressao digital em lona",
                        "lona para ploter",
                        "lona para plotter",
                        "lona frontlight",
                        "lona backlight",
                        "lona com ilhos para caminhao",
                        "lona de freio",
                        "lona para freio",
                        "lona cirurgica",
                    ]
                ):
                    return {
                        "aderencia": "C",
                        "motivo": "Item refere-se a outro produto/serviço (ex.: lona de freio, plotter, banner ou locação)",
                        "atendidos": atendidos,
                        "ausentes": ausentes,
                        "reprovados": ["Produto distinto do objeto pesquisado"],
                    }

            # Se o objeto pesquisado for locação de veículos, descarta peças, manutenção, lavagem, passagens, câmeras ou cobrança por km avulso
            if "veicul" in valor_norm and "locacao" in valor_norm:
                un_api_low = sem_acentos_minusculo(unidade_medida_api or "")
                if any(
                    s in texto_norm
                    for s in [
                        "manutencao preventiva",
                        "manutencao corretiva",
                        "aquisicao de pecas",
                        "fornecimento de pecas",
                        "lavagem de veiculo",
                        "seguro veicular",
                        "rastreador veicular",
                        "rastreamento veicular",
                        "passagem aerea",
                        "passagens aereas",
                        "passagem rodoviaria",
                        "bilhetes de passagens",
                        "agenciamento de viagens",
                        "leitura de placa",
                        "camera ip",
                        "camera lpr",
                        "camera fixa",
                        "licenca de software",
                        "taxa de administracao",
                        "gerenciamento de frota",
                        "locacao de banheiro",
                        "locacao de tenda",
                        "locacao de palco",
                        "locacao de som",
                        "locacao de impressora",
                    ]
                ) or (
                    "km" not in valor_norm
                    and (
                        un_api_low in {"km", "quilometro", "quilometros", "km rodado"}
                        or "km rodado" in texto_norm
                        or "quilometro rodado" in texto_norm
                    )
                ):
                    return {
                        "aderencia": "C",
                        "motivo": "Item refere-se a outro serviço (passagem, câmera, manutenção, taxa ou km avulso)",
                        "atendidos": atendidos,
                        "ausentes": ausentes,
                        "reprovados": ["Serviço distinto de locação de veículos"],
                    }

            atendidos.append(f"Objeto: {valor_str}")
            continue

        # 2. Unidade de fornecimento (R5)
        if "unidade" in atrib_norm:
            ok_un, msg_un = verificar_unidade_compativel(
                valor_str, unidade_medida_api, texto_norm
            )
            if not ok_un:
                reprovados.append(msg_un)
            else:
                atendidos.append(msg_un)
            continue

        # 3. Tipo / Categoria
        if "tipo" in atrib_norm or "categoria" in atrib_norm:
            partes_base = [p.strip() for p in re.split(r"[/,]", valor_norm) if p.strip()]
            sinonimos_tipo = {
                "hatch": ["hatch", "hatchback"],
                "sedan": ["sedan", "seda"],
                "seda": ["sedan", "seda"],
                "picape": ["picape", "pickup", "pick-up", "caminhonete", "camionete"],
                "caminhonete": ["picape", "pickup", "pick-up", "caminhonete", "camionete"],
                "suv": ["suv", "utilitario esportivo"],
                "van": ["van", "vans", "minivan", "furgao"],
                "onibus": ["onibus"],
                "micro-onibus": ["micro-onibus", "microonibus"],
                "caminhao": ["caminhao", "caminhoes"],
                "motocicleta": ["motocicleta", "moto", "motocicletas", "motos"],
            }
            partes_tipo: List[str] = []
            for p in partes_base:
                partes_tipo.extend(sinonimos_tipo.get(p, [p]))

            if any(re.search(rf"\b{re.escape(p)}\b", texto_norm) for p in partes_tipo):
                atendidos.append(f"Tipo/Categoria: {valor_str}")
            else:
                # Verifica se o item especifica explicitamente outro tipo conflitante
                tipos_conflitantes = [
                    "hatch", "hatchback", "sedan", "seda", "picape", "pickup", "pick-up",
                    "caminhonete", "camionete", "suv", "van", "vans", "furgao", "minivan",
                    "onibus", "micro-onibus", "microonibus", "caminhao", "caminhoes",
                    "ambulancia", "motocicleta", "moto", "trator", "retroescavadeira",
                    "motoniveladora", "escavadeira", "empilhadeira", "guincho", "reboque",
                ]
                outros_no_item = [
                    t for t in tipos_conflitantes
                    if t not in partes_tipo and re.search(rf"\b{re.escape(t)}\b", texto_norm)
                ]
                if outros_no_item:
                    reprovados.append(
                        f"Tipo/Categoria incompatível ({'/'.join(sorted(set(outros_no_item)))} em vez de {valor_str})"
                    )
                else:
                    ausentes.append(f"Tipo/Categoria ({valor_str}) não especificado")
            continue

        # 3b. Regime (sem motorista vs com motorista)
        if "regime" in atrib_norm:
            if "sem motorista" in valor_norm:
                if "sem motorista" in texto_norm or "sem condutor" in texto_norm:
                    atendidos.append("Regime: sem motorista")
                elif "com motorista" in texto_norm or "com condutor" in texto_norm:
                    reprovados.append("Regime incompatível (com motorista em vez de sem motorista)")
                else:
                    ausentes.append("Regime ('sem motorista') ausente na descrição")
            elif "com motorista" in valor_norm:
                if "com motorista" in texto_norm or "com condutor" in texto_norm:
                    atendidos.append("Regime: com motorista")
                elif "sem motorista" in texto_norm or "sem condutor" in texto_norm:
                    reprovados.append("Regime incompatível (sem motorista em vez de com motorista)")
                else:
                    ausentes.append("Regime ('com motorista') ausente na descrição")
            else:
                if valor_norm in texto_norm:
                    atendidos.append(f"Regime: {valor_str}")
                else:
                    ausentes.append(f"Regime ('{valor_str}') ausente na descrição")
            continue

        # 4. Material
        if "material" in atrib_norm:
            if "plast" in valor_norm or "polietileno" in valor_norm:
                if any(
                    m in texto_norm
                    for m in ["algodao", "encerado de algodao", "lona de algodao"]
                ) and "plast" not in texto_norm:
                    reprovados.append("Material incompatível (algodão em vez de plástico)")
                elif any(
                    m in texto_norm
                    for m in ["plastico", "plastica", "polietileno", "pebd", "pead"]
                ):
                    atendidos.append("Material: plástico/polietileno")
                else:
                    ausentes.append("Material plástico não especificado na descrição")
            else:
                if valor_norm in texto_norm:
                    atendidos.append(f"Material: {valor_str}")
                else:
                    ausentes.append(f"Material ({valor_str}) ausente")
            continue

        # 5. Cor
        if "cor" in atrib_norm:
            if valor_norm in {"preta", "preto"}:
                tem_preta = bool(
                    re.search(r"\b(preta|preto|preta/branca|dupla face)\b", texto_norm)
                )
                outras_cores = re.findall(
                    r"\b(azul|amarela|amarelo|transparente|cristal|verde|laranja|vermelha|vermelho)\b",
                    texto_norm,
                )
                if tem_preta:
                    if any(
                        df_str in texto_norm
                        for df_str in [
                            "preta e branca",
                            "preto e branco",
                            "preta/branca",
                            "preto/branco",
                            "dupla face",
                        ]
                    ):
                        ausentes.append("Cor: menciona dupla face preta/branca (revisão manual)")
                    else:
                        atendidos.append("Cor: preta")
                elif outras_cores:
                    reprovados.append(
                        f"Cor incompatível ({'/'.join(sorted(set(outras_cores)))} em vez de preta)"
                    )
                else:
                    ausentes.append("Cor não informada na descrição")
            else:
                if valor_norm in texto_norm:
                    atendidos.append(f"Cor: {valor_str}")
                else:
                    ausentes.append(f"Cor ({valor_str}) não informada")
            continue

        # 6. Largura (m)
        if "largura" in atrib_norm:
            req_val = _parse_float_ptbr(valor_str)
            if req_val is not None:
                if dimensoes_item is not None:
                    larg_item, _ = dimensoes_item
                    if _comparar_num(larg_item, operador, req_val):
                        atendidos.append(f"Largura: {larg_item:g}m ({operador} {req_val:g}m)")
                    else:
                        reprovados.append(
                            f"Largura inferior ao mínimo ({larg_item:g}m < {req_val:g}m)"
                        )
                else:
                    ausentes.append(f"Largura ({operador} {req_val:g}m) não informada")
            continue

        # 7. Comprimento (m)
        if "comprimento" in atrib_norm:
            req_val = _parse_float_ptbr(valor_str)
            if req_val is not None:
                un_api_norm = sem_acentos_minusculo(unidade_medida_api or "")
                m_un_comp = re.search(
                    r"(?:rolo|bobina)\s*(?:de\s*|com\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\b",
                    un_api_norm,
                )
                comp_un_api = (
                    _parse_float_ptbr(m_un_comp.group(1)) if m_un_comp else None
                )

                if comp_un_api is not None and not _comparar_num(
                    comp_un_api, operador, req_val
                ):
                    reprovados.append(
                        f"Comprimento da unidade ('{unidade_medida_api}') inferior ao mínimo ({comp_un_api:g}m < {req_val:g}m)"
                    )
                elif dimensoes_item is not None and dimensoes_item[1] > 0:
                    _, comp_item = dimensoes_item
                    if _comparar_num(comp_item, operador, req_val):
                        atendidos.append(
                            f"Comprimento: {comp_item:g}m ({operador} {req_val:g}m)"
                        )
                    else:
                        reprovados.append(
                            f"Comprimento inferior ao mínimo ({comp_item:g}m < {req_val:g}m)"
                        )
                elif comp_un_api is not None and _comparar_num(
                    comp_un_api, operador, req_val
                ):
                    atendidos.append(
                        f"Comprimento na unidade: {comp_un_api:g}m ({operador} {req_val:g}m)"
                    )
                else:
                    ausentes.append(f"Comprimento ({operador} {req_val:g}m) não informado")
            continue

        # 8. Espessura (micras)
        if "espessura" in atrib_norm or "micra" in atrib_norm:
            req_val = _parse_float_ptbr(valor_str)
            if req_val is not None:
                if espessura_item is not None:
                    if _comparar_num(espessura_item, operador, req_val):
                        atendidos.append(
                            f"Espessura: {espessura_item:g} micras ({operador} {req_val:g} micras)"
                        )
                    else:
                        reprovados.append(
                            f"Espessura incompatível ({espessura_item:g} micras vs {operador} {req_val:g} micras)"
                        )
                else:
                    ausentes.append(
                        f"Espessura ({operador} {req_val:g} micras) não informada"
                    )
            continue

        # 9. Peso (kg)
        if "peso" in atrib_norm:
            req_val = _parse_float_ptbr(valor_str)
            if req_val is not None:
                if peso_item is not None:
                    if _comparar_num(peso_item, operador, req_val):
                        atendidos.append(f"Peso: {peso_item:g} kg ({operador} {req_val:g} kg)")
                    else:
                        reprovados.append(
                            f"Peso inferior ao mínimo ({peso_item:g} kg < {req_val:g} kg)"
                        )
                else:
                    ausentes.append(f"Peso ({operador} {req_val:g} kg) não informado")
            continue

        # 10. Motorização (ex.: >= 1.0, >= 1.4)
        if "motor" in atrib_norm:
            req_val = _parse_float_ptbr(valor_str)
            if req_val is not None:
                m_mot = re.search(
                    r"(?:motor(?:izacao)?(?:\s+minima|\s+de)?\s*|cilindrada\s*)(\d[.,]\d)\b|\b([12][.,][034568])\b",
                    texto_norm,
                )
                if m_mot:
                    val_m = _parse_float_ptbr(m_mot.group(1) or m_mot.group(2))
                    if val_m is not None:
                        if _comparar_num(val_m, operador, req_val):
                            atendidos.append(f"Motorização: {val_m:.1f}")
                        else:
                            reprovados.append(f"Motorização inferior ({val_m:.1f} < {req_val:.1f})")
                        continue
                ausentes.append(f"Motorização ({operador} {req_val:.1f}) não informada")
            continue

        # 11. Requisito genérico
        req_num = _parse_float_ptbr(valor_str)
        if req_num is not None and operador in {">=", "<=", "=", ">", "<"}:
            un_norm = sem_acentos_minusculo(unidade_req)
            if un_norm and un_norm != "-":
                m_gen = re.search(
                    rf"0?(\d+(?:[.,]\d+)?)\s*{re.escape(un_norm)}\b", texto_norm
                )
                if m_gen:
                    val_enc = _parse_float_ptbr(m_gen.group(1))
                    if val_enc is not None:
                        if _comparar_num(val_enc, operador, req_num):
                            atendidos.append(f"{atrib}: {val_enc:g} {unidade_req}")
                        else:
                            reprovados.append(
                                f"{atrib} incompatível ({val_enc:g} vs {operador} {req_num:g} {unidade_req})"
                            )
                        continue
            ausentes.append(f"{atrib} ({operador} {valor_str} {unidade_req}) não informado")
        else:
            if valor_norm and valor_norm in texto_norm:
                atendidos.append(f"{atrib}: {valor_str}")
            else:
                ausentes.append(f"{atrib} ('{valor_str}') ausente na descrição")

    if reprovados:
        return {
            "aderencia": "C",
            "motivo": "Não atende aos requisitos: " + "; ".join(reprovados),
            "atendidos": atendidos,
            "ausentes": ausentes,
            "reprovados": reprovados,
        }

    if ausentes:
        return {
            "aderencia": "B",
            "motivo": "Informação incompleta na descrição (revisão manual): "
            + "; ".join(ausentes),
            "atendidos": atendidos,
            "ausentes": ausentes,
            "reprovados": [],
        }

    return {
        "aderencia": "A",
        "motivo": "Atende todos os requisitos mínimos verificáveis ("
        + ", ".join(atendidos)
        + ")",
        "atendidos": atendidos,
        "ausentes": [],
        "reprovados": [],
    }


def _comparar_num(valor_item: float, operador: str, valor_req: float) -> bool:
    op = operador.strip()
    if op in {">=", "≥"}:
        return valor_item + 1e-6 >= valor_req
    if op in {"<=", "≤"}:
        return valor_item - 1e-6 <= valor_req
    if op in {"=", "=="}:
        return abs(valor_item - valor_req) <= 1e-4
    if op == ">":
        return valor_item > valor_req
    if op == "<":
        return valor_item < valor_req
    return valor_item + 1e-6 >= valor_req
