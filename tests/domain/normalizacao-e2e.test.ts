import test from "node:test";
import assert from "node:assert";
import ExcelJS from "exceljs";
import { executarPipelinePesquisa, selecionarTop20Menores } from "../../src/lib/domain/pipeline.ts";
import { calcularEstatisticasPrecos } from "../../src/lib/domain/statistics.ts";
import { PNCPClient } from "../../src/lib/domain/pncp-client.ts";
import { gerarPlanilhaXlsx } from "../../src/lib/export/exporter-xlsx.ts";
import { gerarRelatorioPdfA4 } from "../../src/lib/export/exporter-pdf.ts";
import { gerarCsvConsolidado } from "../../src/lib/export/exporter-csv.ts";
import type { ParametrosPipeline } from "../../src/lib/domain/types.ts";

test("Task 6: E2E - Pipeline de Serviço de Vigilância Armada com 4 ARPs (Posto-Mês), Estatísticas e Exportações", async (t) => {
  // Salvar métodos originais para restauração
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

  // Mock das 4 Atas simulando exatamente o cenário real do usuário:
  // ARP 1: Lote de R$ 36.000,00 mensal para 3 postos (normaliza para R$ 12.000,00/mês/posto).
  // ARP 2: Contrato anual de R$ 432.000,00 para 3 postos durante 12 meses (normaliza para R$ 12.000,00/mês/posto).
  // ARP 3: Item de R$ 12.000,00 mensal já cadastrado com unidade "Posto" (permanece R$ 12.000,00/mês/posto com divisor = 1).
  // ARP 4: Item de R$ 15.000,00 sem quantitativo informado na descrição (permanece R$ 15.000,00 com quantitativo "não informado").
  PNCPClient.prototype.buscarTodasAtasPorTermos = async function () {
    return {
      atas: [
        {
          orgao_cnpj: "11111111000111",
          ano: "2026",
          numero_sequencial_compra_ata: "1",
          numero_sequencial: "1",
          numero_controle_pncp: "11111111000111-1-000001/2026",
          orgao_nome: "TRIBUNAL REGIONAL FEDERAL 5 REGIAO",
          esfera_id: "F",
          uf: "PE",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-15T10:00:00Z",
          data_inicio_vigencia: "2026-01-15T10:00:00Z",
          data_fim_vigencia: "2027-01-15T10:00:00Z",
          description: "Contratação de serviços de vigilância armada",
          title: "ARP 10/2026",
        },
        {
          orgao_cnpj: "22222222000122",
          ano: "2026",
          numero_sequencial_compra_ata: "2",
          numero_sequencial: "1",
          numero_controle_pncp: "22222222000122-1-000002/2026",
          orgao_nome: "MINISTERIO DA JUSTICA E SEGURANCA PUBLICA",
          esfera_id: "F",
          uf: "DF",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-02-01T10:00:00Z",
          data_inicio_vigencia: "2026-02-01T10:00:00Z",
          data_fim_vigencia: "2027-02-01T10:00:00Z",
          description: "Contratação anual de serviços de vigilância armada",
          title: "ARP 20/2026",
        },
        {
          orgao_cnpj: "33333333000133",
          ano: "2026",
          numero_sequencial_compra_ata: "3",
          numero_sequencial: "1",
          numero_controle_pncp: "33333333000133-1-000003/2026",
          orgao_nome: "PREFEITURA MUNICIPAL DE SANTOS",
          esfera_id: "M",
          uf: "SP",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-01-20T10:00:00Z",
          data_inicio_vigencia: "2026-01-20T10:00:00Z",
          data_fim_vigencia: "2027-01-20T10:00:00Z",
          description: "Serviço de vigilância armada patrimonial",
          title: "ARP 30/2026",
        },
        {
          orgao_cnpj: "44444444000144",
          ano: "2026",
          numero_sequencial_compra_ata: "4",
          numero_sequencial: "1",
          numero_controle_pncp: "44444444000144-1-000004/2026",
          orgao_nome: "FUNDACAO OSWALDO CRUZ",
          esfera_id: "F",
          uf: "RJ",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-02-10T10:00:00Z",
          data_inicio_vigencia: "2026-02-10T10:00:00Z",
          data_fim_vigencia: "2027-02-10T10:00:00Z",
          description: "Serviço terceirizado de vigilância armada",
          title: "ARP 40/2026",
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
      // ARP 1: Lote mensal com 3 postos
      return [
        {
          numeroItem: 1,
          descricao: "Prestação de serviços contínuos de vigilância armada para 3 postos",
          informacaoComplementar: "Lote mensal em escala 12x36 diurno e noturno",
          unidadeMedida: "Mês",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "22222222000122") {
      // ARP 2: Contrato anual com 3 postos durante 12 meses
      return [
        {
          numeroItem: 1,
          descricao: "Contrato anual de serviços de vigilância armada contendo 3 postos",
          informacaoComplementar: "Vigência de 12 meses para atendimento do edifício-sede",
          unidadeMedida: "Ano",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "33333333000133") {
      // ARP 3: Item já cadastrado com unidade Posto
      return [
        {
          numeroItem: 1,
          descricao: "Serviço de vigilância armada patrimonial",
          informacaoComplementar: "Posto diurno 44h semanais",
          unidadeMedida: "Posto",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "44444444000144") {
      // ARP 4: Sem quantitativo informado na descrição
      return [
        {
          numeroItem: 1,
          descricao: "Serviço terceirizado de vigilância armada",
          informacaoComplementar: "Execução contínua conforme termo de referência",
          unidadeMedida: "Serviço",
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

  PNCPClient.prototype.obterResultadosItem = async function (cnpj: string) {
    if (cnpj === "11111111000111") {
      return [
        {
          valorUnitarioHomologado: 36000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "VIGILANCIA ALVORADA LTDA",
          niFornecedor: "01000000000101",
        },
      ];
    }
    if (cnpj === "22222222000122") {
      return [
        {
          valorUnitarioHomologado: 432000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "SEGURANCA NACIONAL S/A",
          niFornecedor: "02000000000102",
        },
      ];
    }
    if (cnpj === "33333333000133") {
      return [
        {
          valorUnitarioHomologado: 12000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "GUARDA FORTE SERVICOS LTDA",
          niFornecedor: "03000000000103",
        },
      ];
    }
    if (cnpj === "44444444000144") {
      return [
        {
          valorUnitarioHomologado: 15000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "DELTA VIGILANCIA PATRIMONIAL LTDA",
          niFornecedor: "04000000000104",
        },
      ];
    }
    return [];
  };

  PNCPClient.prototype.enriquecerItensComArquivosAta = async function () {
    return;
  };

  // Parâmetros de pesquisa: objeto "Serviço de vigilância armada" com modo auto
  const params: ParametrosPipeline = {
    descricaoObjeto: "Serviço de vigilância armada",
    termosBusca: ["vigilancia"],
    requisitos: [],
    escopoOrgaos: "Todos",
    statusAta: "Todas",
    tipoDataPeriodo: "todos",
    modoNormalizacao: "auto",
    apenasMunicipiosBilionarios: false,
    usarCache: false,
  };

  // 1. Executar Pipeline End-to-End
  const resultado = await executarPipelinePesquisa(params);

  // Verificação de Metadados Globais do Modo
  assert.strictEqual(resultado.modo_normalizacao_escolhido, "auto");
  assert.strictEqual(resultado.modo_normalizacao_aplicado, "posto_mes");
  assert.strictEqual(resultado.unidade_referencia_padrao, "R$/mês/posto");
  assert.strictEqual(resultado.itens_candidatos.length, 4);

  // 2. Verificação Item a Item das Regras e Salvaguardas
  // ARP 1: R$ 36.000,00 mensal / 3 postos = R$ 12.000,00/mês/posto
  const itemArp1 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "11111111000111");
  assert.ok(itemArp1, "ARP 1 deve estar presente");
  assert.strictEqual(itemArp1.valor_original, 36000);
  assert.strictEqual(itemArp1.valor_unitario, 12000, "ARP 1 deve ser normalizada para R$ 12.000,00");
  assert.strictEqual(itemArp1.normalizado, true);
  assert.strictEqual(itemArp1.unidade_original, "Mês");
  assert.strictEqual(itemArp1.unidade_referencia, "R$/mês/posto");
  assert.ok(
    itemArp1.formula_normalizacao && itemArp1.formula_normalizacao.includes("3 postos"),
    `Fórmula da ARP 1 deve citar 3 postos: ${itemArp1.formula_normalizacao}`
  );

  // ARP 2: R$ 432.000,00 anual / (12 meses × 3 postos) = R$ 12.000,00/mês/posto
  const itemArp2 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "22222222000122");
  assert.ok(itemArp2, "ARP 2 deve estar presente");
  assert.strictEqual(itemArp2.valor_original, 432000);
  assert.strictEqual(itemArp2.valor_unitario, 12000, "ARP 2 deve ser normalizada para R$ 12.000,00");
  assert.strictEqual(itemArp2.normalizado, true);
  assert.strictEqual(itemArp2.unidade_original, "Ano");
  assert.strictEqual(itemArp2.unidade_referencia, "R$/mês/posto");
  assert.ok(
    itemArp2.formula_normalizacao &&
      itemArp2.formula_normalizacao.includes("12 m") &&
      itemArp2.formula_normalizacao.includes("3 postos"),
    `Fórmula da ARP 2 deve citar 12 m e 3 postos: ${itemArp2.formula_normalizacao}`
  );

  // ARP 3: R$ 12.000,00 já com unidade "Posto" -> permanece R$ 12.000,00 (divisor = 1)
  const itemArp3 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "33333333000133");
  assert.ok(itemArp3, "ARP 3 deve estar presente");
  assert.strictEqual(itemArp3.valor_original, 12000);
  assert.strictEqual(itemArp3.valor_unitario, 12000, "ARP 3 permanece R$ 12.000,00");
  assert.strictEqual(itemArp3.normalizado, false, "ARP 3 com unidade Posto não sofre nova divisão");
  assert.strictEqual(itemArp3.unidade_original, "Posto");
  assert.strictEqual(itemArp3.unidade_referencia, "R$/mês/posto");

  // ARP 4: R$ 15.000,00 sem quantitativo informado na descrição -> permanece R$ 15.000,00 com "não informado"
  const itemArp4 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "44444444000144");
  assert.ok(itemArp4, "ARP 4 deve estar presente");
  assert.strictEqual(itemArp4.valor_original, 15000);
  assert.strictEqual(itemArp4.valor_unitario, 15000);
  assert.strictEqual(itemArp4.normalizado, false);
  assert.strictEqual(itemArp4.quantitativo_previsto_arp, "1 Serviço");
  assert.strictEqual(itemArp4.unidade_referencia, "R$/mês/posto");

  // 3. Provar o Empate dos 3 Primeiros Itens no Top 20 e Ordenação Correta
  const top20 = selecionarTop20Menores(resultado.itens_candidatos, false, 20);
  assert.strictEqual(top20.length, 4);
  assert.strictEqual(top20[0].valor_unitario, 12000, "1º item deve empatar em R$ 12.000,00");
  assert.strictEqual(top20[1].valor_unitario, 12000, "2º item deve empatar em R$ 12.000,00");
  assert.strictEqual(top20[2].valor_unitario, 12000, "3º item deve empatar em R$ 12.000,00");
  assert.strictEqual(top20[3].valor_unitario, 15000, "4º item deve ser o de R$ 15.000,00");

  // 4. Verificação Estatística: Média de R$ 12.750,00 e Mediana de R$ 12.000,00
  const valoresNormalizados = top20.map((i) => i.valor_unitario);
  const statsNormalizadas = calcularEstatisticasPrecos(valoresNormalizados);

  assert.strictEqual(statsNormalizadas.quantidade, 4);
  assert.strictEqual(statsNormalizadas.menor, 12000);
  assert.strictEqual(statsNormalizadas.maior, 15000);
  assert.strictEqual(
    statsNormalizadas.media,
    12750,
    "Média normalizada deve ser exatamente R$ 12.750,00 ((12k+12k+12k+15k)/4)"
  );
  assert.strictEqual(
    statsNormalizadas.mediana,
    12000,
    "Mediana normalizada deve ser exatamente R$ 12.000,00"
  );

  // Evidência de Prevenção da Distorção Catastrófica (Centenas de Milhares de Reais):
  const valoresDistorcidosSemNormalizacao = top20.map((i) => i.valor_original);
  const statsSemNormalizacao = calcularEstatisticasPrecos(valoresDistorcidosSemNormalizacao);
  // Sem normalização: (36.000 + 432.000 + 12.000 + 15.000) / 4 = 495.000 / 4 = 123.750,00
  assert.strictEqual(statsSemNormalizacao.media, 123750);
  const distorcaoEvitada = statsSemNormalizacao.media - statsNormalizadas.media;
  assert.strictEqual(
    distorcaoEvitada,
    111000,
    "O pipeline evitou com sucesso uma distorção de R$ 111.000,00 na média por posto!"
  );

  // 5. Verificação da Geração Completa dos 3 Exportadores (XLSX, PDF, CSV)
  // 5.1 Planilha XLSX
  const indicesSelecionados = [0, 1, 2, 3];
  const xlsxBytes = await gerarPlanilhaXlsx(
    top20,
    top20,
    indicesSelecionados,
    resultado.descartados,
    "menor_preco",
    resultado.unidade_referencia_padrao
  );
  assert.ok(xlsxBytes instanceof Uint8Array, "XLSX deve retornar Uint8Array");
  assert.ok(xlsxBytes.length > 0, "XLSX não deve ser vazio");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBytes.buffer as ArrayBuffer);
  const wsConsolidada = wb.getWorksheet("Planilha_Consolidada");
  assert.ok(wsConsolidada, "Aba Planilha_Consolidada deve existir");

  // Validar se cabeçalhos de normalização estão presentes no XLSX
  const headerRow = wsConsolidada.rows[0];
  assert.ok(headerRow, "Linha de cabeçalho deve existir");
  const headerTexts = headerRow.cells.map((c) => String(c.value || ""));
  assert.ok(
    headerTexts.some((h) => h.includes("Valor Unitário Normalizado")),
    "Deve conter coluna de Valor Unitário Normalizado no XLSX"
  );
  assert.ok(
    headerTexts.some((h) => h.includes("Memória de Cálculo") || h.includes("Fórmula")),
    "Deve conter coluna de Memória de Cálculo / Fórmula no XLSX"
  );
  assert.ok(
    headerTexts.some((h) => h.includes("Valor Homologado Original") || h.includes("Valor Original")),
    "Deve conter coluna de Valor Original no XLSX"
  );

  // Validar se fórmulas estatísticas de média e mediana estão presentes na planilha
  let encontrouFormulaAverage = false;
  let encontrouFormulaMedian = false;
  wsConsolidada.eachRow((row) => {
    row.eachCell((cell) => {
      const val = typeof cell.value === "object" ? JSON.stringify(cell.value) : String(cell.value || "");
      if (val.includes("AVERAGE")) encontrouFormulaAverage = true;
      if (val.includes("MEDIAN")) encontrouFormulaMedian = true;
    });
  });
  assert.ok(encontrouFormulaAverage, "Planilha XLSX deve conter fórmula =AVERAGE auditável");
  assert.ok(encontrouFormulaMedian, "Planilha XLSX deve conter fórmula =MEDIAN auditável");

  // 5.2 Relatório Executivo em PDF A4
  const pdfBytes = await gerarRelatorioPdfA4(
    resultado,
    top20,
    params.descricaoObjeto,
    "menor_preco"
  );
  assert.ok(pdfBytes instanceof Uint8Array, "PDF deve retornar Uint8Array");
  assert.ok(pdfBytes.length > 0, "PDF não deve ser vazio");
  const pdfHeaderStr = Buffer.from(pdfBytes).subarray(0, 15).toString("utf-8");
  assert.ok(pdfHeaderStr.startsWith("%PDF-"), "PDF deve começar com cabeçalho %PDF-");

  // 5.3 Exportação CSV Consolidada
  const csvContent = gerarCsvConsolidado(top20, "menor_preco");
  assert.ok(csvContent.startsWith("\uFEFF"), "CSV deve iniciar com BOM UTF-8 para Excel");
  assert.ok(csvContent.includes(";"), "CSV deve utilizar separador ponto e vírgula");
  assert.ok(
    csvContent.includes("valor_unitario_normalizado"),
    "CSV deve incluir cabeçalho de valor normalizado"
  );
  assert.ok(
    csvContent.includes("formula_normalizacao"),
    "CSV deve incluir cabeçalho da fórmula de normalização"
  );
  assert.ok(
    csvContent.includes("12.000,00"),
    "CSV deve incluir valores normalizados formatados em pt-BR"
  );
  assert.ok(
    csvContent.includes("12.750,00"),
    "CSV deve incluir a média aritmética consolidada de R$ 12.750,00"
  );
});

test("Task 6: E2E - Pipeline de Locação de Veículos (Veículo-Mês) com Contrato Anual e Lote Mensal", async (t) => {
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

  // Mock de 3 Atas de Locação de Veículos:
  // ARP V1: Lote mensal com 5 veículos (hatch) por R$ 15.000,00/mês -> R$ 3.000,00/mês/veículo
  // ARP V2: Contrato anual de 5 veículos (sedan) por 12 meses por R$ 180.000,00 -> R$ 3.000,00/mês/veículo
  // ARP V3: 1 veículo por R$ 3.500,00 mensal com unidade "Veículo" -> R$ 3.500,00/mês/veículo
  PNCPClient.prototype.buscarTodasAtasPorTermos = async function () {
    return {
      atas: [
        {
          orgao_cnpj: "55555555000155",
          ano: "2026",
          numero_sequencial_compra_ata: "1",
          numero_sequencial: "1",
          numero_controle_pncp: "55555555000155-1-000001/2026",
          orgao_nome: "PREFEITURA MUNICIPAL DE RECIFE",
          esfera_id: "M",
          uf: "PE",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-03-01T10:00:00Z",
          data_inicio_vigencia: "2026-03-01T10:00:00Z",
          data_fim_vigencia: "2027-03-01T10:00:00Z",
          description: "Locação de veículos automotores para a frota municipal",
          title: "ARP 50/2026",
        },
        {
          orgao_cnpj: "66666666000166",
          ano: "2026",
          numero_sequencial_compra_ata: "2",
          numero_sequencial: "1",
          numero_controle_pncp: "66666666000166-1-000002/2026",
          orgao_nome: "SECRETARIA DE ESTADO DE ADMINISTRACAO",
          esfera_id: "E",
          uf: "PE",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-03-05T10:00:00Z",
          data_inicio_vigencia: "2026-03-05T10:00:00Z",
          data_fim_vigencia: "2027-03-05T10:00:00Z",
          description: "Contrato anual de locação de veículos tipo sedan",
          title: "ARP 60/2026",
        },
        {
          orgao_cnpj: "77777777000177",
          ano: "2026",
          numero_sequencial_compra_ata: "3",
          numero_sequencial: "1",
          numero_controle_pncp: "77777777000177-1-000003/2026",
          orgao_nome: "AUTARQUIA DE TRANSITO E TRANSPORTE URBANO",
          esfera_id: "M",
          uf: "PE",
          situacao_nome: "Vigente",
          cancelado: false,
          data_assinatura: "2026-03-10T10:00:00Z",
          data_inicio_vigencia: "2026-03-10T10:00:00Z",
          data_fim_vigencia: "2027-03-10T10:00:00Z",
          description: "Locação de veículos utilitários operacionais",
          title: "ARP 70/2026",
        },
      ],
      conferenciasStatus: [],
    };
  };

  PNCPClient.prototype.obterDetalheAta = async function () {
    return null;
  };

  const mockItensCompraVeiculos = async function (cnpj: string) {
    if (cnpj === "55555555000155") {
      return [
        {
          numeroItem: 1,
          descricao: "Locação de veículos tipo hatch contendo 5 veículos",
          informacaoComplementar: "Lote mensal com manutenção e seguro inclusos",
          unidadeMedida: "Mês",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "66666666000166") {
      return [
        {
          numeroItem: 1,
          descricao: "Contrato anual de locação de veículos com 5 veículos tipo sedan",
          informacaoComplementar: "Período global anual de 12 meses",
          unidadeMedida: "Ano",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    if (cnpj === "77777777000177") {
      return [
        {
          numeroItem: 1,
          descricao: "Locação de veículo tipo hatch 1.0",
          informacaoComplementar: "Unidade veicular individual mensal",
          unidadeMedida: "Veículo",
          quantidade: 1,
          temResultado: true,
          situacaoCompraItemNome: "Homologado",
        },
      ];
    }
    return [];
  };

  PNCPClient.prototype.obterItensCompra = mockItensCompraVeiculos;
  PNCPClient.prototype.obterTodosItensCompra = mockItensCompraVeiculos;

  PNCPClient.prototype.obterResultadosItem = async function (cnpj: string) {
    if (cnpj === "55555555000155") {
      return [
        {
          valorUnitarioHomologado: 15000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "FROTA TOTAL LOCADORA LTDA",
          niFornecedor: "05000000000105",
        },
      ];
    }
    if (cnpj === "66666666000166") {
      return [
        {
          valorUnitarioHomologado: 180000,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "BRASIL VEICULOS LOCACOES S/A",
          niFornecedor: "06000000000106",
        },
      ];
    }
    if (cnpj === "77777777000177") {
      return [
        {
          valorUnitarioHomologado: 3500,
          quantidadeHomologada: 1,
          situacaoCompraItemResultadoNome: "Homologado",
          nomeRazaoSocialFornecedor: "NORDESTE LOCACAO DE FROTAS LTDA",
          niFornecedor: "07000000000107",
        },
      ];
    }
    return [];
  };

  PNCPClient.prototype.enriquecerItensComArquivosAta = async function () {
    return;
  };

  const params: ParametrosPipeline = {
    descricaoObjeto: "Locação de veículos automotores para a frota",
    termosBusca: ["locacao", "veiculos"],
    requisitos: [],
    escopoOrgaos: "Todos",
    statusAta: "Todas",
    tipoDataPeriodo: "todos",
    modoNormalizacao: "auto",
    apenasMunicipiosBilionarios: false,
    usarCache: false,
  };

  const resultado = await executarPipelinePesquisa(params);

  assert.strictEqual(resultado.modo_normalizacao_aplicado, "veiculo_mes");
  assert.strictEqual(resultado.unidade_referencia_padrao, "R$/mês/veículo");
  assert.strictEqual(resultado.itens_candidatos.length, 3);

  const itemV1 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "55555555000155");
  assert.ok(itemV1);
  assert.strictEqual(itemV1.valor_unitario, 3000, "R$ 15.000 / 5 veículos = R$ 3.000");
  assert.strictEqual(itemV1.normalizado, true);
  assert.ok(itemV1.formula_normalizacao && itemV1.formula_normalizacao.includes("5 veículos"));

  const itemV2 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "66666666000166");
  assert.ok(itemV2);
  assert.strictEqual(itemV2.valor_unitario, 3000, "R$ 180.000 / (12m × 5 veículos) = R$ 3.000");
  assert.strictEqual(itemV2.normalizado, true);

  const itemV3 = resultado.itens_candidatos.find((i) => i.cnpj_orgao === "77777777000177");
  assert.ok(itemV3);
  assert.strictEqual(itemV3.valor_unitario, 3500, "Item unitário permanece R$ 3.500");
  assert.strictEqual(itemV3.normalizado, false);

  const top20 = selecionarTop20Menores(resultado.itens_candidatos, false, 20);
  assert.strictEqual(top20.length, 3);
  assert.strictEqual(top20[0].valor_unitario, 3000);
  assert.strictEqual(top20[1].valor_unitario, 3000);
  assert.strictEqual(top20[2].valor_unitario, 3500);

  const stats = calcularEstatisticasPrecos(top20.map((i) => i.valor_unitario));
  assert.strictEqual(stats.quantidade, 3);
  assert.strictEqual(Math.round(stats.media * 100) / 100, 3166.67);
  assert.strictEqual(stats.mediana, 3000);

  // Verificação de exportação com unidade de referência de veículos
  const xlsx = await gerarPlanilhaXlsx(top20, top20, [0, 1, 2], [], "menor_preco", resultado.unidade_referencia_padrao);
  assert.ok(xlsx.length > 0);

  const pdf = await gerarRelatorioPdfA4(resultado, top20, params.descricaoObjeto, "menor_preco");
  assert.ok(pdf.length > 0);

  const csv = gerarCsvConsolidado(top20, "menor_preco");
  assert.ok(csv.includes("3.000,00"));
});

