"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthSplitShell } from "@/components/AuthSplitShell";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  LogIn,
  UserPlus,
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const msgUrl = searchParams.get("msg");
  const tipoUrl = searchParams.get("tipo");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<boolean>(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(
    tipoUrl === "sucesso" && msgUrl ? msgUrl : null
  );

  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (erro && alertRef.current) {
      alertRef.current.focus();
    }
  }, [erro]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setPendente(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, senha }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 403 && data.pendente) {
          setPendente(true);
          setErro(
            data.error ||
              "Sua solicitação de cadastro foi realizada e aguarda aprovação do Administrador."
          );
        } else {
          setErro(data.error || "E-mail ou senha incorretos.");
        }
        setLoading(false);
        return;
      }

      // Redireciona para o destino ou página principal
      window.location.href = redirectUrl || "/";
    } catch {
      setErro("Falha de conexão com o servidor. Verifique sua rede e tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Acesso ao Sistema
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Entre com suas credenciais cadastradas para pesquisar e auditar atas
        </p>
      </div>

      {/* Mensagem de sucesso passada via URL */}
      {sucessoMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{sucessoMsg}</div>
        </div>
      )}

      {/* Alerta de erro acessível */}
      {erro && (
        <div
          ref={alertRef}
          role="alert"
          aria-live="polite"
          tabIndex={-1}
          className="focus:outline-none"
        >
          {pendente ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-300">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Cadastro Aguardando Aprovação</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
                {erro}
              </p>
              <div className="pt-1 border-t border-amber-200/60 dark:border-amber-800/60 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                Assim que a solicitação for aprovada, uma notificação automática será enviada a partir de <strong className="font-semibold text-amber-900 dark:text-amber-100">sergiodantastorres@gmail.com</strong> para o seu e-mail cadastrado.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{erro}</div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo E-mail */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
          >
            E-mail de Acesso
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@exemplo.com"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Campo Senha */}
        <div className="space-y-1.5">
          <label
            htmlFor="senha"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
          >
            Senha de Acesso
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="senha"
              name="senha"
              type={mostrarSenha ? "text" : "password"}
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              {mostrarSenha ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Botão de Envio */}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#1B365D] to-[#112240] hover:from-[#152a4a] hover:to-[#0A1528] dark:from-[#2B4C7E] dark:to-[#1B365D] shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#B59410]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Verificando credenciais...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4 text-[#D4AF37]" />
              <span>Entrar no Sistema</span>
            </>
          )}
        </button>
      </form>

      {/* Rodapé do Formulário: Link para Cadastro */}
      <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Ainda não possui conta de acesso?
        </p>
        <Link
          href="/cadastro"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B365D] hover:text-[#0A1528] dark:text-[#D4AF37] dark:hover:text-[#F3E5AB] transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Solicitar acesso ao sistema</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthSplitShell>
      <Suspense
        fallback={
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B365D] dark:text-[#D4AF37]" />
            <span className="text-xs">Carregando tela de acesso...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthSplitShell>
  );
}
