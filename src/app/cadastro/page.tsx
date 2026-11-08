"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AuthSplitShell } from "@/components/AuthSplitShell";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ArrowRight,
  LogIn,
} from "lucide-react";

export default function CadastroPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<boolean>(false);
  const [sucessoMsg, setSucessoMsg] = useState<string>("");

  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (erro && alertRef.current) {
      alertRef.current.focus();
    }
  }, [erro]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);

    // Validação client-side de paridade de senhas
    if (senha !== confirmacaoSenha) {
      setErro("As senhas informadas não coincidem. Verifique e tente novamente.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (nome.trim().length < 2) {
      setErro("O nome completo deve conter pelo menos 2 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          senha,
          confirmacaoSenha,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErro(data.error || "Não foi possível processar a solicitação de cadastro.");
        setLoading(false);
        return;
      }

      setSucessoMsg(
        data.message ||
          "Solicitação de acesso registrada com sucesso! Seu cadastro foi recebido e aguarda aprovação pelo administrador."
      );
      setSucesso(true);
    } catch {
      setErro("Falha de conexão com o servidor. Verifique sua rede e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitShell>
      {sucesso ? (
        /* Estado de Sucesso pós-envio */
        <div className="space-y-6 text-center py-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Solicitação Recebida!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {sucessoMsg}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>Próximos passos e validação:</span>
            </p>
            <p>
              Novas contas iniciam com o status <strong className="font-semibold text-slate-900 dark:text-white">Aguardando Aprovação</strong>. O administrador receberá sua solicitação e, assim que liberada, uma notificação de ativação será disparada por e-mail a partir de <strong className="font-mono text-[11px] text-[#1B365D] dark:text-[#D4AF37]">sergiodantastorres@gmail.com</strong>.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Caso não visualize o e-mail em sua caixa de entrada após a liberação, verifique também a pasta de Lixo Eletrônico ou Spam.
            </p>
          </div>

          <Link
            href="/login"
            className="w-full min-h-[44px] cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#1B365D] to-[#112240] hover:from-[#152a4a] hover:to-[#0A1528] dark:from-[#2B4C7E] dark:to-[#1B365D] shadow-md transition-all"
          >
            <span>Ir para a Tela de Login</span>
            <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
          </Link>
        </div>
      ) : (
        /* Formulário de Cadastro */
        <div className="space-y-6">
          <div className="space-y-1.5 text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Solicitar Acesso
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Preencha os dados abaixo para solicitar autorização na plataforma de pesquisa de preços
            </p>
          </div>

          {/* Banner de Aviso de Aprovação Prévia Obrigatória */}
          <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Aprovação Prévia Obrigatória</span>
            </div>
            <p className="leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              Qualquer endereço de e-mail corporativo ou pessoal válido pode ser utilizado. Novas contas são criadas sob o status <strong className="font-semibold text-amber-950 dark:text-white">Aguardando Aprovação</strong> e o e-mail de ativação será enviado por <strong className="font-mono text-[11px] text-amber-950 dark:text-amber-100">sergiodantastorres@gmail.com</strong>.
            </p>
          </div>

          {/* Alerta de Erro Acessível */}
          {erro && (
            <div
              ref={alertRef}
              role="alert"
              aria-live="polite"
              tabIndex={-1}
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{erro}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Nome Completo */}
            <div className="space-y-1.5">
              <label
                htmlFor="nome"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do Auditor ou Requisitante"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                E-mail
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
                  placeholder="seu.email@dominio.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Qualquer domínio institucional ou pessoal válido é aceito.
              </p>
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
                  minLength={6}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {mostrarSenha ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Campo Confirmar Senha */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirmacaoSenha"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirmacaoSenha"
                  name="confirmacaoSenha"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmacaoSenha}
                  onChange={(e) => setConfirmacaoSenha(e.target.value)}
                  placeholder="Repita a senha digitada"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                />
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
                  <span>Enviando solicitação...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  <span>Solicitar Acesso</span>
                </>
              )}
            </button>
          </form>

          {/* Rodapé do Formulário: Retorno para Login */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Já possui conta cadastrada?
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B365D] hover:text-[#0A1528] dark:text-[#D4AF37] dark:hover:text-[#F3E5AB] transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar no sistema</span>
            </Link>
          </div>
        </div>
      )}
    </AuthSplitShell>
  );
}
