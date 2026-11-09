import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DADOS_ABERTOS_TIMEOUT_MS,
  ESCOPO_POR_REGIAO,
  ITEMS_PAGE_SIZE,
  MAX_PARALLEL_WORKERS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
} from "@/data/constants";
import { PNCPClient } from "@/lib/domain/pncp-client";
import { executarPipelinePesquisa } from "@/lib/domain/pipeline";
import { extrairRequisitosMinimos } from "@/lib/domain/parser-requisitos";

describe("Otimização de Performance PNCP sem Perda de Fidelidade (Abordagem A)", () => {
  it("1. Constantes calibradas: 20 workers paralelos, fast-timeout no Dados Abertos e resiliência no PNCP", () => {
    assert.equal(ITEMS_PAGE_SIZE, 100);
    assert.equal(MAX_PARALLEL_WORKERS, 20);
    assert.equal(REQUEST_TIMEOUT_MS, 7000);
    assert.equal(DADOS_ABERTOS_TIMEOUT_MS, 2800);
    assert.equal(MAX_RETRIES, 2);
    assert.equal(RETRY_BACKOFF_MS, 350);
  });

  it("2. Dados Abertos (atalho opcional) não deve fazer retries em 503, caindo imediatamente para a API Oficial do PNCP (que faz retry normal)", async () => {
    const originalFetch = globalThis.fetch;
    let callsDadosAbertos = 0;
    let callsPncpV1 = 0;

    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("dadosabertos.compras.gov.br")) {
          callsDadosAbertos++;
          return new Response("Gateway Timeout", { status: 504 });
        }
        if (url.includes("/compras/2026/88881/itens")) {
          callsPncpV1++;
          if (callsPncpV1 === 1) {
            // Simula instabilidade momentânea na 1ª tentativa do PNCP v1
            return new Response("Service Unavailable", { status: 503 });
          }
          return new Response(
            JSON.stringify([
              {
                numeroItem: 1,
                descricao: "Locação de veículo hatch 1.0",
                unidadeMedida: "Mês",
                quantidade: 10,
                temResultado: true,
                situacaoCompraItemNome: "Homologado",
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("Not Found", { status: 404 });
      };

      const client = new PNCPClient(false);
      const itens = await client.obterTodosItensCompra("33333333000133", "2026", "88881");

      assert.equal(
        callsDadosAbertos,
        1,
        "Dados Abertos deve tentar apenas 1 vez (0 retries) para não travar a fila quando instável"
      );
      assert.equal(
        callsPncpV1,
        2,
        "API Oficial do PNCP deve fazer retry em 503 e recuperar os itens na 2ª tentativa"
      );
      assert.equal(itens.length, 1);
      assert.equal(itens[0].descricao, "Locação de veículo hatch 1.0");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("3. Deduplicação In-Flight no Lote 3.1 do Dados Abertos: chamadas concorrentes para a mesma compra devem aguardar a mesma Promise em lote", async () => {
    const originalFetch = globalThis.fetch;
    let callsLote31 = 0;
    let callsPncpIndividual = 0;

    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("3.1_consultarResultadoItensContratacoes_PNCP_14133_Id")) {
          callsLote31++;
          // Simula latência de rede de 60ms no lote
          await new Promise((r) => setTimeout(r, 60));
          return new Response(
            JSON.stringify({
              resultado: [
                {
                  numeroItemPncp: 1,
                  valorUnitarioHomologado: 150,
                  quantidadeHomologada: 10,
                  nomeRazaoSocialFornecedor: "FORNECEDOR A",
                  niFornecedor: "11111111000191",
                },
                {
                  numeroItemPncp: 2,
                  valorUnitarioHomologado: 250,
                  quantidadeHomologada: 20,
                  nomeRazaoSocialFornecedor: "FORNECEDOR B",
                  niFornecedor: "22222222000192",
                },
                {
                  numeroItemPncp: 3,
                  valorUnitarioHomologado: 350,
                  quantidadeHomologada: 30,
                  nomeRazaoSocialFornecedor: "FORNECEDOR C",
                  niFornecedor: "33333333000193",
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.includes("/resultados")) {
          callsPncpIndividual++;
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      };

      const client = new PNCPClient(false);
      // Dispara 3 itens da mesma compra simultaneamente
      const [r1, r2, r3] = await Promise.all([
        client.obterResultadosItem("44444444000144", "2026", "77771", "1"),
        client.obterResultadosItem("44444444000144", "2026", "77771", "2"),
        client.obterResultadosItem("44444444000144", "2026", "77771", "3"),
      ]);

      assert.equal(callsLote31, 1, "Deve realizar exatamente 1 chamada em lote 3.1");
      assert.equal(
        callsPncpIndividual,
        0,
        "Nenhuma chamada individual ao PNCP deve ser disparada pois todos aguardaram o lote 3.1"
      );
      assert.equal(r1[0].valorUnitarioHomologado, 150);
      assert.equal(r2[0].valorUnitarioHomologado, 250);
      assert.equal(r3[0].valorUnitarioHomologado, 350);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("4. Detecção inteligente de última página em obterTodosItensCompra: ata com 65 itens na página 1 não deve fazer requisição extra para página 2", async () => {
    const originalFetch = globalThis.fetch;
    let paginasSolicitadas = 0;

    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("dadosabertos.compras.gov.br")) {
          return new Response(JSON.stringify({ resultado: [] }), { status: 200 });
        }
        if (url.includes("/compras/2026/66661/itens")) {
          paginasSolicitadas++;
          const u = new URL(url);
          const pag = Number(u.searchParams.get("pagina") || "1");
          if (pag === 1) {
            const arr = Array.from({ length: 65 }, (_, idx) => ({
              numeroItem: idx + 1,
              descricao: `Item ${idx + 1}`,
              unidadeMedida: "UN",
              quantidade: 1,
              temResultado: true,
              situacaoCompraItemNome: "Homologado",
            }));
            return new Response(JSON.stringify(arr), { status: 200 });
          }
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      };

      const client = new PNCPClient(false);
      const itens = await client.obterTodosItensCompra("55555555000155", "2026", "66661");

      assert.equal(itens.length, 65);
      assert.equal(
        paginasSolicitadas,
        1,
        "Como 65 não é múltiplo de 50 nem atingiu 100, a página 1 já é a última página"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("5. buscarTodasAtasPorTermos deve paralelizar a busca de múltiplos termos e a conferência de status sem bloquear a paginação", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const q = url.searchParams.get("q") || "";
        const pag = Number(url.searchParams.get("pagina") || "1");
        const status = url.searchParams.get("status") || "vigente";
        // Simula 50ms de latência por requisição de rede
        await new Promise((r) => setTimeout(r, 50));

        if (status !== "vigente") {
          return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
        }

        return new Response(
          JSON.stringify({
            total: 150,
            items: [
              {
                numero_controle_pncp: `11111111000111-1-00000${pag}/2026-000001-${q}`,
                item_url: `/atas/11111111000111/2026/${pag}/1`,
              },
            ],
          }),
          { status: 200 }
        );
      };

      const client = new PNCPClient(false);
      const t0 = performance.now();
      const res = await client.buscarTodasAtasPorTermos({
        termos: ["veiculo hatch", "automovel passeio", "locacao veiculo"],
        statusUi: "Vigentes",
        tipoData: "Vigência",
      });
      const elapsedMs = performance.now() - t0;

      assert.equal(res.atas.length, 6, "Deve retornar todas as 6 atas (2 páginas x 3 termos)");
      assert.equal(res.conferenciasStatus.length, 3, "Deve preservar as 3 conferências de status na ordem");
      assert.ok(
        elapsedMs < 250,
        `Execução paralela de 3 termos (12 chamadas de 50ms) deve concluir em < 250ms (levou ${Math.round(elapsedMs)}ms)`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("6. executarPipelinePesquisa: busca por Região não deve multiplicar por 9 UFs quando total < 9000 e deve paralelizar obterDetalheAta na Etapa 2", async () => {
    const originalFetch = globalThis.fetch;
    let searchPage1VigentesCalls = 0;
    let detalheAtaCalls = 0;

    try {
      globalThis.fetch = async (input: string | URL | Request) => {
        const urlStr = String(input);
        const url = new URL(urlStr);

        if (urlStr.includes("/api/search/")) {
          const status = url.searchParams.get("status") || "vigente";
          if (status !== "vigente") {
            return new Response(JSON.stringify({ total: 5, items: [] }), { status: 200 });
          }
          searchPage1VigentesCalls++;
          // Retorna 5 atas municipais de PE sem municipio_nome (forçando obterDetalheAta na Etapa 2)
          const items = Array.from({ length: 5 }, (_, i) => ({
            numero_controle_pncp: `1000000000010${i}-1-000001/2026-000001`,
            item_url: `/atas/1000000000010${i}/2026/1/1`,
            orgao_cnpj: `1000000000010${i}`,
            orgao_nome: `PREFEITURA MUNICIPAL TESTE ${i}`,
            unidade_nome: "Secretaria de Administração",
            esfera_id: "M",
            uf: "PE",
            municipio_nome: "", // Ausente na busca para acionar obterDetalheAta na Etapa 2
            codigo_ibge: "",
            description: "Registro de preços para locação de veículo hatch 1.0",
            title: `Ata 0${i}/2026`,
            data_inicio_vigencia: "2026-01-10T00:00:00",
            data_fim_vigencia: "2027-01-10T00:00:00",
            data_assinatura: "2026-01-09T00:00:00",
          }));
          return new Response(JSON.stringify({ total: 5, items }), { status: 200 });
        }

        if (urlStr.includes("/atas/1") && !urlStr.includes("/arquivos")) {
          detalheAtaCalls++;
          // 60ms por chamada de detalhe da ata
          await new Promise((r) => setTimeout(r, 60));
          return new Response(
            JSON.stringify({
              numeroAtaRegistroPreco: "001/2026",
              anoAta: 2026,
              orgaoEntidade: { esferaId: "M" },
              unidadeOrgao: {
                municipioNome: "Recife",
                codigoIbge: "2611606",
                ufSigla: "PE",
              },
            }),
            { status: 200 }
          );
        }

        if (urlStr.includes("2.1_consultarItensContratacoes_PNCP_14133_Id")) {
          return new Response(
            JSON.stringify({
              totalPaginas: 1,
              resultado: [
                {
                  numeroItemPncp: 1,
                  descricaoResumida: "Locação de veículo hatch 1.0",
                  unidadeMedida: "Mês",
                  quantidade: 12,
                  quantidadeResultado: 12,
                  valorUnitarioEstimado: 3000,
                  valorUnitarioResultado: 2800,
                  nomeFornecedor: "LOCADORA NORDESTE LTDA",
                  codFornecedor: "12345678000199",
                  situacaoCompraItemNome: "Homologado",
                },
              ],
            }),
            { status: 200 }
          );
        }

        if (urlStr.includes("/arquivos")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        return new Response(JSON.stringify([]), { status: 200 });
      };

      const reqs = extrairRequisitosMinimos("Locação de veículo hatch");
      const t0 = performance.now();
      const res = await executarPipelinePesquisa({
        descricaoObjeto: "Locação de veículo hatch",
        termosBusca: ["veiculo hatch"],
        requisitos: reqs,
        escopoOrgaos: ESCOPO_POR_REGIAO,
        regiaoSelecionada: "Nordeste",
        statusAta: "Vigentes",
        tipoDataPeriodo: "Vigência",
        usarCache: false,
      });
      const elapsedMs = performance.now() - t0;

      assert.equal(
        searchPage1VigentesCalls,
        1,
        "Quando total nacional (5) < 9000, deve fazer apenas 1 busca nacional em vez de 9 buscas por UF do Nordeste"
      );
      assert.equal(detalheAtaCalls, 5, "Deve buscar o detalhe das 5 atas sem município");
      assert.equal(res.itens_candidatos.length, 5, "Todas as 5 atas de Recife/PE devem ser aprovadas");
      assert.ok(
        elapsedMs < 240,
        `As 5 chamadas obterDetalheAta de 60ms na Etapa 2 devem rodar em paralelo (< 240ms total, levou ${Math.round(elapsedMs)}ms)`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
