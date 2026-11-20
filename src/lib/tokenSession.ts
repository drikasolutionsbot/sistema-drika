export interface TokenSessionData {
  tenant_id: string;
  tenant_name: string;
  token: string;
}

const STORAGE_KEY = "token_session";
const COOKIE_NAME = "drika_token_session";
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 365 dias

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.substring(name.length + 1));
  } catch {
    return null;
  }
}

function setSessionCookie(serialized: string) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const encoded = encodeURIComponent(serialized);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const host = window.location.hostname;

  // Define no domínio atual
  document.cookie = `${COOKIE_NAME}=${encoded}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;

  // Se estiver em drikahub.com ou subdomínio (ex: www.drikahub.com), compartilha entre ambos
  if (host === "drikahub.com" || host.endsWith(".drikahub.com")) {
    document.cookie = `${COOKIE_NAME}=${encoded}; Domain=.drikahub.com; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  }
}

function clearSessionCookie() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const host = window.location.hostname;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  if (host === "drikahub.com" || host.endsWith(".drikahub.com")) {
    document.cookie = `${COOKIE_NAME}=; Domain=.drikahub.com; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

/**
 * Obtém a sessão persistida do cliente (localStorage + fallback automático via Cookie 365 dias).
 * Se existir no cookie mas não no localStorage (ex.: alternou entre www.drikahub.com e drikahub.com),
 * restaura automaticamente no localStorage.
 */
export function getTokenSession(): TokenSessionData | null {
  if (typeof window === "undefined") return null;

  try {
    const rawLocal = localStorage.getItem(STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && parsed.tenant_id) {
        // Garante que o cookie também esteja sincronizado
        if (!getCookieValue(COOKIE_NAME)) {
          setSessionCookie(rawLocal);
        }
        return parsed as TokenSessionData;
      }
    }
  } catch {
    // fallback para cookie abaixo
  }

  try {
    const rawCookie = getCookieValue(COOKIE_NAME);
    if (rawCookie) {
      const parsed = JSON.parse(rawCookie);
      if (parsed && parsed.tenant_id) {
        const normalized = JSON.stringify({
          tenant_id: parsed.tenant_id,
          tenant_name: parsed.tenant_name || "Loja",
          token: parsed.token || "",
        });
        try {
          localStorage.setItem(STORAGE_KEY, normalized);
        } catch {}
        return parsed as TokenSessionData;
      }
    }
  } catch {}

  return null;
}

export function saveTokenSession(session: TokenSessionData) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify({
    tenant_id: session.tenant_id,
    tenant_name: session.tenant_name || "Loja",
    token: session.token || "",
  });
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {}
  setSessionCookie(serialized);
}

export function clearTokenSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  clearSessionCookie();
}
