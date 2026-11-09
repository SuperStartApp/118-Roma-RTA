import { associazione } from "./associazione";

export function tokenPubblicoValido(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function creaLinkTesseraPubblica(token: string): string {
  if (!tokenPubblicoValido(token)) throw new Error("Token tessera non valido.");
  return new URL("/tessera-pubblica#" + token, associazione.urlGestionale).href;
}

// Fallisce chiuso anche con un backend vecchio che restituisce /tessera/<id>.
export function verificaLinkTesseraPubblica(value: unknown): string {
  if (typeof value !== "string") throw new Error("Link pubblico non disponibile.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Link pubblico non valido."); }
  if (!tokenPubblicoValido(url.hash.slice(1)) || value !== creaLinkTesseraPubblica(url.hash.slice(1))) {
    throw new Error("Collegamento non pubblico: aggiorna il gestionale e riprova.");
  }
  return value;
}
