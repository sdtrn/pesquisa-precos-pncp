import type { ModoNormalizacaoPreco } from "./types.ts";
import {
  MODO_NORMALIZACAO_AUTO,
  MODO_NORMALIZACAO_POSTO,
  MODO_NORMALIZACAO_VEICULO,
  MODO_NORMALIZACAO_DESATIVADO,
} from "../../data/constants.ts";

export interface DadosCalculoNormalizacao {
  valorHomologado: number;
  quantidadeHomologada?: number;
  descricaoItem: string;
  informacaoComplementar?: string;
  unidadeMedidaItem?: string;
  quantidadeItem?: number;
  modoNormalizacao: ModoNormalizacaoPreco;
}

export interface ResultadoCalculoNormalizacao {
  valorNormalizado: number;
  valorOriginal: number;
  unidadeOriginal?: string;
  unidadeReferencia: string;
  formula: string;
  normalizado: boolean;
  quantitativoDetectado: number | null;
  mesesDetectados: number;
  quantitativoStatus?: string;
}

/**
 * Remove acentos e converte string para caixa baixa para matching resiliente
 */
export function removerAcentos(texto: string): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Formata valores numéricos para o padrão de moeda Real (BRL)
 * Substitui espaços não-quebráveis (\u00a0) por espaço regular
 */
export function formatarBRL(valor: number): string {
  return valor
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00a0/g, " ");
}

const NUMEROS_EXTENSO_SIMPLES: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
};

function converterExtensoParaNumero(termo: string): number | null {
  if (!termo) return null;
  const t = termo.trim().toLowerCase();
  if (NUMEROS_EXTENSO_SIMPLES[t] !== undefined) {
    return NUMEROS_EXTENSO_SIMPLES[t];
  }
  // Suporte a "vinte e um", "vinte e dois", "trinta e cinco", etc.
  const partes = t.split(/\s+e\s+/);
  if (partes.length === 2) {
    const d = NUMEROS_EXTENSO_SIMPLES[partes[0]];
    const u = NUMEROS_EXTENSO_SIMPLES[partes[1]];
    if (d !== undefined && u !== undefined) {
      return d + u;
    }
  }
  return null;
}

/**
 * Detecta automaticamente o modo sugerido de normalização com base na descrição
 */
export function detectarModoNormalizacaoSugerido(descricao: string): ModoNormalizacaoPreco {
  if (!descricao || typeof descricao !== "string") {
    return MODO_NORMALIZACAO_DESATIVADO;
  }

  const s = removerAcentos(descricao);

  // Termos prioritários de veículos / locação de frota
  const padroesVeiculo = [
    /\blocacao\s+de\s+(?:veiculos?|frota|automoveis?|carros?|vans?|caminhonetes?|picapes?|viaturas?|motos?|motocicletas?)\b/,
    /\baluguel\s+de\s+(?:veiculos?|frota|automoveis?|carros?|vans?|caminhonetes?|picapes?|viaturas?|motos?|motocicletas?)\b/,
    /\b(?:veiculos?|automoveis?)\s+tipo\s+(?:hatch|sedan|suv|picape|utilitario)\b/,
    /\b(?:locacao|aluguel)\s+(?:mensal\s+)?de\s+(?:veiculo|veiculos)\b/,
    /\b(?:hatch|sedan|suv|caminhonete|picape|pick-?up)\b/,
    /\b(?:aluguel|locacao)\s+de\s+van\b/,
    /\blocacao\s+de\s+viaturas?\b/,
  ];

  for (const reg of padroesVeiculo) {
    if (reg.test(s)) {
      return MODO_NORMALIZACAO_VEICULO;
    }
  }

  // Termos de postos de trabalho / dedicação exclusiva de mão de obra
  const padroesPosto = [
    /\bvigilancia\b/,
    /\bvigilante\b/,
    /\bvigia\b/,
    /\bseguranca\s+patrimonial\b/,
    /\bportaria\b/,
    /\bporteiro\b/,
    /\brecepcao\b/,
    /\brecepcionista\b/,
    /\blimpeza\b/,
    /\bservicos?\s+gerais\b/,
    /\basseio\s+e\s+conservacao\b/,
    /\bmotorista\b/,
    /\btelefonista\b/,
    /\bcopeir[ao]\b/,
    /\bjardineir[ao]\b/,
    /\bmanutencao\s+predial\b/,
    /\bposto\s+de\s+(?:servico|trabalho)\b/,
    /\bpostos?\s+de\s+(?:vigilancia|portaria|recepcao|limpeza)\b/,
  ];

  for (const reg of padroesPosto) {
    if (reg.test(s)) {
      return MODO_NORMALIZACAO_POSTO;
    }
  }

  return MODO_NORMALIZACAO_DESATIVADO;
}

/**
 * Extrai quantitativo numérico (dígitos ou por extenso) a partir do texto
 */
export function extrairQuantitativoUnidades(
  texto: string,
  modo: ModoNormalizacaoPreco
): number | null {
  if (!texto || typeof texto !== "string") {
    return null;
  }

  // Modo desativado não extrai
  if (modo === MODO_NORMALIZACAO_DESATIVADO) {
    return null;
  }

  // Modo auto resolve primeiro o modo sugerido
  let modoEfetivo = modo;
  if (modo === MODO_NORMALIZACAO_AUTO) {
    modoEfetivo = detectarModoNormalizacaoSugerido(texto);
    if (modoEfetivo === MODO_NORMALIZACAO_DESATIVADO) {
      return null;
    }
  }

  const s = removerAcentos(texto);

  const substantivosPosto =
    "(?:postos?|vigilantes?|vigias?|porteiros?|recepcionistas?|motoristas?|colaboradores?|profissionais?|agentes?|atendentes?|auxiliares?|copeir[ao]s?|operadores?|trabalhadores?|serventes?|funcionarios?|homens|pessoas)";

  const substantivosVeiculo =
    "(?:veiculos?|automoveis?|carros?|viaturas?|vans?|picapes?|pick-?ups?|caminhonetes?|motocicletas?|motos?|onibus|micro-?onibus|caminhoes|ambulancias?|unidades?)";

  const substantivos =
    modoEfetivo === MODO_NORMALIZACAO_POSTO ? substantivosPosto : substantivosVeiculo;

  // Padrão 1: Notação com dois-pontos ou igual (ex: "Postos: 4", "Veículos: 05")
  const regDoisPontos = new RegExp(`\\b${substantivos}\\s*[:=]\\s*(\\d+)`, "i");
  const mDoisPontos = s.match(regDoisPontos);
  if (mDoisPontos) {
    const val = parseInt(mDoisPontos[1], 10);
    if (val > 0) return val;
  }

  // Padrão 2: Quantitativo / total de (ex: "Total de 8 postos", "Quantitativo: 10 veículos")
  const regTotal = new RegExp(
    `\\b(?:quantitativo|quantidade|total)\\s*(?:de)?\\s*[:=]?\\s*(\\d+)\\s*(?:unidades?\\s+de\\s+)?${substantivos}`,
    "i"
  );
  const mTotal = s.match(regTotal);
  if (mTotal) {
    const val = parseInt(mTotal[1], 10);
    if (val > 0) return val;
  }

  // Padrão 3: Dígitos antes do substantivo, com opcional número por extenso entre parênteses
  // Ex: "3 postos", "05 veículos", "3 (três) postos", "10 unidades de veículos"
  const regDigitos = new RegExp(
    `\\b(\\d+)\\s*(?:\\([a-z\\s]+\\)\\s*)?(?:unidades?\\s+(?:de\\s+)?)?${substantivos}\\b`,
    "i"
  );
  const mDigitos = s.match(regDigitos);
  if (mDigitos) {
    const val = parseInt(mDigitos[1], 10);
    if (val > 0) return val;
  }

  // Padrão 4: Numeral por extenso antes do substantivo, com opcional dígito entre parênteses
  // Ex: "dois vigilantes", "dez carros", "dois (2) veículos", "vinte e quatro postos"
  const regExtenso = new RegExp(
    `\\b([a-z]+(?:\\s+e\\s+[a-z]+)?)\\s*(?:\\(\\s*(\\d+)\\s*\\)\\s*)?(?:unidades?\\s+(?:de\\s+)?)?${substantivos}\\b`,
    "i"
  );
  const mExtenso = s.match(regExtenso);
  if (mExtenso) {
    if (mExtenso[2]) {
      const val = parseInt(mExtenso[2], 10);
      if (val > 0) return val;
    }
    const valExtenso = converterExtensoParaNumero(mExtenso[1]);
    if (valExtenso !== null && valExtenso > 0) {
      return valExtenso;
    }
  }

  // Padrão 5: "com N postos", "para N veículos", "de N postos"
  const regCompostos = new RegExp(
    `\\b(?:com|para|de|contendo)\\s+(\\d+|[a-z]+(?:\\s+e\\s+[a-z]+)?)\\s*(?:unidades?\\s+de\\s+)?${substantivos}\\b`,
    "i"
  );
  const mCompostos = s.match(regCompostos);
  if (mCompostos) {
    const numStr = mCompostos[1];
    if (/^\d+$/.test(numStr)) {
      const val = parseInt(numStr, 10);
      if (val > 0) return val;
    } else {
      const valExtenso = converterExtensoParaNumero(numStr);
      if (valExtenso !== null && valExtenso > 0) {
        return valExtenso;
      }
    }
  }

  return null;
}

/**
 * Detecta a quantidade de meses do período contratual.
 * SALVAGUARDA CRÍTICA: Se a unidade for "Mês"/"Meses"/"Mensal", NUNCA divide por 12 (retorna 1).
 */
export function detectarMesesPeriodo(
  texto: string,
  unidadeMedida?: string,
  quantidadeItem?: number
): number {
  if (unidadeMedida) {
    const u = removerAcentos(unidadeMedida).trim();

    // 1. Salvaguarda mensal rigorosa: faturamento mensal -> divisor 1
    const ehMensal =
      u === "mes" ||
      u === "meses" ||
      u === "mensal" ||
      u === "mensalidade" ||
      u === "m" ||
      u.startsWith("mes/") ||
      u.startsWith("mes-") ||
      u.includes("/mes") ||
      u.includes("-mes");

    if (ehMensal) {
      return 1;
    }

    // 2. Unidade de medida expressamente anual
    const ehAnual =
      u === "ano" ||
      u === "anos" ||
      u === "anual" ||
      u === "anualidade" ||
      u === "exercicio" ||
      u === "exercicio anual";

    if (ehAnual) {
      return 12;
    }
  }

  // 3. Inspeção textual de indicação expressa de montante / contrato global anual
  const t = removerAcentos(texto || "");
  const padroesAnual = [
    /\bvalor\s+(?:global\s+)?anual\b/,
    /\bmontante\s+(?:global\s+)?anual\b/,
    /\bcontrato\s+anual\b/,
    /\bestimativa\s+anual\b/,
    /\bglobal\s+anual\b/,
    /\bexercicio\s+anual\b/,
    /\bpor\s+ano\b/,
    /\bperiodo\s+(?:de\s+)?12\s+meses\b/,
    /\bvigencia\s+(?:de\s+)?12\s+meses\b/,
    /\b(?:12|doze)\s+meses\b.*?\b(?:global|anual|total)\b/,
    /\b(?:global|anual|total)\b.*?\b(?:12|doze)\s+meses\b/,
  ];

  for (const reg of padroesAnual) {
    if (reg.test(t)) {
      return 12;
    }
  }

  // Padrão default: mensal ou unitário
  return 1;
}

/**
 * Calcula o preço unitário normalizado com salvaguardas contra dupla divisão e gera a fórmula auditável
 */
export function calcularPrecoNormalizado(
  dados: DadosCalculoNormalizacao
): ResultadoCalculoNormalizacao {
  const {
    valorHomologado,
    quantidadeHomologada,
    descricaoItem,
    informacaoComplementar,
    unidadeMedidaItem,
    quantidadeItem,
    modoNormalizacao,
  } = dados;

  const textoCompleto = `${descricaoItem || ""} ${informacaoComplementar || ""}`.trim();

  // 1. Resolver modo efetivo
  const modoEfetivo: ModoNormalizacaoPreco =
    modoNormalizacao === MODO_NORMALIZACAO_AUTO
      ? detectarModoNormalizacaoSugerido(textoCompleto)
      : modoNormalizacao;

  // 2. Modo desativado -> não calcula
  if (modoEfetivo === MODO_NORMALIZACAO_DESATIVADO) {
    return {
      valorNormalizado: valorHomologado,
      valorOriginal: valorHomologado,
      unidadeOriginal: unidadeMedidaItem || "não informado",
      unidadeReferencia: "R$",
      formula: "",
      normalizado: false,
      quantitativoDetectado: null,
      mesesDetectados: 1,
    };
  }

  // 3. Unidade de referência alvo e nomes
  const unidadeRef =
    modoEfetivo === MODO_NORMALIZACAO_POSTO ? "R$/mês/posto" : "R$/mês/veículo";
  const nomeUnidadeSingular = modoEfetivo === MODO_NORMALIZACAO_POSTO ? "posto" : "veículo";
  const nomeUnidadePlural = modoEfetivo === MODO_NORMALIZACAO_POSTO ? "postos" : "veículos";

  // 4. Extrair quantitativo de unidades
  const quantitativo = extrairQuantitativoUnidades(textoCompleto, modoEfetivo);

  // 5. Detectar meses do período contratual
  const meses = detectarMesesPeriodo(textoCompleto, unidadeMedidaItem, quantidadeItem);

  // 6. Se quantitativo não foi informado na ARP, mantém valor original e marca status
  if (quantitativo === null) {
    return {
      valorNormalizado: valorHomologado,
      valorOriginal: valorHomologado,
      unidadeOriginal: unidadeMedidaItem || "não informado",
      unidadeReferencia: unidadeRef,
      formula: "",
      normalizado: false,
      quantitativoDetectado: null,
      mesesDetectados: meses,
      quantitativoStatus: "não informado",
    };
  }

  // 7. Salvaguardas contra dupla divisão de unidades
  let divisorUnidades = quantitativo;

  const uNorm = unidadeMedidaItem ? removerAcentos(unidadeMedidaItem).trim() : "";

  // Salvaguarda A: unidade de medida já é Posto ou Veículo individual
  const unidadeJaEhPosto =
    modoEfetivo === MODO_NORMALIZACAO_POSTO &&
    /^(?:posto|postos|vigilante|vigilantes|porteiro|porteiros|agente|agentes|vigia|vigias)$/.test(
      uNorm
    );

  const unidadeJaEhVeiculo =
    modoEfetivo === MODO_NORMALIZACAO_VEICULO &&
    /^(?:veiculo|veiculos|automovel|automoveis|carro|carros|viatura|viaturas|van|vans|caminhonete|caminhonetes)$/.test(
      uNorm
    );

  // Unidade já expressa formato composto por posto-mês ou veículo-mês
  const unidadeJaEhComposta =
    uNorm.includes("posto/mes") ||
    uNorm.includes("posto-mes") ||
    uNorm.includes("posto mes") ||
    uNorm.includes("veiculo/mes") ||
    uNorm.includes("veiculo-mes") ||
    uNorm.includes("veiculo mes");

  if (unidadeJaEhPosto || unidadeJaEhVeiculo || unidadeJaEhComposta) {
    divisorUnidades = 1;
  }

  // Salvaguarda B: quantidadeItem ou quantidadeHomologada no PNCP já é igual ao quantitativo detectado (N)
  // O órgão já cadastrou o item como N unidades e o valor homologado já é de 1 unidade individual
  if (
    (quantidadeItem !== undefined && quantidadeItem === quantitativo) ||
    (quantidadeHomologada !== undefined && quantidadeHomologada === quantitativo)
  ) {
    divisorUnidades = 1;
  }

  // Se quantitativo for 1, divisor é 1
  if (quantitativo === 1) {
    divisorUnidades = 1;
  }

  // 8. Divisor total combinado (unidades × meses)
  const divisorTotal = divisorUnidades * meses;

  // Se o divisor total for 1, o valor já é unitário mensal -> não há divisão a ser feita
  if (divisorTotal === 1) {
    return {
      valorNormalizado: valorHomologado,
      valorOriginal: valorHomologado,
      unidadeOriginal: unidadeMedidaItem || "não informado",
      unidadeReferencia: unidadeRef,
      formula: "",
      normalizado: false,
      quantitativoDetectado: quantitativo,
      mesesDetectados: meses,
    };
  }

  // 9. Cálculo matemático do valor normalizado
  const valorCalc = valorHomologado / divisorTotal;
  const valorNormalizado = Math.round(valorCalc * 100) / 100;

  // 10. Formatação textual da fórmula auditável da Lei 14.133/2021
  const strOriginal = formatarBRL(valorHomologado);
  const strNormalizado = formatarBRL(valorNormalizado);

  let formula = "";
  if (meses > 1 && divisorUnidades > 1) {
    formula = `${strOriginal} ÷ (${meses} m × ${divisorUnidades} ${nomeUnidadePlural}) = ${strNormalizado}/mês/${nomeUnidadeSingular}`;
  } else if (divisorUnidades > 1) {
    formula = `${strOriginal} ÷ ${divisorUnidades} ${nomeUnidadePlural} = ${strNormalizado}/mês/${nomeUnidadeSingular}`;
  } else if (meses > 1) {
    formula = `${strOriginal} ÷ ${meses} m = ${strNormalizado}/mês/${nomeUnidadeSingular}`;
  }

  return {
    valorNormalizado,
    valorOriginal: valorHomologado,
    unidadeOriginal: unidadeMedidaItem || "não informado",
    unidadeReferencia: unidadeRef,
    formula,
    normalizado: true,
    quantitativoDetectado: quantitativo,
    mesesDetectados: meses,
  };
}
