export type TipoDocumentoIdentificacao = "CNPJ" | "CPF" | "NI";

export interface DocumentoIdentificacaoFormatado {
  numeroFormatado: string;
  tipo: TipoDocumentoIdentificacao;
  rotulo: string;
}

/**
 * Formata um número de identificação (CNPJ com 14 dígitos ou CPF com 11 dígitos),
 * preservando formatações já existentes e tratando graciosamente vazios e outros formatos.
 */
export function formatarDocumentoIdentificacao(
  ni?: string | null
): DocumentoIdentificacaoFormatado {
  if (!ni || typeof ni !== "string") {
    return {
      numeroFormatado: "",
      tipo: "NI",
      rotulo: "NI",
    };
  }

  const trimmed = ni.trim();
  if (!trimmed) {
    return {
      numeroFormatado: "",
      tipo: "NI",
      rotulo: "NI",
    };
  }

  const digitos = trimmed.replace(/\D/g, "");

  if (digitos.length === 14) {
    const formatado = digitos.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
    return {
      numeroFormatado: formatado,
      tipo: "CNPJ",
      rotulo: "CNPJ",
    };
  }

  if (digitos.length === 11) {
    const formatado = digitos.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      "$1.$2.$3-$4"
    );
    return {
      numeroFormatado: formatado,
      tipo: "CPF",
      rotulo: "CPF",
    };
  }

  return {
    numeroFormatado: trimmed,
    tipo: "NI",
    rotulo: "NI",
  };
}

/**
 * Combina a razão social/nome do fornecedor com o número de identificação formatado (CNPJ ou CPF),
 * evitando duplicações caso o nome já possua a identificação ou tratando casos com campos vazios.
 *
 * Exemplos:
 * - ("FORNECEDOR LTDA", "12039966000111") => "FORNECEDOR LTDA (CNPJ: 12.039.966/0001-11)"
 * - ("JOAO DA SILVA", "12345678901") => "JOAO DA SILVA (CPF: 123.456.789-01)"
 */
export function formatarFornecedorComDocumento(
  nome?: string | null,
  ni?: string | null
): string {
  const nomeLimpo = (nome || "").trim();
  const doc = formatarDocumentoIdentificacao(ni);

  if (!doc.numeroFormatado) {
    return nomeLimpo;
  }

  if (nomeLimpo && nomeLimpo.includes(doc.numeroFormatado)) {
    return nomeLimpo;
  }

  const docBloco = `(${doc.rotulo}: ${doc.numeroFormatado})`;

  if (!nomeLimpo) {
    return docBloco;
  }

  return `${nomeLimpo} ${docBloco}`;
}
