# Especificação de Design: Quantitativo Oficial da ARP e Múltiplos Itens por ARP no Top 20

**Data**: 03/11/2026  
**Status**: Proposto (Aguardando Aprovação do Usuário)  
**Autor**: Sérgio Dantas Torres / Antigravity  

---

## 1. Contexto e Motivação (Intent & Why)

Durante a realização de pesquisas de preços para serviços contínuos (como locação de veículos tipo hatch), dois problemas foram identificados na tela e nos relatórios dos 20 menores preços unitários:

1. **Quantitativo da ARP exibindo "não informado":** Na tabela de seleção auditável, a coluna **Qtd. ARP** passou a apresentar *"não informado"* para a totalidade dos itens encontrados, mesmo quando o PNCP disponibiliza o quantitativo homologado na licitação e na ata (ex.: 10 veículos, 120 meses). Isso ocorria porque a rotina de padronização/normalização de preços, ao não identificar no texto livre uma indicação explícita de postos/veículos para divisão em lote, marcava `quantitativoStatus = "não informado"`, o que levava o pipeline a sobrescrever e apagar o quantitativo real obtido da API do PNCP (`quantidadeHomologada` / `item.quantidade`).
2. **Restrição artificial de apenas 1 item por ARP (Regra R6 legada):** É comum que uma mesma Ata de Registro de Preços contenha múltiplos itens ou lotes correspondentes ao mesmo objeto geral (ex.: Item 1 com fornecedor X a R$ 2.000/mês e Item 2 com fornecedor Y a R$ 2.100/mês, ou lotes com itens de mesmo preço para fornecedores diferentes). O sistema atualmente descarta sumariamente no pipeline e no algoritmo de seleção qualquer item excedente da mesma ata, impedindo que itens legítimos mais baratos componham a cesta dos 20 menores preços.
3. **Diferenciação clara de itens e lotes:** Ao permitir múltiplos itens de uma mesma ARP (mesmo com o mesmo preço unitário), a tabela consolidada e os relatórios (Excel, PDF e CSV) precisam evidenciar o **número do item e/ou lote** e o **respectivo fornecedor**, para que o auditor e o agente de contratação distingam com clareza cada registro homologado.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
1. **Preservação e Exibição do Quantitativo Oficial da ARP:**
   - Garantir que a coluna **Qtd. ARP** exiba sempre o quantitativo numérico homologado acompanhado da unidade de fornecimento oficial da ata no PNCP (ex.: `10 Veículos`, `120 Mês`, `24 UN X MÊS`).
   - Impedir que rotinas de normalização sobrescrevam o quantitativo oficial da ata quando este estiver presente na API.
2. **Admissão de Múltiplos Itens por ARP nos 20 Menores Preços:**
   - Remover o descarte forçado de itens de uma mesma ARP no pipeline (`pipeline.ts`) e no seletor Top 20 (`selection.ts`).
   - Permitir que todos os itens homologados válidos concorram individualmente por preço unitário (ou taxa de desconto).
   - Manter apenas a deduplicação de registros estritamente idênticos (mesmo CNPJ, mesma ARP e mesmo número de item).
3. **Identificação Inequívoca de Item/Lote e Fornecedor:**
   - Exibir na tabela do modal dos 20 menores preços, na tabela consolidada do painel de auditoria e em todas as exportações (Excel, PDF e CSV) a identificação destacada do **Item/Lote** (`numero_item_lote`) e do **Fornecedor** (`fornecedor`), permitindo diferenciar itens de uma mesma ata mesmo quando possuírem valor idêntico.
4. **Atualização da Terminologia e Metadados da Regra R6:**
   - Atualizar o badge e textos do modal de *"Máx. 1 item por ARP"* para *"Classificação Auditável por Item Homologado"*.
   - Atualizar a documentação e testes automatizados para refletir a nova regra de negócio.

### Não-Objetivos
- Não alterar as regras de aderência técnica (Classes A, B e C) nem as salvaguardas de filtros geográficos e orçamentários (Regras R1, R2 e R7).
- Não duplicar artificialmente linhas do mesmo item da mesma ARP.

### Anti-Objetivos
- Não perder a rastreabilidade do documento comprobatório nem do link oficial do PNCP de cada item.
- Não distorcer as métricas estatísticas (Média, Mediana, IQR, Desvio Padrão e CV%), que continuam calculadas sobre os itens efetivamente selecionados.

---

## 3. Abordagens Consideradas

### Abordagem 1: Seleção Direta por Item com Exibição de Item/Lote (Selecionada)
- Todos os itens homologados válidos entram no ranking de preços do Top 20.
- A tabela do modal, a tabela consolidada e os relatórios destacam o número do item/lote e fornecedor.
- O pipeline preserva 100% dos quantitativos oficiais do PNCP.
- **Vantagem:** Totalmente aderente à realidade das contratações públicas com atas de múltiplos lotes e fornecedores; resolve ambos os problemas sem atritos de usabilidade.
- **Decisão:** Escolhida pelo usuário.

### Abordagem 2: Seleção com Alternador Flexível (Toggle) no Modal (Descartada)
- Adicionaria um botão na interface para alternar entre "Permitir múltiplos itens" e "Limitar a 1 item por ARP".
- **Descartada:** Adiciona complexidade visual desnecessária à interface quando o comportamento desejado pelo usuário é que todos os itens válidos componham o universo de seleção.

---

## 4. Especificação Técnica Detalhada

### 4.1. Camada de Pipeline (`src/lib/domain/pipeline.ts`)
1. **Preservação do Quantitativo:**
   - Remover o bloco que define `quantitativoPrevistoArpFinal = "não informado"` quando `resNorm.quantitativoStatus === "não informado"`.
   - Garantir que `quantitativo_previsto_arp` receba o valor de `quantitativoArpStr`, gerado a partir de `melhorRes.quantidadeHomologada` ou `itemObj.quantidade` formatado com `unMedidaItem`.
2. **Fim do Descarte de Itens da Mesma Ata:**
   - Em `itensDedupAta`, remover a lógica que executava `itensA.slice(1)` e `itensB.slice(1)` enviando-os para a lista de descartados.
   - Todos os itens de `itensA` e `itensB` passam a ser adicionados em `itensCandidatosAprovados`.
   - Manter a salvaguarda de descarte apenas para duplicidade real de chave composta: `${cnpj}|${numero_arp}|${numero_item_lote}`.

### 4.2. Algoritmo de Seleção Top 20 (`src/lib/domain/selection.ts`)
1. No método `selecionarTop20Menores`:
   - Remover o agrupamento por `chaveAta = `${it.cnpj_orgao}|${it.numero_arp_licitacao}``.
   - Ordenar todos os itens candidatos aprovados diretamente pelo critério ativo (`valor_unitario` crescente para menor preço, ou decrescente para maior desconto).
   - Retornar os primeiros `limite` (20) itens.

### 4.3. Interface do Usuário (UI)

#### Modal de Seleção Top 20 (`src/components/Top20SelectionModal.tsx`)
1. **Cabeçalho:** Substituir o badge `<span ...>Máx. 1 item por ARP</span>` por `<span ...>Classificação por Item Homologado</span>`.
2. **Coluna de Item/Lote:** Adicionar uma coluna explícita ou identificador visual proeminente para `numero_item_lote` (ex.: `# Item / Lote`), posicionada de modo que o usuário veja imediatamente qual item daquela ARP está selecionado.
3. **Coluna Qtd. ARP:** Exibição com destaque da quantidade e unidade (ex.: `10 Veículos`), preservando o alinhamento numérico à direita.
4. **Filtro em Tempo Real:** Permitir que o campo de busca de texto também busque pelo número do item/lote.

#### Painel Consolidado de Relatório (`src/components/ConsolidatedReportPanel.tsx`)
1. Na tabela de itens selecionados e candidatos, incluir a coluna ou badge **Item / Lote** de forma visível ao lado do número da ARP e do fornecedor.

### 4.4. Camada de Exportação de Dados

1. **Excel (`src/lib/export/exporter-xlsx.ts`):**
   - Na aba `Planilha_Parecer` e `Memoria_de_Pesquisa`, garantir que as colunas `Nº do Item/Lote`, `Quantitativo previsto na ARP`, `Unidade` e `Fornecedor` estejam devidamente preenchidas, formatadas e alinhadas.
2. **PDF (`src/lib/export/exporter-pdf.ts`):**
   - Na tabela do relatório executivo em PDF, incluir a identificação do `Item/Lote` junto aos dados da ARP ou em coluna própria para distinção auditável imediata.
3. **CSV (`src/lib/export/exporter-csv.ts`):**
   - Certificar a presença das colunas `Nº do Item/Lote`, `Quantitativo previsto na ARP`, `Fornecedor` e `Valor Unitário`.

### 4.5. Testes Automatizados
1. Atualizar testes unitários em `tests/domain/pipeline-normalizacao.test.ts`, `tests/domain/pipeline-and-stats.test.ts` e afins para verificar:
   - Que múltiplos itens da mesma ARP são preservados e elegíveis para o Top 20.
   - Que o quantitativo oficial da ARP é mantido mesmo em itens normalizados.
2. Executar a suíte completa de testes (`npm test`) garantindo 100% de aprovação sem regressões.

---

## 5. Plano de Validação e Critérios de Aceite
- [ ] Pesquisa com os termos da imagem de locação de veículo exibe o quantitativo real na coluna "Qtd. ARP" (ex.: `10 Veículo`, `120 Mês`) em vez de "não informado".
- [ ] ARPs com múltiplos itens/lotes para o mesmo objeto exibem todos os itens classificados no Top 20.
- [ ] O número do item/lote e fornecedor estão claramente visíveis no modal, na tabela consolidada e nas exportações (Excel, PDF e CSV).
- [ ] Todos os testes automatizados executam e passam com sucesso.
