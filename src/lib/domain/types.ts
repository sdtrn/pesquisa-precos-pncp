export type OperadorRequisito = "contém" | "=" | ">=" | "<=" | "compatível" | ">" | "<";

export type CriterioClassificacao = "menor_preco" | "maior_desconto";

export type ModoNormalizacaoPreco = "auto" | "posto_mes" | "veiculo_mes" | "desativado";

export interface RequisitoMinimo {
  Atributo: string;
  Operador: OperadorRequisito | string;
  Valor: string;
  Unidade: string;
  Obrigatorio: boolean;
}

export type NivelAderencia = "A" | "B" | "C";

export interface ResultadoAderencia {
  aderencia: NivelAderencia;
  motivo: string;
  atendidos: string[];
  ausentes: string[];
  reprovados: string[];
}

export interface ArquivoArp {
  titulo: string;
  tipo: string;
  url: string;
  sequencial?: number;
  dataPublicacao?: string;
  ehTermoAditivo?: boolean;
}

export interface ItemCandidato {
  descricao_objeto: string;
  valor_unitario: number;
  valor_original?: number;
  unidade_original?: string;
  formula_normalizacao?: string;
  unidade_referencia?: string;
  normalizado?: boolean;
  quantitativo_previsto_arp: string;
  quantidade_numerica_str: string;
  unidade_fornecimento: string;
  numero_arp_licitacao: string;
  id_ata_r6: string;
  orgao_gerenciador_uf: string;
  orgao_nome: string;
  uf: string;
  municipio_nome: string;
  codigo_ibge: string;
  fornecedor: string;
  fornecedor_cnpj?: string;
  numero_item_lote: string;
  data_assinatura: string;
  vigencia_ata: string;
  data_inicio_vigencia?: string;
  data_fim_vigencia: string;
  situacao_ata: string;
  possibilidade_adesao?: "Sim" | "Não" | "Não informado";
  especificacao_complementar?: string;
  esfera: string;
  tipo_orgao: string;
  cnpj_orgao: string;
  ano_compra: string;
  seq_compra: string;
  seq_ata: string;
  link_ata_pncp: string;
  link_download_arp?: string;
  arquivos_arp?: ArquivoArp[];
  aderencia: NivelAderencia;
  detalhe_aderencia: string;
  orgao_atende_validade: "Sim" | "Não";
  data_hora_consulta: string;
  escopo_escolhido: string;
  status_escolhido: string;
  periodo_aplicado: string;
  termos_usados: string;
  eh_item_sintetico_ata?: boolean;
}

export interface RegistroDescartado {
  Nível: "Ata" | "Item";
  "Motivo do Descarte": string;
  "Nº da ARP / Controle PNCP": string;
  "Órgão Gerenciador/UF": string;
  Esfera: string;
  Município: string;
  "Nº do Item/Lote": string;
  "Descrição do Objeto / Item": string;
  "Valor Unitário (R$)": number | null;
  Unidade: string;
  "Data de Assinatura": string;
  "Vigência da Ata": string;
  "Situação da Ata": string;
  "Link no PNCP": string;
}

export interface ConferenciaStatusApi {
  termo: string;
  vigentes: number;
  nao_vigentes: number;
  soma_vigentes_mais_nao_vigentes: number;
  todos: number;
  equacao_valida: boolean;
}

export interface ParametrosPipeline {
  descricaoObjeto: string;
  termosBusca: string[];
  requisitos: RequisitoMinimo[];
  escopoOrgaos: string;
  criterioClassificacao?: CriterioClassificacao;
  modoNormalizacao?: ModoNormalizacaoPreco;
  statusAta: string;
  tipoDataPeriodo: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
  ufSelecionada?: string | null;
  regiaoSelecionada?: string | null;
  apenasMunicipiosBilionarios?: boolean;
  usarCache?: boolean;
}

export interface ResultadoPesquisa {
  momento_consulta: string;
  escopo_orgaos: string;
  criterio_classificacao?: CriterioClassificacao;
  modo_normalizacao_escolhido?: ModoNormalizacaoPreco;
  modo_normalizacao_aplicado?: ModoNormalizacaoPreco;
  unidade_referencia_padrao?: string;
  uf_selecionada?: string | null;
  regiao_selecionada?: string | null;
  apenas_municipios_bilionarios?: boolean;
  status_ata: string;
  tipo_data_periodo: string;
  data_inicial: string | null;
  data_final: string | null;
  periodo_aplicado_str: string;
  termos_busca: string[];
  requisitos: RequisitoMinimo[];
  total_atas_encontradas: number;
  atas_validas_escopo_periodo: number;
  total_itens_avaliados: number;
  conferencias_status_api: ConferenciaStatusApi[];
  itens_candidatos: ItemCandidato[];
  descartados: RegistroDescartado[];
  resumo_descartes: Record<string, number>;
}

export interface EstatisticasPrecos {
  quantidade: number;
  soma: number;
  media: number;
  mediana: number;
  menor: number;
  maior: number;
  desvioPadrao: number;
  coeficienteVariacao: number; // em %
  q1: number;
  q3: number;
  iqr: number;
  limiteInferiorOutlier: number;
  limiteSuperiorOutlier: number;
}

export interface RegistroHistoricoPesquisa {
  id: string;
  dataHoraPesquisa: string; // DD/MM/YYYY HH:MM:SS
  timestampIso: string;
  descricaoObjeto: string;
  escopoOrgaos: string;
  criterioClassificacao?: CriterioClassificacao;
  modoNormalizacao?: ModoNormalizacaoPreco;
  ufSelecionada?: string | null;
  regiaoSelecionada?: string | null;
  apenasMunicipiosBilionarios?: boolean;
  statusAta: string;
  periodoAplicado: string;
  termosBusca: string[];
  incluirRevisaoB: boolean;
  indicesSelecionados: number[];
  itensSelecionadosCount: number;
  mediaSelecionados: number;
  resultado: ResultadoPesquisa;
}
