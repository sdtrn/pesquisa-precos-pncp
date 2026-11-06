import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gerarRelatorioPdfA4,
  TABELA_CONSOLIDADA_COLUMN_STYLES,
} from "@/lib/export/exporter-pdf";
import type { ItemCandidato, ResultadoPesquisa } from "@/lib/domain/types";

function extrairTabelasMockPdf(pdfBytes: Uint8Array): any[][] {
  const txt = Buffer.from(pdfBytes).toString("utf-8");
  const lines = txt.split("\n");
  const parsedTables: any[][] = [];
  for (const line of lines) {
    if (line.startsWith("[[")) {
      try {
        parsedTables.push(JSON.parse(line));
      } catch {
        // ignora se não for JSON válido
      }
    }
  }
  return parsedTables;
}

function criarResultadoBaseMock(): ResultadoPesquisa {
  return {
    momento_consulta: "06/11/2026 19:30:00",
    escopo_orgaos: "Todos os Órgãos (Brasil)",
    status_ata: "Vigentes",
    periodo_aplicado_str: "Últimos 12 meses",
    termos_busca: ["notebook"],
    requisitos: [],
    total_atas_encontradas: 10,
    atas_validas_escopo_periodo: 5,
    total_itens_avaliados: 12,
    conferencias_status_api: [],
    itens_candidatos: [],
    descartados: [],
    resumo_descartes: {},
  };
}

describe("Exportador PDF — Coluna 'Adesão' e Fornecedor com CNPJ na Tabela Consolidada (A4 Retrato)", () => {
  it("Cabeçalho da Tabela 3 deve conter a coluna 'Adesão' na posição correta (índice 3)", async () => {
    const res = criarResultadoBaseMock();
    const itens: ItemCandidato[] = [
      {
        id: "item-1",
        descricao_objeto: "Notebook corporativo i7 16GB",
        valor_unitario: 5200,
        numero_arp_licitacao: "ARP nº 10/2026",
        possibilidade_adesao: "Sim",
        data_assinatura: "15/03/2026",
        orgao_gerenciador_uf: "Prefeitura de São Paulo/SP",
        fornecedor: "Tecnologia Brasil Ltda (12.345.678/0001-90)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/1",
      } as ItemCandidato,
    ];

    const pdfBytes = await gerarRelatorioPdfA4(res, itens, "Notebooks", "menor_preco");
    const tabelas = extrairTabelasMockPdf(pdfBytes);

    // Encontra o cabeçalho da Tabela Consolidada (contém 'Descrição do objeto')
    const cabecalhoTabela3 = tabelas.find(
      (t) => Array.isArray(t) && t[0]?.includes("Descrição do objeto")
    )?.[0];

    assert.ok(cabecalhoTabela3, "Cabeçalho da Tabela 3 deve existir");
    assert.deepEqual(cabecalhoTabela3, [
      "Descrição do objeto",
      "Valor Unitário (R$)",
      "Nº da ARP / Licitação",
      "Adesão",
      "Data de Assinatura",
      "Órgão Gerenciador/UF",
      "Fornecedor",
    ]);
  });

  it("Linhas de dados contêm 'Sim', 'Não' ou 'Não informado' e fornecedor com CNPJ", async () => {
    const res = criarResultadoBaseMock();
    const itens: ItemCandidato[] = [
      {
        id: "item-1",
        descricao_objeto: "Notebook i7 16GB",
        valor_unitario: 5000,
        numero_arp_licitacao: "ARP nº 10/2026",
        possibilidade_adesao: "Sim",
        data_assinatura: "10/01/2026",
        orgao_gerenciador_uf: "Tribunal de Justiça/PE",
        fornecedor: "Empresa Alpha Ltda (11.222.333/0001-44)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/1",
      } as ItemCandidato,
      {
        id: "item-2",
        descricao_objeto: "Notebook i5 8GB",
        valor_unitario: 3500,
        numero_arp_licitacao: "ARP nº 11/2026",
        possibilidade_adesao: "Não",
        data_assinatura: "15/01/2026",
        orgao_gerenciador_uf: "Prefeitura de Olinda/PE",
        fornecedor: "Comércio Beta Eireli (22.333.444/0001-55)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/2",
      } as ItemCandidato,
      {
        id: "item-3",
        descricao_objeto: "Notebook i3 4GB",
        valor_unitario: 2500,
        numero_arp_licitacao: "ARP nº 12/2026",
        possibilidade_adesao: undefined, // não informado
        data_assinatura: "20/01/2026",
        orgao_gerenciador_uf: "Câmara de Caruaru/PE",
        fornecedor: "Distribuidora Gamma S.A. (33.444.555/0001-66)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/3",
      } as ItemCandidato,
    ];

    const pdfBytes = await gerarRelatorioPdfA4(res, itens, "Notebooks", "menor_preco");
    const tabelas = extrairTabelasMockPdf(pdfBytes);

    const idxCabecalho = tabelas.findIndex(
      (t) => Array.isArray(t) && t[0]?.includes("Descrição do objeto")
    );
    assert.ok(idxCabecalho >= 0, "Cabeçalho da Tabela 3 deve ser encontrado");

    const corpoTabela3 = tabelas[idxCabecalho + 1];
    assert.ok(corpoTabela3, "Corpo da Tabela 3 deve existir");
    assert.equal(corpoTabela3.length, 4, "Deve conter 3 itens de dados + 1 linha de média");

    // Item 1: Adesão = "Sim" (índice 3) e Fornecedor com CNPJ (índice 6)
    assert.equal(corpoTabela3[0][3], "Sim");
    assert.equal(corpoTabela3[0][6], "Empresa Alpha Ltda (11.222.333/0001-44)");

    // Item 2: Adesão = "Não" (índice 3) e Fornecedor com CNPJ (índice 6)
    assert.equal(corpoTabela3[1][3], "Não");
    assert.equal(corpoTabela3[1][6], "Comércio Beta Eireli (22.333.444/0001-55)");

    // Item 3: Adesão = "Não informado" quando undefined (índice 3)
    assert.equal(corpoTabela3[2][3], "Não informado");
    assert.equal(corpoTabela3[2][6], "Distribuidora Gamma S.A. (33.444.555/0001-66)");
  });

  it("Linha da Média deve conter '—' na coluna de adesão e ter 7 colunas alinhadas", async () => {
    const res = criarResultadoBaseMock();
    const itens: ItemCandidato[] = [
      {
        id: "item-1",
        descricao_objeto: "Notebook Corporativo",
        valor_unitario: 4000,
        numero_arp_licitacao: "ARP 01/2026",
        possibilidade_adesao: "Sim",
        data_assinatura: "01/02/2026",
        orgao_gerenciador_uf: "Órgão A/PE",
        fornecedor: "Forn A (11.111.111/0001-11)",
        link_ata_pncp: "https://pncp.gov.br",
      } as ItemCandidato,
    ];

    const pdfBytes = await gerarRelatorioPdfA4(res, itens, "Notebooks", "menor_preco");
    const tabelas = extrairTabelasMockPdf(pdfBytes);

    const idxCabecalho = tabelas.findIndex(
      (t) => Array.isArray(t) && t[0]?.includes("Descrição do objeto")
    );
    const corpoTabela3 = tabelas[idxCabecalho + 1];
    const linhaMedia = corpoTabela3[corpoTabela3.length - 1];

    assert.equal(linhaMedia.length, 7, "Linha da média deve conter 7 colunas");
    assert.equal(linhaMedia[0], "MÉDIA DOS VALORES UNITÁRIOS");
    assert.ok(String(linhaMedia[1]).includes("4.000,00"));
    assert.equal(linhaMedia[2], "—", "Nº ARP deve ser traço na linha de média");
    assert.equal(linhaMedia[3], "—", "Adesão deve ser traço na linha de média");
    assert.equal(linhaMedia[4], "—", "Data de Assinatura deve ser traço na linha de média");
    assert.equal(linhaMedia[5], "—", "Órgão Gerenciador deve ser traço na linha de média");
    assert.equal(linhaMedia[6], "—", "Fornecedor deve ser traço na linha de média");
  });

  it("Larguras de coluna somam a largura útil da página A4 retrato (186mm) e possuem estilos adequados", () => {
    assert.ok(
      TABELA_CONSOLIDADA_COLUMN_STYLES,
      "TABELA_CONSOLIDADA_COLUMN_STYLES deve ser exportado"
    );

    const styles = TABELA_CONSOLIDADA_COLUMN_STYLES as Record<number, { cellWidth: number; halign?: string; fontStyle?: string }>;

    // 0: Descrição (cellWidth: 50)
    assert.equal(styles[0].cellWidth, 50);
    // 1: Valor Unitário (cellWidth: 23, halign: "right", fontStyle: "bold")
    assert.equal(styles[1].cellWidth, 23);
    assert.equal(styles[1].halign, "right");
    assert.equal(styles[1].fontStyle, "bold");
    // 2: ARP / Licitação (cellWidth: 26, halign: "center")
    assert.equal(styles[2].cellWidth, 26);
    assert.equal(styles[2].halign, "center");
    // 3: Adesão (cellWidth: 15, halign: "center")
    assert.equal(styles[3].cellWidth, 15);
    assert.equal(styles[3].halign, "center");
    // 4: Data de Assinatura (cellWidth: 18, halign: "center")
    assert.equal(styles[4].cellWidth, 18);
    assert.equal(styles[4].halign, "center");
    // 5: Órgão Gerenciador/UF (cellWidth: 27)
    assert.equal(styles[5].cellWidth, 27);
    // 6: Fornecedor (cellWidth: 27)
    assert.equal(styles[6].cellWidth, 27);

    // Soma das 7 colunas deve ser exatamente 186mm (210mm - 2 * 12mm margens)
    const larguraTotal = Object.values(styles).reduce((acc, col) => acc + col.cellWidth, 0);
    assert.equal(larguraTotal, 186, "A soma das colunas deve ser exatamente 186mm");
  });

  it("Critério maior_desconto deve manter cabeçalho adaptado com 'Taxa de Desconto (%)' e 'Adesão'", async () => {
    const res = criarResultadoBaseMock();
    const itens: ItemCandidato[] = [
      {
        id: "item-desc-1",
        descricao_objeto: "Manutenção de frota",
        valor_unitario: 12.5,
        numero_arp_licitacao: "ARP nº 99/2026",
        possibilidade_adesao: "Sim",
        data_assinatura: "15/02/2026",
        orgao_gerenciador_uf: "Secretaria de Saúde/PE",
        fornecedor: "Auto Mecânica Express (44.555.666/0001-77)",
        link_ata_pncp: "https://pncp.gov.br",
      } as ItemCandidato,
    ];

    const pdfBytes = await gerarRelatorioPdfA4(res, itens, "Frota", "maior_desconto");
    const tabelas = extrairTabelasMockPdf(pdfBytes);

    const cabecalhoTabela3 = tabelas.find(
      (t) => Array.isArray(t) && t[0]?.includes("Descrição do objeto")
    )?.[0];

    assert.ok(cabecalhoTabela3);
    assert.deepEqual(cabecalhoTabela3, [
      "Descrição do objeto",
      "Taxa de Desconto (%)",
      "Nº da ARP / Licitação",
      "Adesão",
      "Data de Assinatura",
      "Órgão Gerenciador/UF",
      "Fornecedor",
    ]);

    const idxCabecalho = tabelas.findIndex(
      (t) => Array.isArray(t) && t[0]?.includes("Descrição do objeto")
    );
    const corpoTabela3 = tabelas[idxCabecalho + 1];
    const linhaMedia = corpoTabela3[corpoTabela3.length - 1];
    assert.equal(linhaMedia[0], "MÉDIA DAS TAXAS DE DESCONTO");
    assert.equal(linhaMedia.length, 7);
    assert.equal(linhaMedia[3], "—");
  });
});
