import type { RequisitoMinimo, ResultadoAderencia } from "@/lib/domain/types";

/**
 * Remove acentos e converte o texto para minúsculas com espaços normalizados.
 */
export function semAcentosMinusculo(texto?: string | null): string {
  if (!texto || typeof texto !== "string") {
    return "";
  }
  return texto
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFloatPtbr(valStr?: string | null): number | null {
  if (!valStr) return null;
  let s = valStr.trim();
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(s)) {
    // Ponto separador de milhar em PT-BR (ex.: "12.000", "9.000", "18.000")
    s = s.replace(/\./g, "");
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

const PALAVRAS_MODALIDADE_CONTRATACAO = new Set([
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
]);

const STOPWORDS_GERAIS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "com",
  "sem",
  "para",
  "por",
  "um",
  "uma",
  "uns",
  "umas",
  "ao",
  "aos",
  "minimo",
  "maximo",
  "medindo",
  "pesando",
  "aproximadamente",
  "novo",
  "nova",
  "novos",
  "novas",
  "primeiro",
  "uso",
  "acondicionado",
  "acondicionada",
  "cor",
  "tipo",
  "modelo",
  "marca",
  "referencia",
  "conforme",
  "edital",
  "termo",
  "item",
  "itens",
  "lote",
  "unidade",
  "unidades",
  "rolo",
  "bobina",
  "caixa",
  "pacote",
  "frasco",
  "peca",
  "objeto",
  "descricao",
  "especificacao",
  "especificacoes",
  "atender",
  "necessidades",
  "secretaria",
  "municipio",
  "municipal",
  "estadual",
  "federal",
  "prefeitura",
  "orgao",
  "valor",
  "mensal",
  "anual",
  "diaria",
  "aparelho",
  "aparelhos",
  "equipamento",
  "equipamentos",
  "capacidade",
  "potencia",
  "ciclo",
  "frio",
  "quente",
  "tensao",
  "volts",
  "bivolt",
  "cerca",
  "minima",
  "maxima",
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extrairNucleoSubstantivo(textoNorm: string): {
  acaoPrincipal: string | null;
  substantivos: string[];
} {
  let acaoPrincipal: string | null = null;
  for (const acao of ["locacao", "manutencao"]) {
    if (new RegExp(`\\b${acao}\\b`).test(textoNorm)) {
      acaoPrincipal = acao;
      break;
    }
  }

  const palavras = textoNorm.match(/[a-z0-9]{3,}/g) || [];
  const substantivos: string[] = [];
  for (const p of palavras) {
    if (STOPWORDS_GERAIS.has(p) || PALAVRAS_MODALIDADE_CONTRATACAO.has(p)) {
      continue;
    }
    if (/^\d+$/.test(p)) {
      continue;
    }
    if (!substantivos.includes(p)) {
      substantivos.push(p);
    }
  }

  return { acaoPrincipal, substantivos };
}

export interface GrupoSinonimosObjeto {
  id: string;
  gatilho: RegExp;
  termosBuscaExpandidos: string[];
  padraoSinonimos: RegExp;
}

/**
 * Grupos de sinônimos automáticos para os objetos mais frequentes em contratações públicas (Lei 14.133/2021).
 * Ativados por padrão para garantir recall total e evitar que termos com nomenclaturas variantes sejam ignorados.
 */
export const GRUPOS_SINONIMOS_AUTOMATICOS: GrupoSinonimosObjeto[] = [
  {
    id: "motorista",
    gatilho: /\b(motoristas?|condutor(?:es)?|manobristas?)\b/i,
    termosBuscaExpandidos: ["motorista", "condutor"],
    padraoSinonimos: /\b(motoristas?|condutor(?:es)?|manobristas?|conducao\s+de\s+veiculos?)\b/i,
  },
  {
    id: "vigilancia",
    gatilho: /\b(vigilancia|vigilantes?|seguranca\s+patrimonial|portaria|porteiros?|vigias?)\b/i,
    termosBuscaExpandidos: ["vigilancia", "seguranca patrimonial", "vigilante"],
    padraoSinonimos: /\b(vigilancia|vigilantes?|seguranca|portaria|porteiros?|vigias?|controlador\s+de\s+acesso|ronda)\b/i,
  },
  {
    id: "limpeza",
    gatilho: /\b(limpeza|conservacao|asseio|higienizacao|faxina|zeladoria|copeiragem)\b/i,
    termosBuscaExpandidos: ["limpeza", "conservacao predial", "asseio e conservacao"],
    padraoSinonimos: /\b(limpeza|conservacao|asseio|higienizacao|faxina|servente[s]?|zeladoria|zelador(?:es)?|copeiragem|copeir[oa]s?)\b/i,
  },
  {
    id: "combustivel",
    gatilho: /\b(combustiv\w*|gasolina|diesel|etanol|abastecimento)\b/i,
    termosBuscaExpandidos: ["combustivel", "gasolina", "oleo diesel", "etanol"],
    padraoSinonimos: /\b(combustiv\w*|gasolina|diesel|etanol|alcool|oleo\s+diesel|abastecimento|arla)\b/i,
  },
  {
    id: "alimentacao",
    gatilho: /\b(alimentac\w*|refeic\w*|marmit\w*|buffet|generos\s+alimenticios|lanches?|coffee\s*break|desjejum)\b/i,
    termosBuscaExpandidos: ["refeicao", "alimentacao", "buffet", "generos alimenticios"],
    padraoSinonimos: /\b(alimentac\w*|refeic\w*|marmit\w*|buffet|generos\s+alimenticios|lanches?|coffee\s*break|desjejum|marmitex|almoco|jantar)\b/i,
  },
  {
    id: "papel_a4",
    gatilho: /\b(papel\s*(?:a4|sulfite|formato\s*a4|oficio)|resmas?)\b/i,
    termosBuscaExpandidos: ["papel a4", "papel sulfite", "resma"],
    padraoSinonimos: /\b(papel\s*(?:a4|sulfite|formato\s*a4|oficio)|resmas?|sulfite\s*a4)\b/i,
  },
  {
    id: "impressao",
    gatilho: /\b(impressao|reprografia|copias?|outsourcing\s+de\s+impressao|locacao\s+de\s+impressora|multifuncional)\b/i,
    termosBuscaExpandidos: ["impressao", "reprografia", "outsourcing de impressao"],
    padraoSinonimos: /\b(impressao|reprografia|copias?|outsourcing|multifuncional|locacao\s+de\s+impressora)\b/i,
  },
  {
    id: "mobiliario",
    gatilho: /\b(mobiliario|moveis\s+para\s+escritorio|cadeiras?|mesas?|armarios?|estantes?|poltronas?)\b/i,
    termosBuscaExpandidos: ["mobiliario", "cadeiras", "moveis para escritorio"],
    padraoSinonimos: /\b(mobiliario|moveis|cadeiras?|mesas?|armarios?|estantes?|poltronas?|estacao\s+de\s+trabalho|gaveteiro)\b/i,
  },
  {
    id: "computador",
    gatilho: /\b(computador\w*|notebook\w*|laptop\w*|desktop\w*|microcomputador\w*)\b/i,
    termosBuscaExpandidos: ["computador", "notebook", "microcomputador"],
    padraoSinonimos: /\b(computador\w*|notebook\w*|laptop\w*|desktop\w*|microcomputador\w*|workstation)\b/i,
  },
  {
    id: "medicamentos",
    gatilho: /\b(medicament\w*|farmac\w*|remedios?|material\s+hospitalar|insumos?\s+hospitalares?)\b/i,
    termosBuscaExpandidos: ["medicamento", "material hospitalar", "insumos hospitalares"],
    padraoSinonimos: /\b(medicament\w*|farmac\w*|remedios?|material\s+hospitalar|insumos?\s+hospitalares?|material\s+penso)\b/i,
  },
];

/**
 * Gera termos de busca enxutos e específicos para consultar o endpoint `/api/search/` do PNCP.
 * NUNCA gera palavras genéricas isoladas (como 'locacao', 'aquisicao', 'fornecimento', 'servico').
 */
export function gerarTermosBusca(descricao: string): string[] {
  const textoNorm = semAcentosMinusculo(descricao);
  if (!textoNorm) {
    return [];
  }

  // Caso clássico de Lona Plástica / Bobina de Lona
  if (/\blonas?\b/.test(textoNorm)) {
    const termosLona = ["lona"];
    if (textoNorm.includes("plast") || textoNorm.includes("polietileno")) {
      termosLona.push("lona plastica");
    }
    if (textoNorm.includes("preta") || textoNorm.includes("preto")) {
      termosLona.push("lona preta");
    }
    return termosLona;
  }

  // Caso de Aparelho de Ar-Condicionado / Condicionador de Ar (quando o objeto principal é climatização e não veículo)
  const ehVeiculoContexto =
    /\b(veiculos?|automoveis|automovel|automotor|hatch|sedan|suv|picape|caminhonete|camionete|van|furgao|onibus|micro-?onibus|caminhao|ambulancia)\b/.test(
      textoNorm
    );
  if (
    !ehVeiculoContexto &&
    /\b(ar[\s-]*condicionado|condicionador(?:es)?\s+de\s+ar)\b/.test(textoNorm)
  ) {
    if (textoNorm.includes("split") && textoNorm.includes("inverter")) {
      return [
        "ar condicionado split",
        "split inverter",
        "condicionador de ar split",
        "ar condicionado inverter",
      ];
    }
    if (textoNorm.includes("split")) {
      return ["ar condicionado split", "condicionador de ar split"];
    }
    if (textoNorm.includes("inverter")) {
      return ["ar condicionado inverter", "condicionador de ar inverter"];
    }
    return ["ar condicionado", "condicionador de ar"];
  }

  // Expansão automática com os grupos de sinônimos mais procurados em compras públicas
  const termosExpandidosSinonimos: string[] = [];
  for (const grupo of GRUPOS_SINONIMOS_AUTOMATICOS) {
    if (grupo.gatilho.test(textoNorm)) {
      for (const t of grupo.termosBuscaExpandidos) {
        if (!termosExpandidosSinonimos.includes(t)) {
          termosExpandidosSinonimos.push(t);
        }
      }
    }
  }

  const { acaoPrincipal, substantivos } = extrairNucleoSubstantivo(textoNorm);
  const termos: string[] = [];

  if (acaoPrincipal && substantivos.length > 0) {
    const obj1 = substantivos[0];
    const termoComposto = `${acaoPrincipal} de ${obj1}`;
    termos.push(termoComposto);
    if (substantivos.length >= 2) {
      const termoEsp = `${acaoPrincipal} ${obj1} ${substantivos[1]}`;
      if (!termos.includes(termoEsp)) {
        termos.push(termoEsp);
      }
    }
  } else if (substantivos.length > 0) {
    if (substantivos.length >= 2) {
      termos.push(`${substantivos[0]} ${substantivos[1]}`);
      const palavrasAmplas = new Set([
        "veiculo",
        "veiculos",
        "equipamento",
        "material",
        "maquina",
        "maquinas",
        "aparelho",
        "produto",
        "conjunto",
        "kit",
        "papel",
        "tubo",
        "cabo",
        "placa",
        "caixa",
        "cadeira",
        "mesa",
      ]);
      if (!palavrasAmplas.has(substantivos[0])) {
        termos.unshift(substantivos[0]);
      }
    } else {
      termos.push(substantivos[0]);
    }
  }

  // Se houver termos expandidos por sinônimos, une com os termos extraídos sem duplicações
  const todosTermos = [...termos, ...termosExpandidosSinonimos];
  const resultadoFinal = Array.from(new Set(todosTermos)).filter(Boolean);

  if (resultadoFinal.length > 0) {
    return resultadoFinal;
  }

  return [textoNorm.slice(0, 40).trim()];
}

/**
 * Extrai da descrição digitada uma lista estruturada de requisitos mínimos.
 */
export function extrairRequisitosMinimos(descricao: string): RequisitoMinimo[] {
  const textoNorm = semAcentosMinusculo(descricao);
  const requisitos: RequisitoMinimo[] = [];
  if (!textoNorm) {
    return requisitos;
  }

  const ehContextoVeiculo = [
    "veiculo",
    "veiculos",
    "automovel",
    "automoveis",
    "automotor",
    "hatch",
    "sedan",
    "suv",
    "picape",
    "caminhonete",
    "camionete",
    "carro",
  ].some((w) => textoNorm.includes(w));

  const ehObjetoArCondicionado =
    !ehContextoVeiculo &&
    /\b(ar[\s-]*condicionado|condicionador(?:es)?\s+de\s+ar)\b/.test(textoNorm);

  // 1. Objeto Principal
  if (/\blonas?\b/.test(textoNorm)) {
    requisitos.push({
      Atributo: "Objeto principal",
      Operador: "contém",
      Valor: "lona",
      Unidade: "-",
      Obrigatorio: true,
    });
  } else if (ehObjetoArCondicionado) {
    requisitos.push({
      Atributo: "Objeto principal",
      Operador: "contém",
      Valor: "ar condicionado",
      Unidade: "-",
      Obrigatorio: true,
    });
  } else {
    const { acaoPrincipal, substantivos } = extrairNucleoSubstantivo(textoNorm);
    let valorObj = "";
    if (acaoPrincipal && substantivos.length > 0) {
      valorObj = `${acaoPrincipal} ${substantivos[0]}`;
    } else if (substantivos.length >= 2) {
      valorObj = `${substantivos[0]} ${substantivos[1]}`;
    } else if (substantivos.length === 1) {
      valorObj = substantivos[0];
    } else {
      valorObj = textoNorm.slice(0, 30);
    }

    requisitos.push({
      Atributo: "Objeto principal",
      Operador: "contém",
      Valor: valorObj,
      Unidade: "-",
      Obrigatorio: true,
    });
  }

  // 2. Tipo / Categoria
  const tiposVeiculoEquip: Array<[string[], string]> = [
    [["hatch", "hatchback"], "hatch"],
    [["sedan", "seda"], "sedan"],
    [["picape", "pickup", "pick-up", "caminhonete", "camionete"], "picape/caminhonete"],
    [["suv", "utilitario esportivo"], "suv"],
    [["van", "minivan", "furgao"], "van/furgão"],
    [["micro-onibus", "microonibus", "micro onibus"], "micro-ônibus"],
    [["onibus"], "ônibus"],
    [["caminhao"], "caminhão"],
    [["ambulancia"], "ambulância"],
    [["motocicleta", "moto"], "motocicleta"],
    [["passeio"], "passeio"],
    [["split"], "split"],
  ];
  const tiposEncontrados: string[] = [];
  for (const [variantes, nomeTipo] of tiposVeiculoEquip) {
    if (variantes.some((v) => new RegExp(`\\b${escapeRegex(v)}\\b`).test(textoNorm))) {
      if (!tiposEncontrados.includes(nomeTipo)) {
        tiposEncontrados.push(nomeTipo);
      }
    }
  }
  if (tiposEncontrados.length > 0) {
    requisitos.push({
      Atributo: "Tipo / Categoria",
      Operador: "=",
      Valor: tiposEncontrados.join(" / "),
      Unidade: "-",
      Obrigatorio: true,
    });
  }

  // 2b. Tecnologia (Inverter vs Convencional)
  if (/\binverter\b/.test(textoNorm)) {
    requisitos.push({
      Atributo: "Tecnologia",
      Operador: "=",
      Valor: "inverter",
      Unidade: "-",
      Obrigatorio: true,
    });
  }

  // 3. Material
  if (
    ["plastico", "plastica", "polietileno", "pebd", "pead"].some((m) =>
      textoNorm.includes(m)
    )
  ) {
    requisitos.push({
      Atributo: "Material",
      Operador: "=",
      Valor: "plástico",
      Unidade: "-",
      Obrigatorio: true,
    });
  } else if (textoNorm.includes("aco inox") || textoNorm.includes("inoxidavel")) {
    requisitos.push({
      Atributo: "Material",
      Operador: "=",
      Valor: "aço inox",
      Unidade: "-",
      Obrigatorio: true,
    });
  } else if (textoNorm.includes("aluminio")) {
    requisitos.push({
      Atributo: "Material",
      Operador: "=",
      Valor: "alumínio",
      Unidade: "-",
      Obrigatorio: true,
    });
  } else if (textoNorm.includes("algodao")) {
    requisitos.push({
      Atributo: "Material",
      Operador: "=",
      Valor: "algodão",
      Unidade: "-",
      Obrigatorio: true,
    });
  }

  // 4. Cor
  const coresConhecidas: Array<[string[], string]> = [
    [["preto", "preta"], "preta"],
    [["azul"], "azul"],
    [["amarelo", "amarela"], "amarela"],
    [["branco", "branca"], "branca"],
    [["verde"], "verde"],
    [["transparente", "cristal"], "transparente"],
    [["cinza", "prata"], "cinza/prata"],
  ];
  for (const [variantes, corCanonica] of coresConhecidas) {
    if (variantes.some((v) => new RegExp(`\\b${v}\\b`).test(textoNorm))) {
      requisitos.push({
        Atributo: "Cor",
        Operador: "=",
        Valor: corCanonica,
        Unidade: "-",
        Obrigatorio: true,
      });
      break;
    }
  }

  // 5. Dimensões: Largura x Comprimento
  const matchDim = textoNorm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)?\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\b/
  );
  if (matchDim) {
    const v1 = parseFloatPtbr(matchDim[1]);
    const v2 = parseFloatPtbr(matchDim[2]);
    if (v1 !== null && v2 !== null) {
      const largura = Math.min(v1, v2);
      const comprimento = Math.max(v1, v2);
      requisitos.push({
        Atributo: "Largura",
        Operador: ">=",
        Valor: `${largura}`,
        Unidade: "m",
        Obrigatorio: true,
      });
      requisitos.push({
        Atributo: "Comprimento",
        Operador: ">=",
        Valor: `${comprimento}`,
        Unidade: "m",
        Obrigatorio: true,
      });
    }
  }

  // 6. Espessura em micras ou milímetros
  const matchMicras = textoNorm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:micras?|micra|µm?|mc)\b/
  );
  if (matchMicras) {
    const esp = parseFloatPtbr(matchMicras[1]);
    if (esp !== null) {
      requisitos.push({
        Atributo: "Espessura",
        Operador: ">=",
        Valor: `${esp}`,
        Unidade: "micras",
        Obrigatorio: true,
      });
    }
  } else {
    const matchMm = textoNorm.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
    if (matchMm) {
      const mmVal = parseFloatPtbr(matchMm[1]);
      if (mmVal !== null && mmVal < 5.0) {
        requisitos.push({
          Atributo: "Espessura",
          Operador: ">=",
          Valor: `${Math.round(mmVal * 1000 * 100) / 100}`,
          Unidade: "micras",
          Obrigatorio: true,
        });
      }
    }
  }

  // 7. Peso mínimo em kg
  const matchPeso = textoNorm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|quilogramas?)\b/
  );
  if (matchPeso) {
    const peso = parseFloatPtbr(matchPeso[1]);
    if (peso !== null) {
      requisitos.push({
        Atributo: "Peso",
        Operador: ">=",
        Valor: `${peso}`,
        Unidade: "kg",
        Obrigatorio: true,
      });
    }
  }

  // 8. Atributos específicos de veículos / equipamentos
  let matchMotor = textoNorm.match(
    /(?:motor(?:izacao)?(?:\s+minima|\s+de)?\s*|cilindrada\s*)(\d[.,]\d)\b|\b([12][.,][034568])\s*(?:flex|diesel|gasolina|turbo|8v|12v|16v)\b/
  );
  if (!matchMotor && ehContextoVeiculo) {
    matchMotor = textoNorm.match(/\b([12]\.[034568])\b/);
  }
  if (matchMotor) {
    const mStr = matchMotor[1] || matchMotor[2];
    const mVal = parseFloatPtbr(mStr);
    if (mVal !== null && mVal >= 1.0 && mVal <= 6.0) {
      requisitos.push({
        Atributo: "Motorização",
        Operador: ">=",
        Valor: mVal.toFixed(1),
        Unidade: "L",
        Obrigatorio: true,
      });
    }
  }

  // 8b. Potência (CV / HP / BTUs)
  const matchCv = textoNorm.match(/(\d{2,4})\s*(?:cv|hp|cavalos)\b/);
  if (matchCv) {
    requisitos.push({
      Atributo: "Potência",
      Operador: ">=",
      Valor: matchCv[1],
      Unidade: "cv",
      Obrigatorio: true,
    });
  }
  const matchBtu = textoNorm.match(
    /(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*btus?(?:\s*\/\s*h)?\b/
  );
  if (matchBtu) {
    const btuLimpo = matchBtu[1].replace(/\./g, "").replace(/,/g, "");
    const pedeMinimoBtu =
      /(?:minimo|minima|a partir de)\s+(?:de\s+)?(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*btus?/.test(
        textoNorm
      );
    requisitos.push({
      Atributo: "Potência",
      Operador: pedeMinimoBtu ? ">=" : "=",
      Valor: btuLimpo,
      Unidade: "BTUs",
      Obrigatorio: true,
    });
  }

  // 8c. Combustível
  const combustiveis: Array<[string[], string]> = [
    [["flex", "bicombustivel"], "flex"],
    [["diesel"], "diesel"],
    [["gasolina"], "gasolina"],
    [["eletrico", "hibrido"], "elétrico/híbrido"],
  ];
  for (const [combVars, combNome] of combustiveis) {
    if (combVars.some((c) => new RegExp(`\\b${c}\\b`).test(textoNorm))) {
      requisitos.push({
        Atributo: "Combustível",
        Operador: "=",
        Valor: combNome,
        Unidade: "-",
        Obrigatorio: true,
      });
      break;
    }
  }

  // 8d. Portas
  const matchPortas = textoNorm.match(/0?(\d)\s*portas\b/);
  if (matchPortas) {
    requisitos.push({
      Atributo: "Portas",
      Operador: ">=",
      Valor: matchPortas[1],
      Unidade: "portas",
      Obrigatorio: true,
    });
  }

  // 8e. Capacidade de passageiros / lugares
  const matchLug = textoNorm.match(
    /0?(\d{1,2})\s*(?:passageiros|lugares|ocupantes|pessoas)\b/
  );
  if (matchLug) {
    requisitos.push({
      Atributo: "Capacidade",
      Operador: ">=",
      Valor: matchLug[1],
      Unidade: "lugares",
      Obrigatorio: true,
    });
  }

  // 8f. Ar-condicionado (apenas quando acessório de veículo) / Tração / Regime
  if (
    ehContextoVeiculo &&
    (textoNorm.includes("ar condicionado") ||
      textoNorm.includes("ar-condicionado"))
  ) {
    requisitos.push({
      Atributo: "Acessório",
      Operador: "contém",
      Valor: "ar condicionado",
      Unidade: "-",
      Obrigatorio: true,
    });
  }
  if (textoNorm.includes("4x4")) {
    requisitos.push({
      Atributo: "Tração",
      Operador: "=",
      Valor: "4x4",
      Unidade: "-",
      Obrigatorio: true,
    });
  }
  if (textoNorm.includes("sem motorista")) {
    requisitos.push({
      Atributo: "Regime",
      Operador: "contém",
      Valor: "sem motorista",
      Unidade: "-",
      Obrigatorio: true,
    });
  } else if (textoNorm.includes("com motorista")) {
    requisitos.push({
      Atributo: "Regime",
      Operador: "contém",
      Valor: "com motorista",
      Unidade: "-",
      Obrigatorio: true,
    });
  }

  // 9. Unidade de fornecimento esperada
  if (["rolo", "rolos", "bobina", "bobinas"].some((u) => textoNorm.includes(u))) {
    requisitos.push({
      Atributo: "Unidade de fornecimento",
      Operador: "compatível",
      Valor: "rolo/bobina",
      Unidade: "rolo/bobina",
      Obrigatorio: true,
    });
  } else if (
    ["mensal", "mensais", "mes", "meses"].some((u) =>
      new RegExp(`\\b${u}\\b`).test(textoNorm)
    )
  ) {
    requisitos.push({
      Atributo: "Unidade de fornecimento",
      Operador: "compatível",
      Valor: "mensal/mês",
      Unidade: "mês",
      Obrigatorio: true,
    });
  } else if (
    ["diaria", "diarias"].some((u) => new RegExp(`\\b${u}\\b`).test(textoNorm))
  ) {
    requisitos.push({
      Atributo: "Unidade de fornecimento",
      Operador: "compatível",
      Valor: "diária",
      Unidade: "diária",
      Obrigatorio: true,
    });
  }

  return requisitos;
}

/**
 * Extrai [largura_m, comprimento_m] da descrição de um item.
 */
export function extrairDimensoesItem(textoNorm: string): [number, number] | null {
  const mLarg = textoNorm.match(
    /(?:largura(?:\s+minima|\s+de)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)?)|(?:(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\s+(?:de\s+)?largura)/
  );
  const mComp = textoNorm.match(
    /(?:comprimento(?:\s+minimo|\s+de)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)?)|(?:(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\s+(?:de\s+)?comprimento)/
  );

  if (mLarg && mComp) {
    const strL = mLarg[1] || mLarg[2];
    const strC = mComp[1] || mComp[2];
    const valL = parseFloatPtbr(strL);
    const valC = parseFloatPtbr(strC);
    if (valL !== null && valC !== null && valL > 0 && valC > 0) {
      return [Math.min(valL, valC), Math.max(valL, valC)];
    }
  }

  const regexAxB =
    /(?<!\d)(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m|mt|mts|metros?)?(?:\s+(?:de\s+)?largura)?\s*[xX*]\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m|mt|mts|metros?)?(?!\s*(?:cm|mm)\b)/g;

  let m: RegExpExecArray | null;
  while ((m = regexAxB.exec(textoNorm)) !== null) {
    const v1 = parseFloatPtbr(m[1]);
    const v2 = parseFloatPtbr(m[2]);
    if (v1 !== null && v2 !== null && v1 > 0 && v2 > 0) {
      if (
        (v1 === 4 && v2 === 4) ||
        (v1 === 4 && v2 === 2) ||
        (v1 === 2 && v2 === 4)
      ) {
        continue;
      }
      const posFim = m.index + m[0].length;
      const trechoPos = textoNorm.slice(posFim, posFim + 15);
      if (/^\s*[xX*]\s*\d+/.test(trechoPos)) {
        continue;
      }
      return [Math.min(v1, v2), Math.max(v1, v2)];
    }
  }

  if (mLarg && !mComp) {
    const strL = mLarg[1] || mLarg[2];
    const valL = parseFloatPtbr(strL);
    if (valL !== null && valL > 0) {
      return [valL, -1.0];
    }
  }

  return null;
}

/**
 * Extrai a espessura em micras a partir da descrição do item.
 */
export function extrairEspessuraMicrasItem(textoNorm: string): number | null {
  const mMicra = textoNorm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:micras?|micra|µm?|mc|microns?)\b/
  );
  if (mMicra) {
    const val = parseFloatPtbr(mMicra[1]);
    if (val !== null && val >= 5) {
      return val;
    }
  }

  const mMm = textoNorm.match(/(\d+[.,]\d+)\s*(?:mm|milimetros?)\b/);
  if (mMm) {
    const valMm = parseFloatPtbr(mMm[1]);
    if (valMm !== null && valMm >= 0.01 && valMm <= 3.0) {
      return Math.round(valMm * 1000 * 100) / 100;
    }
  }

  return null;
}

/**
 * Extrai o peso em kg a partir da descrição do item.
 */
export function extrairPesoKgItem(textoNorm: string): number | null {
  const regexPeso = /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|quilogramas?)(?!\s*\/\s*m)/g;
  const pesosEncontrados: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regexPeso.exec(textoNorm)) !== null) {
    const val = parseFloatPtbr(m[1]);
    if (val !== null && val > 0) {
      pesosEncontrados.push(val);
    }
  }
  return pesosEncontrados.length > 0 ? Math.max(...pesosEncontrados) : null;
}

/**
 * Verifica a Regra R5: unidade de fornecimento compatível com o objeto,
 * sem converter unidades para 'encaixar' itens menores.
 */
export function verificarUnidadeCompativel(
  valorEsperado: string,
  unidadeApi: string | null | undefined,
  textoItemNorm: string
): { compativel: boolean; mensagem: string } {
  const unApi = semAcentosMinusculo(unidadeApi || "");
  const esp = semAcentosMinusculo(valorEsperado);

  if (esp.includes("rolo") || esp.includes("bobina")) {
    const unidadesIncompativeis = new Set([
      "metro",
      "metros",
      "m",
      "mt",
      "mts",
      "m2",
      "m²",
      "metro quadrado",
      "metros quadrados",
      "kg",
      "quilograma",
      "quilogramas",
      "quilo",
      "quilos",
      "grama",
      "gramas",
      "lote",
      "kit",
      "conjunto",
      "par",
      "litro",
      "litros",
      "caixa",
      "pacote",
    ]);

    if (
      unidadesIncompativeis.has(unApi) ||
      ["metro", "quilograma", "lote"].some((x) => unApi.startsWith(`${x} `))
    ) {
      return {
        compativel: false,
        mensagem: `Unidade incompatível na ARP ('${unidadeApi}') para objeto em rolo/bobina (R5)`,
      };
    }

    if (["rolo", "rl", "bobina", "bob", "rlo"].some((k) => unApi.includes(k))) {
      return {
        compativel: true,
        mensagem: `Unidade '${unidadeApi}' compatível (rolo/bobina)`,
      };
    }

    if (
      ["unidade", "un", "und", "unid", "unid.", "peca", "pc", "pç"].includes(
        unApi
      )
    ) {
      if (
        ["rolo", "rolos", "bobina", "bobinas"].some((p) =>
          new RegExp(`\\b${p}\\b`).test(textoItemNorm)
        )
      ) {
        return {
          compativel: true,
          mensagem: `Unidade '${unidadeApi}' com descrição explícita de rolo/bobina`,
        };
      }
      return {
        compativel: false,
        mensagem: `Unidade '${unidadeApi}' sem indicação de rolo/bobina na descrição (R5)`,
      };
    }

    if (!unApi) {
      return {
        compativel: false,
        mensagem: "Unidade de fornecimento não informada na ARP",
      };
    }
    return {
      compativel: false,
      mensagem: `Unidade '${unidadeApi}' incompatível com rolo/bobina`,
    };
  }

  if (esp.includes("mensal") || esp.includes("mes")) {
    if (
      ["diaria", "dia", "km", "quilometro", "hora", "hr", "litro"].some((k) =>
        unApi.includes(k)
      )
    ) {
      return {
        compativel: false,
        mensagem: `Unidade '${unidadeApi}' incompatível com regime mensal (R5)`,
      };
    }
    return { compativel: true, mensagem: `Unidade '${unidadeApi || "mensal"}'` };
  }

  if (esp.includes("diaria")) {
    if (
      ["mes", "mensal", "km", "quilometro", "hora", "anual"].some((k) =>
        unApi.includes(k)
      )
    ) {
      return {
        compativel: false,
        mensagem: `Unidade '${unidadeApi}' incompatível com diária (R5)`,
      };
    }
    return { compativel: true, mensagem: `Unidade '${unidadeApi || "diária"}'` };
  }

  if (!unApi) {
    return { compativel: false, mensagem: "Unidade de fornecimento não informada" };
  }
  if (unApi === "lote") {
    return {
      compativel: false,
      mensagem: "Item cadastrado como LOTE sem unidade individual (R5)",
    };
  }
  return { compativel: true, mensagem: `Unidade '${unidadeApi}'` };
}

function extrairBtusItem(textoNorm: string): number | null {
  const mMil = textoNorm.match(/\b(\d{1,2})\s*mil\s*btus?(?:\s*\/\s*h)?\b/);
  if (mMil) {
    return Number(mMil[1]) * 1000;
  }
  const mBtu = textoNorm.match(
    /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*btus?(?:\s*\/\s*h)?\b/
  );
  if (mBtu) {
    const limpo = mBtu[1].replace(/[.,]/g, "");
    const n = Number(limpo);
    if (Number.isFinite(n) && n >= 1000) {
      return n;
    }
  }
  const mCapac = textoNorm.match(
    /(?:capacidade(?:\s+de)?\s+refrigeracao|capacidade|potencia)\s*(?::\s*|\s+)(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\b/
  );
  if (mCapac) {
    const limpo = mCapac[1].replace(/[.,]/g, "");
    const n = Number(limpo);
    if (Number.isFinite(n) && n >= 5000) {
      return n;
    }
  }
  return null;
}

function palavraPresenteOuSinonimo(
  palavra: string,
  textoItemNorm: string,
  textoContextoAtaNorm = ""
): boolean {
  if (palavra === "locacao" || palavra === "aluguel") {
    const padraoLoc = /\b(locacao|locacoes|aluguel|locar|mensal|diaria)\b/;
    return padraoLoc.test(textoItemNorm) || padraoLoc.test(textoContextoAtaNorm);
  }

  if (
    ["veiculo", "veiculos", "automovel", "automoveis"].includes(palavra)
  ) {
    const padraoVeic =
      /\b(veiculos?|automoveis|automovel|automotor|carro|caminhonetes?|camionetes?|picapes?|pickup|sedan|seda|hatch|suv|utilitarios?|vans?|furgao|onibus|micro-?onibus|caminhao|ambulancias?|motocicletas?)\b/;
    return padraoVeic.test(textoItemNorm);
  }

  if (palavra === "condicionado" || palavra === "condicionador") {
    const padraoArCond =
      /\b(ar[\s-]*condicionado|condicionador(?:es)?\s+de\s+ar|climatizador(?:es)?\s+split|evaporadora\s+e\s+condensadora)\b/;
    if (padraoArCond.test(textoItemNorm)) return true;
    if (
      padraoArCond.test(textoContextoAtaNorm) &&
      /\b(split|inverter|btus?|evaporadora|condensadora)\b/.test(textoItemNorm)
    ) {
      return true;
    }
    return false;
  }

  // Consulta aos grupos de sinônimos automáticos para objetos frequentes da administração pública
  for (const grupo of GRUPOS_SINONIMOS_AUTOMATICOS) {
    if (grupo.gatilho.test(palavra)) {
      if (
        grupo.padraoSinonimos.test(textoItemNorm) ||
        grupo.padraoSinonimos.test(textoContextoAtaNorm)
      ) {
        return true;
      }
    }
  }

  const base = palavra.replace(/s$/, "");
  if (base.length >= 3) {
    return new RegExp(`\\b${escapeRegex(base)}(?:s|es)?\\b`).test(textoItemNorm);
  }
  return textoItemNorm.includes(palavra);
}

function compararNum(valorItem: number, operador: string, valorReq: number): boolean {
  const op = operador.trim();
  if (op === ">=" || op === "≥") return valorItem + 1e-6 >= valorReq;
  if (op === "<=" || op === "≤") return valorItem - 1e-6 <= valorReq;
  if (op === "=" || op === "==") return Math.abs(valorItem - valorReq) <= 1e-4;
  if (op === ">") return valorItem > valorReq;
  if (op === "<") return valorItem < valorReq;
  return valorItem + 1e-6 >= valorReq;
}

/**
 * Classifica o item da ARP em 'A', 'B' ou 'C'.
 * Regra inegociável: Atributo ausente na descrição NUNCA resulta em A.
 */
export function avaliarAderenciaItem(
  descricaoItem: string | null | undefined,
  unidadeMedidaApi: string | null | undefined,
  requisitos: RequisitoMinimo[],
  informacaoComplementarItem?: string | null,
  objetoAta?: string | null
): ResultadoAderencia {
  const textoCompleto = `${descricaoItem || ""} ${informacaoComplementarItem || ""}`.trim();
  let textoNorm = semAcentosMinusculo(textoCompleto);

  const numeraisExtenso: Array<[string, string]> = [
    ["duas", "2"],
    ["dois", "2"],
    ["tres", "3"],
    ["quatro", "4"],
    ["cinco", "5"],
    ["seis", "6"],
    ["sete", "7"],
    ["oito", "8"],
  ];
  for (const [ext, dig] of numeraisExtenso) {
    textoNorm = textoNorm.replace(
      new RegExp(`\\b${ext}\\s+(portas|passageiros|lugares|ocupantes|pessoas)\\b`, "g"),
      `${dig} $1`
    );
  }

  const textoAtaNorm = semAcentosMinusculo(objetoAta || "");

  if (!textoNorm) {
    return {
      aderencia: "C",
      motivo: "Descrição do item vazia na ARP",
      atendidos: [],
      ausentes: [],
      reprovados: ["Descrição vazia"],
    };
  }

  const atendidos: string[] = [];
  const ausentes: string[] = [];
  const reprovados: string[] = [];

  const dimensoesItem = extrairDimensoesItem(textoNorm);
  const espessuraItem = extrairEspessuraMicrasItem(textoNorm);
  const pesoItem = extrairPesoKgItem(textoNorm);

  for (const req of requisitos) {
    if (req.Obrigatorio === false) continue;

    const atrib = String(req.Atributo || "").trim();
    const atribNorm = semAcentosMinusculo(atrib);
    const operador = String(req.Operador || "").trim();
    const valorStr = String(req.Valor || "").trim();
    const valorNorm = semAcentosMinusculo(valorStr);
    const unidadeReq = String(req.Unidade || "").trim();

    // 1. Objeto principal
    if (atribNorm.includes("objeto")) {
      let palavrasObj = valorNorm
        .split(" ")
        .filter((p) => p.length >= 3 && !STOPWORDS_GERAIS.has(p));
      if (palavrasObj.length === 0) {
        palavrasObj = [valorNorm];
      }

      if (
        !palavrasObj.every((p) =>
          palavraPresenteOuSinonimo(p, textoNorm, textoAtaNorm)
        )
      ) {
        return {
          aderencia: "C",
          motivo: `Item não corresponde ao objeto pesquisado ('${valorStr}' ausente na descrição do item)`,
          atendidos,
          ausentes,
          reprovados: [`Objeto '${valorStr}' não encontrado`],
        };
      }

      if (valorNorm.includes("lona") && !valorNorm.includes("locacao")) {
        const termosExclusaoLona = [
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
        ];
        if (termosExclusaoLona.some((s) => textoNorm.includes(s))) {
          return {
            aderencia: "C",
            motivo:
              "Item refere-se a outro produto/serviço (ex.: lona de freio, plotter, banner ou locação)",
            atendidos,
            ausentes,
            reprovados: ["Produto distinto do objeto pesquisado"],
          };
        }
      }

      if (valorNorm.includes("motorista") || valorNorm.includes("condutor")) {
        const regexSemMotorista =
          /\b(?:sem|dispensado|nao\s+inclui|nao\s+incluso|excluso)\s+(?:motoristas?|condutor(?:es)?)\b/i;
        if (
          regexSemMotorista.test(textoNorm) &&
          !/\b(?:com\s+(?:motorista|condutor)|postos?\s+de\s+(?:motorista|condutor)|servicos?\s+de\s+(?:motorista|condutor))\b/i.test(
            textoNorm
          )
        ) {
          return {
            aderencia: "C",
            motivo:
              "Item refere-se expressamente a contratação sem motorista/condutor (objeto pesquisado requer condutor)",
            atendidos,
            ausentes,
            reprovados: ["Item expressamente sem motorista/condutor"],
          };
        }
      }

      if (valorNorm.includes("veicul") && valorNorm.includes("locacao")) {
        const unApiLow = semAcentosMinusculo(unidadeMedidaApi || "");
        const termosExclusaoVeic = [
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
        ];
        const ehKmAvulso =
          !valorNorm.includes("km") &&
          (["km", "quilometro", "quilometros", "km rodado"].includes(unApiLow) ||
            textoNorm.includes("km rodado") ||
            textoNorm.includes("quilometro rodado"));

        if (termosExclusaoVeic.some((s) => textoNorm.includes(s)) || ehKmAvulso) {
          return {
            aderencia: "C",
            motivo:
              "Item refere-se a outro serviço (passagem, câmera, manutenção, taxa ou km avulso)",
            atendidos,
            ausentes,
            reprovados: ["Serviço distinto de locação de veículos"],
          };
        }
      }

      if (
        (valorNorm.includes("condicionado") ||
          valorNorm.includes("condicionador")) &&
        !valorNorm.includes("manutencao") &&
        !valorNorm.includes("instalacao") &&
        !valorNorm.includes("limpeza") &&
        !valorNorm.includes("locacao")
      ) {
        const unApiLow = semAcentosMinusculo(unidadeMedidaApi || "");
        const termosExclusaoArCond = [
          "manutencao preventiva",
          "manutencao corretiva",
          "servico de manutencao",
          "servicos de manutencao",
          "manutencao de ar",
          "manutencao em ar",
          "limpeza e higienizacao",
          "higienizacao de ar",
          "servico de limpeza",
          "servico de instalacao",
          "servicos de instalacao",
          "instalacao de ar condicionado",
          "instalacao e desinstalacao",
          "desinstalacao de",
          "remanejamento de",
          "recarga de gas",
          "carga de gas",
          "locacao de ar",
          "aluguel de ar",
          "compressor para ar",
          "compressor rotativo",
          "placa eletronica",
          "placa receptora",
          "controle remoto",
          "suporte para condensadora",
          "suporte para ar",
          "suporte aparelho ar condicionado",
          "suporte de ar condicionado",
          "suporte para evaporadora",
          "suporte de fixacao",
          "base para condensadora",
          "mao francesa para ar",
          "coxim para",
          "pecas para ar",
          "pecas de ar",
          "acessorios para ar",
          "cortina de ar",
          "defletor de ar",
          "tubo de cobre",
          "tubulacao de cobre",
          "bomba de dreno",
          "capacitor para",
          "turbina evaporadora",
          "motor ventilador",
          "serpentina",
          "filtro de ar",
          "higienizador",
          "bolsa coletora",
          "ar condicionado automotivo",
          "ar condicionado veicular",
        ];
        const unidadesServicoOuPeca = new Set([
          "servico",
          "servicos",
          "serv",
          "srv",
          "sv",
          "hora",
          "horas",
          "hr",
          "mes",
          "mensal",
          "diaria",
          "metro",
          "metros",
          "m",
          "kg",
          "quilo",
          "litro",
          "par",
        ]);

        const ehSuporteOuPecaAvulsa =
          /^(?:suporte|base|coxim|mao\s+francesa|parafuso|duto|mangueira|helice|termostato|sensor)\b/.test(
            textoNorm
          ) ||
          /\bsuporte\s+(?:de\s+|para\s+|de\s+fixacao\s+|de\s+parede\s+)?(?:aparelho\s+)?(?:de\s+)?ar[\s-]*condicionado\b/.test(
            textoNorm
          );

        const ehServicoArCond =
          /\b(?:manutencao\s+(?:de|em)\s+(?:aparelhos?|equipamentos?|ar)|manutencao\s+(?:preventiva|corretiva|predial)|servicos?\s+de\s+(?:instalacao|manutencao|limpeza|remanejamento|desmontagem|montagem)|instalacao\s*[\/e]\s*(?:desinstalacao|montagem|desmontagem|remocao)|remanejamento\s+com\s+transporte|desmontagem\s*[\/e]\s*(?:montagem|remocao)|manutencao\s+de\s+aparelhos|ar[\s-]*condicionado\s*[-–—:]\s*(?:instalacao|desinstalacao|montagem|desmontagem|remocao|remanejamento|manutencao|higienizacao|limpeza|assistencia|conserto|reparo))\b/.test(
            textoNorm
          ) ||
          /^(?:instalacao|desinstalacao|remanejamento|desmontagem|montagem|manutencao|limpeza|higienizacao)\b/.test(
            textoNorm
          );

        if (
          ehSuporteOuPecaAvulsa ||
          ehServicoArCond ||
          termosExclusaoArCond.some((s) => textoNorm.includes(s)) ||
          unidadesServicoOuPeca.has(unApiLow)
        ) {
          return {
            aderencia: "C",
            motivo:
              "Item refere-se a serviço (manutenção, instalação, limpeza, locação) ou peça/acessório/suporte avulso",
            atendidos,
            ausentes,
            reprovados: ["Serviço ou peça distinta do aparelho de ar-condicionado"],
          };
        }
      }

      atendidos.push(`Objeto: ${valorStr}`);
      continue;
    }

    // 2. Unidade de fornecimento (R5)
    if (atribNorm.includes("unidade")) {
      const { compativel, mensagem } = verificarUnidadeCompativel(
        valorStr,
        unidadeMedidaApi,
        textoNorm
      );
      if (!compativel) {
        reprovados.push(mensagem);
      } else {
        atendidos.push(mensagem);
      }
      continue;
    }

    // 3. Tipo / Categoria
    if (atribNorm.includes("tipo") || atribNorm.includes("categoria")) {
      const partesBase = valorNorm
        .split(/[/,]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const sinonimosTipo: Record<string, string[]> = {
        hatch: ["hatch", "hatchback"],
        sedan: ["sedan", "seda"],
        seda: ["sedan", "seda"],
        picape: ["picape", "pickup", "pick-up", "caminhonete", "camionete"],
        caminhonete: ["picape", "pickup", "pick-up", "caminhonete", "camionete"],
        suv: ["suv", "utilitario esportivo"],
        van: ["van", "vans", "minivan", "furgao"],
        onibus: ["onibus"],
        "micro-onibus": ["micro-onibus", "microonibus"],
        caminhao: ["caminhao", "caminhoes"],
        motocicleta: ["motocicleta", "moto", "motocicletas", "motos"],
      };
      const partesTipo: string[] = [];
      for (const p of partesBase) {
        partesTipo.push(...(sinonimosTipo[p] || [p]));
      }

      if (
        partesTipo.some((p) => new RegExp(`\\b${escapeRegex(p)}\\b`).test(textoNorm))
      ) {
        atendidos.push(`Tipo/Categoria: ${valorStr}`);
      } else {
        const tiposConflitantes = [
          "hatch",
          "hatchback",
          "sedan",
          "seda",
          "picape",
          "pickup",
          "pick-up",
          "caminhonete",
          "camionete",
          "suv",
          "van",
          "vans",
          "furgao",
          "minivan",
          "onibus",
          "micro-onibus",
          "microonibus",
          "caminhao",
          "caminhoes",
          "ambulancia",
          "motocicleta",
          "moto",
          "trator",
          "retroescavadeira",
          "motoniveladora",
          "escavadeira",
          "empilhadeira",
          "guincho",
          "reboque",
          "janela",
          "portatil",
        ];
        const outrosNoItem = tiposConflitantes.filter(
          (t) =>
            !partesTipo.includes(t) &&
            new RegExp(`\\b${escapeRegex(t)}\\b`).test(textoNorm)
        );
        if (outrosNoItem.length > 0) {
          const unicos = Array.from(new Set(outrosNoItem)).sort();
          reprovados.push(
            `Tipo/Categoria incompatível (${unicos.join("/")} em vez de ${valorStr})`
          );
        } else {
          ausentes.push(`Tipo/Categoria (${valorStr}) não especificado`);
        }
      }
      continue;
    }

    // 3b. Regime
    if (atribNorm.includes("regime")) {
      if (valorNorm.includes("sem motorista")) {
        if (
          textoNorm.includes("sem motorista") ||
          textoNorm.includes("sem condutor")
        ) {
          atendidos.push("Regime: sem motorista");
        } else if (
          textoNorm.includes("com motorista") ||
          textoNorm.includes("com condutor")
        ) {
          reprovados.push(
            "Regime incompatível (com motorista em vez de sem motorista)"
          );
        } else {
          ausentes.push("Regime ('sem motorista') ausente na descrição");
        }
      } else if (valorNorm.includes("com motorista")) {
        if (
          textoNorm.includes("com motorista") ||
          textoNorm.includes("com condutor")
        ) {
          atendidos.push("Regime: com motorista");
        } else if (
          textoNorm.includes("sem motorista") ||
          textoNorm.includes("sem condutor")
        ) {
          reprovados.push(
            "Regime incompatível (sem motorista em vez de com motorista)"
          );
        } else {
          ausentes.push("Regime ('com motorista') ausente na descrição");
        }
      } else if (textoNorm.includes(valorNorm)) {
        atendidos.push(`Regime: ${valorStr}`);
      } else {
        ausentes.push(`Regime ('${valorStr}') ausente na descrição`);
      }
      continue;
    }

    // 4. Material
    if (atribNorm.includes("material")) {
      if (valorNorm.includes("plast") || valorNorm.includes("polietileno")) {
        if (
          ["algodao", "encerado de algodao", "lona de algodao"].some((m) =>
            textoNorm.includes(m)
          ) &&
          !textoNorm.includes("plast")
        ) {
          reprovados.push("Material incompatível (algodão em vez de plástico)");
        } else if (
          ["plastico", "plastica", "polietileno", "pebd", "pead"].some((m) =>
            textoNorm.includes(m)
          )
        ) {
          atendidos.push("Material: plástico/polietileno");
        } else {
          ausentes.push("Material plástico não especificado na descrição");
        }
      } else if (textoNorm.includes(valorNorm)) {
        atendidos.push(`Material: ${valorStr}`);
      } else {
        ausentes.push(`Material (${valorStr}) ausente`);
      }
      continue;
    }

    // 5. Cor
    if (atribNorm.includes("cor")) {
      if (valorNorm === "preta" || valorNorm === "preto") {
        const temPreta = /\b(preta|preto|preta\/branca|dupla face)\b/.test(
          textoNorm
        );
        const outrasCores =
          textoNorm.match(
            /\b(azul|amarela|amarelo|transparente|cristal|verde|laranja|vermelha|vermelho)\b/g
          ) || [];

        if (temPreta) {
          if (
            [
              "preta e branca",
              "preto e branco",
              "preta/branca",
              "preto/branco",
              "dupla face",
            ].some((df) => textoNorm.includes(df))
          ) {
            ausentes.push(
              "Cor: menciona dupla face preta/branca (revisão manual)"
            );
          } else {
            atendidos.push("Cor: preta");
          }
        } else if (outrasCores.length > 0) {
          const unicas = Array.from(new Set(outrasCores)).sort();
          reprovados.push(
            `Cor incompatível (${unicas.join("/")} em vez de preta)`
          );
        } else {
          ausentes.push("Cor não informada na descrição");
        }
      } else if (textoNorm.includes(valorNorm)) {
        atendidos.push(`Cor: ${valorStr}`);
      } else {
        ausentes.push(`Cor (${valorStr}) não informada`);
      }
      continue;
    }

    // 6. Largura (m)
    if (atribNorm.includes("largura")) {
      const reqVal = parseFloatPtbr(valorStr);
      if (reqVal !== null) {
        if (dimensoesItem !== null) {
          const [largItem] = dimensoesItem;
          if (compararNum(largItem, operador, reqVal)) {
            atendidos.push(`Largura: ${largItem}m (${operador} ${reqVal}m)`);
          } else {
            reprovados.push(
              `Largura inferior ao mínimo (${largItem}m < ${reqVal}m)`
            );
          }
        } else {
          ausentes.push(`Largura (${operador} ${reqVal}m) não informada`);
        }
      }
      continue;
    }

    // 7. Comprimento (m)
    if (atribNorm.includes("comprimento")) {
      const reqVal = parseFloatPtbr(valorStr);
      if (reqVal !== null) {
        const unApiNorm = semAcentosMinusculo(unidadeMedidaApi || "");
        const mUnComp = unApiNorm.match(
          /(?:rolo|bobina)\s*(?:de\s*|com\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|mt|mts|metros?)\b/
        );
        const compUnApi = mUnComp ? parseFloatPtbr(mUnComp[1]) : null;

        if (compUnApi !== null && !compararNum(compUnApi, operador, reqVal)) {
          reprovados.push(
            `Comprimento da unidade ('${unidadeMedidaApi}') inferior ao mínimo (${compUnApi}m < ${reqVal}m)`
          );
        } else if (dimensoesItem !== null && dimensoesItem[1] > 0) {
          const [, compItem] = dimensoesItem;
          if (compararNum(compItem, operador, reqVal)) {
            atendidos.push(`Comprimento: ${compItem}m (${operador} ${reqVal}m)`);
          } else {
            reprovados.push(
              `Comprimento inferior ao mínimo (${compItem}m < ${reqVal}m)`
            );
          }
        } else if (compUnApi !== null && compararNum(compUnApi, operador, reqVal)) {
          atendidos.push(
            `Comprimento na unidade: ${compUnApi}m (${operador} ${reqVal}m)`
          );
        } else {
          ausentes.push(`Comprimento (${operador} ${reqVal}m) não informado`);
        }
      }
      continue;
    }

    // 8. Espessura (micras)
    if (atribNorm.includes("espessura") || atribNorm.includes("micra")) {
      const reqVal = parseFloatPtbr(valorStr);
      if (reqVal !== null) {
        if (espessuraItem !== null) {
          if (compararNum(espessuraItem, operador, reqVal)) {
            atendidos.push(
              `Espessura: ${espessuraItem} micras (${operador} ${reqVal} micras)`
            );
          } else {
            reprovados.push(
              `Espessura incompatível (${espessuraItem} micras vs ${operador} ${reqVal} micras)`
            );
          }
        } else {
          ausentes.push(
            `Espessura (${operador} ${reqVal} micras) não informada`
          );
        }
      }
      continue;
    }

    // 9. Peso (kg)
    if (atribNorm.includes("peso")) {
      const reqVal = parseFloatPtbr(valorStr);
      if (reqVal !== null) {
        if (pesoItem !== null) {
          if (compararNum(pesoItem, operador, reqVal)) {
            atendidos.push(`Peso: ${pesoItem} kg (${operador} ${reqVal} kg)`);
          } else {
            reprovados.push(
              `Peso inferior ao mínimo (${pesoItem} kg < ${reqVal} kg)`
            );
          }
        } else {
          ausentes.push(`Peso (${operador} ${reqVal} kg) não informado`);
        }
      }
      continue;
    }

    // 10. Motorização
    if (atribNorm.includes("motor")) {
      const reqVal = parseFloatPtbr(valorStr);
      if (reqVal !== null) {
        const mMot = textoNorm.match(
          /(?:motor(?:izacao)?(?:\s+minima|\s+de)?\s*|cilindrada\s*)(\d[.,]\d)\b|\b([12][.,][034568])\b/
        );
        if (mMot) {
          const valM = parseFloatPtbr(mMot[1] || mMot[2]);
          if (valM !== null) {
            if (compararNum(valM, operador, reqVal)) {
              atendidos.push(`Motorização: ${valM.toFixed(1)}`);
            } else {
              reprovados.push(
                `Motorização inferior (${valM.toFixed(1)} < ${reqVal.toFixed(1)})`
              );
            }
            continue;
          }
        }
        ausentes.push(
          `Motorização (${operador} ${reqVal.toFixed(1)}) não informada`
        );
      }
      continue;
    }

    // 10b. Tecnologia (Inverter vs Convencional)
    if (atribNorm.includes("tecnologia") || valorNorm === "inverter") {
      if (/\binverter\b/.test(textoNorm)) {
        atendidos.push("Tecnologia: inverter");
      } else if (/\b(convencional|on[\s/-]*off)\b/.test(textoNorm)) {
        reprovados.push(
          "Tecnologia incompatível (convencional/on-off em vez de inverter)"
        );
      } else {
        ausentes.push("Tecnologia (inverter) não informada na descrição");
      }
      continue;
    }

    // 10c. Potência / Capacidade em BTUs
    if (
      semAcentosMinusculo(unidadeReq).startsWith("btu") ||
      atribNorm.includes("btu")
    ) {
      const reqBtu = parseFloatPtbr(valorStr);
      if (reqBtu !== null) {
        const btuItem = extrairBtusItem(textoNorm);
        if (btuItem !== null) {
          if (compararNum(btuItem, operador, reqBtu)) {
            atendidos.push(`${atrib}: ${btuItem} BTUs (${operador} ${reqBtu} BTUs)`);
          } else {
            reprovados.push(
              `${atrib} incompatível (${btuItem} BTUs vs ${operador} ${reqBtu} BTUs)`
            );
          }
        } else {
          ausentes.push(
            `${atrib} (${operador} ${reqBtu} BTUs) não informado na descrição`
          );
        }
      }
      continue;
    }

    // 11. Requisito genérico
    const reqNum = parseFloatPtbr(valorStr);
    if (
      reqNum !== null &&
      [">=", "<=", "=", ">", "<"].includes(operador)
    ) {
      const unNorm = semAcentosMinusculo(unidadeReq);
      if (unNorm && unNorm !== "-") {
        const unRegexStr = escapeRegex(unNorm).replace(/s$/, "s?");
        const mGen = textoNorm.match(
          new RegExp(`0?(\\d+(?:[.,]\\d+)?)\\s*${unRegexStr}\\b`)
        );
        if (mGen) {
          const valEnc = parseFloatPtbr(mGen[1]);
          if (valEnc !== null) {
            if (compararNum(valEnc, operador, reqNum)) {
              atendidos.push(`${atrib}: ${valEnc} ${unidadeReq}`);
            } else {
              reprovados.push(
                `${atrib} incompatível (${valEnc} vs ${operador} ${reqNum} ${unidadeReq})`
              );
            }
            continue;
          }
        }
      }
      ausentes.push(
        `${atrib} (${operador} ${valorStr} ${unidadeReq}) não informado`
      );
    } else if (valorNorm && textoNorm.includes(valorNorm)) {
      atendidos.push(`${atrib}: ${valorStr}`);
    } else {
      ausentes.push(`${atrib} ('${valorStr}') ausente na descrição`);
    }
  }

  if (reprovados.length > 0) {
    return {
      aderencia: "C",
      motivo: `Não atende aos requisitos: ${reprovados.join("; ")}`,
      atendidos,
      ausentes,
      reprovados,
    };
  }

  if (ausentes.length > 0) {
    return {
      aderencia: "B",
      motivo: `Informação incompleta na descrição (revisão manual): ${ausentes.join("; ")}`,
      atendidos,
      ausentes,
      reprovados: [],
    };
  }

  return {
    aderencia: "A",
    motivo: `Atende todos os requisitos mínimos verificáveis (${atendidos.join(", ")})`,
    atendidos,
    ausentes: [],
    reprovados: [],
  };
}

/**
 * Triagem rápida em memória do resumo da Ata (título + descrição) antes de abrir os itens
 * na API do PNCP. Descarta apenas Atas 100% incompatíveis com o objeto pesquisado
 * (ex.: atas exclusivas de manutenção/limpeza/instalação quando se busca aquisição do bem,
 * ou atas de medicamentos/impressoras/softwares trazidas por termos genéricos),
 * preservando 100% das atas específicas ou guarda-chuva (materiais/equipamentos diversos).
 */
export function verificarCompatibilidadePreliminarAta(
  descricaoAta: string | null | undefined,
  tituloAta: string | null | undefined,
  requisitos: RequisitoMinimo[]
): { compativel: boolean; motivo: string } {
  const textoAta = semAcentosMinusculo(
    `${tituloAta || ""} ${descricaoAta || ""}`
  );
  if (!textoAta) {
    return { compativel: true, motivo: "" };
  }

  const reqObj = requisitos.find(
    (r) =>
      r.Obrigatorio !== false &&
      semAcentosMinusculo(r.Atributo).includes("objeto")
  );
  if (!reqObj) {
    return { compativel: true, motivo: "" };
  }

  const valObjNorm = semAcentosMinusculo(reqObj.Valor);

  // 1. Pesquisa de Aparelho de Ar-Condicionado / Climatização (Aquisição)
  if (
    (valObjNorm.includes("condicionado") ||
      valObjNorm.includes("condicionador")) &&
    !valObjNorm.includes("manutencao") &&
    !valObjNorm.includes("instalacao") &&
    !valObjNorm.includes("limpeza") &&
    !valObjNorm.includes("locacao")
  ) {
    const temPalavraChaveClimatizacao =
      /\b(ar[\s-]*condicionado|condicionador\w*|climatiz\w*|split|inverter|btus?|refrigera\w*|eletrodomest\w*|eletroeletron\w*|equipament\w*\s+permanent\w*|materiais?\s+permanent\w*|mobiliari\w*)\b/.test(
        textoAta
      );

    if (!temPalavraChaveClimatizacao) {
      return {
        compativel: false,
        motivo:
          "objeto da ata incompatível com o item pesquisado (sem relação com ar-condicionado/climatização)",
      };
    }

    const ehServicoExclusivoAr =
      /\b(manutencao preventiva|manutencao corretiva|servicos? de manutencao|manutencao de ar|manutencao em ar|manutencao predial|limpeza e higienizacao|servicos? de limpeza|higienizacao de|servicos? de instalacao|instalacao e desinstalacao|instalacao de ar|desinstalacao|recarga de gas|locacao de ar|locacao de aparelhos|ar condicionado automotivo|ar condicionado veicular)\b/.test(
        textoAta
      );
    const mencionaAquisicaoDeAparelhos =
      /\b(aquisicao de aparelhos|aquisicao de ar|aquisicao de condicionador|aquisicao de equipamentos|aquisicao de eletrodomesticos|fornecimento de aparelhos|fornecimento de ar condicionado|fornecimento de condicionador|eventual aquisicao|compra de aparelhos)\b/.test(
        textoAta
      );

    if (ehServicoExclusivoAr && !mencionaAquisicaoDeAparelhos) {
      return {
        compativel: false,
        motivo:
          "ata exclusiva de prestação de serviços (manutenção/instalação/limpeza/locação) — objeto pesquisado é aquisição do equipamento",
      };
    }

    const ehPecaOuAcessorioExclusivo =
      /\b(?:suportes?|pecas? de reposicao|partes e pecas|gas refrigerante|cortinas? de ar|filtros? de ar|controles? remotos?|tubulac\w*|dutos?)\b/.test(
        textoAta
      ) &&
      !/\b(?:aparelhos?|condicionadores?|equipamentos?|climatizadores?|split)\b/.test(
        textoAta
      );

    if (ehPecaOuAcessorioExclusivo) {
      return {
        compativel: false,
        motivo:
          "ata exclusiva de peças/acessórios/suportes — objeto pesquisado é o aparelho de ar-condicionado completo",
      };
    }

    const reqSplit = requisitos.some(
      (r) =>
        r.Obrigatorio !== false &&
        semAcentosMinusculo(r.Valor).includes("split")
    );
    if (reqSplit) {
      const ehOutroTipoExclusivo =
        /\b(?:ar[\s-]*condicionado\s+(?:tipo\s+)?janela|aparelho\s+de\s+janela|cortinas?\s+de\s+ar)\b/.test(
          textoAta
        ) && !textoAta.includes("split");
      if (ehOutroTipoExclusivo) {
        return {
          compativel: false,
          motivo:
            "ata restrita a modelos de janela/cortina de ar — objeto pesquisado requer modelo split",
        };
      }
    }
  }

  // 2. Pesquisa de Locação de Veículos
  if (valObjNorm.includes("locacao") && valObjNorm.includes("veicul")) {
    const temPalavraVeiculo =
      /\b(veicul\w*|automov\w*|automotor\w*|frota|carro\w*|hatch\w*|sedan|seda|picape\w*|pickup|caminhonete\w*|camionete\w*|suv|utilitari\w*|van|vans|furgao|onibus|micro-?onibus|caminhao|caminhoes|ambulancia\w*|motocicleta\w*|transporte)\b/.test(
        textoAta
      );
    if (!temPalavraVeiculo) {
      return {
        compativel: false,
        motivo:
          "objeto da ata incompatível com locação de veículos (outro tipo de locação ou serviço)",
      };
    }

    const ehServicoNaoLocacaoVeic =
      /\b(manutencao preventiva|manutencao corretiva|aquisicao de pecas|fornecimento de pecas|fornecimento de combustiv\w*|lavagem de veicul\w*|seguro veicular|rastreamento veicular|passagens? aereas?|passagens? rodoviarias?|aquisicao de veicul\w*|compra de veicul\w*)\b/.test(
        textoAta
      ) && !/\b(locacao|aluguel)\b/.test(textoAta);

    if (ehServicoNaoLocacaoVeic) {
      return {
        compativel: false,
        motivo:
          "ata de aquisição/manutenção/combustível/seguro (objeto pesquisado é locação de veículos)",
      };
    }
  }

  // 3. Pesquisa de Lona (Aquisição)
  if (valObjNorm.includes("lona") && !valObjNorm.includes("locacao")) {
    const ehExclusivoComunicacaoOuFreio =
      /\b(impressao digital|confeccao de banner\w*|comunicacao visual|lona de freio|lona para freio|pecas automotivas|locacao de tenda\w*|locacao de lona\w*)\b/.test(
        textoAta
      ) &&
      !/\b(lona plastica|lona preta|polietileno|material de construcao|materiais de construcao|ferragens|insumos agricolas)\b/.test(
        textoAta
      );

    if (ehExclusivoComunicacaoOuFreio) {
      return {
        compativel: false,
        motivo:
          "objeto da ata incompatível (comunicação visual/banner, freio automotivo ou locação)",
      };
    }
  }

  // 4. Pesquisa de Serviços de Motorista / Condutor
  if (valObjNorm.includes("motorista") || valObjNorm.includes("condutor")) {
    const regexSemMotorista =
      /\b(?:sem|dispensado|nao\s+inclui|nao\s+incluso|excluso)\s+(?:motoristas?|condutor(?:es)?)\b/i;
    if (
      regexSemMotorista.test(textoAta) &&
      !/\b(?:com\s+(?:motorista|condutor)|postos?\s+de\s+(?:motorista|condutor)|servicos?\s+de\s+(?:motorista|condutor))\b/i.test(
        textoAta
      )
    ) {
      return {
        compativel: false,
        motivo:
          "ata refere-se expressamente a contratação sem motorista/condutor (objeto pesquisado requer condutor)",
      };
    }
  }

  return { compativel: true, motivo: "" };
}
