"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Scale,
  Award,
  Users,
  UserCheck,
  Clock,
  Shield,
  Search,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  UserX,
  UserPlus,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export const ADMIN_PRINCIPAL_EMAIL = "sergiodantastorres@gmail.com";

interface UsuarioItem {
  id: number;
  email: string;
  nome: string;
  perfil: "admin" | "consulta";
  ativo: boolean;
  ultimo_login: string | null;
  criado_em: string;
}

interface UsuarioAutenticado {
  id: number;
  email: string;
  nome: string;
  perfil: "admin" | "consulta";
  ativo: boolean;
}

export default function UsuariosPage() {
  const router = useRouter();

  // Estados de Autenticação e Dados
  const [currentUser, setCurrentUser] = useState<UsuarioAutenticado | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acessoRestrito, setAcessoRestrito] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Estados de UI
  const [darkMode, setDarkMode] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendentes" | "ativos">("todos");
  const [feedback, setFeedback] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  // Inicialização de Dark Mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pncp_theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = stored === "dark" || (!stored && prefersDark);
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (typeof window !== "undefined") {
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("pncp_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("pncp_theme", "light");
      }
    }
  };

  // Carregar dados da sessão e usuários
  const carregarDados = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      // 1. Verificar sessão atual
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        if (meRes.status === 401) {
          router.push("/login?redirect=/usuarios");
          return;
        }
        setAcessoRestrito(true);
        setLoading(false);
        return;
      }
      const meData = await meRes.json();
      if (!meData.autenticado || !meData.usuario) {
        router.push("/login?redirect=/usuarios");
        return;
      }

      setCurrentUser(meData.usuario);

      if (meData.usuario.perfil !== "admin") {
        setAcessoRestrito(true);
        setLoading(false);
        return;
      }

      // 2. Carregar lista de usuários
      const usuariosRes = await fetch("/api/usuarios");
      if (!usuariosRes.ok) {
        if (usuariosRes.status === 403) {
          setAcessoRestrito(true);
        } else {
          setFeedback({
            tipo: "erro",
            mensagem: "Falha ao carregar a lista de usuários.",
          });
        }
        setLoading(false);
        return;
      }

      const usuariosData = await usuariosRes.json();
      setUsuarios(usuariosData.usuarios || []);
    } catch {
      setFeedback({
        tipo: "erro",
        mensagem: "Erro de comunicação com o servidor ao consultar usuários.",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // continua para o redirecionamento
    }
    router.push("/login");
  };

  // Ação: Alternar Status (Aprovar / Desativar)
  const handleToggleStatus = async (user: UsuarioItem) => {
    if (user.email.toLowerCase() === ADMIN_PRINCIPAL_EMAIL.toLowerCase()) {
      setFeedback({
        tipo: "erro",
        mensagem: "O Administrador Principal do sistema não pode ser desativado.",
      });
      return;
    }
    if (currentUser && user.id === currentUser.id) {
      setFeedback({
        tipo: "erro",
        mensagem: "Não é permitido alterar o status da própria conta logada.",
      });
      return;
    }

    setActionLoadingId(user.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/usuarios/${user.id}/toggle-status`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          tipo: "erro",
          mensagem: data.error || "Não foi possível alterar o status do usuário.",
        });
        setActionLoadingId(null);
        return;
      }

      // Atualizar lista localmente
      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ativo: data.usuario.ativo } : u))
      );

      const msgSucesso = data.foiAprovadoAgora
        ? `Acesso aprovado com sucesso para ${user.nome}! ${
            data.emailEnviado
              ? "E-mail oficial de notificação enviado ao usuário."
              : "Notificação registrada no sistema."
          }`
        : `Usuário ${user.nome} desativado com sucesso.`;

      setFeedback({ tipo: "sucesso", mensagem: msgSucesso });
    } catch {
      setFeedback({
        tipo: "erro",
        mensagem: "Erro ao processar a solicitação no servidor.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Ação: Alternar Perfil (Tornar Admin / Tornar Consulta)
  const handleAlterarPerfil = async (user: UsuarioItem) => {
    if (user.email.toLowerCase() === ADMIN_PRINCIPAL_EMAIL.toLowerCase()) {
      setFeedback({
        tipo: "erro",
        mensagem: "O perfil do Administrador Principal não pode ser alterado.",
      });
      return;
    }
    if (currentUser && user.id === currentUser.id) {
      setFeedback({
        tipo: "erro",
        mensagem: "Não é permitido rebaixar o perfil da própria conta em sessão.",
      });
      return;
    }

    const novoPerfil: "admin" | "consulta" =
      user.perfil === "admin" ? "consulta" : "admin";

    setActionLoadingId(user.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/usuarios/${user.id}/alterar-perfil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novoPerfil }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          tipo: "erro",
          mensagem: data.error || "Não foi possível alterar o perfil do usuário.",
        });
        setActionLoadingId(null);
        return;
      }

      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, perfil: data.usuario.perfil } : u))
      );

      setFeedback({
        tipo: "sucesso",
        mensagem: `Perfil de ${user.nome} alterado para '${novoPerfil.toUpperCase()}' com sucesso.`,
      });
    } catch {
      setFeedback({
        tipo: "erro",
        mensagem: "Erro ao processar alteração de perfil no servidor.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Estatísticas KPI
  const kpis = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((u) => u.ativo).length;
    const pendentes = usuarios.filter((u) => !u.ativo).length;
    const admins = usuarios.filter((u) => u.perfil === "admin").length;
    return { total, ativos, pendentes, admins };
  }, [usuarios]);

  // Lista Filtrada
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      // Filtro de status
      if (filtroStatus === "pendentes" && u.ativo) return false;
      if (filtroStatus === "ativos" && !u.ativo) return false;

      // Filtro de busca
      if (!termoBusca.trim()) return true;
      const termo = termoBusca.toLowerCase().trim();
      return (
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo)
      );
    });
  }, [usuarios, filtroStatus, termoBusca]);

  // Formatação de data em America/Recife
  const formatarData = (dataStr: string | null) => {
    if (!dataStr) return "Nunca";
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return "Data inválida";
      return d.toLocaleString("pt-BR", {
        timeZone: "America/Recife",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dataStr);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Institutional Ribbon */}
      <div className="bg-gradient-to-r from-[#0F2442] via-[#1B365D] to-[#0F2442] text-white px-4 py-1.5 text-xs select-none">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium tracking-wide">
            <Scale className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>
              GOVERNANÇA EM CONTRATAÇÕES PÚBLICAS • LEI Nº 14.133/2021 • IN SEGES/ME Nº 65/2021
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-200">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#F3E5AB]">
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
              Desenvolvido por Sérgio Dantas Torres
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1B365D] to-[#0F2442] flex items-center justify-center shadow-md border border-[#D4AF37]/40 shrink-0">
              <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Gestão de Usuários e RBAC
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#1B365D]/10 dark:bg-[#D4AF37]/20 text-[#1B365D] dark:text-[#F3E5AB] border border-[#1B365D]/20 dark:border-[#D4AF37]/30">
                  Painel Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Aprovação prévia de cadastros, controle de perfis de auditoria e segurança
              </p>
            </div>
          </div>

          {/* Navigation Links and Action Bar */}
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <span>Pesquisa de Preços</span>
            </Link>

            <Link
              href="/usuarios"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1B365D] dark:bg-[#1B365D] shadow-sm border border-[#D4AF37]/50"
            >
              <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Gestão de Usuários</span>
            </Link>

            <Link
              href="/historico"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-[#B59410]" />
              <span>Histórico de Auditoria</span>
            </Link>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Alternar tema claro ou escuro"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
              title={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* User identification & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {currentUser.nome}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {currentUser.perfil.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors"
                  title="Encerrar sessão segura"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B365D] dark:text-[#D4AF37] mb-3" />
            <p className="text-sm">Carregando painel de usuários e permissões...</p>
          </div>
        )}

        {/* Barreira de Acesso Restrito (Não Admin) */}
        {!loading && acessoRestrito && (
          <div
            role="alert"
            className="p-6 rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 space-y-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold">Acesso Restrito ao Painel Administrativo</h2>
                <p className="text-sm mt-1 text-amber-800 dark:text-amber-300">
                  O painel de gestão de usuários é restrito exclusivamente a administradores do
                  sistema. O seu usuário atual está autenticado com o perfil de{" "}
                  <strong>{currentUser?.perfil ? currentUser.perfil.toUpperCase() : "CONSULTA"}</strong>.
                </p>
                <p className="text-xs mt-2 text-amber-700 dark:text-amber-400">
                  Para solicitar elevação de privilégios, contate o administrador principal em{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">
                    {ADMIN_PRINCIPAL_EMAIL}
                  </code>
                  .
                </p>
              </div>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1B365D] hover:bg-[#152a4a] transition-all"
              >
                Retornar à Pesquisa de Preços
              </Link>
            </div>
          </div>
        )}

        {/* Admin Content */}
        {!loading && !acessoRestrito && (
          <>
            {/* Feedback Alert Banner */}
            {feedback && (
              <div
                role="alert"
                aria-live="polite"
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                  feedback.tipo === "sucesso"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {feedback.tipo === "sucesso" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium">{feedback.mensagem}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="text-xs underline hover:no-underline font-semibold"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total de Usuários
                  </p>
                  <p className="text-2xl font-bold font-heading text-slate-900 dark:text-white mt-1">
                    {kpis.total}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              {/* Card 2: Ativos */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Ativos
                  </p>
                  <p className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
                    {kpis.ativos}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                  <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              {/* Card 3: Pendentes */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Aguardando Aprovação
                  </p>
                  <p className="text-2xl font-bold font-heading text-amber-600 dark:text-amber-400 mt-1">
                    {kpis.pendentes}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>

              {/* Card 4: Administradores */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Administradores
                  </p>
                  <p className="text-2xl font-bold font-heading text-indigo-600 dark:text-indigo-400 mt-1">
                    {kpis.admins}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                  <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37]"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFiltroStatus("todos")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filtroStatus === "todos"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Todos ({kpis.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus("pendentes")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filtroStatus === "pendentes"
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 shadow-sm font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-amber-700"
                  }`}
                >
                  Pendentes ({kpis.pendentes})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus("ativos")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filtroStatus === "ativos"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 shadow-sm font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-emerald-700"
                  }`}
                >
                  Ativos ({kpis.ativos})
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={carregarDados}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                title="Recarregar lista"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th scope="col" className="px-6 py-3.5">
                        Nome / Identificação
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        E-mail
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        Perfil
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        Cadastro / Último Acesso (Recife)
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-right">
                        Ações de Gestão
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {usuariosFiltrados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                        >
                          Nenhum usuário encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      usuariosFiltrados.map((u) => {
                        const isAdminPrincipal =
                          u.email.toLowerCase() === ADMIN_PRINCIPAL_EMAIL.toLowerCase();
                        const isSelf = currentUser?.id === u.id;
                        const isActionDisabled = isAdminPrincipal || isSelf;

                        return (
                          <tr
                            key={u.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Nome */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1B365D] to-[#0F2442] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                  {u.nome
                                    .split(" ")
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join("")}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{u.nome}</span>
                                    {isSelf && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                                        Você
                                      </span>
                                    )}
                                    {isAdminPrincipal && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/20 text-[#B59410] dark:text-[#F3E5AB] border border-[#D4AF37]/30">
                                        <Award className="w-2.5 h-2.5" />
                                        Admin Principal
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* E-mail */}
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                                {u.email}
                              </span>
                            </td>

                            {/* Perfil */}
                            <td className="px-6 py-4">
                              {u.perfil === "admin" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  <Shield className="w-3 h-3" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  <Users className="w-3 h-3" />
                                  Consulta
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4">
                              {u.ativo ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Ativo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                  Aguardando Aprovação
                                </span>
                              )}
                            </td>

                            {/* Datas */}
                            <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                              <div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  Criado:
                                </span>{" "}
                                {formatarData(u.criado_em)}
                              </div>
                              <div className="mt-0.5">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  Último Login:
                                </span>{" "}
                                {formatarData(u.ultimo_login)}
                              </div>
                            </td>

                            {/* Ações */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Botão de Status: Aprovar Acesso ou Desativar */}
                                {u.ativo ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(u)}
                                    disabled={isActionDisabled || actionLoadingId === u.id}
                                    title={
                                      isActionDisabled
                                        ? "Conta protegida contra desativação"
                                        : "Desativar acesso deste usuário"
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      isActionDisabled
                                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                                        : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                                    }`}
                                  >
                                    {actionLoadingId === u.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <UserX className="w-3.5 h-3.5" />
                                    )}
                                    <span>Desativar</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(u)}
                                    disabled={isActionDisabled || actionLoadingId === u.id}
                                    title={
                                      isActionDisabled
                                        ? "Conta protegida"
                                        : "Aprovar acesso e notificar usuário por e-mail"
                                    }
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                                      isActionDisabled
                                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
                                    }`}
                                  >
                                    {actionLoadingId === u.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Aprovar Acesso</span>
                                  </button>
                                )}

                                {/* Botão de Perfil: Tornar Admin ou Tornar Consulta */}
                                {u.perfil === "admin" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAlterarPerfil(u)}
                                    disabled={isActionDisabled || actionLoadingId === u.id}
                                    title={
                                      isActionDisabled
                                        ? "Perfil do administrador protegido"
                                        : "Alterar perfil para Consulta"
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      isActionDisabled
                                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                    }`}
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Tornar Consulta</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAlterarPerfil(u)}
                                    disabled={isActionDisabled || actionLoadingId === u.id}
                                    title={
                                      isActionDisabled
                                        ? "Perfil protegido"
                                        : "Promover usuário para Administrador"
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                      isActionDisabled
                                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                                        : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                    }`}
                                  >
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>Tornar Admin</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
