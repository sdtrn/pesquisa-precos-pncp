import test from "node:test";
import assert from "node:assert";
import { executarPipelinePesquisa, selecionarTop20Menores } from "../../src/lib/domain/pipeline.ts";
import { PNCPClient } from "../../src/lib/domain/pncp-client.ts";
import type { ParametrosPipeline, ItemCandidato } from "../../src/lib/domain/types.ts";

test("Task 3: Pipeline - Normalização de preços unitários (postos e veículos) e Top 20", async (t) => {
  // Salvar implementações originais para restaurar após o teste
  const originalBuscarAtas = PNCPClient.prototype.buscarTodasAtasPorTermos;
  const originalObterTodosItens = PNCPClient.prototype.obterTodosItensCompra;
  const originalObterItens = PNCPClient.prototype.obterItensCompra;
  const originalObterResultados = PNCPClient.prototype.obterResultadosItem;
  const originalObterDetalhe = PNCPClient.prototype.obterDetalheAta;
  const originalEnriquecer = PNCPClient.prototype.enriquecerItensComArquivosAta;

  t.after(() => {
    PNCPClient.prototype.buscarTodasAtasPorTermos = originalBuscarAtas;
    PNCPClient.prototype.obterTodosItensCompra = originalObterTodosItens;
    PNCPClient.prototype.obterItensCompra = originalObterItens;
    PNCPClient.prototype.obterResultadosItem = originalObterResultados;
    PNCPClient.prototype.obterDetalheAta = originalObterDetalhe;
    PNCPClient.prototype.enriquecerItensComArquivosAta = originalEnriquecer;
  });

  // Mock de 3 atas com itens de postos de vigilância:
  // Ata 1: Lote de 3 postos com R$ 36.000,00 homologado (deve normalizar para R$ 12.000,00)
  // Ata 2: 1 posto unitário com R$ 12.000,00 homologado (já unitário: R$ 12.000,00)
  // Ata 3: Item sem quantitativo informado com R$ 25.000,00 (mantém R$ 25.000,00 e quantitativo_previsto_arp = "não informado")
  PNCPClient.prototype.buscarTodasAtasPorTermos = async function () {
    return {
      atas: [
        {
          orgao_cnpj: "11111111000111",
          ano: "2026",
          numero_sequencial_compra_ata: "1",
          numero_sequencial: "1",
          numero_controle_pncp: "11111111000111-1-000001/2026",
          orgao_nome: "ÓRGÃO TESTE 1",
          esfera_id: "F",
          uf: "DF",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-10T10:00:00Z",
          data_inicio_vigencia: "2026-01-10T10:00:00Z",
          data_fim_vigencia: "2027-01-10T10:00:00Z",
          description: "Contratação de serviços de vigilância armada 24h",
          title: "ARP 1/2026",
        },
        {
          orgao_cnpj: "22222222000122",
          ano: "2026",
          numero_sequencial_compra_ata: "2",
          numero_sequencial: "1",
          numero_controle_pncp: "22222222000122-1-000002/2026",
          orgao_nome: "ÓRGÃO TESTE 2",
          esfera_id: "F",
          uf: "DF",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-10T10:00:00Z",
          data_inicio_vigencia: "2026-01-10T10:00:00Z",
          data_fim_vigencia: "2027-01-10T10:00:00Z",
          description: "Contratação de serviços de vigilância armada 24h",
          title: "ARP 2/2026",
        },
        {
          orgao_cnpj: "33333333000133",
          ano: "2026",
          numero_sequencial_compra_ata: "3",
          numero_sequencial: "1",
          numero_controle_pncp: "33333333000133-1-000003/2026",
          orgao_nome: "ÓRGÃO TESTE 3",
          esfera_id: "F",
          uf: "DF",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-10T10:00:00Z",
          data_inicio_vigencia: "2026-01-10T10:00:00Z",
          data_fim_vigencia: "2027-01-10T10:00:00Z",
          description: "Contratação de serviços de vigilância armada",
          title: "ARP 3/2026",
        },
      ],
      conferenciasStatus: [],
    };
  };

  PNCPClient.prototype.obterDetalheAta = async function () {
    return null;
  };

  const mockItensCompra = async function (cnpj: string) {
    if (cnpj === "11111111000111") {
      return [
        {
          numeroItem: 1,
          descricao: "Serviço de vigilância armada 24h contendo 3 postos",
          informacaoComplementar: "Lote mensal com escala 12x36",
          unidadeMedida: "Mês",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "22222222000122") {
      return [
        {
          numeroItem: 1,
          descricao: "Serviço de vigilância armada 24h",
          informacaoComplementar: "Posto de vigilância",
          unidadeMedida: "Posto",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "33333333000133") {
      return [
        {
          numeroItem: 1,
          descricao: "Serviço de vigilância armada",
          informacaoComplementar: "Serviço terceirizado contínuo",
          unidadeMedida: "Unidade",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    return [];
  };

  PNCPClient.prototype.obterItensCompra = mockItensCompra;
  PNCPClient.prototype.obterTodosItensCompra = mockItensCompra;

  PNCPClient.prototype.obterResultadosItem = async function (cnpj) {
    if (cnpj === "11111111000111") {
      return [
        {
          valorUnitarioHomologado: 36000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "EMPRESA SEGURANCA ALPHA LTDA",
          niFornecedor: "11111111000100",
        },
      ];
    }
    if (cnpj === "22222222000122") {
      return [
        {
          valorUnitarioHomologado: 12000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "EMPRESA SEGURANCA BETA LTDA",
          niFornecedor: "22222222000100",
        },
      ];
    }
    if (cnpj === "33333333000133") {
      return [
        {
          valorUnitarioHomologado: 25000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "EMPRESA SEGURANCA GAMMA LTDA",
          niFornecedor: "33333333000100",
        },
      ];
    }
    return [];
  };

  PNCPClient.prototype.enriquecerItensComArquivosAta = async function () {
    return;
  };

  const params: ParametrosPipeline = {
    descricaoObjeto: "vigilância armada",
    termosBusca: ["vigilancia"],
    requisitos: [],
    escopoOrgaos: "Todos",
    statusAta: "Todas",
    tipoDataPeriodo: "todos",
    modoNormalizacao: "auto",
    apenasMunicipiosBilionarios: false,
    usarCache: false,
  };

  const resultado = await executarPipelinePesquisa(params);

  // 1. Verificação de metadados do modo no ResultadoPesquisa
  assert.strictEqual(resultado.modo_normalizacao_escolhido, "auto");
  assert.strictEqual(resultado.modo_normalizacao_aplicado, "posto_mes");
  assert.strictEqual(resultado.unidade_referencia_padrao, "R$/mês/posto");

  // 2. Verificação dos itens candidatos aprovados
  assert.strictEqual(resultado.itens_candidatos.length, 3);

  const itemLote3Postos = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "11111111000111");
  assert.ok(itemLote3Postos, "Item da Ata 1 deve estar presente");
  assert.strictEqual(itemLote3Postos.valor_unitario, 12000, "R$ 36.000 dividido por 3 postos deve resultar em R$ 12.000");
  assert.strictEqual(itemLote3Postos.valor_original, 36000, "Valor original deve preservar os R$ 36.000");
  assert.strictEqual(itemLote3Postos.unidade_original, "Mês");
  assert.strictEqual(itemLote3Postos.normalizado, true, "Item de 3 postos deve ser marcado como normalizado");
  assert.strictEqual(itemLote3Postos.unidade_referencia, "R$/mês/posto");
  assert.ok(
    itemLote3Postos.formula_normalizacao && itemLote3Postos.formula_normalizacao.includes("3 postos"),
    `Fórmula deve indicar a divisão por 3 postos: ${itemLote3Postos.formula_normalizacao}`
  );

  const itemUnitario = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "22222222000122");
  assert.ok(itemUnitario, "Item da Ata 2 deve estar presente");
  assert.strictEqual(itemUnitario.valor_unitario, 12000, "Valor unitário já unitário deve permanecer R$ 12.000");
  assert.strictEqual(itemUnitario.valor_original, 12000);
  assert.strictEqual(itemUnitario.normalizado, false, "Item já unitário não deve sofrer divisão adicional");
  assert.strictEqual(itemUnitario.unidade_referencia, "R$/mês/posto");

  const itemSemQuant = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "33333333000133");
  assert.ok(itemSemQuant, "Item da Ata 3 deve estar presente");
  assert.strictEqual(itemSemQuant.valor_unitario, 25000);
  assert.strictEqual(itemSemQuant.valor_original, 25000);
  assert.strictEqual(itemSemQuant.normalizado, false);
  assert.strictEqual(
    itemSemQuant.quantitativo_previsto_arp,
    "1 Unidade",
    "Quantitativo oficial da ARP no PNCP (1 Unidade) deve ser preservado mesmo quando não há divisão por postos"
  );

  // 3. Verificação do Ranqueamento no Top 20
  const top20 = selecionarTop20Menores(resultado.itens_candidatos, false, 20);
  assert.strictEqual(top20.length, 3);
  // Os dois itens de R$ 12.000 devem vir antes do item de R$ 25.000
  assert.strictEqual(top20[0].valor_unitario, 12000);
  assert.strictEqual(top20[1].valor_unitario, 12000);
  assert.strictEqual(top20[2].valor_unitario, 25000);
});

test("Task 3: Pipeline - Modo de veículos explícito e Top 20", async (t) => {
  const originalBuscarAtas = PNCPClient.prototype.buscarTodasAtasPorTermos;
  const originalObterTodosItens = PNCPClient.prototype.obterTodosItensCompra;
  const originalObterItens = PNCPClient.prototype.obterItensCompra;
  const originalObterResultados = PNCPClient.prototype.obterResultadosItem;
  const originalObterDetalhe = PNCPClient.prototype.obterDetalheAta;
  const originalEnriquecer = PNCPClient.prototype.enriquecerItensComArquivosAta;

  t.after(() => {
    PNCPClient.prototype.buscarTodasAtasPorTermos = originalBuscarAtas;
    PNCPClient.prototype.obterTodosItensCompra = originalObterTodosItens;
    PNCPClient.prototype.obterItensCompra = originalObterItens;
    PNCPClient.prototype.obterResultadosItem = originalObterResultados;
    PNCPClient.prototype.obterDetalheAta = originalObterDetalhe;
    PNCPClient.prototype.enriquecerItensComArquivosAta = originalEnriquecer;
  });

  PNCPClient.prototype.buscarTodasAtasPorTermos = async function () {
    return {
      atas: [
        {
          orgao_cnpj: "44444444000144",
          ano: "2026",
          numero_sequencial_compra_ata: "4",
          numero_sequencial: "1",
          numero_controle_pncp: "44444444000144-1-000004/2026",
          orgao_nome: "PREFEITURA DE FROTA",
          esfera_id: "F",
          uf: "DF",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-10T10:00:00Z",
          data_inicio_vigencia: "2026-01-10T10:00:00Z",
          data_fim_vigencia: "2027-01-10T10:00:00Z",
          description: "Locação de veículos",
          title: "ARP 4/2026",
        },
      ],
      conferenciasStatus: [],
    };
  };

  PNCPClient.prototype.obterDetalheAta = async function () {
    return null;
  };

  const mockItensVeiculo = async function () {
    return [
      {
        numeroItem: 1,
        descricao: "Locação de 5 veículos tipo sedan executivo",
        informacaoComplementar: "Mensalidade do lote de 5 veículos",
        unidadeMedida: "Mês",
        quantidade: 1,
        temResultado: true,
        situacaoCompraItemNome: "Homologado",
      },
    ];
  };

  PNCPClient.prototype.obterItensCompra = mockItensVeiculo;
  PNCPClient.prototype.obterTodosItensCompra = mockItensVeiculo;

  PNCPClient.prototype.obterResultadosItem = async function () {
    return [
      {
        valorUnitarioHomologado: 15000,
        quantidadeHomologada: 1,
        situacaoCompraItemResultadoNome: "Homologado",
        nomeRazaoSocialFornecedor: "LOCADORA DE VEICULOS LTDA",
        niFornecedor: "44444444000100",
      },
    ];
  };

  PNCPClient.prototype.enriquecerItensComArquivosAta = async function () {
    return;
  };

  const params: ParametrosPipeline = {
    descricaoObjeto: "Locação de veículos",
    termosBusca: ["locacao"],
    requisitos: [],
    escopoOrgaos: "Todos",
    statusAta: "Todas",
    tipoDataPeriodo: "todos",
    modoNormalizacao: "veiculo_mes",
    apenasMunicipiosBilionarios: false,
    usarCache: false,
  };

  const resultado = await executarPipelinePesquisa(params);

  assert.strictEqual(resultado.modo_normalizacao_escolhido, "veiculo_mes");
  assert.strictEqual(resultado.modo_normalizacao_aplicado, "veiculo_mes");
  assert.strictEqual(resultado.unidade_referencia_padrao, "R$/mês/veículo");

  const item = resultado.itens_candidatos[0];
  assert.ok(item);
  assert.strictEqual(item.valor_unitario, 3000, "R$ 15.000 / 5 veículos deve resultar em R$ 3.000");
  assert.strictEqual(item.valor_original, 15000);
  assert.strictEqual(item.normalizado, true);
  assert.strictEqual(item.unidade_referencia, "R$/mês/veículo");
  assert.ok(item.formula_normalizacao?.includes("5 veículos"));
});

test("Task 3: Pipeline - Modo desativado preserva valores brutos e unidade R$", async (t) => {
  const originalBuscarAtas = PNCPClient.prototype.buscarTodasAtasPorTermos;
  const originalObterTodosItens = PNCPClient.prototype.obterTodosItensCompra;
  const originalObterItens = PNCPClient.prototype.obterItensCompra;
  const originalObterResultados = PNCPClient.prototype.obterResultadosItem;
  const originalObterDetalhe = PNCPClient.prototype.obterDetalheAta;
  const originalEnriquecer = PNCPClient.prototype.enriquecerItensComArquivosAta;

  t.after(() => {
    PNCPClient.prototype.buscarTodasAtasPorTermos = originalBuscarAtas;
    PNCPClient.prototype.obterTodosItensCompra = originalObterTodosItens;
    PNCPClient.prototype.obterItensCompra = originalObterItens;
    PNCPClient.prototype.obterResultadosItem = originalObterResultados;
    PNCPClient.prototype.obterDetalheAta = originalObterDetalhe;
    PNCPClient.prototype.enriquecerItensComArquivosAta = originalEnriquecer;
  });

  PNCPClient.prototype.buscarTodasAtasPorTermos = async function () {
    return {
      atas: [
        {
          orgao_cnpj: "55555555000155",
          ano: "2026",
          numero_sequencial_compra_ata: "5",
          numero_sequencial: "1",
          numero_controle_pncp: "55555555000155-1-000005/2026",
          orgao_nome: "ÓRGÃO TESTE 5",
          esfera_id: "F",
          uf: "DF",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-10T10:00:00Z",
          data_inicio_vigencia: "2026-01-10T10:00:00Z",
          data_fim_vigencia: "2027-01-10T10:00:00Z",
          description: "Vigilância armada",
          title: "ARP 5/2026",
        },
      ],
      conferenciasStatus: [],
    };
  };

  PNCPClient.prototype.obterDetalheAta = async function () {
    return null;
  };

  const mockItens = async function () {
    return [
      {
        numeroItem: 1,
        descricao: "Contratação de 3 postos de vigilância armada",
        unidadeMedida: "Mês",
        quantidade: 1,
        temResultado: true,
        situacaoCompraItemNome: "Homologado",
      },
    ];
  };

  PNCPClient.prototype.obterItensCompra = mockItens;
  PNCPClient.prototype.obterTodosItensCompra = mockItens;

  PNCPClient.prototype.obterResultadosItem = async function () {
    return [
      {
        valorUnitarioHomologado: 36000,
        quantidadeHomologada: 1,
        situacaoCompraItemResultadoNome: "Homologado",
        nomeRazaoSocialFornecedor: "EMPRESA SEGURANCA DELTA LTDA",
        niFornecedor: "55555555000100",
      },
    ];
  };

  PNCPClient.prototype.enriquecerItensComArquivosAta = async function () {
    return;
  };

  const params: ParametrosPipeline = {
    descricaoObjeto: "vigilância armada",
    termosBusca: ["vigilancia"],
    requisitos: [],
    escopoOrgaos: "Todos",
    statusAta: "Todas",
    tipoDataPeriodo: "todos",
    modoNormalizacao: "desativado",
    apenasMunicipiosBilionarios: false,
    usarCache: false,
  };

  const resultado = await executarPipelinePesquisa(params);

  assert.strictEqual(resultado.modo_normalizacao_escolhido, "desativado");
  assert.strictEqual(resultado.modo_normalizacao_aplicado, "desativado");
  assert.strictEqual(resultado.unidade_referencia_padrao, "R$");

  const item = resultado.itens_candidatos[0];
  assert.ok(item);
  assert.strictEqual(item.valor_unitario, 36000, "Com modo desativado, o valor bruto de R$ 36.000 deve ser mantido");
  assert.strictEqual(item.valor_original, 36000);
  assert.strictEqual(item.normalizado, false);
  assert.strictEqual(item.unidade_referencia, "R$");
  assert.strictEqual(item.formula_normalizacao, "");
});

test("Task 3: Seleção Top 20 - Ordenação correta por menor valor unitário normalizado", () => {
  const candidatos: Partial<ItemCandidato>[] = [
    {
      cnpj_orgao: "111",
      numero_arp_licitacao: "ARP 1/2026",
      numero_item_lote: "1",
      valor_unitario: 12000, // Normalizado de 36.000 / 3
      valor_original: 36000,
      normalizado: true,
      aderencia: "A",
    },
    {
      cnpj_orgao: "222",
      numero_arp_licitacao: "ARP 2/2026",
      numero_item_lote: "1",
      valor_unitario: 9500, // Já unitário
      valor_original: 9500,
      normalizado: false,
      aderencia: "A",
    },
    {
      cnpj_orgao: "333",
      numero_arp_licitacao: "ARP 3/2026",
      numero_item_lote: "1",
      valor_unitario: 15000,
      valor_original: 15000,
      normalizado: false,
      aderencia: "A",
    },
    {
      // Mesmo órgão/ata 1 com outro item de valor unitário normalizado maior
      cnpj_orgao: "111",
      numero_arp_licitacao: "ARP 1/2026",
      numero_item_lote: "2",
      valor_unitario: 14000,
      valor_original: 28000,
      normalizado: true,
      aderencia: "A",
    },
  ];

  const top = selecionarTop20Menores(candidatos as ItemCandidato[], false, 20);

  // Permite múltiplos itens da mesma ata no Top 20 ordenados por menor valor normalizado
  assert.strictEqual(top.length, 4);
  // Ordem crescente de valor unitário normalizado: 9.500 < 12.000 < 14.000 < 15.000
  assert.deepStrictEqual(
    top.map((x) => x.valor_unitario),
    [9500, 12000, 14000, 15000]
  );
  assert.strictEqual(top[0].cnpj_orgao, "222");
  assert.strictEqual(top[1].cnpj_orgao, "111");
  assert.strictEqual(top[2].cnpj_orgao, "111");
  assert.strictEqual(top[3].cnpj_orgao, "333");
});


