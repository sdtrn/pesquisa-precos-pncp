import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import {
  extrairTextoPdf,
  parseTaxaDesconto,
  extrairTaxaDescontoDePdf,
} from "../../src/lib/domain/pdf-parser.ts";

test("PDF Parser: Extração de texto e parsing de taxas de desconto em compras públicas", async (t) => {
  await t.test("parseTaxaDesconto identifica com precisão o caso real da ARP 261/2026 do Recife", () => {
    const textoRecife =
      "1.2.4 O Registro de Preços, com validade de 12 (doze) meses, para contratação do serviço de gerenciamento de frota para fornecimento de combustível, com a taxa de desconto de 7,49% (sete inteiros e quarenta e nove centésimos por cento), em 01 (um) lote e 01 (um) item, visando atendimento de demanda da Secretaria de Saúde da Prefeitura da Cidade do Recife";

    const resultado = parseTaxaDesconto(textoRecife);
    assert.ok(resultado, "Deveria ter encontrado a taxa");
    assert.strictEqual(resultado.taxa, 7.49, "A taxa deve ser exatamente 7.49");
    assert.strictEqual(resultado.trecho, "taxa de desconto de 7,49%");
  });

  await t.test("parseTaxaDesconto identifica padrões usuais em editais e atas de combustível e frota", () => {
    // 1. Taxa com dois pontos e vírgula
    const res1 = parseTaxaDesconto("Proposta homologada com taxa de desconto: 5,25% sobre os preços da tabela.");
    assert.ok(res1);
    assert.strictEqual(res1.taxa, 5.25);

    // 2. Percentual com ponto flutuante
    const res2 = parseTaxaDesconto("O percentual de desconto de 12.5% incidirá sobre o preço médio da ANP.");
    assert.ok(res2);
    assert.strictEqual(res2.taxa, 12.5);

    // 3. Desconto linear
    const res3 = parseTaxaDesconto("Fica pactuado o desconto linear de 3,80% para gasolina, etanol e diesel.");
    assert.ok(res3);
    assert.strictEqual(res3.taxa, 3.8);

    // 4. Taxa negativa (ágio / taxa de administração negativa)
    const res4 = parseTaxaDesconto("Empresa vencedora ofertou taxa de administração de -0,50% para gestão do serviço.");
    assert.ok(res4);
    assert.strictEqual(res4.taxa, -0.5);

    // 5. Percentual invertido: "X% de desconto"
    const res5 = parseTaxaDesconto("Foi concedido o índice de 8,15% (oito inteiros e quinze centésimos) de desconto.");
    assert.ok(res5);
    assert.strictEqual(res5.taxa, 8.15);

    // 6. Texto sem taxa ou com valores monetários em R$
    const resSemTaxa = parseTaxaDesconto("Aquisição de veículos no valor total de R$ 500.000,00 homologados.");
    assert.strictEqual(resSemTaxa, null);
  });

  await t.test("extrairTextoPdf lida com buffers vazios ou inválidos sem estourar exceção", () => {
    assert.strictEqual(extrairTextoPdf(Buffer.alloc(0)), "");
    assert.strictEqual(extrairTextoPdf(Buffer.from("invalid-pdf-data")), "");
  });

  await t.test("extrairTaxaDescontoDePdf analisa o arquivo real da ARP 261/2026 se presente", () => {
    const pdfPath =
      "C:/Users/sergi/.gemini/antigravity/brain/4fcc2750-1419-47f5-b61e-d42250054150/.user_uploaded/media_1793632257372_3f4675e1.pdf";

    if (fs.existsSync(pdfPath)) {
      const buf = fs.readFileSync(pdfPath);
      const res = extrairTaxaDescontoDePdf(buf);
      assert.ok(res, "Deveria extrair a taxa diretamente do PDF oficial");
      assert.strictEqual(res.taxa, 7.49, "Taxa extraída do PDF oficial da Prefeitura do Recife deve ser 7.49%");
    }
  });
});
