"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Scale,
  Award,
  Users,
  Clock,
  Search,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Activity,
  Layers,
  Filter,
  Eye,
  X,
  Server,
  Globe,
  Database,
  Calendar,
  Hash,
  Info,
} from "lucide-react";

export const ADMIN_PRINCIPAL_EMAIL = "sergiodantastorres@gmail.com";

interface RegistroAuditoriaPncpItem {
  id: number;
  usuario_id: number | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  usuario_perfil: string | null;
  descricao_objeto: string;
  termos_busca: string | null;
  escopo_orgaos: string | null;
  regiao_ou_uf: string | null;
  apenas_municipios_bilionarios: boolean | null;
  status_ata: string | null;
  tipo_data: string | null;
  periodo_pesquisa: string | null;
  criterio_classificacao: string | null;
  modo_normalizacao: string | null;
  total_atas_varridas: number;
  total_encontrados: number;
  total_selecionados: number;
  total_descartados: number;
  media_estimada: number | null;
  unidade_referencia: string | null;
  duracao_segundos: number | null;
  ip_origem: string | null;
  user_agent: string | null;
  status: string;
  erro_mensagem: string | null;
  executado_em: string;
}

interface RegistroAcessoPncpItem {
  id: number;
  usuario_id: number | null;
  email_informado: string;
  usuario_nome: string | null;
  evento: string;
  ip_origem: string | null;
  user_agent: string | null;
  detalhes: string | null;
  ocorrido_em: string;
}

interface ResumoHistorico {
  totalConsultas: number;
  consultasSucesso: number;
  consultasErro: number;
  totalAcessos: number;
  usuariosUnicosConsultando: number;
}

interface UsuarioAutenticado {
  id: number;
  email: string;
  nome: string;
  perfil: "admin" | "consulta";
  ativo: boolean;
}

export default function HistoricoPage() {
  const router = useRouter();

  // Autenticação & Permissões
  const [currentUser, setCurrentUser] = useState<UsuarioAutenticado | null>(null);
  const [loading, setLoading] = useState(true);
  const [acessoRestrito, setAcessoRestrito] = useState(false);

  // Dados do Histórico
  const [consultas, setConsultas] = useState<RegistroAuditoriaPncpItem[]>([]);
  const [acessos, setAcessos] = useState<RegistroAcessoPncpItem[]>([]);
  const [resumo, setResumo] = useState<ResumoHistorico>({
    totalConsultas: 0,
    consultasSucesso: 0,
    consultasErro: 0,
    totalAcessos: 0,
    usuariosUnicosConsultando: 0,
  });

  // UI States
  const [darkMode, setDarkMode] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"consultas" | "acessos">("consultas");
  const [termoBuscaConsultas, setTermoBuscaConsultas] = useState("");
  const [filtroStatusConsultas, setFiltroStatusConsultas] = useState<"todos" | "sucesso" | "erro">("todos");
  const [termoBuscaAcessos, setTermoBuscaAcessos] = useState("");
  const [filtroEventoAcessos, setFiltroEventoAcessos] = useState("TODOS");
  const [selectedConsulta, setSelectedConsulta] = useState<RegistroAuditoriaPncpItem | null>(null);

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

  // Carregar dados de auditoria
  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Checagem de autenticação
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        if (meRes.status === 401) {
          router.push("/login?redirect=/historico");
          return;
        }
        setAcessoRestrito(true);
        setLoading(false);
        return;
      }

      const meData = await meRes.json();
      if (!meData.autenticado || !meData.usuario) {
        router.push("/login?redirect=/historico");
        return;
      }

      setCurrentUser(meData.usuario);

      if (meData.usuario.perfil !== "admin") {
        setAcessoRestrito(true);
        setLoading(false);
        return;
      }

      // 2. Carregar registros do histórico
      const histRes = await fetch("/api/historico");
      if (!histRes.ok) {
        if (histRes.status === 403) {
          setAcessoRestrito(true);
        }
        setLoading(false);
        return;
      }

      const histData = await histRes.json();
      setConsultas(histData.consultas || []);
      setAcessos(histData.acessos || []);
      if (histData.resumo) {
        setResumo(histData.resumo);
      }
    } catch {
      setAcessoRestrito(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // Fechar modal ao pressionar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedConsulta(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // continua para o redirecionamento
    }
    router.push("/login");
  };

  // Formatação em America/Recife
  const formatarDataRecife = (dataStr: string | null | undefined) => {
    if (!dataStr) return "N/D";
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
        second: "2-digit",
      });
    } catch {
      return String(dataStr);
    }
  };

  // Formatação de Moeda
  const formatarMoeda = (valor: number | null | undefined) => {
    if (valor === null || valor === undefined || isNaN(valor)) return "N/D";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  // Filtragem de Consultas
  const consultasFiltradas = useMemo(() => {
    return consultas.filter((c) => {
      // Status
      if (filtroStatusConsultas === "sucesso" && c.status !== "sucesso") return false;
      if (filtroStatusConsultas === "erro" && c.status === "sucesso") return false;

      // Busca por termos
      if (!termoBuscaConsultas.trim()) return true;
      const t = termoBuscaConsultas.toLowerCase().trim();
      return (
        c.descricao_objeto.toLowerCase().includes(t) ||
        (c.termos_busca && c.termos_busca.toLowerCase().includes(t)) ||
        (c.usuario_nome && c.usuario_nome.toLowerCase().includes(t)) ||
        (c.usuario_email && c.usuario_email.toLowerCase().includes(t)) ||
        (c.regiao_ou_uf && c.regiao_ou_uf.toLowerCase().includes(t)) ||
        (c.escopo_orgaos && c.escopo_orgaos.toLowerCase().includes(t))
      );
    });
  }, [consultas, filtroStatusConsultas, termoBuscaConsultas]);

  // Filtragem de Acessos
  const acessosFiltrados = useMemo(() => {
    return acessos.filter((a) => {
      // Evento
      if (filtroEventoAcessos !== "TODOS" && a.evento !== filtroEventoAcessos) {
        return false;
      }

      // Busca
      if (!termoBuscaAcessos.trim()) return true;
      const t = termoBuscaAcessos.toLowerCase().trim();
      return (
        a.email_informado.toLowerCase().includes(t) ||
        (a.usuario_nome && a.usuario_nome.toLowerCase().includes(t)) ||
        a.evento.toLowerCase().includes(t) ||
        (a.detalhes && a.detalhes.toLowerCase().includes(t)) ||
        (a.ip_origem && a.ip_origem.toLowerCase().includes(t))
      );
    });
  }, [acessos, filtroEventoAcessos, termoBuscaAcessos]);

  // Badge de Evento de Acesso
  const renderBadgeEvento = (evento: string) => {
    switch (evento) {
      case "LOGIN_SUCESSO":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            LOGIN_SUCESSO
          </span>
        );
      case "LOGIN_PENDENTE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            LOGIN_PENDENTE
          </span>
        );
      case "LOGIN_FALHA":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            LOGIN_FALHA
          </span>
        );
      case "CADASTRO_SOLICITADO":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            CADASTRO_SOLICITADO
          </span>
        );
      case "USUARIO_APROVADO":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
            USUARIO_APROVADO
          </span>
        );
      case "USUARIO_DESATIVADO":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
            USUARIO_DESATIVADO
          </span>
        );
      case "LOGOUT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            LOGOUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {evento}
          </span>
        );
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
                  Histórico de Auditoria Geral
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#1B365D]/10 dark:bg-[#D4AF37]/20 text-[#1B365D] dark:text-[#F3E5AB] border border-[#1B365D]/20 dark:border-[#D4AF37]/30">
                  Painel de Governança
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Rastreabilidade de pesquisas de preços, logs de autenticação e dossiês técnicos
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-[#B59410]" />
              <span>Gestão de Usuários</span>
            </Link>

            <Link
              href="/historico"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1B365D] dark:bg-[#1B365D] shadow-sm border border-[#D4AF37]/50"
            >
              <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
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

            {/* User Profile & Logout */}
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
                  title="Encerrar sessão"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B365D] dark:text-[#D4AF37] mb-3" />
            <p className="text-sm">Carregando registros de auditoria e segurança...</p>
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
                <h2 className="text-lg font-bold">Acesso Restrito ao Painel de Auditoria</h2>
                <p className="text-sm mt-1 text-amber-800 dark:text-amber-300">
                  O painel de histórico geral de auditoria e registros de acesso é restrito
                  exclusivamente a administradores. Seu perfil atual é{" "}
                  <strong>{currentUser?.perfil ? currentUser.perfil.toUpperCase() : "CONSULTA"}</strong>.
                </p>
                <p className="text-xs mt-2 text-amber-700 dark:text-amber-400">
                  Para visualizar seu próprio histórico individual de pesquisas, utilize o botão na
                  tela inicial ou contate o administrador principal em{" "}
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
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Consultas */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total de Consultas
                  </p>
                  <p className="text-2xl font-bold font-heading text-slate-900 dark:text-white mt-1">
                    {resumo.totalConsultas}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              {/* Card 2: Sucesso */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Consultas com Sucesso
                  </p>
                  <p className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
                    {resumo.consultasSucesso}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              {/* Card 3: Usuários Distintos */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Usuários Distintos
                  </p>
                  <p className="text-2xl font-bold font-heading text-indigo-600 dark:text-indigo-400 mt-1">
                    {resumo.usuariosUnicosConsultando}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>

              {/* Card 4: Registros de Acesso */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Registros de Acesso
                  </p>
                  <p className="text-2xl font-bold font-heading text-[#B59410] dark:text-[#D4AF37] mt-1">
                    {resumo.totalAcessos}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <Clock className="w-5 h-5 text-[#B59410] dark:text-[#D4AF37]" />
                </div>
              </div>
            </div>

            {/* Navigation Tabs Switcher */}
            <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setAbaAtiva("consultas")}
                  className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                    abaAtiva === "consultas"
                      ? "border-[#1B365D] dark:border-[#D4AF37] text-[#1B365D] dark:text-[#F3E5AB]"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Consultas Realizadas ({consultas.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaAtiva("acessos")}
                  className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                    abaAtiva === "acessos"
                      ? "border-[#1B365D] dark:border-[#D4AF37] text-[#1B365D] dark:text-[#F3E5AB]"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Acessos & Logins ({acessos.length})</span>
                </button>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={carregarHistorico}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors mb-2"
                title="Atualizar dados de auditoria"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Atualizar</span>
              </button>
            </div>

            {/* ABA 1: CONSULTAS REALIZADAS */}
            {abaAtiva === "consultas" && (
              <div className="space-y-4">
                {/* Search & Status Filters */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por objeto, termos, solicitante, e-mail ou UF..."
                      value={termoBuscaConsultas}
                      onChange={(e) => setTermoBuscaConsultas(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setFiltroStatusConsultas("todos")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        filtroStatusConsultas === "todos"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Todos ({consultas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroStatusConsultas("sucesso")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        filtroStatusConsultas === "sucesso"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-emerald-700"
                      }`}
                    >
                      Sucesso ({resumo.consultasSucesso})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroStatusConsultas("erro")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        filtroStatusConsultas === "erro"
                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-semibold shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-rose-700"
                      }`}
                    >
                      Erro ({resumo.consultasErro})
                    </button>
                  </div>
                </div>

                {/* Consultas Table */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th scope="col" className="px-5 py-3.5">
                            Data / Horário (Recife) & Duração
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Solicitante
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Objeto Consultado & Termos
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Escopo & Parâmetros
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Resultados & Média
                          </th>
                          <th scope="col" className="px-5 py-3.5 text-right">
                            Status & Detalhes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {consultasFiltradas.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                            >
                              Nenhum registro de consulta encontrado.
                            </td>
                          </tr>
                        ) : (
                          consultasFiltradas.map((c) => (
                            <tr
                              key={c.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              {/* Data/Hora & Duração */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                  {formatarDataRecife(c.executado_em)}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-[#B59410]" />
                                  <span>
                                    {c.duracao_segundos !== null ? `${c.duracao_segundos}s` : "N/D"}
                                  </span>
                                </div>
                              </td>

                              {/* Solicitante */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 uppercase">
                                    {(c.usuario_nome || "U")
                                      .split(" ")
                                      .map((p) => p[0])
                                      .slice(0, 2)
                                      .join("")}
                                  </div>
                                  <div>
                                    <div className="font-medium text-xs text-slate-900 dark:text-white">
                                      {c.usuario_nome || "Anônimo"}
                                    </div>
                                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                      {c.usuario_email || "N/A"}
                                    </div>
                                    <div className="mt-0.5">
                                      {c.usuario_perfil === "admin" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                                          Admin
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                          Consulta
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Objeto Consultado */}
                              <td className="px-5 py-4 max-w-xs">
                                <p className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-2">
                                  {c.descricao_objeto}
                                </p>
                                {c.termos_busca && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {c.termos_busca
                                      .split(",")
                                      .slice(0, 3)
                                      .map((termo, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                        >
                                          {termo.trim()}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </td>

                              {/* Escopo & Parâmetros */}
                              <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {c.escopo_orgaos || "Todos os Órgãos"}{" "}
                                  {c.regiao_ou_uf && `(${c.regiao_ou_uf})`}
                                </div>
                                {c.apenas_municipios_bilionarios && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#D4AF37]/20 text-[#B59410] dark:text-[#F3E5AB] mt-0.5">
                                    Municípios ≥ R$ 1 Bi
                                  </span>
                                )}
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {c.periodo_pesquisa || "1 ano"} • {c.criterio_classificacao || "Menor Preço"}
                                </div>
                              </td>

                              {/* Resultados & Média */}
                              <td className="px-5 py-4 text-xs">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {formatarMoeda(c.media_estimada)}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Encontrados: {c.total_encontrados} • Top 20: {c.total_selecionados} • Descartados: {c.total_descartados}
                                </div>
                              </td>

                              {/* Status & Ação Detalhes */}
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  {c.status === "sucesso" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      Sucesso
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                      Erro
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setSelectedConsulta(c)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1B365D] hover:bg-[#152a4a] dark:bg-[#1B365D] dark:hover:bg-[#234574] shadow-sm transition-all"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                                    <span>Detalhes</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: ACESSOS & LOGINS */}
            {abaAtiva === "acessos" && (
              <div className="space-y-4">
                {/* Search & Event Filters */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por e-mail informado, nome, IP ou detalhes..."
                      value={termoBuscaAcessos}
                      onChange={(e) => setTermoBuscaAcessos(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Evento:
                    </span>
                    <select
                      value={filtroEventoAcessos}
                      onChange={(e) => setFiltroEventoAcessos(e.target.value)}
                      className="py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B365D]"
                    >
                      <option value="TODOS">Todos os Eventos</option>
                      <option value="LOGIN_SUCESSO">LOGIN_SUCESSO</option>
                      <option value="LOGIN_PENDENTE">LOGIN_PENDENTE</option>
                      <option value="LOGIN_FALHA">LOGIN_FALHA</option>
                      <option value="CADASTRO_SOLICITADO">CADASTRO_SOLICITADO</option>
                      <option value="USUARIO_APROVADO">USUARIO_APROVADO</option>
                      <option value="USUARIO_DESATIVADO">USUARIO_DESATIVADO</option>
                      <option value="LOGOUT">LOGOUT</option>
                    </select>
                  </div>
                </div>

                {/* Acessos Table */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th scope="col" className="px-5 py-3.5">
                            Data / Horário (Recife)
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Usuário / E-mail Informado
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Evento
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Detalhes
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            IP de Origem
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Navegador / User-Agent
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {acessosFiltrados.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                            >
                              Nenhum registro de acesso ou evento encontrado.
                            </td>
                          </tr>
                        ) : (
                          acessosFiltrados.map((a) => (
                            <tr
                              key={a.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-800 dark:text-slate-200">
                                {formatarDataRecife(a.ocorrido_em)}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                                  {a.usuario_nome || "Identificação Direta"}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  {a.email_informado}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                {renderBadgeEvento(a.evento)}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 max-w-xs">
                                {a.detalhes || "—"}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                  {a.ip_origem || "—"}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title={a.user_agent || ""}>
                                {a.user_agent || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL INTERATIVO: DOSSIÊ TÉCNICO DE AUDITORIA */}
      {selectedConsulta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dossie-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedConsulta(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B365D] text-white flex items-center justify-center border border-[#D4AF37]/50 shadow-md">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3
                    id="dossie-modal-title"
                    className="font-heading text-lg sm:text-xl font-bold text-slate-900 dark:text-white"
                  >
                    Dossiê Técnico de Auditoria
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Protocolo de Rastreabilidade #{selectedConsulta.id} • Executado em{" "}
                    {formatarDataRecife(selectedConsulta.executado_em)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedConsulta(null)}
                aria-label="Fechar modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostic Message (if error) */}
            {selectedConsulta.erro_mensagem && (
              <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Mensagem de Diagnóstico / Erro</span>
                </div>
                <p className="mt-1 font-mono">{selectedConsulta.erro_mensagem}</p>
              </div>
            )}

            {/* Solicitante & Metadados de Origem */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Solicitante da Consulta
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {selectedConsulta.usuario_nome || "Usuário Anônimo"}
                </p>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  {selectedConsulta.usuario_email || "N/A"}
                </p>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#1B365D]/10 dark:bg-[#D4AF37]/20 text-[#1B365D] dark:text-[#F3E5AB] mt-1">
                  Perfil: {selectedConsulta.usuario_perfil ? selectedConsulta.usuario_perfil.toUpperCase() : "CONSULTA"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Segurança & Origem da Conexão
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 mt-1">
                  <span className="font-semibold">IP de Origem:</span>{" "}
                  <code className="font-mono px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                    {selectedConsulta.ip_origem || "127.0.0.1"}
                  </code>
                </p>
                <p className="text-xs text-slate-800 dark:text-slate-200 mt-1">
                  <span className="font-semibold">Duração:</span>{" "}
                  <code className="font-mono font-semibold text-[#B59410]">
                    {selectedConsulta.duracao_segundos !== null ? `${selectedConsulta.duracao_segundos}s` : "N/D"}
                  </code>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={selectedConsulta.user_agent || ""}>
                  <span className="font-semibold">Navegador:</span> {selectedConsulta.user_agent || "N/D"}
                </p>
              </div>
            </div>

            {/* Parâmetros do PNCP */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Parâmetros e Critérios de Busca
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Objeto Consultado:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {selectedConsulta.descricao_objeto}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Termos de Busca:</span>
                  <p className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                    {selectedConsulta.termos_busca || "Nenhum termo restritivo"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Escopo de Órgãos & UF:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {selectedConsulta.escopo_orgaos || "Todos"} • Região/UF: {selectedConsulta.regiao_ou_uf || "Nacional"}
                  </p>
                  {selectedConsulta.apenas_municipios_bilionarios && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-[#B59410]">
                      Apenas 177 Municípios (≥ R$ 1 Bi)
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Período e Classificação:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    Período: {selectedConsulta.periodo_pesquisa || "1 ano"} • Critério: {selectedConsulta.criterio_classificacao || "Menor Preço"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Status da Ata & Tipo de Data:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    Status: {selectedConsulta.status_ata || "Vigentes"} • Data: {selectedConsulta.tipo_data || "dataPublicacaoPncp"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Normalização & Unidade:</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    Modo: {selectedConsulta.modo_normalizacao || "Padrão"} • Unidade: {selectedConsulta.unidade_referencia || "Automática"}
                  </p>
                </div>
              </div>
            </div>

            {/* Estatísticas de Auditoria e Saneamento */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Estatísticas de Processamento & Saneamento
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    Atas Varridas
                  </span>
                  <p className="text-lg font-bold font-heading text-slate-900 dark:text-white mt-0.5">
                    {selectedConsulta.total_atas_varridas}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                    Itens Encontrados
                  </span>
                  <p className="text-lg font-bold font-heading text-blue-700 dark:text-blue-300 mt-0.5">
                    {selectedConsulta.total_encontrados}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                    Top 20 Válidos
                  </span>
                  <p className="text-lg font-bold font-heading text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {selectedConsulta.total_selecionados}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                    Descartados (IQR/R1-R7)
                  </span>
                  <p className="text-lg font-bold font-heading text-amber-700 dark:text-amber-300 mt-0.5">
                    {selectedConsulta.total_descartados}
                  </p>
                </div>
              </div>
            </div>

            {/* Média Calculada */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#1B365D] to-[#0F2442] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border border-[#D4AF37]/40">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#F3E5AB] font-semibold">
                  Média Estimada Homologada (Top 20)
                </span>
                <p className="text-2xl font-bold font-heading mt-0.5 text-[#D4AF37]">
                  {formatarMoeda(selectedConsulta.media_estimada)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsulta(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
              >
                Fechar Dossiê
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
