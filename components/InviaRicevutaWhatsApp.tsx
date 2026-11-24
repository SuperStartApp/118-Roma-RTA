"use client";

import { useRef, useState } from "react";
import { associazione } from "@/app/lib/associazione";
import { apriWhatsAppConLink } from "@/app/lib/invio-tessera-whatsapp";
import { tokenPubblicoValido } from "@/app/lib/link-tessera";
import { supabase } from "@/app/lib/supabase";
import { numeroWhatsApp } from "@/app/lib/whatsapp";

export default function InviaRicevutaWhatsApp({ id, telefonoProposto }: { id: string; telefonoProposto?: string | null }) {
  const [aperto, setAperto] = useState(false);
  const [telefono, setTelefono] = useState(telefonoProposto ?? "");
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<{ testo: string; errore: boolean }>();
  const [whatsapp, setWhatsapp] = useState("");
  const operazione = useRef(false);

  async function gestisciLink(azione: "crea" | "revoca") {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Accedi nuovamente alla centrale.");
    const response = await fetch("/api/ricevute/condivisione", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
      body: JSON.stringify({ id, azione }),
    });
    const risultato = await response.json().catch(() => null);
    if (!response.ok || !risultato) throw new Error(risultato?.errore || "Condivisione non disponibile. Riprova.");
    return risultato;
  }

  async function esegui(azione: "crea" | "revoca", numero?: string) {
    if (operazione.current) return;
    operazione.current = true;
    setOccupato(true);
    setEsito(undefined);
    setWhatsapp("");
    try {
      if (azione === "revoca") {
        await gestisciLink("revoca");
        setEsito({ testo: "Collegamento revocato.", errore: false });
      } else if (numero) {
        const risultato = await apriWhatsAppConLink(numero, () => window.open("about:blank", "_blank"), async () => {
          const { token } = await gestisciLink("crea");
          if (!tokenPubblicoValido(token)) throw new Error("Collegamento non disponibile.");
          const locale = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
          const url = new URL("/ricevuta-condivisa#" + token, locale ? window.location.origin : associazione.urlGestionale);
          return "Il tuo documento è disponibile a questo collegamento: " + url.href;
        });
        setWhatsapp(risultato.url);
        setEsito({ testo: risultato.aperto ? "WhatsApp aperto. Verifica il destinatario e premi Invia in WhatsApp." : "Usa Apri WhatsApp per inviare il link già preparato.", errore: false });
      }
    } catch (error) {
      setEsito({ testo: error instanceof Error ? error.message : "Condivisione non disponibile. Riprova.", errore: true });
    } finally {
      operazione.current = false;
      setOccupato(false);
    }
  }

  if (!aperto) return <button type="button" className="text-sm font-semibold text-blue-800 underline" onClick={() => setAperto(true)}>
    Invia ricevuta WhatsApp
  </button>;

  return <form className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" onSubmit={(event) => {
    event.preventDefault();
    const numero = numeroWhatsApp(telefono);
    if (numero) void esegui("crea", numero);
    else setEsito({ testo: "Inserisci un numero WhatsApp valido.", errore: true });
  }}>
    <label className="block font-semibold">
      Numero WhatsApp del destinatario
      <input type="tel" autoComplete="off" required value={telefono} disabled={occupato}
        onChange={(event) => { setTelefono(event.target.value); setWhatsapp(""); setEsito(undefined); }}
        className="mt-1 block w-full max-w-xs rounded-lg border border-slate-300 bg-white p-2" />
    </label>
    {telefonoProposto && <p>Recapito proposto dalla scheda paziente. Verifica che appartenga al destinatario.</p>}
    <p>Il link scade dopo 48 ore. Un nuovo invio sostituisce il link precedente.</p>
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={occupato} className="font-semibold text-blue-800 underline disabled:opacity-50">Prepara invio WhatsApp</button>
      <button type="button" disabled={occupato} onClick={() => void esegui("revoca")} className="text-red-700 underline disabled:opacity-50">Revoca link</button>
      <button type="button" disabled={occupato} onClick={() => { setAperto(false); setWhatsapp(""); setEsito(undefined); }} className="text-slate-600 underline">Chiudi</button>
    </div>
    {esito && <p role={esito.errore ? "alert" : "status"}>{esito.testo}</p>}
    {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">Apri WhatsApp</a>}
  </form>;
}
