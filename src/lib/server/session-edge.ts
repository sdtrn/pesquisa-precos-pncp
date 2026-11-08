/**
 * Utilitário de Sessão Edge-Safe HMAC-SHA256
 *
 * Projetado para funcionar tanto no Next.js Edge Runtime (Edge Middleware)
 * quanto no ambiente Node.js de Route Handlers e Server Actions.
 *
 * Utiliza EXCLUSIVAMENTE a Web Crypto API (globalThis.crypto.subtle),
 * TextEncoder, TextDecoder e Uint8Array. Não importa node:crypto nem fs.
 */

export const COOKIE_NAME = "pncp_sessao";
export const DEFAULT_TTL_SECONDS = 7 * 24 * 3600; // 7 dias

export type PerfilUsuario = "admin" | "consulta";

export interface PayloadSessao {
  uid: number;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  exp: number;
}

const FALLBACK_SECRET =
  "pncp_vercel_2026_hmac_sha256_secret_key_independent_9f8e7d6c5b4a3f2e1d0c";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Obtém o segredo efetivo para assinatura e verificação HMAC.
 * Emite aviso de segurança se em produção e nenhuma variável SESSION_SECRET estiver definida.
 */
export function obterSegredoEfetivo(secretOverride?: string): string {
  if (secretOverride) {
    return secretOverride;
  }
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[SECURITY WARNING] SESSION_SECRET não definida em produção; configure SESSION_SECRET nas variáveis de ambiente."
    );
  }
  return FALLBACK_SECRET;
}

/**
 * Converte Uint8Array para string Base64URL (RFC 4648 §5, sem padding)
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Converte string Base64URL para Uint8Array
 */
function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Importa chave HMAC-SHA256 usando Web Crypto API
 */
async function getHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Assina um token de sessão com HMAC-SHA256
 *
 * Formato do token: `${payloadBase64Url}.${assinaturaBase64Url}`
 */
export async function assinarTokenSessao(
  payload: Omit<PayloadSessao, "exp">,
  ttlSegundos?: number,
  secretOverride?: string
): Promise<string> {
  const secret = obterSegredoEfetivo(secretOverride);
  const ttl = ttlSegundos !== undefined ? ttlSegundos : DEFAULT_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttl;

  const payloadCompleto: PayloadSessao = {
    ...payload,
    exp,
  };

  const payloadJson = JSON.stringify(payloadCompleto);
  const payloadB64 = bytesToBase64Url(encoder.encode(payloadJson));

  const key = await getHmacKey(secret);
  const sigBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadB64)
  );

  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuffer));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifica a assinatura e a validade de um token de sessão.
 *
 * Utiliza comparação em tempo constante de bytes para prevenir timing attacks.
 * Retorna o PayloadSessao se válido e não expirado; caso contrário, retorna null.
 */
export async function verificarTokenSessao(
  token?: string | null,
  secretOverride?: string
): Promise<PayloadSessao | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, providedSigB64] = parts;
  if (!payloadB64 || !providedSigB64) {
    return null;
  }

  try {
    const secret = obterSegredoEfetivo(secretOverride);
    const key = await getHmacKey(secret);

    // Calcula assinatura esperada
    const expectedSigBuffer = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payloadB64)
    );
    const expectedSigBytes = new Uint8Array(expectedSigBuffer);

    // Decodifica a assinatura fornecida
    const providedSigBytes = base64UrlToBytes(providedSigB64);

    if (expectedSigBytes.byteLength !== providedSigBytes.byteLength) {
      return null;
    }

    // Comparação em tempo constante para mitigar timing attacks
    let diff = 0;
    for (let i = 0; i < expectedSigBytes.length; i++) {
      diff |= expectedSigBytes[i] ^ providedSigBytes[i];
    }
    if (diff !== 0) {
      return null;
    }

    // Decodifica o payload JSON
    const payloadBytes = base64UrlToBytes(payloadB64);
    const jsonStr = decoder.decode(payloadBytes);
    const payload = JSON.parse(jsonStr) as Partial<PayloadSessao>;

    // Valida a estrutura dos dados
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.uid !== "number" ||
      typeof payload.email !== "string" ||
      typeof payload.nome !== "string" ||
      (payload.perfil !== "admin" && payload.perfil !== "consulta") ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    // Valida expiração
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
      return null;
    }

    return payload as PayloadSessao;
  } catch {
    return null;
  }
}

/**
 * Extrai o valor do cookie de sessão `pncp_sessao` a partir de um cabeçalho HTTP Cookie.
 */
export function extrairTokenDosCookies(cookieHeader?: string | null): string | null {
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return null;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const name = trimmed.slice(0, eqIdx).trim();
    if (name === COOKIE_NAME) {
      const rawValue = trimmed.slice(eqIdx + 1).trim();
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return null;
}
