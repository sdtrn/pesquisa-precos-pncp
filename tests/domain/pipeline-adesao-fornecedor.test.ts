import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { executarPipelinePesquisa, normalizarPossibilidadeAdesao } from "@/lib/domain/pipeline";
import { PNCPClient } from "@/lib/domain/pncp-client";
import type { ParametrosPipeline } from "@/lib/domain/types";

describe("Task 2: Captura de Possibilidade de Adesão e Formatação do Fornecedor com CNPJ/CPF", () => {
  const originalBuscarAtas = PNCPClient.prototype.buscarTodasAtasPorTermos;
  const originalObterTodosItens = PNCPClient.prototype.obterTodosItensCompra;
  const originalObterItens = PNCPClient.prototype.obterItensCompra;
  const originalObterResultados = PNCPClient.prototype.obterResultadosItem;
  const originalObterDetalhe = PNCPClient.prototype.obterDetalheAta;
  const originalEnriquecer = PNCPClient.prototype.enriquecerItensComArquivosAta;

  beforeEach(() => {
    PNCPClient.prototype.enriquecerItensComArquivosAta = async function () {
      return;
    };
  });

  afterEach(() => {
    PNCPClient.prototype.buscarTodasAtasPorTermos = originalBuscarAtas;
    PNCPClient.prototype.obterTodosItensCompra = originalObterTodosItens;
    PNCPClient.prototype.obterItensCompra = originalObterItens;
    PNCPClient.prototype.obterResultadosItem = originalObterResultados;
    PNCPClient.prototype.obterDetalheAta = originalObterDetalhe;
    PNCPClient.prototype.enriquecerItensComArquivosAta = originalEnriquecer;
  });

  describe("normalizarPossibilidadeAdesao", () => {
    it("converte booleanos true/false para 'Sim' e 'Não'", () => {
      assert.strictEqual(normalizarPossibilidadeAdesao(true), "Sim");
      assert.strictEqual(normalizarPossibilidadeAdesao(false), "Não");
    });

    it("converte strings equivalentes a sim/true para 'Sim'", () => {
      assert.strictEqual(normalizarPossibilidadeAdesao("sim"), "Sim");
      assert.strictEqual(normalizarPossibilidadeAdesao("SIM"), "Sim");
      assert.strictEqual(normalizarPossibilidadeAdesao("true"), "Sim");
      assert.strictEqual(normalizarPossibilidadeAdesao("s"), "Sim");
      assert.strictEqual(normalizarPossibilidadeAdesao("1"), "Sim");
    });

    it("converte strings equivalentes a nao/false para 'Não'", () => {
      assert.strictEqual(normalizarPossibilidadeAdesao("não"), "Não");
      assert.strictEqual(normalizarPossibilidadeAdesao("nao"), "Não");
      assert.strictEqual(normalizarPossibilidadeAdesao("NAO"), "Não");
      assert.strictEqual(normalizarPossibilidadeAdesao("false"), "Não");
      assert.strictEqual(normalizarPossibilidadeAdesao("n"), "Não");
      assert.strictEqual(normalizarPossibilidadeAdesao("0"), "Não");
    });

    it("retorna 'Não informado' para valores nulos, indefinidos ou não mapeados", () => {
      assert.strictEqual(normalizarPossibilidadeAdesao(null), "Não informado");
      assert.strictEqual(normalizarPossibilidadeAdesao(undefined), "Não informado");
      assert.strictEqual(normalizarPossibilidadeAdesao(""), "Não informado");
      assert.strictEqual(normalizarPossibilidadeAdesao("outra coisa"), "Não informado");
    });
  });

  describe("Enriquecimento no Pipeline de Pesquisa", () => {
    it("extrai adesão, formata fornecedor com CNPJ/CPF e mapeia dados adicionais corretamente", async () => {
      // 1. Mock de atas brutas
      PNCPClient.prototype.buscarTodasAtasPorTermos = async function () {
        return {
          atas: [
            {
              // Ata 1: permite_adesao = true, CNPJ 14 dígitos
              orgao_cnpj: "11111111000111",
              ano: "2026",
              numero_sequencial_compra_ata: "1",
              numero_sequencial: "1",
              numero_controle_pncp: "11111111000111-1-000001/2026",
              orgao_nome: "PREFEITURA TESTE 1",
              esfera_id: "M",
              uf: "PE",
              situacao_nome: "Vigente",
              cancelado: false,
              permite_adesao: true,
              data_assinatura: "2026-01-10T10:00:00Z",
              data_inicio_vigencia: "2026-01-10T10:00:00Z",
              data_fim_vigencia: "2027-01-10T10:00:00Z",
              description: "Fornecimento de Notebooks Corporativos",
              title: "ARP 1/2026",
            },
            {
              // Ata 2: permite_adesao = false, CPF 11 dígitos
              orgao_cnpj: "22222222000122",
              ano: "2026",
              numero_sequencial_compra_ata: "2",
              numero_sequencial: "1",
              numero_controle_pncp: "22222222000122-1-000002/2026",
              orgao_nome: "PREFEITURA TESTE 2",
              esfera_id: "M",
              uf: "PE",
              situacao_nome: "Vigente",
              cancelado: false,
              permite_adesao: false,
              data_assinatura: "2026-02-15T10:00:00Z",
              data_inicio_vigencia: "2026-02-15T10:00:00Z",
              data_fim_vigencia: "2027-02-15T10:00:00Z",
              description: "Fornecimento de Notebooks Corporativos",
              title: "ARP 2/2026",
            },
            {
              // Ata 3: sem campo permite_adesao e sem detAta
              orgao_cnpj: "33333333000133",
              ano: "2026",
              numero_sequencial_compra_ata: "3",
              numero_sequencial: "1",
              numero_controle_pncp: "33333333000133-1-000003/2026",
              orgao_nome: "PREFEITURA TESTE 3",
              esfera_id: "M",
              uf: "PE",
              situacao_nome: "Vigente",
              cancelado: false,
              data_assinatura: "2026-03-20T10:00:00Z",
              data_inicio_vigencia: null,
              data_fim_vigencia: "2027-03-20T10:00:00Z",
              description: "Fornecimento de Notebooks Corporativos",
              title: "ARP 3/2026",
            },
            {
              // Ata 4: permite_adesao = false no resumo, mas detAta possui possibilidadeAdesao = "Sim" (detAta buscado por falta de dataAssinatura)
              orgao_cnpj: "44444444000144",
              ano: "2026",
              numero_sequencial_compra_ata: "4",
              numero_sequencial: "1",
              numero_controle_pncp: "44444444000144-1-000004/2026",
              orgao_nome: "PREFEITURA TESTE 4",
              esfera_id: "M",
              uf: "PE",
              situacao_nome: "Vigente",
              cancelado: false,
              permite_adesao: false,
              data_assinatura: null,
              data_inicio_vigencia: "2026-04-01T10:00:00Z",
              data_fim_vigencia: "2027-04-01T10:00:00Z",
              description: "Fornecimento de Notebooks Corporativos",
              title: "ARP 4/2026",
            },
          ],
          conferenciasStatus: [],
        };
      };

      // 2. Mock de itens da compra
      const mockItensCompra = async function (cnpj: string) {
        if (cnpj === "11111111000111") {
          return [
            {
              numeroItem: 1,
              descricao: "Notebook corporativo core i7 16gb ssd 512gb",
              informacaoComplementar: "Garantia on-site de 36 meses com suporte 24x7",
              unidadeMedida: "UNIDADE",
              quantidade: 50,
              temResultado: true,
              situacaoCompraItemNome: "Homologado",
            },
          ];
        }
        if (cnpj === "22222222000122") {
          return [
            {
              numeroItem: 1,
              descricao: "Notebook corporativo core i7 16gb ssd 512gb",
              informacaoComplementar: "",
              unidadeMedida: "UNIDADE",
              quantidade: 10,
              temResultado: true,
              situacaoCompraItemNome: "Homologado",
            },
          ];
        }
        if (cnpj === "33333333000133") {
          return [
            {
              numeroItem: 1,
              descricao: "Notebook corporativo core i7 16gb ssd 512gb",
              informacaoComplementar: null,
              unidadeMedida: "UNIDADE",
              quantidade: 5,
              temResultado: true,
              situacaoCompraItemNome: "Homologado",
            },
          ];
        }
        if (cnpj === "44444444000144") {
          return [
            {
              numeroItem: 1,
              descricao: "Notebook corporativo core i7 16gb ssd 512gb",
              informacaoComplementar: "Acompanha mouse óptico e mochila",
              unidadeMedida: "UNIDADE",
              quantidade: 20,
              temResultado: true,
              situacaoCompraItemNome: "Homologado",
            },
          ];
        }
        return [];
      };

      PNCPClient.prototype.obterTodosItensCompra = mockItensCompra;
      PNCPClient.prototype.obterItensCompra = mockItensCompra;

      // 3. Mock de resultados
      PNCPClient.prototype.obterResultadosItem = async function (cnpj: string) {
        if (cnpj === "11111111000111") {
          return [
            {
              valorUnitarioHomologado: 4500,
              quantidadeHomologada: 50,
              situacaoCompraItemResultadoNome: "Homologado",
              nomeRazaoSocialFornecedor: "DELL COMPUTADORES DO BRASIL LTDA",
              niFornecedor: "72381189000110", // 14 dígitos (CNPJ)
            },
          ];
        }
        if (cnpj === "22222222000122") {
          return [
            {
              valorUnitarioHomologado: 4800,
              quantidadeHomologada: 10,
              situacaoCompraItemResultadoNome: "Homologado",
              nomeRazaoSocialFornecedor: "JOAO SILVA CONSULTORIA",
              niFornecedor: "12345678901", // 11 dígitos (CPF)
            },
          ];
        }
        if (cnpj === "33333333000133") {
          return [
            {
              valorUnitarioHomologado: 5100,
              quantidadeHomologada: 5,
              situacaoCompraItemResultadoNome: "Homologado",
              nomeRazaoSocialFornecedor: "FORNECEDOR SEM DOC",
              niFornecedor: "",
            },
          ];
        }
        if (cnpj === "44444444000144") {
          return [
            {
              valorUnitarioHomologado: 4200,
              quantidadeHomologada: 20,
              situacaoCompraItemResultadoNome: "Homologado",
              nomeRazaoSocialFornecedor: "ACME INFORMATICA LTDA",
              niFornecedor: "00000000000191",
            },
          ];
        }
        return [];
      };

      // 4. Mock de detalhe da ata
      PNCPClient.prototype.obterDetalheAta = async function (cnpj: string) {
        if (cnpj === "44444444000144") {
          return {
            possibilidadeAdesao: "Sim",
            dataAssinatura: "2026-04-01T10:00:00Z",
            dataVigenciaInicio: "2026-04-01T10:00:00Z",
            dataVigenciaFim: "2027-04-01T10:00:00Z",
          };
        }
        return null;
      };

      const params: ParametrosPipeline = {
        descricaoObjeto: "notebook",
        termosBusca: ["notebook"],
        requisitos: [],
        escopoOrgaos: "Todos",
        statusAta: "Todas",
        tipoDataPeriodo: "todos",
        modoNormalizacao: "desativado",
        apenasMunicipiosBilionarios: false,
        usarCache: false,
      };

      const resultado = await executarPipelinePesquisa(params);

      assert.strictEqual(resultado.itens_candidatos.length, 4);

      // Verificação Item 1: permite_adesao: true -> "Sim", CNPJ formatado
      const item1 = resultado.itens_candidatos.find(
        (it) => it.cnpj_orgao === "11111111000111"
      );
      assert.ok(item1);
      assert.strictEqual(item1.possibilidade_adesao, "Sim");
      assert.strictEqual(
        item1.fornecedor,
        "DELL COMPUTADORES DO BRASIL LTDA (CNPJ: 72.381.189/0001-10)"
      );
      assert.strictEqual(item1.fornecedor_cnpj, "72.381.189/0001-10");
      assert.strictEqual(
        item1.especificacao_complementar,
        "Garantia on-site de 36 meses com suporte 24x7"
      );
      assert.strictEqual(item1.data_inicio_vigencia, "10/01/2026");

      // Verificação Item 2: permite_adesao: false -> "Não", CPF formatado
      const item2 = resultado.itens_candidatos.find(
        (it) => it.cnpj_orgao === "22222222000122"
      );
      assert.ok(item2);
      assert.strictEqual(item2.possibilidade_adesao, "Não");
      assert.strictEqual(
        item2.fornecedor,
        "JOAO SILVA CONSULTORIA (CPF: 123.456.789-01)"
      );
      assert.strictEqual(item2.fornecedor_cnpj, "123.456.789-01");
      assert.strictEqual(item2.especificacao_complementar, undefined);
      assert.strictEqual(item2.data_inicio_vigencia, "15/02/2026");

      // Verificação Item 3: sem adesão e sem detAta -> "Não informado", sem documento
      const item3 = resultado.itens_candidatos.find(
        (it) => it.cnpj_orgao === "33333333000133"
      );
      assert.ok(item3);
      assert.strictEqual(item3.possibilidade_adesao, "Não informado");
      assert.strictEqual(item3.fornecedor, "FORNECEDOR SEM DOC");
      assert.strictEqual(item3.fornecedor_cnpj, undefined);
      assert.strictEqual(item3.especificacao_complementar, undefined);
      assert.strictEqual(item3.data_inicio_vigencia, undefined);

      // Verificação Item 4: detAta sobrescreve com "Sim"
      const item4 = resultado.itens_candidatos.find(
        (it) => it.cnpj_orgao === "44444444000144"
      );
      assert.ok(item4);
      assert.strictEqual(item4.possibilidade_adesao, "Sim");
      assert.strictEqual(
        item4.fornecedor,
        "ACME INFORMATICA LTDA (CNPJ: 00.000.000/0001-91)"
      );
      assert.strictEqual(item4.fornecedor_cnpj, "00.000.000/0001-91");
      assert.strictEqual(
        item4.especificacao_complementar,
        "Acompanha mouse óptico e mochila"
      );
      assert.strictEqual(item4.data_inicio_vigencia, "01/04/2026");
    });
  });
});
