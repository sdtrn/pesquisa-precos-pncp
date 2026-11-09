# Otimização de Performance da Pesquisa PNCP com 100% de Fidelidade (Zero Perda de ARPs)

## Contexto e Objetivo
Após a restauração do commit `663b1bf` (que corrigiu as 7 causas raiz de perda de ARPs no PNCP e manteve autenticação/histórico), a fidelidade dos resultados foi restabelecida, porém o tempo total de pesquisa aumentou significativamente. O objetivo deste projeto é reduzir drasticamente a latência da consulta (3x a 5x mais rápida) mantendo **100% de fidelidade e recall** (nenhuma ARP ou item compatível pode deixar de aparecer).

## Abordagem Escolhida (Abordagem A — Pacote Completo de 5 Otimizações Lossless)

1. **Perfis de Rede Diferenciados (`constants.ts` e `PNCPClient.getJson`):**
   - **API Oficial do PNCP (`pncp.gov.br`):** Mantém `MAX_RETRIES = 2`, `REQUEST_TIMEOUT_MS = 7000`, `RETRY_BACKOFF_MS = 350`, `MAX_PARALLEL_WORKERS = 20`, e proibição estrita de cachear `[]` em erros 5xx/timeout/429.
   - **Espelho Dados Abertos (`dadosabertos.compras.gov.br`):** Como é apenas um atalho de leitura cujos dados sempre possuem fallback imediato na API oficial do PNCP, utiliza `DADOS_ABERTOS_TIMEOUT_MS = 2800` e `0 retries`. Se o Dados Abertos oscilar ou demorar mais de 2,8s, o cliente passa imediatamente para a API oficial do PNCP em vez de aguardar 31,8s por compra.

2. **Deduplicação *In-Flight* no Lote 3.1 do Dados Abertos (`PNCPClient.obterResultadosItem`):**
   - Substituir o `Set<string>` `GLOBAL_RESULTADOS_DA_COMPRAS_CONSULTADAS` por um `Map<string, Promise<void>>` (`GLOBAL_RESULTADOS_DA_INFLIGHT`).
   - Quando múltiplos workers buscam simultaneamente resultados de diferentes itens da mesma compra, todos aguardam a mesma `Promise` do endpoint em lote `3.1` terminar, evitando que os workers 2..N pulem o lote e disparem chamadas individuais redundantes à API v1 do PNCP.

3. **Detecção Dinâmica de Última Página em `obterTodosItensCompra`:**
   - A API v1 de itens do PNCP retorna páginas de até `50` ou `100` itens (quando `ITEMS_PAGE_SIZE = 100`).
   - Na página 1, se `dadosPag.length < 50`, ou se `dadosPag.length > 50 && dadosPag.length < ITEMS_PAGE_SIZE` (ex.: 65 itens), a página 1 já é comprovadamente a última página da ata, evitando uma requisição HTTP extra para a página 2 que retornaria vazio.
   - Quando a página 1 retorna exatamente `50` ou `100` itens, o `tamPaginaEfetivo` daquela compra passa a ser `dadosPag.length` (50 ou 100), parando assim que uma página subsequente trouxer `< tamPaginaEfetivo`.

4. **Busca Paralela de Termos e `conferirEquacaoStatusApi` Não-Bloqueante + Região Inteligente:**
   - Em `buscarTodasAtasPorTermos`: buscar a página 1 de todos os termos de busca em paralelo; iniciar `conferirEquacaoStatusApi` em paralelo (sem bloquear o download das páginas `2..N` de atas); e baixar as páginas restantes com concorrência compartilhada.
   - Em `executarPipelinePesquisa` quando `escopoOrgaos === ESCOPO_POR_REGIAO`: realizar primeiramente a busca nacional sem filtro de UF. Como o limite do `/api/search/` do PNCP é de 9.990 registros por termo, se nenhum termo atingir `>= 9000` registros no total da busca, 100% das atas da região já estão presentes no resultado nacional e são filtradas localmente em 0ms. Apenas se algum termo atingir `>= 9000` atas é acionada a busca complementar fatiada por UF da região.

5. **Pré-carregamento Paralelo de `obterDetalheAta` na Etapa 2 (`pipeline.ts`):**
   - Na Etapa 2 de `executarPipelinePesquisa`, substituir o `await client.obterDetalheAta(...)` sequencial dentro do `for (const ataS of atasBrutas)` por uma etapa em lote paralelo (`runWithConcurrency`) apenas para as atas que passaram nos filtros locais de período e compatibilidade preliminar do objeto e que necessitam de confirmação de município/esfera.
