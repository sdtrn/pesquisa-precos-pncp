"""Configurações centrais do sistema de Pesquisa de Preços em Atas do PNCP."""

import os
from pathlib import Path
from zoneinfo import ZoneInfo
import pandas as pd

# Restrição técnica validada: desativar infer_string futuro do pandas
pd.set_option("future.infer_string", False)

# Diretórios e arquivos base
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_MUNICIPIOS_PATH = BASE_DIR / "municipios_bilionarios_2026.csv"
CACHE_DIR = BASE_DIR / ".cache_pncp"
LOGS_DIR = BASE_DIR / "logs"
DOCS_DIR = BASE_DIR / "docs"

CACHE_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Armazena o banco SQLite de cache no disco local (SSD) para evitar bloqueios do Google Drive (G:\)
LOCAL_CACHE_DIR = Path(os.environ.get("LOCALAPPDATA", str(CACHE_DIR))) / "PesquisaPrecosPNCP_cache"
LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

CACHE_DB_PATH = LOCAL_CACHE_DIR / "http_cache.sqlite"
IBGE_CACHE_PATH = CACHE_DIR / "ibge_municipios_cache.json"
RAW_JSON_LOG_PATH = LOGS_DIR / "falhas_campos_canonicos.jsonl"
DIVERGENCIAS_LOG_PATH = LOGS_DIR / "divergencias_api_local.jsonl"

# Fuso horário oficial para comparação de datas pelo calendário
TZ_RECIFE = ZoneInfo("America/Recife")

# Endpoints PNCP (exclusivamente Atas de Registro de Preços e itens/resultados)
PNCP_SEARCH_URL = "https://pncp.gov.br/api/search/"
PNCP_API_V1_BASE = "https://pncp.gov.br/api/pncp/v1"
PNCP_CONSULTA_V1_BASE = "https://pncp.gov.br/api/consulta/v1"
PNCP_APP_ATAS_BASE = "https://pncp.gov.br/app/atas"

# Endpoint IBGE (exclusivamente para identificação de municípios - Regra R2)
IBGE_MUNICIPIOS_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

# Parâmetros de rede seguros e otimizados (keep-alive + pool de conexões)
REQUEST_TIMEOUT_SECONDS = 8
MAX_RETRIES = 2
BACKOFF_BASE_SECONDS = 0.15
PAUSE_BETWEEN_REQUESTS_SECONDS = 0.01
MAX_PARALLEL_WORKERS = 10
SEARCH_PAGE_SIZE = 100
ITEMS_PAGE_SIZE = 500

# Quantidade máxima de menores valores exibidos na janela de seleção (1 item por ata - R6)
TOP_N_ITENS_JANELA = 20

# Opções de escopo dos órgãos
ESCOPO_VALIDADE = "Critério de validade"
ESCOPO_TODOS = "Todos os órgãos do Brasil"
ESCOPO_POR_ESTADO = "ARPs por Estado (UF)"
ESCOPO_PE_RECIFE = "Governo de Pernambuco e Prefeitura do Recife"

# Lista oficial das 27 Unidades da Federação (UF)
UFS_BRASIL = [
    ("AC", "Acre"),
    ("AL", "Alagoas"),
    ("AP", "Amapá"),
    ("AM", "Amazonas"),
    ("BA", "Bahia"),
    ("CE", "Ceará"),
    ("DF", "Distrito Federal"),
    ("ES", "Espírito Santo"),
    ("GO", "Goiás"),
    ("MA", "Maranhão"),
    ("MT", "Mato Grosso"),
    ("MS", "Mato Grosso do Sul"),
    ("MG", "Minas Gerais"),
    ("PA", "Pará"),
    ("PB", "Paraíba"),
    ("PR", "Paraná"),
    ("PE", "Pernambuco"),
    ("PI", "Piauí"),
    ("RJ", "Rio de Janeiro"),
    ("RN", "Rio Grande do Norte"),
    ("RS", "Rio Grande do Sul"),
    ("RO", "Rondônia"),
    ("RR", "Roraima"),
    ("SC", "Santa Catarina"),
    ("SP", "São Paulo"),
    ("SE", "Sergipe"),
    ("TO", "Tocantins"),
]

# Opções de Status da ata
STATUS_VIGENTES = "Vigentes"
STATUS_NAO_VIGENTES = "Não vigentes"
STATUS_TODOS = "Todos"

STATUS_TO_API_PARAM = {
    STATUS_VIGENTES: "vigente",
    STATUS_NAO_VIGENTES: "nao_vigente",
    STATUS_TODOS: "todos",
}

# Opções de Data usada no período
DATA_ASSINATURA = "Data de assinatura da ata"
DATA_PUBLICACAO = "Data de publicação no PNCP"
DATA_VIGENCIA = "Vigência"
