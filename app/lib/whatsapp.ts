import { associazione } from "./associazione";

// Validazione sintattica; non certifica la registrazione su WhatsApp.
export function numeroWhatsApp(value?: string | null): string | null {
  if (!value || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  let numero = value.replace(/\D/g, "");
  if (numero.startsWith("00")) numero = numero.slice(2);
  else if (!value.trim().startsWith("+") && /^3\d{9}$/.test(numero)) numero = "39" + numero;
  return /^[1-9]\d{7,14}$/.test(numero) ? numero : null;
}

export function avvisoAutistaUrl(telefono?: string | null): string | null {
  const numero = numeroWhatsApp(telefono);
  if (!numero) return null;
  const link = new URL("/autista", associazione.urlGestionale).href;
  const testo = "ROMA R.T.A. - Avviso dalla centrale. Contatta la centrale per gli aggiornamenti sulle corse assegnate. Area personale autista: " + link + " (accesso attualmente sospeso).";
  return "https://web.whatsapp.com/send?phone=" + numero + "&text=" + encodeURIComponent(testo);
}
