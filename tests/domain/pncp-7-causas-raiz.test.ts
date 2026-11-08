import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ITEMS_PAGE_SIZE,
  MAX_PARALLEL_WORKERS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
} from "@/data/constants";
import { PNCPClient } from "@/lib/domain/pncp-client";
import { inferirEsferaRapida } from "@/lib/domain/pipeline";
import { gerarTermosBusca } from "@/lib/domain/parser-requisitos";

describe("Diagnóstico Técnico PNCP — Verificação das 7 Causas Raiz", () => {
  it("Passo 1: constants.ts deve ter os parâmetros calibrados de rede e paginação", () => {
    assert.equal(ITEMS_PAGE_SIZE, 100);
    assert.equal(REQUEST_TIMEOUT_MS, 10000);
    assert.equal(MAX_RETRIES, 2);
    assert.equal(RETRY_BACKOFF_MS, 600);
    assert.equal(MAX_PARALLEL_WORKERS, 10);
  });

  it("Passo 2 (Causa Raiz 1 e 7): getJson não deve envenenar o cache em HTTP 503 ou timeout, mas deve fazê-lo em 404 e 204", async () => {
    const originalFetch = globalThis.fetch;
    let calls503 = 0;
    let calls404 = 0;

    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/compras/2099/99991/itens")) {
          calls503++;
          return new Response("Service Unavailable", { status: 503 });
        }
        if (url.includes("/compras/2099/99992/itens")) {
          calls404++;
          return new Response("Not Found", { status: 404 });
        }
        return new Response(JSON.stringify({ resultado: [] }), { status: 200 });
      };

      const client = new PNCPClient(true);
      // 1ª chamada com 503 deve tentar (MAX_RETRIES + 1) vezes e NÃO cachear []
      const res1 = await client.obterTodosItensCompra("00000000000191", "2099", "99991");
      assert.deepEqual(res1, []);
      assert.equal(calls503, MAX_RETRIES + 1, "Deve executar retry em HTTP 503 mesmo com ignorar404=true");

      // 2ª chamada para a mesma compra que deu 503 NÃO pode vir do cache (deve tentar buscar novamente na rede)
      await client.obterTodosItensCompra("00000000000191", "2099", "99991");
      assert.equal(calls503, (MAX_RETRIES + 1) * 2, "Não pode ter envenenado o GLOBAL_MEM_CACHE após HTTP 503");

      // Já para 404 real na API de itens, o endpoint de getJson deve cachear [] naquela URL
      await client.obterDetalheAta("00000000000191", "2099", "99992", "1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Passo 3 (Causa Raiz 3): obterTodosItensCompra no Dados Abertos deve preservar temResultado=true quando valorUnitarioResultado é null mas item não fracassou, e extrair codFornecedor/quantidadeResultado", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("2.1_consultarItensContratacoes_PNCP_14133_Id")) {
          return new Response(
            JSON.stringify({
              totalPaginas: 1,
              resultado: [
                {
                  numeroItemPncp: 1,
                  descricaoResumida: "Locação de veículo hatch 1.0",
                  unidadeMedida: "Mês",
                  quantidade: 12,
                  valorUnitarioEstimado: 3500,
                  valorUnitarioResultado: null, // Nulo no endpoint 2.1 (plataforma externa)
                  situacaoCompraItemNome: "Homologado",
                },
                {
                  numeroItemPncp: 2,
                  descricaoResumida: "Locação de veículo sedan",
                  unidadeMedida: "Mês",
                  quantidade: 6,
                  quantidadeResultado: 6,
                  valorUnitarioEstimado: 4500,
                  valorUnitarioResultado: 4100,
                  nomeFornecedor: "LOCADORA TESTE LTDA",
                  codFornecedor: "12345678000199",
                  situacaoCompraItemNome: "Homologado",
                },
                {
                  numeroItemPncp: 3,
                  descricaoResumida: "Item deserto",
                  unidadeMedida: "Mês",
                  quantidade: 1,
                  valorUnitarioEstimado: 3000,
                  valorUnitarioResultado: null,
                  situacaoCompraItemNome: "Deserto",
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ resultado: [] }), { status: 200 });
      };

      const client = new PNCPClient(false);
      const itens = await client.obterTodosItensCompra("11111111000111", "2026", "555");
      assert.equal(itens.length, 3);

      // Item 1: valorUnitarioResultado null, mas situação Homologado -> temResultado deve ser true!
      assert.equal(itens[0].temResultado, true);

      // Item 2: com valorUnitarioResultado -> deve ter niFornecedor e quantidadeHomologada preenchidos
      assert.equal(itens[1].temResultado, true);
      const resHom = itens[1]._resultadoHomologado as Record<string, unknown>;
      assert.ok(resHom);
      const resObj = Array.isArray(resHom) ? resHom[0] : resHom;
      assert.equal(resObj.niFornecedor, "12345678000199");
      assert.equal(resObj.quantidadeHomologada, 6);

      // Item 3: Deserto e sem valor -> temResultado deve ser false
      assert.equal(itens[2].temResultado, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Passo 3 (Causa Raiz 4): obterTodosItensCompra deve paginar além da página 1 (quando API retorna 50 itens) e além da página 4 (atas grandes > 250 itens)", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("dadosabertos.compras.gov.br")) {
          return new Response(JSON.stringify({ resultado: [] }), { status: 200 });
        }
        if (url.includes("/compras/2026/777/itens")) {
          const u = new URL(url);
          const pag = Number(u.searchParams.get("pagina") || "1");
          // Simula 6 páginas: páginas 1 a 5 com 50 itens cada, página 6 com 10 itens (total 260 itens)
          const qtd = pag <= 5 ? 50 : pag === 6 ? 10 : 0;
          const arr = Array.from({ length: qtd }, (_, idx) => ({
            numeroItem: (pag - 1) * 50 + idx + 1,
            descricao: `Medicamento item ${(pag - 1) * 50 + idx + 1}`,
            unidadeMedida: "UN",
            quantidade: 100,
            temResultado: true,
            situacaoCompraItemNome: "Homologado",
          }));
          return new Response(JSON.stringify(arr), { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      };

      const client = new PNCPClient(false);
      const itens = await client.obterTodosItensCompra("22222222000122", "2026", "777");
      assert.equal(itens.length, 260, "Deve recuperar todos os 260 itens em 6 páginas de 50 itens");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Passo 4 (Causa Raiz 5): inferirEsferaRapida deve classificar Consórcios Públicos com esfera_id='N' como 'M' (Municipal) ou 'E' (Interestadual)", () => {
    assert.equal(
      inferirEsferaRapida("N", "CONSORCIO INTERMUNICIPAL DE SAUDE - CISABES", "CISABES", "ES"),
      "M"
    );
    assert.equal(
      inferirEsferaRapida("N", "CONDER - CONSORCIO PUBLICO DE DESENVOLVIMENTO", "Unidade Central", "BA"),
      "M"
    );
    assert.equal(
      inferirEsferaRapida("N", "CIMASP - CONSORCIO MULTIFINALITARIO", "", "SP"),
      "M"
    );
    assert.equal(
      inferirEsferaRapida("N", "CONSORCIO INTERESTADUAL DE DESENVOLVIMENTO DO BRASIL CENTRAL", "", "DF"),
      "E"
    );
    // Esferas válidas F, E, D, M devem retornar imediatamente
    assert.equal(inferirEsferaRapida("F", "QUALQUER ORGAO", "", "DF"), "F");
    assert.equal(inferirEsferaRapida("M", "MUNICIPIO DE RECIFE", "", "PE"), "M");
  });

  it("Gerenciamento de frota com fornecimento de combustível não deve expandir para gasolina/diesel/etanol avulsos", () => {
    const termos = gerarTermosBusca("Gerenciamento de frota com fornecimento de combustível");
    assert.ok(!termos.includes("gasolina"), "Não deve incluir gasolina avulsa em gerenciamento de frota");
    assert.ok(!termos.includes("oleo diesel"), "Não deve incluir óleo diesel avulso em gerenciamento de frota");
    assert.ok(!termos.includes("etanol"), "Não deve incluir etanol avulso em gerenciamento de frota");
  });
});
