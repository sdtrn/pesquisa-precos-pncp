# Especificação de Design: Expansão de Itens no Top 20, Possibilidade de Adesão, Padronização Condicional e CNPJ do Fornecedor

**Data**: 06/11/2026  
**Status**: Proposto (Aprovado pelo Builder Check, Aguardando Homologação do Usuário)  
**Autor**: Sérgio Dantas Torres / Antigravity  

---

## 1. Contexto e Motivação (Intent & Why)

Na utilização do sistema de Pesquisa de Preços em Atas de Registro de Preços (PNCP), quatro melhorias essenciais de usabilidade, transparência e conformidade documental foram demandadas:

1. **Visualização Completa de Colunas na Tela dos 20 Menores Itens (Expansão Individual por Seta Concomitante):**
   - Atualmente, a tabela do modal de seleção dos 20 menores preços (`Top20SelectionModal`) exibe colunas resumidas para caber na tela. O usuário necessita inspecionar todos os dados e metadados detalhados de cada item antes de decidir se o selecionará ou não.
   - Deve ser disponibilizada uma seta ao lado de cada item que permita expandir a linha (mostrando todos os atributos completos do item em formato de cartão/acordeão estruturado) e, uma vez expandida, a seta aponta para cima (`ChevronUp`), permitindo retrair o item. O usuário pode abrir e fechar múltiplos itens de forma concomitante e independente para comparação livre.

2. **Condicionalidade da Coluna "Memória de Cálculo (Lei 14.133/2021)" nos Relatórios:**
   - Na maioria das pesquisas de preços, os itens pesquisados não demandam normalização/padronização de unidade de medida (ex.: itens já cotados por mês, por unidade, etc.). Nesses casos, a coluna "Memória de Cálculo (Lei 14.133/2021)" e as colunas correlatas apareciam no relatório Excel preenchidas apenas com traço ("-") ou vazias para todos os itens, poluindo o relatório oficial.
   - O usuário definiu a regra estrita: **somente** incluir as colunas de padronização nos relatórios quando **pelo menos um** dos itens efetivamente selecionados tiver passado por padronização. Se nenhum item selecionado demandou padronização, essas colunas não devem existir no relatório.
   - Além disso, para o relatório em Excel quando houver item padronizado selecionado, devem ser mantidas as colunas: `Valor Unitário Normalizado`, `Memória de Cálculo (Lei 14.133/2021)` e `Valor Homologado Original (R$)`, e deve ser **removida** a coluna `Unidade Original ARP`.

3. **Captura e Exibição de "Possibilidade de Adesão" (Sim / Não):**
   - No Portal PNCP, a página e o registro oficial da ARP destacam expressamente a informação **"Possibilidade de Adesão: Sim"** ou **"Possibilidade de Adesão: Não"** (conforme comprovado nas imagens de ata fornecidas pelo usuário).
   - Essa informação é crítica para o agente de contratação saber se a ata admite "carona" (adesão por órgão não participante conforme art. 86 da Lei 14.133/2021).
   - O sistema deve extrair essa informação da API do PNCP (onde consta nativamente nos campos `permite_adesao` da busca e `possibilidadeAdesao` do detalhe da ata), apresentar uma coluna dedicada na tela dos 20 menores preços (`Top20SelectionModal`) e incluir essa coluna no relatório em PDF e no relatório em Excel.

4. **CNPJ do Fornecedor Junto ao Nome em Todas as Telas e Relatórios:**
   - Para fins de rastreabilidade de compliance e identificação inequívoca da pessoa jurídica vencedora, o CNPJ/CPF do fornecedor deve figurar **junto ao nome/razão social na mesma célula** (ex.: `RAZÃO SOCIAL DO FORNECEDOR (CNPJ: XX.XXX.XXX/XXXX-XX)`), sem necessidade de criar uma nova coluna separada, tanto em todas as telas quanto em todos os relatórios emitidos (Excel, PDF e CSV).

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
1. **Interação de Expansão/Retração Concomitante no Top 20:**
   - Implementar coluna de alternância com botão de seta (`ChevronDown` / `ChevronUp`) ao lado de cada item.
   - Manter estado local com `Set<string>` de chaves de itens expandidos, permitindo abrir e fechar múltiplos itens de forma concomitante e independente.
   - Exibir na área expandida a totalidade dos dados: descrição completa, especificação complementar, detalhes da licitação/processo, dados do órgão (nome, CNPJ, esfera, município, IBGE), dados do fornecedor (razão social e CNPJ), vigência (datas de assinatura, início e término, situação), quantitativos oficiais e de fornecimento, fórmula e memória de cálculo da Lei 14.133/2021, possibilidade de adesão, classe de aderência (A/B) e links diretos (PNCP e documentos anexos).
2. **Relatórios Limpos e Dinâmicos quanto à Normalização:**
   - No gerador Excel (`exporter-xlsx.ts`), verificar se `itensSelecionados.some(i => i.normalizado || Boolean(i.formula_normalizacao))`.
   - Se `true`: incluir as 3 colunas acordadas (`Valor Unitário Normalizado`, `Memória de Cálculo (Lei 14.133/2021)` e `Valor Homologado Original (R$)`) e remover `Unidade Original ARP`.
   - Se `false`: manter apenas a coluna padrão de valor unitário homologado, suprimindo qualquer coluna de memória de cálculo vazia.
   - Ajustar dinamicamente fórmulas de estatísticas do Excel (Média, Mediana, etc.) para apontar para a coluna correta de valor unitário em cada caso.
3. **Rastreabilidade da Possibilidade de Adesão (Sim / Não):**
   - Atualizar a interface `ItemCandidato` com o campo `possibilidade_adesao: "Sim" | "Não" | "Não informado"`.
   - Extrair no pipeline a informação oficial da API do PNCP (`ata.permite_adesao` e `detAta.possibilidadeAdesao`).
   - Adicionar a coluna "Adesão" na tabela do modal dos 20 menores preços com indicador visual (Sim / Não).
   - Adicionar a coluna "Possibilidade de Adesão" na tabela consolidada do relatório em PDF e na planilha Excel.
4. **Padronização de Fornecedor com CNPJ:**
   - Criar utilitário de formatação de CNPJ/CPF (`formatarCpfCnpj`) para aplicar máscara pontuada (`XX.XXX.XXX/XXXX-XX` ou `XXX.XXX.XXX-XX`).
   - Garantir que a propriedade `fornecedor` em `ItemCandidato` seja formatada como `NOME_RAZAO_SOCIAL (CNPJ: XX.XXX.XXX/XXXX-XX)` ou `NOME_RAZAO_SOCIAL (CPF: XXX.XXX.XXX-XX)`.
   - Refletir essa formatação em todas as telas (modal de seleção e painel de relatório consolidado) e em todos os relatórios (Excel, PDF, CSV).

### Não-Objetivos
- Não remover as colunas essenciais de auditoria da Lei 14.133/2021.
- Não restringir a visualização de detalhes a modais externos que bloqueiem a visão da lista de itens.
- Não criar colunas extras separadas para CNPJ quando o usuário solicitou expressamente na mesma célula do fornecedor.

### Anti-Objetivos
- Não deixar que a expansão de um item feche os outros que o usuário escolheu manter abertos.
- Não quebrar fórmulas matemáticas no Excel ao alterar dinamicamente o número e as posições das colunas.
- Não truncar textos de CNPJ ou descrições no relatório em PDF.

---

## 3. Abordagem Selecionada

### Abordagem: Expansão Inline Multi-Item + Relatório Dinâmico por Metadados
- **Expansão na Interface:** Um botão com ícone `ChevronDown`/`ChevronUp` na primeira coluna do `Top20SelectionModal`. Clicar no botão altera o `expandedKeys` (`Set<string>`), renderizando um `<tr>` com `colSpan` contendo um grid dividido em blocos temáticos com tipografia legível e contraste adequado para os modos claro e escuro.
- **Detecção no Pipeline:** A busca na API PNCP (`/api/search/`) já traz `permite_adesao: boolean` e o detalhe da ata traz `possibilidadeAdesao: boolean`. O pipeline mapeará `true -> "Sim"`, `false -> "Não"` e ausente -> `"Não informado"`.
- **Formatação do Fornecedor:** Formatação inteligente com prefixo dinâmico `CNPJ:` (14 dígitos) ou `CPF:` (11 dígitos):
  `fornecedorFmt = fornecedorNome && fornecedorNi ? `${fornecedorNome} (${rotuloDocumento}: ${formatarCpfCnpj(fornecedorNi)})` : fornecedorNome || formatarCpfCnpj(fornecedorNi) || "não informado"`.
- **Exportação Condicional:**
  - `const temPadronizacao = itensSelecionados.some(i => i.normalizado || Boolean(i.formula_normalizacao));`
  - Se `temPadronizacao === false`, as colunas de normalização são omitidas tanto do cabeçalho quanto das linhas de dados do Excel na Aba 1, resultando em um relatório direto e sem colunas em branco.
  - No PDF, a coluna de Adesão é inserida harmoniosamente na tabela consolidada, mantendo o padrão A4 retrato perfeitamente diagramado.

---

## 4. Impacto nos Arquivos da Base de Código

1. **`src/lib/domain/types.ts`:**
   - Adicionar `possibilidade_adesao?: "Sim" | "Não" | "Não informado";` em `ItemCandidato`.
   - Adicionar `especificacao_complementar?: string;` e `data_inicio_vigencia?: string;` em `ItemCandidato` para exibição no acordeão.
   - Adicionar `fornecedor_cnpj?: string;` em `ItemCandidato`.
2. **`src/lib/domain/pipeline.ts`:**
   - Criar/utilizar função de formatação de CNPJ/CPF pontuado com identificação `CNPJ:` ou `CPF:`.
   - Extrair `permite_adesao` / `possibilidadeAdesao` para preencher `possibilidade_adesao`.
   - Mapear `especificacao_complementar` e `data_inicio_vigencia`.
   - Formatar `fornecedorFmt` com a identificação explícita do documento pontuado.
3. **`src/components/Top20SelectionModal.tsx`:**
   - Adicionar estado `expandedKeys: Set<string>`.
   - Adicionar botão de seta na linha do item com `ChevronDown`/`ChevronUp`.
   - Renderizar sub-linha de detalhes expandidos com todas as informações completas.
   - Adicionar coluna de "Adesão" na tabela principal.
   - Exibir fornecedor com CNPJ na mesma célula.
4. **`src/lib/export/exporter-xlsx.ts`:**
   - Condicionar a inclusão das colunas de normalização da Aba 1 a `temPadronizacao`.
   - Se houver padronização: manter `Valor Unitário Normalizado`, `Memória de Cálculo (Lei 14.133/2021)` e `Valor Homologado Original (R$)`, excluindo `Unidade Original ARP`.
   - Se não houver: omitir essas 3 colunas.
   - Adicionar coluna `Possibilidade de Adesão`.
   - Ajustar as fórmulas dinâmicas de Média, Mediana, Menor e Maior de acordo com o índice dinâmico da coluna de valor.
5. **`src/lib/export/exporter-pdf.ts`:**
   - Adicionar a coluna `Adesão` na tabela consolidada (Tabela 3).
   - Ajustar larguras das colunas para manter a diagramação proporcional no A4 retrato.
   - Exibir o fornecedor com CNPJ na mesma célula.
6. **`src/components/ConsolidatedReportPanel.tsx`:**
   - Exibir a informação de "Possibilidade de Adesão" e o CNPJ do fornecedor na tabela de itens selecionados.
7. **Testes Automatizados:**
   - Atualizar e criar testes em `tests/domain/` e `tests/export/` validando o preenchimento de `possibilidade_adesao`, a formatação de CNPJ/CPF do fornecedor e a geração condicional de colunas no Excel e PDF.

---

## 5. Decisões Técnicas do Construtor (Builder Calls)

1. **Campos Adicionais no Acordeão (`ItemCandidato`):**
   - Para que a visualização expandida apresente todas as informações prometidas sem truncamentos, adicionamos os campos opcionais `especificacao_complementar?: string` e `data_inicio_vigencia?: string` a `ItemCandidato`. No `pipeline.ts`, eles são preenchidos a partir dos dados já recebidos da API do PNCP (`infCompItem` e `dtIniVigFinal`), sem qualquer chamada extra de rede.
2. **Escopo dos Relatórios:**
   - A regra de colunas dinâmicas (condicionalidade da padronização e remoção de `Unidade Original ARP`) aplica-se à **Aba 1 do Excel** (`Cesta de Preços Homologados`), que é o documento final da pesquisa para o processo administrativo.
   - O campo `Possibilidade de Adesão` é adicionado à **Aba 1 do Excel**, à **Tabela Consolidada do PDF** e ao **CSV**.
   - A Aba 2 do Excel (base técnica de 27 colunas) e o CSV mantêm suas estruturas técnicas consolidadas para não quebrar compatibilidade com planilhas e scripts externos de importação.
3. **Resiliência e Desempenho de Rede:**
   - O status de `possibilidade_adesao` prioriza o campo `permite_adesao` já retornado na listagem da busca e, se houver detalhes já carregados (`detAta`), utiliza `detAta.possibilidadeAdesao`. Caso ambos sejam ausentes/nulos, adota `"Não informado"` sem disparar requisições adicionais de rede, garantindo que a pesquisa continue concluindo em menos de 3 a 5 segundos.
4. **Tratamento de Documento do Fornecedor (CNPJ vs CPF):**
   - O formatador aplica dinamicamente o rótulo correto: para 14 dígitos, `(CNPJ: 00.000.000/0000-00)`; para 11 dígitos, `(CPF: 000.000.000-00)`. Para números com formato desconhecido ou já formatados, preserva o valor recebido, mantendo absoluta segurança jurídica e conformidade com a Lei 14.133/2021.
