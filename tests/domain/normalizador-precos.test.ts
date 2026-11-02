import test from "node:test";
import assert from "node:assert";
import {
  detectarModoNormalizacaoSugerido,
  extrairQuantitativoUnidades,
  detectarMesesPeriodo,
  calcularPrecoNormalizado,
  type DadosCalculoNormalizacao,
  type ResultadoCalculoNormalizacao,
} from "../../src/lib/domain/normalizador-precos.ts";

test("Task 2: detectarModoNormalizacaoSugerido - detecção automática de modo", () => {
  // Posto / Mão de obra
  assert.strictEqual(detectarModoNormalizacaoSugerido("vigilância armada"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("Serviço de vigilante patrimonial 24h"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("porteiro diurno"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("serviço de portaria desarmada"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("recepcionista bilíngue"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("limpeza predial e conservação"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("auxiliar de serviços gerais"), "posto_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("prestação de serviço de motorista"), "posto_mes");

  // Veículos / Frotas
  assert.strictEqual(detectarModoNormalizacaoSugerido("locação de veículos tipo hatch"), "veiculo_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("aluguel de van executiva"), "veiculo_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("caminhonete 4x4 cabine dupla"), "veiculo_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("locação de automóveis sedan"), "veiculo_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("locação de viaturas"), "veiculo_mes");
  assert.strictEqual(detectarModoNormalizacaoSugerido("locação de picape"), "veiculo_mes");

  // Desativado (bens e serviços comuns)
  assert.strictEqual(detectarModoNormalizacaoSugerido("aquisição de ar condicionado split"), "desativado");
  assert.strictEqual(detectarModoNormalizacaoSugerido("lona plástica 4x4m preta"), "desativado");
  assert.strictEqual(detectarModoNormalizacaoSugerido("caneta esferográfica azul"), "desativado");
  assert.strictEqual(detectarModoNormalizacaoSugerido("computador desktop i7"), "desativado");
  assert.strictEqual(detectarModoNormalizacaoSugerido(""), "desativado");
});

test("Task 2: extrairQuantitativoUnidades - extração de dígitos e numerais por extenso", () => {
  // Dígitos em postos
  assert.strictEqual(
    extrairQuantitativoUnidades("Contratação de 3 postos de vigilância armada", "posto_mes"),
    3
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Serviço com 05 postos de portaria", "posto_mes"),
    5
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("1 posto de vigilância diurna", "posto_mes"),
    1
  );

  // Dígitos em veículos
  assert.strictEqual(
    extrairQuantitativoUnidades("Locação de 05 veículos tipo hatch", "veiculo_mes"),
    5
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Aluguel de 2 vans para transporte", "veiculo_mes"),
    2
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Locação de 10 automóveis sedan", "veiculo_mes"),
    10
  );

  // Numerais por extenso em português
  assert.strictEqual(
    extrairQuantitativoUnidades("Prestação de serviços com dois vigilantes", "posto_mes"),
    2
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Locação de dez carros para transporte", "veiculo_mes"),
    10
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Contratação de um posto de recepcionista", "posto_mes"),
    1
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Vigilância armada com três postos", "posto_mes"),
    3
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Aluguel de quatro caminhonetes 4x4", "veiculo_mes"),
    4
  );

  // Numerais compostos e com parênteses
  assert.strictEqual(
    extrairQuantitativoUnidades("Contratação de 3 (três) postos de vigilância armada", "posto_mes"),
    3
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Locação de dois (2) veículos tipo sedan", "veiculo_mes"),
    2
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Prestação com vinte e quatro postos de trabalho", "posto_mes"),
    24
  );

  // Padrões com dois-pontos / quantitativo
  assert.strictEqual(
    extrairQuantitativoUnidades("Postos: 4 - Vigilância patrimonial", "posto_mes"),
    4
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Total de 8 postos de limpeza", "posto_mes"),
    8
  );

  // Quantitativo ausente -> deve retornar null
  assert.strictEqual(
    extrairQuantitativoUnidades("Serviço de vigilância da sede administrativa", "posto_mes"),
    null
  );
  assert.strictEqual(
    extrairQuantitativoUnidades("Locação mensal de veículo tipo hatch", "veiculo_mes"),
    null
  );

  // Modo desativado -> deve retornar null
  assert.strictEqual(
    extrairQuantitativoUnidades("3 postos de vigilância", "desativado"),
    null
  );
});

test("Task 2: detectarMesesPeriodo - detecção de período e salvaguarda mensal", () => {
  // Salvaguarda mensal: NUNCA divide por 12 se unidade for Mês/Meses/Mensal
  assert.strictEqual(detectarMesesPeriodo("Contrato anual de vigilância", "Mês", 12), 1);
  assert.strictEqual(detectarMesesPeriodo("3 postos pelo período de 12 meses", "meses", 12), 1);
  assert.strictEqual(detectarMesesPeriodo("Serviço contínuo", "MENSAL", 1), 1);
  assert.strictEqual(detectarMesesPeriodo("Vigilância", "mês", 24), 1);

  // Período anual explícito por unidade de medida
  assert.strictEqual(detectarMesesPeriodo("3 postos de vigilância", "Ano"), 12);
  assert.strictEqual(detectarMesesPeriodo("Locação de veículos", "Anual"), 12);
  assert.strictEqual(detectarMesesPeriodo("Vigilância", "Exercício"), 12);

  // Período anual explícito na descrição ou informações complementares
  assert.strictEqual(
    detectarMesesPeriodo("Serviço de 3 postos - valor global anual", "Lote", 1),
    12
  );
  assert.strictEqual(
    detectarMesesPeriodo("Locação de frota - montante global anual para 12 meses", "Serviço", 1),
    12
  );
  assert.strictEqual(
    detectarMesesPeriodo("Contrato anual de prestação de serviços", "Unidade", 1),
    12
  );
  assert.strictEqual(
    detectarMesesPeriodo("Estimativa anual para contratação", undefined, 1),
    12
  );

  // Padrão default quando não é expressamente anual -> 1
  assert.strictEqual(detectarMesesPeriodo("Serviço de 3 postos de portaria", "Lote", 1), 1);
  assert.strictEqual(detectarMesesPeriodo("Locação de veículos", undefined, 1), 1);
});

test("Task 2: calcularPrecoNormalizado - cálculo de lote mensal e anual com fórmulas", () => {
  // Cenário 1: Postos lote mensal (R$ 36.000 para 3 postos, unidade Mês)
  const c1: DadosCalculoNormalizacao = {
    valorHomologado: 36000,
    quantidadeItem: 1,
    unidadeMedidaItem: "Mês",
    descricaoItem: "Contratação de 3 postos de vigilância armada 24h",
    modoNormalizacao: "posto_mes",
  };
  const r1 = calcularPrecoNormalizado(c1);
  assert.strictEqual(r1.valorNormalizado, 12000);
  assert.strictEqual(r1.valorOriginal, 36000);
  assert.strictEqual(r1.unidadeReferencia, "R$/mês/posto");
  assert.strictEqual(r1.formula, "R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto");
  assert.strictEqual(r1.normalizado, true);
  assert.strictEqual(r1.quantitativoDetectado, 3);
  assert.strictEqual(r1.mesesDetectados, 1);

  // Cenário 2: Postos lote anual (R$ 432.000 para 3 postos em 12 meses)
  const c2: DadosCalculoNormalizacao = {
    valorHomologado: 432000,
    quantidadeItem: 1,
    unidadeMedidaItem: "Lote",
    descricaoItem: "Serviço de 3 postos de vigilância armada - valor global anual para 12 meses",
    modoNormalizacao: "posto_mes",
  };
  const r2 = calcularPrecoNormalizado(c2);
  assert.strictEqual(r2.valorNormalizado, 12000);
  assert.strictEqual(r2.valorOriginal, 432000);
  assert.strictEqual(r2.unidadeReferencia, "R$/mês/posto");
  assert.strictEqual(r2.formula, "R$ 432.000,00 ÷ (12 m × 3 postos) = R$ 12.000,00/mês/posto");
  assert.strictEqual(r2.normalizado, true);
  assert.strictEqual(r2.quantitativoDetectado, 3);
  assert.strictEqual(r2.mesesDetectados, 12);

  // Cenário 3: Veículos mensal (R$ 15.000 para 5 veículos, unidade Mês)
  const c3: DadosCalculoNormalizacao = {
    valorHomologado: 15000,
    quantidadeItem: 1,
    unidadeMedidaItem: "Mês",
    descricaoItem: "Locação de 05 veículos tipo hatch",
    modoNormalizacao: "veiculo_mes",
  };
  const r3 = calcularPrecoNormalizado(c3);
  assert.strictEqual(r3.valorNormalizado, 3000);
  assert.strictEqual(r3.valorOriginal, 15000);
  assert.strictEqual(r3.unidadeReferencia, "R$/mês/veículo");
  assert.strictEqual(r3.formula, "R$ 15.000,00 ÷ 5 veículos = R$ 3.000,00/mês/veículo");
  assert.strictEqual(r3.normalizado, true);
  assert.strictEqual(r3.quantitativoDetectado, 5);

  // Cenário 4: Veículos lote anual (R$ 180.000 para 5 veículos em 12 meses)
  const c4: DadosCalculoNormalizacao = {
    valorHomologado: 180000,
    unidadeMedidaItem: "Ano",
    descricaoItem: "Locação de 5 veículos tipo hatch",
    modoNormalizacao: "veiculo_mes",
  };
  const r4 = calcularPrecoNormalizado(c4);
  assert.strictEqual(r4.valorNormalizado, 3000);
  assert.strictEqual(r4.valorOriginal, 180000);
  assert.strictEqual(r4.unidadeReferencia, "R$/mês/veículo");
  assert.strictEqual(r4.formula, "R$ 180.000,00 ÷ (12 m × 5 veículos) = R$ 3.000,00/mês/veículo");
  assert.strictEqual(r4.normalizado, true);
  assert.strictEqual(r4.mesesDetectados, 12);
});

test("Task 2: calcularPrecoNormalizado - salvaguardas contra dupla divisão", () => {
  // Salvaguarda 1: Se unidadeMedida já for "Posto", valor já é unitário -> divisor 1
  const s1: DadosCalculoNormalizacao = {
    valorHomologado: 12000,
    quantidadeItem: 1,
    unidadeMedidaItem: "Posto",
    descricaoItem: "3 postos de vigilância armada",
    modoNormalizacao: "posto_mes",
  };
  const resS1 = calcularPrecoNormalizado(s1);
  assert.strictEqual(resS1.valorNormalizado, 12000, "Não deve dividir quando unidade já for Posto");
  assert.strictEqual(resS1.normalizado, false);
  assert.strictEqual(resS1.formula, "");
  assert.strictEqual(resS1.quantitativoDetectado, 3);

  // Salvaguarda 2: Se quantidadeItem === N e texto diz N postos -> API já unitizou o valor
  const s2: DadosCalculoNormalizacao = {
    valorHomologado: 12000,
    quantidadeItem: 3,
    unidadeMedidaItem: "Mês",
    descricaoItem: "Contratação de 3 postos de vigilância armada",
    modoNormalizacao: "posto_mes",
  };
  const resS2 = calcularPrecoNormalizado(s2);
  assert.strictEqual(resS2.valorNormalizado, 12000, "Não deve dividir quando quantidadeItem === N");
  assert.strictEqual(resS2.normalizado, false);
  assert.strictEqual(resS2.formula, "");

  // Salvaguarda 3: Se quantidadeHomologada === N e texto diz N postos
  const s3: DadosCalculoNormalizacao = {
    valorHomologado: 12000,
    quantidadeHomologada: 3,
    unidadeMedidaItem: "Mês",
    descricaoItem: "Prestação de 3 postos de portaria",
    modoNormalizacao: "posto_mes",
  };
  const resS3 = calcularPrecoNormalizado(s3);
  assert.strictEqual(resS3.valorNormalizado, 12000, "Não deve dividir quando quantidadeHomologada === N");
  assert.strictEqual(resS3.normalizado, false);

  // Salvaguarda 4: Veículo com unidadeMedida "Veículo"
  const s4: DadosCalculoNormalizacao = {
    valorHomologado: 3000,
    quantidadeItem: 5,
    unidadeMedidaItem: "Veículo",
    descricaoItem: "Locação de 5 veículos tipo hatch",
    modoNormalizacao: "veiculo_mes",
  };
  const resS4 = calcularPrecoNormalizado(s4);
  assert.strictEqual(resS4.valorNormalizado, 3000, "Não deve dividir quando unidade for Veículo");
  assert.strictEqual(resS4.normalizado, false);

  // Salvaguarda 5: Unidade já expressa posto-mês
  const s5: DadosCalculoNormalizacao = {
    valorHomologado: 12000,
    unidadeMedidaItem: "Posto/Mês",
    descricaoItem: "3 postos de vigilância",
    modoNormalizacao: "posto_mes",
  };
  const resS5 = calcularPrecoNormalizado(s5);
  assert.strictEqual(resS5.valorNormalizado, 12000);
  assert.strictEqual(resS5.normalizado, false);
});

test("Task 2: calcularPrecoNormalizado - quantitativo ausente, modo desativado e modo auto", () => {
  // Quantitativo ausente: mantém valor original, normalizado = false, marca quantitativoStatus = "não informado"
  const ausente: DadosCalculoNormalizacao = {
    valorHomologado: 15000,
    descricaoItem: "Serviço de vigilância da sede administrativa",
    modoNormalizacao: "posto_mes",
  };
  const rAusente = calcularPrecoNormalizado(ausente);
  assert.strictEqual(rAusente.valorNormalizado, 15000);
  assert.strictEqual(rAusente.valorOriginal, 15000);
  assert.strictEqual(rAusente.normalizado, false);
  assert.strictEqual(rAusente.quantitativoDetectado, null);
  assert.strictEqual(rAusente.quantitativoStatus, "não informado");
  assert.strictEqual(rAusente.formula, "");

  // Modo desativado: não normaliza
  const desativado: DadosCalculoNormalizacao = {
    valorHomologado: 36000,
    descricaoItem: "3 postos de vigilância",
    modoNormalizacao: "desativado",
  };
  const rDesativado = calcularPrecoNormalizado(desativado);
  assert.strictEqual(rDesativado.valorNormalizado, 36000);
  assert.strictEqual(rDesativado.normalizado, false);
  assert.strictEqual(rDesativado.unidadeReferencia, "R$");
  assert.strictEqual(rDesativado.formula, "");

  // Modo auto: detecta postos automaticamente
  const autoPosto: DadosCalculoNormalizacao = {
    valorHomologado: 36000,
    descricaoItem: "Prestação de serviço com 3 postos de vigilância armada",
    modoNormalizacao: "auto",
  };
  const rAutoPosto = calcularPrecoNormalizado(autoPosto);
  assert.strictEqual(rAutoPosto.valorNormalizado, 12000);
  assert.strictEqual(rAutoPosto.unidadeReferencia, "R$/mês/posto");
  assert.strictEqual(rAutoPosto.normalizado, true);

  // Modo auto: detecta veículos automaticamente
  const autoVeiculo: DadosCalculoNormalizacao = {
    valorHomologado: 15000,
    descricaoItem: "Locação de 05 veículos tipo hatch",
    modoNormalizacao: "auto",
  };
  const rAutoVeiculo = calcularPrecoNormalizado(autoVeiculo);
  assert.strictEqual(rAutoVeiculo.valorNormalizado, 3000);
  assert.strictEqual(rAutoVeiculo.unidadeReferencia, "R$/mês/veículo");
  assert.strictEqual(rAutoVeiculo.normalizado, true);

  // Modo auto: bem comum detecta desativado automaticamente
  const autoComum: DadosCalculoNormalizacao = {
    valorHomologado: 2500,
    descricaoItem: "Aquisição de ar condicionado 12000 BTU",
    modoNormalizacao: "auto",
  };
  const rAutoComum = calcularPrecoNormalizado(autoComum);
  assert.strictEqual(rAutoComum.valorNormalizado, 2500);
  assert.strictEqual(rAutoComum.normalizado, false);
  assert.strictEqual(rAutoComum.unidadeReferencia, "R$");
});
