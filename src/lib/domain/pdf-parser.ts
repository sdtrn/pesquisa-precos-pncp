import zlib from "node:zlib";

/**
 * Converte sequências hexadecimais em caracteres legíveis.
 * Suporta codificação UTF-16BE / UCS-2 (comum em fontes Identity-H de OCR)
 * e ASCII/Latin1 padrão.
 */
function decodeHexToUnicode(hex: string): string {
  let str = "";
  if (hex.length >= 4 && hex.length % 4 === 0) {
    for (let i = 0; i < hex.length; i += 4) {
      str += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
    }
  } else {
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
  }
  return str;
}

/**
 * Extrai a camada de texto legível de um Buffer PDF sem dependências externas.
 * Inspeciona os streams de conteúdo texto (BT ... ET), descompacta via zlib
 * (FlateDecode) e decodifica strings literais (...) e hexadecimais <...>.
 */
export function extrairTextoPdf(pdfBuf: Buffer): string {
  if (!pdfBuf || pdfBuf.length < 10) return "";

  let fullText = "";
  let pos = 0;
  const streamMarker = Buffer.from("stream");
  const endStreamMarker = Buffer.from("endstream");

  while (pos < pdfBuf.length) {
    const s = pdfBuf.indexOf(streamMarker, pos);
    if (s === -1) break;

    let start = s + 6;
    while (start < pdfBuf.length && (pdfBuf[start] === 0x0d || pdfBuf[start] === 0x0a)) {
      start++;
    }

    const e = pdfBuf.indexOf(endStreamMarker, start);
    if (e === -1) break;

    let end = e;
    while (end > start && (pdfBuf[end - 1] === 0x0d || pdfBuf[end - 1] === 0x0a)) {
      end--;
    }

    // Filtro de tamanho para evitar streams gigantes de imagens rasterizadas (JPEG/PNG)
    const streamLen = end - start;
    if (streamLen > 0 && streamLen < 400000) {
      const slice = pdfBuf.subarray(start, end);
      let decomp: string | null = null;
      try {
        decomp = zlib.inflateSync(slice).toString("latin1");
      } catch {
        try {
          decomp = zlib.inflateRawSync(slice).toString("latin1");
        } catch {
          // Stream não compactado ou formato não suportado
          decomp = slice.toString("latin1");
        }
      }

      if (decomp && decomp.includes("BT") && decomp.includes("ET")) {
        let i = 0;
        const len = decomp.length;
        while (i < len) {
          // Strings hexadecimais <00520045...>
          if (decomp[i] === "<") {
            const j = decomp.indexOf(">", i);
            if (j !== -1) {
              const hex = decomp.slice(i + 1, j).replace(/\s+/g, "");
              if (/^[0-9A-Fa-f]+$/.test(hex)) {
                fullText += decodeHexToUnicode(hex);
              }
              i = j + 1;
              continue;
            }
          }

          // Strings literais (...) com suporte a parênteses aninhados e escape
          if (decomp[i] === "(") {
            let str = "";
            i++;
            let depth = 1;
            while (i < len && depth > 0) {
              if (decomp[i] === "\\" && i + 1 < len) {
                str += decomp[i + 1];
                i += 2;
                continue;
              }
              if (decomp[i] === "(") depth++;
              else if (decomp[i] === ")") depth--;
              if (depth > 0) str += decomp[i];
              i++;
            }
            fullText += str + " ";
            continue;
          }

          i++;
        }
        fullText += "\n";
      }
    }

    pos = e + 9;
  }

  return fullText;
}

export interface ResultadoTaxaDesconto {
  taxa: number;
  trecho: string;
  padrao: string;
}

/**
 * Analisa um texto (extraído de PDF ou campos descritivos) e localiza
 * taxas de desconto ou taxas de administração comumente utilizadas em
 * compras públicas brasileiras (ex: gerenciamento de frota/combustível,
 * vale-alimentação, agenciamento de viagens).
 */
export function parseTaxaDesconto(texto: string): ResultadoTaxaDesconto | null {
  if (!texto || typeof texto !== "string") return null;

  // Normaliza múltiplos espaços e quebras de linha para busca contígua
  const norm = texto.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");

  const patterns = [
    // 1. 'taxa de desconto de 7,49%' | 'taxa de desconto: 7,49%' | 'taxa de administração de -0,5%' | 'percentual de desconto de 5,2%'
    /(?:taxa\s+(?:de\s+)?desconto|taxa\s+de\s+administra[çc][ãa]o|percentual\s+de\s+desconto|desconto\s+(?:linear|global|m[ée]dio)?)\s*(?:contratad[oa]|homologad[oa]|ofertad[oa]|propost[oa]|obtido)?\s*(?:de|:)?\s*(-?[0-9]+(?:[,\.][0-9]+)?)\s*%/i,

    // 2. '7,49% (sete inteiros...) de desconto' | '7,49% de taxa de desconto'
    /(-?[0-9]+(?:[,\.][0-9]+)?)\s*%\s*(?:\([^)]+\)\s*)?(?:de\s+desconto|de\s+taxa\s+de\s+desconto|de\s+taxa\s+de\s+administra[çc][ãa]o)/i,

    // 3. 'desconto de 7,49%' | 'desconto: 7,49%'
    /\bdesconto\s*(?:de|:)?\s*(-?[0-9]+(?:[,\.][0-9]+)?)\s*%/i,

    // 4. 'taxa de -1,5%' | 'taxa: 2,5%'
    /\btaxa\s*(?:de|:)\s*(-?[0-9]+(?:[,\.][0-9]+)?)\s*%/i,
  ];

  for (const pat of patterns) {
    const match = norm.match(pat);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(",", "."));
      if (Number.isFinite(val)) {
        return {
          taxa: Math.round(val * 10000) / 10000,
          trecho: match[0],
          padrao: pat.source,
        };
      }
    }
  }

  return null;
}

/**
 * Extrai o texto do PDF e retorna a taxa de desconto encontrada,
 * ou null se o arquivo não contiver menção explícita a desconto.
 */
export function extrairTaxaDescontoDePdf(pdfBuf: Buffer): ResultadoTaxaDesconto | null {
  const texto = extrairTextoPdf(pdfBuf);
  if (!texto) return null;
  return parseTaxaDesconto(texto);
}
