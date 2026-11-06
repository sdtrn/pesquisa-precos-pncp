import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ItemCandidato } from "@/lib/domain/types";
import { formatarDocumentoIdentificacao } from "@/lib/domain/formatters";

/**
 * Função pura que gerencia a expansão e retração concomitante de itens no acordeão do Top 20.
 * Garante que abrir um item NUNCA fecha os demais já abertos (comportamento concomitante / multi-open).
 */
export function alternarChaveExpandida(
  expandedKeys: Set<string>,
  chaveItem: string
): Set<string> {
  const next = new Set(expandedKeys);
  if (next.has(chaveItem)) {
    next.delete(chaveItem);
  } else {
    next.add(chaveItem);
  }
  return next;
}

/**
 * Utilitário de formatação de badges visuais para a coluna de Adesão (carona PNCP).
 */
export function formatarBadgeAdesao(
  possibilidade?: "Sim" | "Não" | "Não informado" | string | null
): {
  label: string;
  variant: "sim" | "nao" | "nao_informado";
  tooltip: string;
} {
  const normalizado = (possibilidade || "").trim().toLowerCase();
  if (normalizado === "sim" || normalizado === "true" || normalizado === "s") {
    return {
      label: "Sim",
      variant: "sim",
      tooltip: "Possibilidade de Adesão (carona PNCP): Sim (admissível nos termos do art. 86 da Lei nº 14.133/2021)",
    };
  }
  if (normalizado === "não" || normalizado === "nao" || normalizado === "false" || normalizado === "n") {
    return {
      label: "Não",
      variant: "nao",
      tooltip: "Possibilidade de Adesão (carona PNCP): Não (restrita a gerenciador e participantes)",
    };
  }
  return {
    label: "Não inf.",
    variant: "nao_informado",
    tooltip: "Possibilidade de Adesão (carona PNCP): Não informado nos metadados da compra",
  };
}

/**
 * Função de extração e estruturação de todos os detalhes requeridos no cartão expandido do item.
 */
export function extrairDetalhesItemExpandido(item: ItemCandidato) {
  const badgeAdesao = formatarBadgeAdesao(item.possibilidade_adesao);
  const cnpjOrgaoFormatado = formatarDocumentoIdentificacao(item.cnpj_orgao).numeroFormatado || item.cnpj_orgao;
  const cnpjFornecedorFormatado = item.fornecedor_cnpj
    ? formatarDocumentoIdentificacao(item.fornecedor_cnpj).numeroFormatado
    : null;

  return {
    objeto: {
      descricao: item.descricao_objeto,
      especificacaoComplementar: item.especificacao_complementar || null,
      aderencia: item.aderencia,
      detalheAderencia: item.detalhe_aderencia,
    },
    orgao: {
      nome: item.orgao_nome || item.orgao_gerenciador_uf,
      cnpj: cnpjOrgaoFormatado,
      esfera: item.esfera,
      municipio: item.municipio_nome,
      uf: item.uf,
      codigoIbge: item.codigo_ibge,
      tipo: item.tipo_orgao,
    },
    ata: {
      numeroArp: item.numero_arp_licitacao,
      numeroItemLote: item.numero_item_lote,
      situacao: item.situacao_ata || "Vigente",
      dataAssinatura: item.data_assinatura || "Não informada",
      dataInicioVigencia: item.data_inicio_vigencia || "—",
      dataFimVigencia: item.data_fim_vigencia || "—",
      vigenciaCompleta: item.vigencia_ata || "—",
      linkPncp: item.link_ata_pncp,
      linkDownload: item.link_download_arp || null,
      arquivosAditivos: item.arquivos_arp || [],
    },
    fornecedor: {
      nome: item.fornecedor,
      cnpjCpf: cnpjFornecedorFormatado,
    },
    quantitativosEPreco: {
      quantidadePrevista: item.quantitativo_previsto_arp,
      unidadeFornecimento: item.unidade_fornecimento,
      unidadeReferencia: item.unidade_referencia || null,
      unidadeOriginal: item.unidade_original || null,
      valorUnitario: item.valor_unitario,
      valorOriginal: item.valor_original ?? null,
    },
    normalizacao: {
      normalizado: !!item.normalizado,
      formula: item.formula_normalizacao || null,
      fundamentoLegal: "Art. 23 da Lei nº 14.133/2021",
    },
    adesao: {
      status: item.possibilidade_adesao || "Não informado",
      badge: badgeAdesao,
      explicacao:
        item.possibilidade_adesao === "Sim"
          ? "Órgão gerenciador autoriza expressamente a adesão tardia por órgãos não participantes (carona), observados os limites do art. 86 da Lei nº 14.133/2021."
          : item.possibilidade_adesao === "Não"
          ? "Ata restrita aos órgãos participantes e gerenciador, não admitindo adesão por caronas."
          : "Informação de adesão não declarada explicitamente nos metadados da compra no PNCP.",
    },
  };
}

describe("Task 5: Modal dos 20 Menores Itens — Expansão Concomitante por Seta e Coluna de Adesão", () => {
  const itemMockBase: ItemCandidato = {
    descricao_objeto: "LOCAÇÃO DE VEÍCULOS TIPO SEDAN MÉDIO MOTOR 1.4 TURBO",
    especificacao_complementar: "Veículo 4 portas, ar condicionado digital, câmbio automático, seguro total incluso.",
    valor_unitario: 3500.0,
    valor_original: 42000.0,
    unidade_original: "ANO",
    formula_normalizacao: "R$ 42.000,00 / 12 meses = R$ 3.500,00/mês/veículo",
    unidade_referencia: "R$/mês/veículo",
    normalizado: true,
    quantitativo_previsto_arp: "10",
    quantidade_numerica_str: "10",
    unidade_fornecimento: "MÊS",
    numero_arp_licitacao: "ARP 12/2026",
    id_ata_r6: "00394460000141-2026-12",
    orgao_gerenciador_uf: "MINISTÉRIO DA GESTÃO E INOVAÇÃO/DF",
    orgao_nome: "MINISTÉRIO DA GESTÃO E DA INOVAÇÃO EM SERVIÇOS PÚBLICOS",
    uf: "DF",
    municipio_nome: "Brasília",
    codigo_ibge: "5300108",
    fornecedor: "LOCALIZA RENT A CAR S.A. (CNPJ: 16.670.085/0001-55)",
    fornecedor_cnpj: "16670085000155",
    numero_item_lote: "1",
    data_assinatura: "15/01/2026",
    vigencia_ata: "15/01/2026 a 15/01/2027",
    data_inicio_vigencia: "15/01/2026",
    data_fim_vigencia: "15/01/2027",
    situacao_ata: "Vigente",
    possibilidade_adesao: "Sim",
    esfera: "Federal",
    tipo_orgao: "Administração Direta Federal",
    cnpj_orgao: "00394460000141",
    ano_compra: "2026",
    seq_compra: "100",
    seq_ata: "1",
    link_ata_pncp: "https://pncp.gov.br/app/atas/00394460000141/2026/1",
    link_download_arp: "https://pncp.gov.br/arp-download/123",
    arquivos_arp: [
      {
        titulo: "Termo Aditivo nº 01/2026",
        tipo: "Termo Aditivo",
        url: "https://pncp.gov.br/aditivos/1",
        ehTermoAditivo: true,
      },
    ],
    aderencia: "A",
    detalhe_aderencia: "100% dos requisitos técnicos atendidos",
    orgao_atende_validade: "Sim",
    data_hora_consulta: "06/11/2026 19:00:00",
    escopo_escolhido: "Todos os órgãos do Brasil",
    status_escolhido: "Vigentes",
    periodo_aplicado: "Últimos 12 meses",
    termos_usados: "locacao de veiculos",
  };

  describe("1. Lógica de Expansão Concomitante (Acordeão Multi-Item)", () => {
    it("deve permitir expandir múltiplos itens simultaneamente sem fechar os já abertos", () => {
      let expanded = new Set<string>();
      const chave1 = "chave-item-1";
      const chave2 = "chave-item-2";
      const chave3 = "chave-item-3";

      // Abre item 1
      expanded = alternarChaveExpandida(expanded, chave1);
      assert.strictEqual(expanded.size, 1);
      assert.strictEqual(expanded.has(chave1), true);

      // Abre item 2: item 1 DEVE continuar aberto!
      expanded = alternarChaveExpandida(expanded, chave2);
      assert.strictEqual(expanded.size, 2);
      assert.strictEqual(expanded.has(chave1), true);
      assert.strictEqual(expanded.has(chave2), true);

      // Abre item 3: itens 1 e 2 DEVEM continuar abertos!
      expanded = alternarChaveExpandida(expanded, chave3);
      assert.strictEqual(expanded.size, 3);
      assert.strictEqual(expanded.has(chave1), true);
      assert.strictEqual(expanded.has(chave2), true);
      assert.strictEqual(expanded.has(chave3), true);

      // Fecha item 2: apenas item 2 é removido; itens 1 e 3 continuam abertos!
      expanded = alternarChaveExpandida(expanded, chave2);
      assert.strictEqual(expanded.size, 2);
      assert.strictEqual(expanded.has(chave1), true);
      assert.strictEqual(expanded.has(chave2), false);
      assert.strictEqual(expanded.has(chave3), true);

      // Fecha item 1
      expanded = alternarChaveExpandida(expanded, chave1);
      assert.strictEqual(expanded.size, 1);
      assert.strictEqual(expanded.has(chave3), true);

      // Fecha item 3
      expanded = alternarChaveExpandida(expanded, chave3);
      assert.strictEqual(expanded.size, 0);
    });

    it("não deve mutar o Set original, preservando imutabilidade para hooks do React", () => {
      const original = new Set(["item-a"]);
      const proximo = alternarChaveExpandida(original, "item-b");
      assert.notStrictEqual(original, proximo);
      assert.strictEqual(original.size, 1);
      assert.strictEqual(proximo.size, 2);
    });
  });

  describe("2. Formatação do Rótulo e Status de Adesão (Carona)", () => {
    it("formata corretamente 'Sim' para adesão autorizada", () => {
      const badge = formatarBadgeAdesao("Sim");
      assert.strictEqual(badge.label, "Sim");
      assert.strictEqual(badge.variant, "sim");
      assert.match(badge.tooltip, /Sim/);
    });

    it("formata corretamente 'Não' para adesão não autorizada", () => {
      const badge = formatarBadgeAdesao("Não");
      assert.strictEqual(badge.label, "Não");
      assert.strictEqual(badge.variant, "nao");
      assert.match(badge.tooltip, /Não/);
    });

    it("formata 'Não inf.' para itens sem preenchimento ou 'Não informado'", () => {
      const badgeInformado = formatarBadgeAdesao("Não informado");
      assert.strictEqual(badgeInformado.label, "Não inf.");
      assert.strictEqual(badgeInformado.variant, "nao_informado");

      const badgeUndefined = formatarBadgeAdesao(undefined);
      assert.strictEqual(badgeUndefined.label, "Não inf.");
      assert.strictEqual(badgeUndefined.variant, "nao_informado");

      const badgeNull = formatarBadgeAdesao(null);
      assert.strictEqual(badgeNull.label, "Não inf.");
      assert.strictEqual(badgeNull.variant, "nao_informado");
    });
  });

  describe("3. Extração e Completude dos Blocos de Detalhes do Item", () => {
    it("deve extrair todos os 7 blocos estruturados de informações do item", () => {
      const detalhes = extrairDetalhesItemExpandido(itemMockBase);

      // Bloco 1: Objeto & Especificação
      assert.strictEqual(detalhes.objeto.descricao, itemMockBase.descricao_objeto);
      assert.strictEqual(detalhes.objeto.especificacaoComplementar, itemMockBase.especificacao_complementar);
      assert.strictEqual(detalhes.objeto.aderencia, "A");

      // Bloco 2: Órgão Gerenciador
      assert.strictEqual(detalhes.orgao.nome, itemMockBase.orgao_nome);
      assert.strictEqual(detalhes.orgao.cnpj, "00.394.460/0001-41");
      assert.strictEqual(detalhes.orgao.esfera, "Federal");
      assert.strictEqual(detalhes.orgao.municipio, "Brasília");
      assert.strictEqual(detalhes.orgao.uf, "DF");
      assert.strictEqual(detalhes.orgao.codigoIbge, "5300108");

      // Bloco 3: Licitação & Ata
      assert.strictEqual(detalhes.ata.numeroArp, "ARP 12/2026");
      assert.strictEqual(detalhes.ata.numeroItemLote, "1");
      assert.strictEqual(detalhes.ata.situacao, "Vigente");
      assert.strictEqual(detalhes.ata.dataAssinatura, "15/01/2026");
      assert.strictEqual(detalhes.ata.dataInicioVigencia, "15/01/2026");
      assert.strictEqual(detalhes.ata.dataFimVigencia, "15/01/2027");
      assert.strictEqual(detalhes.ata.linkPncp, itemMockBase.link_ata_pncp);
      assert.strictEqual(detalhes.ata.arquivosAditivos.length, 1);

      // Bloco 4: Fornecedor com CNPJ
      assert.match(detalhes.fornecedor.nome, /LOCALIZA RENT A CAR/);
      assert.strictEqual(detalhes.fornecedor.cnpjCpf, "16.670.085/0001-55");

      // Bloco 5: Quantitativos e Precificação
      assert.strictEqual(detalhes.quantitativosEPreco.quantidadePrevista, "10");
      assert.strictEqual(detalhes.quantitativosEPreco.unidadeFornecimento, "MÊS");
      assert.strictEqual(detalhes.quantitativosEPreco.unidadeReferencia, "R$/mês/veículo");
      assert.strictEqual(detalhes.quantitativosEPreco.valorUnitario, 3500.0);
      assert.strictEqual(detalhes.quantitativosEPreco.valorOriginal, 42000.0);

      // Bloco 6: Normalização (Lei 14.133/2021)
      assert.strictEqual(detalhes.normalizacao.normalizado, true);
      assert.strictEqual(detalhes.normalizacao.formula, itemMockBase.formula_normalizacao);
      assert.match(detalhes.normalizacao.fundamentoLegal, /14\.133\/2021/);

      // Bloco 7: Adesão Oficial
      assert.strictEqual(detalhes.adesao.status, "Sim");
      assert.strictEqual(detalhes.adesao.badge.label, "Sim");
      assert.match(detalhes.adesao.explicacao, /carona/i);
    });

    it("lida graciosamente com itens sem normalização ou campos opcionais", () => {
      const itemSemNorm: ItemCandidato = {
        ...itemMockBase,
        especificacao_complementar: undefined,
        normalizado: false,
        formula_normalizacao: undefined,
        unidade_referencia: undefined,
        valor_original: undefined,
        possibilidade_adesao: "Não",
        arquivos_arp: undefined,
      };

      const detalhes = extrairDetalhesItemExpandido(itemSemNorm);
      assert.strictEqual(detalhes.objeto.especificacaoComplementar, null);
      assert.strictEqual(detalhes.normalizacao.normalizado, false);
      assert.strictEqual(detalhes.normalizacao.formula, null);
      assert.strictEqual(detalhes.adesao.status, "Não");
      assert.strictEqual(detalhes.adesao.badge.label, "Não");
      assert.strictEqual(detalhes.ata.arquivosAditivos.length, 0);
    });
  });

  describe("4. Validação Estrutural e Visual do Componente Top20SelectionModal", () => {
    it("deve conter a implementação de expansão concomitante e coluna de adesão no Top20SelectionModal.tsx", () => {
      const filePath = path.resolve(
        process.cwd(),
        "src",
        "components",
        "Top20SelectionModal.tsx"
      );
      assert.strictEqual(fs.existsSync(filePath), true, "Top20SelectionModal.tsx deve existir");

      const fileContent = fs.readFileSync(filePath, "utf-8");

      // 1. Deve importar os ícones ChevronDown e ChevronUp de lucide-react
      assert.match(fileContent, /ChevronDown/, "Deve importar ChevronDown de lucide-react");
      assert.match(fileContent, /ChevronUp/, "Deve importar ChevronUp de lucide-react");

      // 2. Deve declarar o estado expandedKeys com Set<string>
      assert.match(
        fileContent,
        /const\s*\[expandedKeys,\s*setExpandedKeys\]\s*=\s*useState<Set<string>>\(new\s+Set\(\)\)/,
        "Deve declarar o estado expandedKeys como Set<string>"
      );

      // 3. Deve possuir a função toggleExpandItem permitindo expansão concomitante
      assert.match(
        fileContent,
        /toggleExpandItem/,
        "Deve declarar função toggleExpandItem"
      );

      // 4. Deve conter a coluna estreita da seta e a coluna 'Adesão' no cabeçalho thead
      assert.match(
        fileContent,
        /<th[^>]*>\s*Adesão\s*<\/th>/i,
        "Cabeçalho da tabela deve conter coluna 'Adesão'"
      );

      // 5. Na linha principal, deve conter botão de Chevron e badge de Adesão
      assert.match(
        fileContent,
        /item\.possibilidade_adesao/,
        "Linha principal da tabela deve exibir badge de Adesão"
      );
      assert.match(
        fileContent,
        /Não inf\./,
        "Badge de Adesão deve exibir 'Não inf.' quando não informado"
      );

      // 6. Deve renderizar sublinha condicional com colSpan={14}
      assert.match(
        fileContent,
        /colSpan=\{14\}/,
        "Sublinha do item expandido deve ter colSpan={14}"
      );

      // 7. Cartão expandido deve conter todos os blocos de dados
      assert.match(
        fileContent,
        /item\.descricao_objeto/,
        "Cartão expandido deve exibir objeto completo"
      );
      assert.match(
        fileContent,
        /item\.especificacao_complementar/,
        "Cartão expandido deve exibir especificação complementar"
      );
      assert.match(
        fileContent,
        /item\.cnpj_orgao/,
        "Cartão expandido deve exibir CNPJ do órgão"
      );
      assert.match(
        fileContent,
        /item\.fornecedor/,
        "Cartão expandido deve exibir fornecedor"
      );
      assert.match(
        fileContent,
        /item\.formula_normalizacao/,
        "Cartão expandido deve exibir memória de cálculo de normalização"
      );
    });
  });
});
