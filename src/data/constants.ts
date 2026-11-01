export const TOP_N_ITENS_JANELA = 20;

// Endpoints PNCP (exclusivamente Atas de Registro de Preços e itens/resultados)
export const PNCP_SEARCH_URL = "https://pncp.gov.br/api/search/";
export const PNCP_API_V1_BASE = "https://pncp.gov.br/api/pncp/v1";
export const PNCP_CONSULTA_V1_BASE = "https://pncp.gov.br/api/consulta/v1";
export const PNCP_APP_ATAS_BASE = "https://pncp.gov.br/app/atas";
export const DADOS_ABERTOS_BASE = "https://dadosabertos.compras.gov.br";

// Parâmetros de rede ultrarrápidos e seguros (Fluid Compute Node.js)
export const REQUEST_TIMEOUT_MS = 3000;
export const MAX_RETRIES = 1;
export const MAX_PARALLEL_WORKERS = 25;
export const SEARCH_PAGE_SIZE = 100;
export const ITEMS_PAGE_SIZE = 500;

// Opções de escopo dos órgãos (3 filtros principais conforme definição do usuário)
export const ESCOPO_TODOS = "Todos os órgãos do Brasil";
export const ESCOPO_POR_REGIAO = "ARPs por Região";
export const ESCOPO_PE_RECIFE = "Governo de Pernambuco e Prefeitura do Recife";
// Mantidos para retrocompatibilidade com histórico/testes anteriores
export const ESCOPO_VALIDADE = "Critério de validade";
export const ESCOPO_POR_ESTADO = "ARPs por Estado (UF)";

export const OPCOES_ESCOPO = [
  ESCOPO_TODOS,
  ESCOPO_POR_REGIAO,
  ESCOPO_PE_RECIFE,
] as const;

// Regiões Geográficas Oficiais do Brasil (IBGE)
export interface RegiaoBrasil {
  nome: string;
  siglasUf: string[];
  descricaoUfs: string;
}

export const REGIOES_BRASIL: RegiaoBrasil[] = [
  {
    nome: "Nordeste",
    siglasUf: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    descricaoUfs: "AL, BA, CE, MA, PB, PE, PI, RN e SE (9 estados)",
  },
  {
    nome: "Norte",
    siglasUf: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    descricaoUfs: "AC, AP, AM, PA, RO, RR e TO (7 estados)",
  },
  {
    nome: "Centro-Oeste",
    siglasUf: ["DF", "GO", "MT", "MS"],
    descricaoUfs: "DF, GO, MT e MS (3 estados + DF)",
  },
  {
    nome: "Sudeste",
    siglasUf: ["ES", "MG", "RJ", "SP"],
    descricaoUfs: "ES, MG, RJ e SP (4 estados)",
  },
  {
    nome: "Sul",
    siglasUf: ["PR", "RS", "SC"],
    descricaoUfs: "PR, RS e SC (3 estados)",
  },
];

export const MAPA_REGIAO_UFS: Record<string, string[]> = Object.fromEntries(
  REGIOES_BRASIL.map((r) => [r.nome.toUpperCase(), r.siglasUf])
);

// Opções de Status da ata
export const STATUS_VIGENTES = "Vigentes";
export const STATUS_NAO_VIGENTES = "Não vigentes";
export const STATUS_TODOS = "Todos";

export const STATUS_TO_API_PARAM: Record<string, string> = {
  [STATUS_VIGENTES]: "vigente",
  [STATUS_NAO_VIGENTES]: "nao_vigente",
  [STATUS_TODOS]: "todos",
};

// Opções de Data usada no período (Data de assinatura em 1º lugar como padrão)
export const DATA_ASSINATURA = "Data de assinatura da ata";
export const DATA_PUBLICACAO = "Data de publicação no PNCP";
export const DATA_VIGENCIA = "Vigência";

// Lista oficial das 27 Unidades da Federação (UF)
export const UFS_BRASIL: Array<{ sigla: string; nome: string }> = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

// Critérios de Julgamento / Classificação de ARPs
import type { CriterioClassificacao } from "@/lib/domain/types";

export const CRITERIO_MENOR_PRECO: CriterioClassificacao = "menor_preco";
export const CRITERIO_MAIOR_DESCONTO: CriterioClassificacao = "maior_desconto";

export const OPCOES_CRITERIO: Array<{
  id: CriterioClassificacao;
  nome: string;
  descricaoCurta: string;
}> = [
  {
    id: CRITERIO_MENOR_PRECO,
    nome: "Menor Preço Unitário (R$)",
    descricaoCurta: "Classifica e seleciona as ARPs pelos menores valores unitários monetários.",
  },
  {
    id: CRITERIO_MAIOR_DESCONTO,
    nome: "Maior Taxa de Desconto (%)",
    descricaoCurta: "Classifica e seleciona as ARPs pelas maiores taxas de desconto percentual (ex: gestão de frota, combustíveis, cartões).",
  },
];

export interface PresetExemplo {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  escopoSugerido?: string;
  criterioSugerido?: CriterioClassificacao;
}

export const PRESETS_EXEMPLOS: PresetExemplo[] = [
  {
    id: "gestao-frota-combustivel",
    titulo: "Gerenciamento de Frota com Combustível (Maior Desconto)",
    categoria: "Frota / Combustível",
    descricao:
      "Contratação de serviços de gerenciamento e controle de frota de veículos, por meio de sistema informatizado e integrado via web, com cartão magnético/chip, para fornecimento e abastecimento contínuo de combustíveis (gasolina, etanol, diesel S10 e diesel comum) em rede credenciada de postos, com julgamento pela MAIOR TAXA DE DESCONTO.",
    escopoSugerido: ESCOPO_TODOS,
    criterioSugerido: CRITERIO_MAIOR_DESCONTO,
  },
  {
    id: "lona-8x100",
    titulo: "Lona Plástica Preta 8x100m (200 micras)",
    categoria: "Material / Engenharia",
    descricao:
      "Rolo de lona em plástico medindo no mínimo 8MX100M. Rolo de lona - em plástico resistente, novo de primeiro uso, acondicionado em bobina, cor preto fosco medindo no mínimo 8mX100m com no mínimo 200 micras (0,200mm). Pesando no mínimo 110 kg.",
    escopoSugerido: ESCOPO_VALIDADE,
  },
  {
    id: "veiculo-hatch",
    titulo: "Locação de Veículo Hatch 1.0 (Sem Motorista)",
    categoria: "Frota / Serviços",
    descricao:
      "Locação mensal de veículo tipo hatch, motorização mínima 1.0 flex, 4 portas, capacidade para 5 passageiros, com ar-condicionado, sem motorista.",
    escopoSugerido: ESCOPO_VALIDADE,
  },
  {
    id: "ar-condicionado-12000",
    titulo: "Ar-Condicionado Split Inverter 12.000 BTUs",
    categoria: "Equipamentos / Climatização",
    descricao:
      "Aparelho de ar condicionado tipo split inverter, capacidade de 12000 BTUs, ciclo frio, cor branca.",
    escopoSugerido: ESCOPO_VALIDADE,
  },
  {
    id: "caminhonete-4x4",
    titulo: "Locação de Caminhonete Picape 4x4 Diesel",
    categoria: "Frota / Serviços",
    descricao:
      "Locação mensal de veículo tipo picape cabine dupla, tração 4x4, combustível diesel, 4 portas, 5 lugares, ar condicionado, sem motorista.",
    escopoSugerido: ESCOPO_VALIDADE,
  },
];
