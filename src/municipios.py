"""Módulo de validação de municípios e esferas administrativas (Regras R1, R2 e R7)."""

import json
import unicodedata
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, Set
import pandas as pd
import requests

from src.config import (
    CSV_MUNICIPIOS_PATH,
    IBGE_CACHE_PATH,
    IBGE_MUNICIPIOS_URL,
    RAW_JSON_LOG_PATH,
    REQUEST_TIMEOUT_SECONDS,
    TZ_RECIFE,
)


def normalizar_nome_municipio(nome: Optional[str]) -> str:
    """
    Normaliza o nome do município removendo acentos, espaços extras e convertendo
    para letras minúsculas, para casamento por igualdade EXATA (Regra R2).
    """
    if not nome or not isinstance(nome, str):
        return ""
    texto = nome.strip()
    nfkd = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Normaliza espaços múltiplos e converte para minúsculas
    return " ".join(sem_acento.lower().split())


def normalizar_uf(uf: Optional[str]) -> str:
    """Normaliza a sigla da UF para 2 letras maiúsculas."""
    if not uf or not isinstance(uf, str):
        return ""
    return uf.strip().upper()


def _extrair_uf_ibge(item: Dict[str, Any]) -> str:
    """Extrai a sigla da UF de um registro da API de localidades do IBGE."""
    try:
        micro = item.get("microrregiao")
        if micro and isinstance(micro, dict):
            meso = micro.get("mesorregiao") or {}
            uf_obj = meso.get("UF") or {}
            if uf_obj.get("sigla"):
                return str(uf_obj["sigla"]).strip().upper()
    except Exception:
        pass
    try:
        reg_im = item.get("regiao-imediata")
        if reg_im and isinstance(reg_im, dict):
            reg_int = reg_im.get("regiao-intermediaria") or {}
            uf_obj = reg_int.get("UF") or {}
            if uf_obj.get("sigla"):
                return str(uf_obj["sigla"]).strip().upper()
    except Exception:
        pass
    return ""


def obter_mapa_ibge() -> Dict[str, Dict[str, str]]:
    """
    Consulta a API oficial de localidades do IBGE (ou lê do cache local se já consultado)
    e retorna um dicionário mapeando:
      - chave "(nome_normalizado, UF)" -> {"codigo_ibge": "7 digitos", "nome_ibge": "...", "uf": "..."}
      - chave "codigo_ibge" -> {"codigo_ibge": "7 digitos", "nome_ibge": "...", "uf": "..."}
    """
    if IBGE_CACHE_PATH.exists():
        try:
            with open(IBGE_CACHE_PATH, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if cached and "por_chave" in cached and "por_codigo" in cached:
                return cached
        except Exception:
            pass

    resp = requests.get(IBGE_MUNICIPIOS_URL, timeout=REQUEST_TIMEOUT_SECONDS)
    resp.raise_for_status()
    dados = resp.json()

    por_chave: Dict[str, Dict[str, str]] = {}
    por_codigo: Dict[str, Dict[str, str]] = {}

    for item in dados:
        cod = str(item.get("id", "")).strip()
        nome_oficial = str(item.get("nome", "")).strip()
        uf = _extrair_uf_ibge(item)
        if not cod or not nome_oficial or not uf:
            continue
        nome_norm = normalizar_nome_municipio(nome_oficial)
        chave = f"{nome_norm}|{uf}"
        registro = {
            "codigo_ibge": cod,
            "nome_ibge": nome_oficial,
            "nome_norm": nome_norm,
            "uf": uf,
        }
        por_chave[chave] = registro
        por_codigo[cod] = registro

    resultado = {
        "atualizado_em": datetime.now(TZ_RECIFE).isoformat(),
        "total_municipios_ibge": len(por_codigo),
        "por_chave": por_chave,
        "por_codigo": por_codigo,
    }
    with open(IBGE_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    return resultado


class ValidadorMunicipios:
    """
    Gerencia a lista de municípios bilionários (`municipios_bilionarios_2026.csv`),
    preenche `codigo_ibge` via API do IBGE na primeira execução e valida as Regras R1, R2 e R7.
    """

    def __init__(self) -> None:
        self.df_csv: pd.DataFrame = pd.DataFrame()
        self.codigos_ibge_validos: Set[str] = set()
        self.chaves_nome_uf_validas: Set[Tuple[str, str]] = set()
        self.detalhes_por_codigo: Dict[str, Dict[str, str]] = {}
        self.detalhes_por_nome_uf: Dict[Tuple[str, str], Dict[str, str]] = {}
        self._carregar_e_validar_csv()

    def _carregar_e_validar_csv(self) -> None:
        if not CSV_MUNICIPIOS_PATH.exists():
            raise FileNotFoundError(
                f"Arquivo obrigatório não encontrado: {CSV_MUNICIPIOS_PATH}"
            )

        df = pd.read_csv(CSV_MUNICIPIOS_PATH, dtype=str).fillna("")
        if "codigo_ibge" not in df.columns:
            df["codigo_ibge"] = ""

        # Verifica se há linhas sem codigo_ibge preenchido; se houver, consulta IBGE e atualiza o CSV
        precisa_atualizar_csv = False
        mapa_ibge = obter_mapa_ibge()
        por_chave_ibge = mapa_ibge.get("por_chave", {})
        por_codigo_ibge = mapa_ibge.get("por_codigo", {})

        for idx, row in df.iterrows():
            uf = normalizar_uf(row.get("uf", ""))
            municipio = str(row.get("municipio", "")).strip()
            cod_atual = str(row.get("codigo_ibge", "")).strip()
            nome_norm = normalizar_nome_municipio(municipio)
            chave_ibge = f"{nome_norm}|{uf}"

            if not cod_atual or cod_atual not in por_codigo_ibge:
                info_ibge = por_chave_ibge.get(chave_ibge)
                if info_ibge:
                    cod_atual = info_ibge["codigo_ibge"]
                    df.at[idx, "codigo_ibge"] = cod_atual
                    precisa_atualizar_csv = True

            if cod_atual:
                self.codigos_ibge_validos.add(cod_atual)
                self.detalhes_por_codigo[cod_atual] = {
                    "municipio": municipio,
                    "uf": uf,
                    "codigo_ibge": cod_atual,
                    "porte_orcamentario": str(row.get("porte_orcamentario", "")),
                }
            if nome_norm and uf:
                par = (nome_norm, uf)
                self.chaves_nome_uf_validas.add(par)
                self.detalhes_por_nome_uf[par] = {
                    "municipio": municipio,
                    "uf": uf,
                    "codigo_ibge": cod_atual,
                    "porte_orcamentario": str(row.get("porte_orcamentario", "")),
                }

        if precisa_atualizar_csv:
            df.to_csv(CSV_MUNICIPIOS_PATH, index=False, encoding="utf-8")

        self.df_csv = df

    def registrar_falha_campo_canonico(self, contexto: str, payload_bruto: Any) -> None:
        """Registra no log JSONL quando um campo canônico obrigatório (como esfera) falha (R7)."""
        registro = {
            "timestamp": datetime.now(TZ_RECIFE).isoformat(),
            "contexto": contexto,
            "payload_bruto": payload_bruto,
        }
        with open(RAW_JSON_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(registro, ensure_ascii=False) + "\n")

    def avaliar_orgao_gerenciador(
        self,
        esfera_id: Optional[str],
        uf: Optional[str],
        municipio_nome: Optional[str],
        codigo_ibge: Optional[str],
        payload_bruto_para_log: Any = None,
    ) -> Dict[str, Any]:
        """
        Avalia se o órgão gerenciador atende ao Critério de Validade (Regras R1, R2 e R7).

        Retorna dicionário com:
          - `atende_criterio_validade` (bool): True se União/Estado/DF ou Município da lista CSV
          - `motivo_descarte_escopo_a` (str | None): None se válido; caso contrário,
            "esfera não identificada" (R7) ou "município fora da lista" (R1)
          - `esfera_normalizada` (str): "Federal", "Estadual", "Distrital", "Municipal" ou "Não identificada"
          - `metodo_casamento_municipio` (str): detalhe da validação para auditoria
        """
        esf = (esfera_id or "").strip().upper()
        uf_norm = normalizar_uf(uf)
        mun_norm = normalizar_nome_municipio(municipio_nome)
        cod_norm = str(codigo_ibge or "").strip()

        # Mapeamento estrito do campo canônico esfera_id / esferaId do PNCP:
        # "F" = Federal (União), "E" = Estadual, "D" = Distrital, "M" = Municipal
        if not esf or esf not in {"F", "E", "D", "M"}:
            if payload_bruto_para_log is not None:
                self.registrar_falha_campo_canonico("esfera_nao_identificada", payload_bruto_para_log)
            return {
                "atende_criterio_validade": False,
                "motivo_descarte_escopo_a": "esfera não identificada",
                "esfera_normalizada": "Não identificada",
                "metodo_casamento_municipio": "Não aplicável (esfera não identificada)",
            }

        if esf == "F":
            return {
                "atende_criterio_validade": True,
                "motivo_descarte_escopo_a": None,
                "esfera_normalizada": "Federal",
                "metodo_casamento_municipio": "União (Federal) - aceito por regra R1",
            }

        if esf == "E":
            return {
                "atende_criterio_validade": True,
                "motivo_descarte_escopo_a": None,
                "esfera_normalizada": "Estadual",
                "metodo_casamento_municipio": "Estado - aceito por regra R1",
            }

        if esf == "D":
            return {
                "atende_criterio_validade": True,
                "motivo_descarte_escopo_a": None,
                "esfera_normalizada": "Distrital",
                "metodo_casamento_municipio": "Distrito Federal - aceito por regra R1",
            }

        # Esfera Municipal ("M"): aplicar Regra R1 e R2
        # R2: Casamento por código IBGE e/ou igualdade EXATA de (nome sem acentos e em minúsculas, UF).
        # Proibido casar por "contém"/substring.
        casou_ibge = bool(cod_norm and cod_norm in self.codigos_ibge_validos)
        casou_nome_uf = bool(
            mun_norm and uf_norm and (mun_norm, uf_norm) in self.chaves_nome_uf_validas
        )

        if casou_ibge and casou_nome_uf:
            return {
                "atende_criterio_validade": True,
                "motivo_descarte_escopo_a": None,
                "esfera_normalizada": "Municipal",
                "metodo_casamento_municipio": f"Código IBGE ({cod_norm}) e Nome+UF exatos ({municipio_nome}/{uf_norm})",
            }
        if casou_ibge:
            return {
                "atende_criterio_validade": True,
                "motivo_descarte_escopo_a": None,
                "esfera_normalizada": "Municipal",
                "metodo_casamento_municipio": f"Código IBGE ({cod_norm})",
            }
        if casou_nome_uf:
            return {
                "atende_criterio_validade": True,
                "motivo_descarte_escopo_a": None,
                "esfera_normalizada": "Municipal",
                "metodo_casamento_municipio": f"Igualdade exata Nome+UF ({municipio_nome}/{uf_norm})",
            }

        return {
            "atende_criterio_validade": False,
            "motivo_descarte_escopo_a": "município fora da lista",
            "esfera_normalizada": "Municipal",
            "metodo_casamento_municipio": f"Município não consta em municipios_bilionarios_2026.csv ({municipio_nome or 'sem nome'}/{uf_norm or 'sem UF'})",
        }
