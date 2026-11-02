import test from "node:test";
import assert from "node:assert";
import {
  MODO_NORMALIZACAO_AUTO,
  MODO_NORMALIZACAO_POSTO,
  MODO_NORMALIZACAO_VEICULO,
  MODO_NORMALIZACAO_DESATIVADO,
  OPCOES_MODO_NORMALIZACAO,
} from "../../src/data/constants.ts";
import type {
  ModoNormalizacaoPreco,
  ItemCandidato,
  ParametrosPipeline,
  ResultadoPesquisa,
  RegistroHistoricoPesquisa,
} from "../../src/lib/domain/types.ts";

test("Task 1: Constantes e opções de modo de normalização de preços unitários", () => {
  // Verificação dos valores literais das constantes
  assert.strictEqual(MODO_NORMALIZACAO_AUTO, "auto");
  assert.strictEqual(MODO_NORMALIZACAO_POSTO, "posto_mes");
  assert.strictEqual(MODO_NORMALIZACAO_VEICULO, "veiculo_mes");
  assert.strictEqual(MODO_NORMALIZACAO_DESATIVADO, "desativado");

  // Tipagem estática de ModoNormalizacaoPreco
  const modo1: ModoNormalizacaoPreco = MODO_NORMALIZACAO_AUTO;
  const modo2: ModoNormalizacaoPreco = MODO_NORMALIZACAO_POSTO;
  const modo3: ModoNormalizacaoPreco = MODO_NORMALIZACAO_VEICULO;
  const modo4: ModoNormalizacaoPreco = MODO_NORMALIZACAO_DESATIVADO;
  assert.ok(modo1 && modo2 && modo3 && modo4);

  // Verificação do array OPCOES_MODO_NORMALIZACAO
  assert.ok(Array.isArray(OPCOES_MODO_NORMALIZACAO), "OPCOES_MODO_NORMALIZACAO deve ser um array");
  assert.strictEqual(OPCOES_MODO_NORMALIZACAO.length, 4, "Deve conter 4 opções");

  const ids = OPCOES_MODO_NORMALIZACAO.map((o) => o.id);
  assert.deepStrictEqual(ids, ["auto", "posto_mes", "veiculo_mes", "desativado"]);

  for (const opt of OPCOES_MODO_NORMALIZACAO) {
    assert.ok(opt.nome && typeof opt.nome === "string", "Cada opção deve ter nome");
    assert.ok(opt.descricaoCurta && typeof opt.descricaoCurta === "string", "Cada opção deve ter descricaoCurta");
  }
});

test("Task 1: Extensão dos modelos de domínio (ItemCandidato, ParametrosPipeline, ResultadoPesquisa, RegistroHistoricoPesquisa)", () => {
  // Teste de ItemCandidato com campos de normalização
  const item: ItemCandidato = {
    descricao_objeto: "Posto de vigilância armada 24h",
    valor_unitario: 12000,
    valor_original: 36000,
    unidade_original: "Mês",
    formula_normalizacao: "R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto",
    unidade_referencia: "R$/mês/posto",
    normalizado: true,
    quantitativo_previsto_arp: "3",
    quantidade_numerica_str: "3",
    unidade_fornecimento: "Mês",
    numero_arp_licitacao: "1/2026",
    id_ata_r6: "ata-1",
    orgao_gerenciador_uf: "PE",
    orgao_nome: "Órgão Teste",
    uf: "PE",
    municipio_nome: "Recife",
    codigo_ibge: "2611606",
    fornecedor: "Fornecedor Teste",
    numero_item_lote: "1",
    data_assinatura: "2026-01-01",
    vigencia_ata: "12 meses",
    data_fim_vigencia: "2027-01-01",
    situacao_ata: "Vigente",
    esfera: "E",
    tipo_orgao: "Executivo",
    cnpj_orgao: "00.000.000/0001-00",
    ano_compra: "2026",
    seq_compra: "1",
    seq_ata: "1",
    link_ata_pncp: "https://pncp.gov.br",
    aderencia: "A",
    detalhe_aderencia: "Aderente",
    orgao_atende_validade: "Sim",
    data_hora_consulta: "2026-11-02 12:00:00",
    escopo_escolhido: "Todos",
    status_escolhido: "Vigente",
    periodo_aplicado: "12 meses",
    termos_usados: "vigilância",
  };

  assert.strictEqual(item.valor_original, 36000);
  assert.strictEqual(item.unidade_original, "Mês");
  assert.strictEqual(item.formula_normalizacao, "R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto");
  assert.strictEqual(item.unidade_referencia, "R$/mês/posto");
  assert.strictEqual(item.normalizado, true);

  // Teste de ParametrosPipeline com modoNormalizacao
  const params: ParametrosPipeline = {
    descricaoObjeto: "Vigilância armada",
    termosBusca: ["vigilancia"],
    requisitos: [],
    escopoOrgaos: "Todos",
    statusAta: "Vigentes",
    tipoDataPeriodo: "Data de assinatura da ata",
    modoNormalizacao: "auto",
  };
  assert.strictEqual(params.modoNormalizacao, "auto");

  // Teste de ResultadoPesquisa com campos de normalização
  const resultado: ResultadoPesquisa = {
    momento_consulta: "2026-11-02 12:00:00",
    escopo_orgaos: "Todos",
    status_ata: "Vigentes",
    tipo_data_periodo: "Data de assinatura da ata",
    data_inicial: null,
    data_final: null,
    periodo_aplicado_str: "Todos",
    termos_busca: ["vigilancia"],
    requisitos: [],
    total_atas_encontradas: 1,
    atas_validas_escopo_periodo: 1,
    total_itens_avaliados: 1,
    conferencias_status_api: [],
    itens_candidatos: [item],
    descartados: [],
    resumo_descartes: {},
    modo_normalizacao_escolhido: "auto",
    modo_normalizacao_aplicado: "posto_mes",
    unidade_referencia_padrao: "R$/mês/posto",
  };
  assert.strictEqual(resultado.modo_normalizacao_escolhido, "auto");
  assert.strictEqual(resultado.modo_normalizacao_aplicado, "posto_mes");
  assert.strictEqual(resultado.unidade_referencia_padrao, "R$/mês/posto");

  // Teste de RegistroHistoricoPesquisa com modoNormalizacao
  const historico: RegistroHistoricoPesquisa = {
    id: "hist-1",
    dataHoraPesquisa: "02/11/2026 12:00:00",
    timestampIso: new Date().toISOString(),
    descricaoObjeto: "Vigilância armada",
    escopoOrgaos: "Todos",
    statusAta: "Vigentes",
    periodoAplicado: "Todos",
    termosBusca: ["vigilancia"],
    incluirRevisaoB: false,
    indicesSelecionados: [0],
    itensSelecionadosCount: 1,
    mediaSelecionados: 12000,
    modoNormalizacao: "posto_mes",
    resultado,
  };
  assert.strictEqual(historico.modoNormalizacao, "posto_mes");
});
