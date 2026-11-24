import { numeroWhatsApp } from "./whatsapp";
import { verificaLinkTesseraPubblica } from "./link-tessera";
import { richiediIdPaziente } from "./id-paziente";

type Dipendenze = {
  creaLink: (id: string) => Promise<{ link?: string }>;
  apriFinestra: () => Window | null;
};

export async function apriTesseraWhatsApp(id: string, telefono: string, deps: Dipendenze) {
  const pazienteId = richiediIdPaziente(id);
  const numero = numeroWhatsApp(telefono);
  if (!numero) throw new Error("Numero WhatsApp non valido. Correggi il recapito nella scheda paziente.");
  return apriWhatsAppConLink(numero, deps.apriFinestra, async () => {
    const risultato = await deps.creaLink(pazienteId);
    return "ROMA R.T.A. - La tua tessera associativa: " + verificaLinkTesseraPubblica(risultato.link);
  });
}

export async function apriWhatsAppConLink(numero: string, apriFinestra: () => Window | null, preparaTesto: () => Promise<string>) {
  let finestra: Window | null = null;
  // Eseguito nel click, prima di qualsiasi await. Nessun token nella pagina vuota.
  try {
    finestra = apriFinestra();
    if (finestra) finestra.opener = null;
  } catch { finestra?.close(); finestra = null; }
  try {
    const testo = await preparaTesto();
    const url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(testo);
    let aperto = false;
    if (finestra && !finestra.closed) {
      try { finestra.location.replace(url); aperto = true; }
      catch { finestra.close(); }
    }
    return { url, aperto };
  } catch (error) {
    finestra?.close();
    throw error;
  }
}
