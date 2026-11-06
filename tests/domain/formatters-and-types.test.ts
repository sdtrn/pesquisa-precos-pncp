import { describe, it, expect } from "vitest";
import type { ItemCandidato } from "@/lib/domain/types";
import {
  formatarDocumentoIdentificacao,
  formatarFornecedorComDocumento,
} from "@/lib/domain/formatters";
import {
  formatarDocumentoIdentificacao as formatarDocNormalizador,
  formatarFornecedorComDocumento as formatarFornecedorNormalizador,
} from "@/lib/domain/normalizador-precos";

describe("Utilitários de Formatação de Documento (CNPJ/CPF/NI)", () => {
  describe("formatarDocumentoIdentificacao", () => {
    it("formata CNPJ com 14 dígitos não formatados", () => {
      const res = formatarDocumentoIdentificacao("12039966000111");
      expect(res.tipo).toBe("CNPJ");
      expect(res.rotulo).toBe("CNPJ");
      expect(res.numeroFormatado).toBe("12.039.966/0001-11");
    });

    it("formata CPF com 11 dígitos não formatados", () => {
      const res = formatarDocumentoIdentificacao("12345678901");
      expect(res.tipo).toBe("CPF");
      expect(res.rotulo).toBe("CPF");
      expect(res.numeroFormatado).toBe("123.456.789-01");
    });

    it("preserva CNPJ já formatado com pontuação", () => {
      const res = formatarDocumentoIdentificacao("12.039.966/0001-11");
      expect(res.tipo).toBe("CNPJ");
      expect(res.rotulo).toBe("CNPJ");
      expect(res.numeroFormatado).toBe("12.039.966/0001-11");
    });

    it("preserva CPF já formatado com pontuação", () => {
      const res = formatarDocumentoIdentificacao("123.456.789-01");
      expect(res.tipo).toBe("CPF");
      expect(res.rotulo).toBe("CPF");
      expect(res.numeroFormatado).toBe("123.456.789-01");
    });

    it("lida graciosamente com valores vazios ou nulos sem quebrar", () => {
      expect(formatarDocumentoIdentificacao("")).toEqual({
        numeroFormatado: "",
        tipo: "NI",
        rotulo: "NI",
      });
      expect(formatarDocumentoIdentificacao("   ")).toEqual({
        numeroFormatado: "",
        tipo: "NI",
        rotulo: "NI",
      });
      expect(formatarDocumentoIdentificacao(null as any)).toEqual({
        numeroFormatado: "",
        tipo: "NI",
        rotulo: "NI",
      });
      expect(formatarDocumentoIdentificacao(undefined as any)).toEqual({
        numeroFormatado: "",
        tipo: "NI",
        rotulo: "NI",
      });
    });

    it("preserva identificadores não convencionais (nem 11 nem 14 dígitos)", () => {
      const res = formatarDocumentoIdentificacao("DOC-ESTR-998877");
      expect(res.tipo).toBe("NI");
      expect(res.rotulo).toBe("NI");
      expect(res.numeroFormatado).toBe("DOC-ESTR-998877");
    });
  });

  describe("formatarFornecedorComDocumento", () => {
    it("combina nome do fornecedor e CNPJ de 14 dígitos", () => {
      const resultado = formatarFornecedorComDocumento("FORNECEDOR LTDA", "12039966000111");
      expect(resultado).toBe("FORNECEDOR LTDA (CNPJ: 12.039.966/0001-11)");
    });

    it("combina nome do fornecedor e CPF de 11 dígitos", () => {
      const resultado = formatarFornecedorComDocumento("JOAO DA SILVA", "12345678901");
      expect(resultado).toBe("JOAO DA SILVA (CPF: 123.456.789-01)");
    });

    it("combina nome e documento já formatado", () => {
      const resultado = formatarFornecedorComDocumento("FORNECEDOR LTDA", "12.039.966/0001-11");
      expect(resultado).toBe("FORNECEDOR LTDA (CNPJ: 12.039.966/0001-11)");
    });

    it("evita duplicação se o nome já contiver o documento formatado", () => {
      const nomeComDoc = "FORNECEDOR LTDA (CNPJ: 12.039.966/0001-11)";
      const resultado = formatarFornecedorComDocumento(nomeComDoc, "12039966000111");
      expect(resultado).toBe("FORNECEDOR LTDA (CNPJ: 12.039.966/0001-11)");
    });

    it("retorna apenas o nome se documento for vazio ou não informado", () => {
      expect(formatarFornecedorComDocumento("FORNECEDOR LTDA", "")).toBe("FORNECEDOR LTDA");
      expect(formatarFornecedorComDocumento("FORNECEDOR LTDA", "   ")).toBe("FORNECEDOR LTDA");
      expect(formatarFornecedorComDocumento("FORNECEDOR LTDA", null as any)).toBe("FORNECEDOR LTDA");
    });

    it("retorna o documento formatado se o nome for vazio", () => {
      expect(formatarFornecedorComDocumento("", "12039966000111")).toBe("(CNPJ: 12.039.966/0001-11)");
    });

    it("retorna string vazia se ambos forem vazios", () => {
      expect(formatarFornecedorComDocumento("", "")).toBe("");
    });
  });

  describe("Re-exportação via normalizador-precos", () => {
    it("permite usar as funções exportadas por normalizador-precos", () => {
      expect(formatarDocNormalizador).toBe(formatarDocumentoIdentificacao);
      expect(formatarFornecedorNormalizador).toBe(formatarFornecedorComDocumento);
    });
  });

  describe("ItemCandidato - Novos Campos de Adesão e Detalhes", () => {
    it("permite atribuir os novos campos na interface ItemCandidato", () => {
      const item: Partial<ItemCandidato> = {
        descricao_objeto: "Item de teste",
        valor_unitario: 100,
        possibilidade_adesao: "Sim",
        especificacao_complementar: "Especificação detalhada",
        data_inicio_vigencia: "2026-01-01",
        fornecedor_cnpj: "12.039.966/0001-11",
      };

      expect(item.possibilidade_adesao).toBe("Sim");
      expect(item.especificacao_complementar).toBe("Especificação detalhada");
      expect(item.data_inicio_vigencia).toBe("2026-01-01");
      expect(item.fornecedor_cnpj).toBe("12.039.966/0001-11");
    });
  });
});
