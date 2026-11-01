# Especificação de Design: Critério de Maior Taxa de Desconto e Correção de Links Diretos de ARPs

**Data**: 01/11/2026  
**Status**: Proposto (Aguardando Aprovação)  
**Autor**: Sérgio Dantas Torres / Antigravity

---

## 1. Contexto e Motivação (Intent & Why)

Na administração pública brasileira (sob a égide da Lei nº 14.133/2021), as pesquisas de preços em Atas de Registro de Preços (ARPs) para **"Gerenciamento e controle de frota de veículos com fornecimento de combustível"** (gasolina, etanol, diesel) não utilizam o preço unitário em Reais (R$) como critério de classificação e vantajosidade, pois os preços dos combustíveis variam semanalmente nos postos credenciados. Em vez disso, a licitação e a ARP são julgadas e homologadas com base na **MAIOR TAXA DE DESCONTO (%)** sobre a tabela de preços de referência (como a tabela ANP ou preço de bomba).

Atualmente, o sistema assume estritamente o critério de **menor preço unitário**, classificando os menores valores em R$, calculando estatísticas e médias monetárias, e formatando todos os relatórios em `R$`.

Além disso, foi constatado que na visualização dos resultados os links de acesso direto às ARPs selecionadas não estão funcionando ou direcionam para páginas genéricas, impedindo a conferência imediata do documento comprobatório pelo auditor ou servidor público.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
1. **Critério de Julgamento Configurável**: Permitir alternar entre **"Menor Preço Unitário (R$)"** (padrão) e **"Maior Taxa de Desconto (%)"**.
2. **Classificação Invertida para Desconto**: Quando selecionado "Maior Taxa de Desconto", classificar itens e atas em ordem decrescente (ex.: 5,50% é melhor e fica à frente de 2,10%), selecionando no Top 20 as ARPs com os maiores percentuais de desconto.
3. **Exemplo Rápido Especializado**: Adicionar o preset rápido *"Gerenciamento de frota com fornecimento de combustível"*, pré-configurado com descrição técnica, termos de busca e o critério de "Maior Taxa de Desconto (%)".
4. **Adequação Completa das Visualizações e Exportações**:
   - Títulos de colunas: "Taxa de Desconto (%)" em vez de "Valor Unitário (R$)".
   - Formatação: `%` com 2 casas decimais (ex.: `4,50%`) em vez de `R$ 4,50`.
   - Médias e consolidados: "MÉDIA DAS TAXAS DE DESCONTO" com fórmula Excel `=AVERAGE(...)` adaptada para porcentagem.
   - Relatórios em PDF e CSV com a terminologia e cabeçalhos corretos.
5. **Correção e Confiabilidade dos Links das ARPs**:
   - Extrair com 100% de precisão as chaves da ata (`cnpj`, `ano`, `seqCompra`, `seqAta`) a partir do `numero_controle_pncp` oficial (`CNPJ-1-seqCompra/ano-seqAta`) e fallback estruturado de `item_url`.
   - Garantir que `link_ata_pncp` aponte invariavelmente para a página da ata no portal PNCP (`https://pncp.gov.br/app/atas/:cnpj/:ano/:seqCompra/:seqAta`).
   - Corrigir a rota de download e URLs de arquivos para que não gerem links quebrados ou inválidos (remoção de caminhos inexistentes como `/pncp-api/v1/`).

### Não-Objetivos
- Não alterar as regras de escopo institucional já homologadas (R1, R2, R7 - Municípios bilionários, Regiões, PE/Recife).
- Não descontinuar o critério padrão de menor preço monetário (R$) para compras tradicionais de bens e serviços.

### Anti-Objetivos
- Não criar regras "mágicas" ou ocultas que forcem desconto de forma imprevisível sem consentimento explícito do usuário.
- Não introduzir dependências externas adicionais nem bibliotecas pesadas.

---

## 3. Abordagens Consideradas

### Opção 1: Seletor Explícito no Formulário + Preset Inteligente (Selecionada)
- Adiciona um controle de alternância no formulário: `Menor Preço Unitário (R$)` vs `Maior Taxa de Desconto (%)`.
- O preset de combustível ativa automaticamente o critério de desconto, mas o usuário mantém autonomia para usar desconto em outros objetos (ex.: passagens aéreas, manutenção veicular com taxa de desconto na Tabela Audatex/Tabela Fipe) ou usar preço unitário em R$ caso compre litros diretos de combustível.
- Adaptação coerente em toda a esteira (pipeline, tipos, componentes, exportadores).

### Opção 2: Detecção Automática Heurística por Palavras-Chave (Descartada)
- O sistema tentaria adivinhar a partir de termos no texto. Descartada por ser frágil, imprevisível e impedir compras de combustível licitadas em R$/litro.

---

## 4. Especificação Técnica Detalhada

### 4.1. Camada de Domínio e Tipos (`src/lib/domain/types.ts`)
- Adicionar o tipo:
  ```typescript
  export type CriterioClassificacao = "menor_preco" | "maior_desconto";
  ```
- Atualizar `ParametrosPipeline`, `ResultadoPesquisa` e `RegistroHistoricoPesquisa` com a propriedade opcional (com default `"menor_preco"` para compatibilidade retroativa):
  ```typescript
  criterioClassificacao?: CriterioClassificacao;
  ```
- No `ItemCandidato` e `RegistroDescartado`, manter a chave numérica `valor_unitario` para armazenar o valor bruto (seja preço em R$ ou taxa de desconto em %), mas adicionar metadados se necessário para clareza da renderização.

### 4.2. Constantes e Preset (`src/data/constants.ts`)
- Adicionar constantes:
  ```typescript
  export const CRITERIO_MENOR_PRECO: CriterioClassificacao = "menor_preco";
  export const CRITERIO_MAIOR_DESCONTO: CriterioClassificacao = "maior_desconto";
  ```
- Atualizar interface `PresetExemplo` para incluir `criterioSugerido?: CriterioClassificacao;`.
- Adicionar o novo exemplo rápido:
  ```typescript
  {
    id: "gestao-frota-combustivel",
    titulo: "Gerenciamento de Frota com Combustível (Maior Desconto)",
    categoria: "Frota / Combustível",
    descricao: "Contratação de serviços de gerenciamento e controle de frota de veículos, por meio de sistema informatizado e integrado via web com cartão de pagamento, para fornecimento contínuo de combustíveis (gasolina, etanol, diesel) em rede credenciada de postos, com critério de julgamento pela MAIOR TAXA DE DESCONTO.",
    escopoSugerido: ESCOPO_TODOS,
    criterioSugerido: "maior_desconto",
  }
  ```

### 4.3. Pipeline de Triagem e Seleção (`src/lib/domain/pipeline.ts`)
- No agrupamento por Ata (Regra R6):
  - Se `criterioClassificacao === "maior_desconto"`: ordenar os itens da mesma ata por `b.valor_unitario - a.valor_unitario` (o item com maior desconto representará a ata).
  - Caso contrário: manter `a.valor_unitario - b.valor_unitario`.
- Em `selecionarTop20Menores` (ou generalizado `selecionarTop20Candidatos`):
  - Aceitar o parâmetro `criterioClassificacao`.
  - Se `"maior_desconto"`: ordenar a lista em ordem decrescente de desconto.
  - Se `"menor_preco"`: ordenar em ordem crescente de valor unitário.

### 4.4. Estatísticas e Outliers (`src/lib/domain/statistics.ts`)
- Em `calcularEstatisticasPrecos`:
  - Permitir valores `v >= 0` quando for taxa de desconto (taxas de 0% ou baixas são válidas em licitações de frota).
  - Ajustar o cálculo do limite inferior de outliers para não negativar nem cortar descontos reais válidos.

### 4.5. Correção dos Links das ARPs e Arquivos (`pncp-client.ts` e `pipeline.ts`)
- **Extração Robusta de Chaves**:
  - Implementar parser direto da string `numero_controle_pncp` com a expressão regular oficial:
    `/^(\d{14})-\d+-(\d+)\/(\d{4})-(\d+)$/`
    obtendo: `[cnpj, ano, seqCompra, seqAta]`.
  - Caso o controle não esteja preenchido, manter a leitura de `item_url` e dos campos individuais (`orgao_cnpj`, `ano`, `numero_sequencial_compra_ata`, `numero_sequencial`).
  - No `pipeline.ts`, garantir que mesmo no bloco `else`, `linkPncp` seja gerado chamando `PNCPClient.montarLinkAtaPncp(cnpj, anoC, seqCompra, seqAta)`.
  - Garantir que `link_ata_pncp` nunca seja a raiz `/app/atas`, mas sim a URL direta da ata: `https://pncp.gov.br/app/atas/${cnpj}/${ano}/${seqCompra}/${seqAta}`.
- **Normalização de Arquivos e Documentos**:
  - Corrigir a URL padrão de documento para a base oficial de API do PNCP (`https://pncp.gov.br/api/pncp/v1/...` e nunca `/pncp-api/v1/`).
  - No `descreverArquivosEvidenciaItem`, se não houver PDF direto retornado pela API secundária, o link documental direciona para a página oficial da ata com rótulo claro e transparente ("Ver Ata no PNCP").

### 4.6. Interface do Usuário (UI/UX)
- **Formulário de Busca (`SearchParametersForm.tsx`)**:
  - Adicionar o seletor em pílula/botões: "Menor Preço Unitário (R$)" vs "Maior Taxa de Desconto (%)".
  - Explicar sucintamente o critério em tooltip de ajuda.
  - Ao clicar em um preset com `criterioSugerido`, atualizar o estado correspondente.
- **Tabela Top 20 e Painel Consolidado (`ConsolidatedReportPanel.tsx`, `Top20SelectionModal.tsx`)**:
  - Cabeçalho da coluna: mudar de "Valor Unitário (R$)" para "Taxa de Desconto (%)" quando ativado o critério de desconto.
  - Formatação: função `formatValorOuTaxa(valor, criterio)` exibindo `5,50%` ou `R$ 5,50`.
  - Média final destacada: "MÉDIA DAS TAXAS DE DESCONTO" exibindo `X,XX%`.
  - Coluna de link na tabela: botão claro "Acessar Ata no PNCP" com ícone de link externo e link direto funcionando.

### 4.7. Exportadores (`exporter-xlsx.ts`, `exporter-pdf.ts`, `exporter-csv.ts`)
- **Excel (`.xlsx`)**:
  - Coluna no parecer: "Taxa de Desconto (%)" com estilo numérico percentual `0.00%`.
  - Linha de média: "MÉDIA DAS TAXAS DE DESCONTO" com fórmula `=AVERAGE(...)`.
  - Quadro de evidências com link direto ativo da ata no PNCP.
- **PDF (`.pdf`)**:
  - Tabela com coluna "Taxa de Desconto (%)" e formatação `X,XX%`.
  - Resumo estatístico destacando: Média das Taxas de Desconto, Mediana e Desvio-Padrão.
- **CSV (`.csv`)**:
  - Cabeçalho ajustado para `Taxa de Desconto (%)`.

---

## 5. Plano de Verificação

1. **Testes Unitários**:
   - Teste de ordenação de itens e atas por maior desconto (verificando que 6% > 4% > 2%).
   - Teste de extração de chaves da ata via `numero_controle_pncp` e geração de URL direta do PNCP.
   - Teste de cálculo de estatísticas para taxas de desconto (incluindo valores próximos a zero).
   - Testes de exportação XLSX, PDF e CSV no modo desconto.
2. **Teste de Integração de UI**:
   - Selecionar o novo preset "Gerenciamento de frota com combustível" e validar o preenchimento automático do formulário com "Maior Taxa de Desconto (%)".
   - Executar busca e verificar renderização das porcentagens e ordenação.
   - Testar clique no link da ARP e verificar que abre a página específica da ata no PNCP (`https://pncp.gov.br/app/atas/...`).
