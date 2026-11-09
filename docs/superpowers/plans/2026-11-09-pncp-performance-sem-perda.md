# Otimização de Performance PNCP sem Perda de Fidelidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir o tempo de execução da pesquisa de preços no PNCP em 3x a 5x mantendo 100% de fidelidade nos resultados e zero perda de ARPs.

**Architecture:** Separação de timeout/retries entre o atalho Dados Abertos (fast-fail 2.8s, 0 retries) e a API Oficial do PNCP (7s, 2 retries, 20 workers), deduplicação de promessas *in-flight* no carregamento em lote de resultados homologados, detecção exata de última página de itens, paralelização da busca inicial por termos/conferência de status e pré-carregamento paralelo de detalhes de atas na Etapa 2 do pipeline.

**Tech Stack:** TypeScript, Next.js App Router, Node.js native test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-09-pncp-performance-sem-perda-design.md`

---

### Task 1: Perfis de Rede Diferenciados, Deduplicação In-Flight 3.1 e Detecção de Última Página

**Files:**
- Modify: `src/data/constants.ts:10-19`
- Modify: `src/lib/domain/pncp-client.ts:25-95,111-233,648-904`
- Modify: `tests/domain/pncp-7-causas-raiz.test.ts:15-22`
- Create: `tests/domain/pncp-performance-fidelidade.test.ts`

- [ ] **Step 1: Escrever os testes de performance e fidelidade em `tests/domain/pncp-performance-fidelidade.test.ts`**
- [ ] **Step 2: Executar os testes e verificar a falha inicial (RED)**
- [ ] **Step 3: Implementar constantes calibradas em `src/data/constants.ts` e otimizações em `src/lib/domain/pncp-client.ts`**
- [ ] **Step 4: Executar os testes e verificar aprovação (GREEN)**

### Task 2: Busca Paralela de Termos, Conferência Não-Bloqueante, Região Inteligente e Etapa 2 Paralela

**Files:**
- Modify: `src/lib/domain/pncp-client.ts:419-552,1002-1081`
- Modify: `src/lib/domain/pipeline.ts:350-778`
- Modify: `tests/domain/pncp-performance-fidelidade.test.ts`

- [ ] **Step 1: Adicionar testes para busca paralela de termos, região inteligente e Etapa 2 paralela em `tests/domain/pncp-performance-fidelidade.test.ts`**
- [ ] **Step 2: Executar os testes para verificar o comportamento**
- [ ] **Step 3: Implementar paralelização em `buscarTodasAtasPorTermos` (`pncp-client.ts`) e na Etapa 1 e Etapa 2 de `executarPipelinePesquisa` (`pipeline.ts`)**
- [ ] **Step 4: Executar suíte de testes e confirmar 100% de aprovação**
- [ ] **Step 5: Executar commit, push e deploy para produção na Vercel**
