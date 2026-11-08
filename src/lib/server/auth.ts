/**
 * Camada de Autenticação Server-Side do Sistema de Pesquisa de Preços PNCP
 *
 * Fornece utilitários para extração de metadados da requisição,
 * verificação de sessão ativa com revalidação imediata contra banco de dados,
 * guardas de autorização (RBAC: autenticado / admin) e construção de cookies HttpOnly.
 */

import {
  COOKIE_NAME,
  DEFAULT_TTL_SECONDS,
  extrairTokenDosCookies,
  verificarTokenSessao,
} from "@/lib/server/session-edge";
import { buscarUsuarioPorId, type UsuarioPncp } from "@/lib/server/db";

/**
 * Erro específico de autenticação e autorização HTTP (401 e 403).
 */
export class AuthError extends Error {
  status: 401 | 403;

  constructor(message: string, status: 401 | 403 = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Metadados essenciais extraídos de uma requisição HTTP para auditoria e segurança.
 */
export interface MetadadosRequisicao {
  ip: string;
  userAgent: string;
  originUrl: string;
}

/**
 * Extrai IP real (considerando proxies reversos Vercel/Cloudflare/Nginx),
 * User-Agent (limitado a 250 caracteres para segurança de log) e Origin URL.
 */
export function extrairMetadadosRequisicao(req: Request): MetadadosRequisicao {
  // IP: x-forwarded-for (primeiro IP da cadeia), ou x-real-ip, ou fallback 127.0.0.1
  let ip = "127.0.0.1";
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const primeiroIp = xForwardedFor.split(",")[0]?.trim();
    if (primeiroIp) {
      ip = primeiroIp;
    }
  } else {
    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp?.trim()) {
      ip = xRealIp.trim();
    }
  }

  // User-Agent: fatiado em até 250 caracteres ou "Desconhecido"
  const rawUa = req.headers.get("user-agent");
  const userAgent =
    rawUa && rawUa.trim().length > 0 ? rawUa.trim().slice(0, 250) : "Desconhecido";

  // Origin URL: prioriza APP_URL -> origin -> x-forwarded-proto/host -> req.url
  let originUrl = "";
  if (process.env.APP_URL && process.env.APP_URL.trim().length > 0) {
    originUrl = process.env.APP_URL.trim();
  } else if (req.headers.get("origin")) {
    originUrl = req.headers.get("origin")!.trim();
  } else {
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
      originUrl = `${proto}://${host.trim()}`;
    } else {
      try {
        originUrl = new URL(req.url).origin;
      } catch {
        originUrl = "http://localhost:3000";
      }
    }
  }

  return { ip, userAgent, originUrl };
}

/**
 * Obtém o usuário atualmente autenticado a partir do cookie de sessão.
 *
 * CRÍTICO PARA SEGURANÇA:
 * Mesmo que a assinatura criptográfica do cookie seja válida, o usuário
 * é revalidado no banco de dados. Caso o usuário tenha sido desativado
 * ou excluído pelo administrador, a sessão é imediatamente rejeitada (retorna null).
 */
export async function obterUsuarioLogado(
  req: Request,
  deps?: { buscarPorId?: typeof buscarUsuarioPorId }
): Promise<UsuarioPncp | null> {
  const cookieHeader = req.headers.get("cookie");
  const token = extrairTokenDosCookies(cookieHeader);
  if (!token) {
    return null;
  }

  const payload = await verificarTokenSessao(token);
  if (!payload) {
    return null;
  }

  const buscarFn = deps?.buscarPorId ?? buscarUsuarioPorId;
  const usuario = await buscarFn(payload.uid);

  if (!usuario || !usuario.ativo) {
    return null;
  }

  return usuario;
}

/**
 * Guarda de autenticação para Route Handlers e Server Actions.
 * Garante que a requisição possui uma sessão válida e ativa.
 *
 * @throws {AuthError} 401 caso não autenticado ou inativo
 */
export async function exigirAutenticado(
  req: Request,
  deps?: { buscarPorId?: typeof buscarUsuarioPorId }
): Promise<UsuarioPncp> {
  const usuario = await obterUsuarioLogado(req, deps);
  if (!usuario) {
    throw new AuthError(
      "Sessão expirada ou não autenticada. Faça login para continuar.",
      401
    );
  }
  return usuario;
}

/**
 * Guarda de autorização RBAC para rotas administrativas.
 * Garante que a requisição possui uma sessão válida com perfil "admin".
 *
 * @throws {AuthError} 401 se não autenticado
 * @throws {AuthError} 403 se autenticado, mas com perfil diferente de "admin"
 */
export async function exigirAdmin(
  req: Request,
  deps?: { buscarPorId?: typeof buscarUsuarioPorId }
): Promise<UsuarioPncp> {
  const usuario = await exigirAutenticado(req, deps);
  if (usuario.perfil !== "admin") {
    throw new AuthError(
      "Acesso restrito ao Administrador do sistema.",
      403
    );
  }
  return usuario;
}

/**
 * Constrói o cabeçalho Set-Cookie padrão para persistência segura da sessão.
 * Utiliza HttpOnly e SameSite=Lax para proteção contra XSS e CSRF.
 * Adiciona '; Secure' automaticamente em produção.
 */
export function construirHeaderSetCookieSessao(
  token: string,
  maxAgeSegundos: number = DEFAULT_TTL_SECONDS
): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSegundos}${isProd ? "; Secure" : ""}`;
}

/**
 * Constrói o cabeçalho Set-Cookie para expirar e remover o cookie de sessão imediatamente.
 */
export function construirHeaderLimparCookieSessao(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
