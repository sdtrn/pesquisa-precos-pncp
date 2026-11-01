import test from "node:test";
import assert from "node:assert";
import { PNCPClient } from "../../src/lib/domain/pncp-client.ts";

test("Task 2: Extração blindada de chaves PNCP e montagem de links diretos de ARP", () => {
  // Caso 1: Objeto PNCP contendo apenas numero_controle_pncp (item_url ausente)
  const itemControle = {
    numero_controle_pncp: "45132495000140-1-000872/2024-000001",
    item_url: "",
  };
  const chaves1 = PNCPClient.extrairChavesItemUrl(itemControle);
  assert.ok(chaves1, "Deve extrair chaves a partir de numero_controle_pncp");
  assert.deepStrictEqual(chaves1, ["45132495000140", "2024", "872", "1"]);

  const link1 = PNCPClient.montarLinkAtaPncp(chaves1[0], chaves1[1], chaves1[2], chaves1[3]);
  assert.strictEqual(
    link1,
    "https://pncp.gov.br/app/atas/45132495000140/2024/872/1"
  );

  // Caso 2: Objeto PNCP contendo item_url padrão do PNCP
  const itemUrl = {
    item_url: "/atas/10331797000163/2026/51/2",
  };
  const chaves2 = PNCPClient.extrairChavesItemUrl(itemUrl);
  assert.ok(chaves2, "Deve extrair chaves a partir de item_url");
  assert.deepStrictEqual(chaves2, ["10331797000163", "2026", "51", "2"]);

  const link2 = PNCPClient.montarLinkAtaPncp(chaves2[0], chaves2[1], chaves2[2], chaves2[3]);
  assert.strictEqual(
    link2,
    "https://pncp.gov.br/app/atas/10331797000163/2026/51/2"
  );

  // Caso 3: Objeto sem item_url mas com campos isolados
  const itemCampos = {
    orgao_cnpj: "88000914000101",
    ano: "2025",
    numero_sequencial_compra_ata: "209",
    numero_sequencial: "1",
  };
  const chaves3 = PNCPClient.extrairChavesItemUrl(itemCampos);
  assert.deepStrictEqual(chaves3, ["88000914000101", "2025", "209", "1"]);

  // Caso 4: Objeto vazio retorna null sem quebrar
  const chavesVazio = PNCPClient.extrairChavesItemUrl({});
  assert.strictEqual(chavesVazio, null);
});
