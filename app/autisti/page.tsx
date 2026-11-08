"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { 
  UserPlus, 
  UserX, 
  Phone, 
  Key, 
  Users, 
  Copy, 
  Check, 
  MessageSquare, 
  ExternalLink,
  Loader2,
  Ambulance
} from "lucide-react";

export default function GestioneAutisti() {
  const [autisti, setAutisti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pin, setPin] = useState("");

  // Stati per feedback di copia
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);

  useEffect(() => {
    fetchAutisti();
  }, []);

  async function fetchAutisti() {
    setLoading(true);
    setErroreCaricamento(null);
    try {
      const { data, error } = await supabase
        .from("autisti")
        .select("*")
        .eq("attivo", true)
        .order("cognome", { ascending: true });

      if (error) throw error;
      setAutisti(data || []);
    } catch (err: any) {
      console.error(err);
      setErroreCaricamento("Impossibile caricare gli autisti. Verifica la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function aggiungiAutista(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("autisti").insert([
        { nome: nome.trim(), cognome: cognome.trim(), telefono: telefono.trim(), pin: pin.trim(), attivo: true },
      ]);
      if (error) throw error;

      setNome("");
      setCognome("");
      setTelefono("");
      setPin("");
      await fetchAutisti();
    } catch (error: any) {
      alert("Errore inserimento: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function eliminaAutista(id: string, nomeCompleto: string) {
    if (confirm(`Sei sicuro di voler disattivare l'autista ${nomeCompleto}?`)) {
      const { error } = await supabase
        .from("autisti")
        .update({ attivo: false })
        .eq("id", id);

      if (!error) fetchAutisti();
    }
  }

  // Ottiene l'URL completo del login autisti (es. https://tuo-sito.vercel.app/autista)
  const getAutistaLoginUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/autista`;
    }
    return "/autista";
  };

  // Copia negli appunti il link generico
  const copiaLinkTerminale = async () => {
    setCopiedLink(false);
    try {
      await navigator.clipboard.writeText(getAutistaLoginUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      alert("Impossibile copiare il link. Verifica i permessi del browser oppure usa Apri pannello autista.");
    }
  };

  // Copia il PIN dell'autista
  const copiaPin = (id: string, pinCode: string) => {
    navigator.clipboard.writeText(pinCode);
    setCopiedPinId(id);
    setTimeout(() => setCopiedPinId(null), 2000);
  };

  // Genera e invia il messaggio WhatsApp completo di Credenziali all'autista
  const inviaCredenzialiWhatsApp = (autista: any) => {
    if (!autista.telefono) return;

    let num = autista.telefono.replace(/\D/g, "");
    if (num.length === 10 && !num.startsWith("39")) {
      num = "39" + num;
    }

    const loginUrl = getAutistaLoginUrl();

    const messaggio = 
`🚑 *AMBULANCEPRO - ACCESSO TERMINALE DI BORDO*

Ciao *${autista.nome}*,
ecco le tue credenziali di accesso per visualizzare le corse assegnate e i fogli di viaggio:

🔗 *Link di Accesso:*
${loginUrl}

🔑 *Il tuo PIN personale:* *${autista.pin}*

📌 *Istruzioni:*
1. Clicca sul link dal tuo smartphone
2. Inserisci il tuo PIN personale
3. Visualizzerai gli orari, i pazienti e il pulsante con il navigatore per ogni missione.

_Centrale Operativa Roma R.T.A._`;

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(messaggio)}`, "_blank");
  };

  if (erroreCaricamento && !loading) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => void fetchAutisti()} />;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* INTESTAZIONE PAGINA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <Users size={14} /> Risorse Umane & Equipaggi
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Autisti
            </h1>
          </div>
          <div>
            <span className="px-3 py-1 rounded-md text-xs font-semibold bg-slate-200 text-slate-800">
              {autisti.length} {autisti.length === 1 ? "autista attivo" : "autisti attivi"}
            </span>
          </div>
        </div>

        {/* BOX INFORMATIVO CON LINK TERMINALE CONDIVISIBILE */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <Ambulance size={20} />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-bold text-white">Pannello riservato agli autisti</h2>
              <p className="text-sm text-slate-300">Un unico collegamento, accesso con il PIN personale.</p>
              <p className="text-xs text-blue-200 font-mono break-all">
                {typeof window !== "undefined" ? getAutistaLoginUrl() : "/autista"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={copiaLinkTerminale}
              className="inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span aria-live="polite">{copiedLink ? "Link copiato" : "Copia link"}</span>
            </button>
            <a
              href="/autista"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-white hover:bg-blue-50 text-blue-950 transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              <ExternalLink size={14} />
              <span>Apri pannello autista</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FORM NUOVO AUTISTA (COLONNA SINISTRA) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <UserPlus className="text-blue-600" size={18} />
              <span>Registra Nuovo Autista</span>
            </div>

            <form onSubmit={aggiungiAutista} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome</label>
                <input
                  type="text"
                  placeholder="Es. Mario"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cognome</label>
                <input
                  type="text"
                  placeholder="Es. Rossi"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Recapito Telefonico (per WhatsApp)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="tel"
                    placeholder="Es. 340 1234567"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">PIN di accesso (da 4 a 6 cifre)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || pin.length < 4}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-xs tracking-wide transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Salvataggio...
                  </>
                ) : (
                  <>
                    <UserPlus size={15} /> Salva Operatore
                  </>
                )}
              </button>
            </form>
          </div>

          {/* LISTA AUTISTI (COLONNA DESTRA) */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="flex justify-center items-center py-20 text-slate-400">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
            ) : autisti.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl text-center text-slate-500 border border-slate-200">
                Nessun operatore attivo censito a sistema.
              </div>
            ) : (
              autisti.map((a) => (
                <div
                  key={a.id}
                  className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start sm:items-center space-x-3.5">
                    {/* Badge Iniziali */}
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base tracking-wider uppercase shrink-0">
                      {(a.nome?.[0] || "") + (a.cognome?.[0] || "")}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-base leading-tight">
                        {a.nome} {a.cognome}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                        {a.telefono && (
                          <a
                            href={`tel:${a.telefono}`}
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 transition"
                          >
                            <Phone size={12} className="text-slate-400" />
                            <span>{a.telefono}</span>
                          </a>
                        )}

                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Key size={11} className="text-slate-400" />
                          Accesso con PIN personale
                        </span>
                      </div>
                    </div>
                  </div>
                    <button
                      type="button"
                      onClick={() => eliminaAutista(a.id, `${a.nome} ${a.cognome}`)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                      title="Disattiva operatore"
                    >
                      <UserX size={15} /> Disattiva
                    </button>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-3">
                    <p className="text-xs font-bold text-blue-950">Condividi l’accesso al pannello autista</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {a.telefono && (
                      <button
                        type="button"
                        onClick={() => inviaCredenzialiWhatsApp(a)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-bold transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        title="Invia link e PIN su WhatsApp all'autista"
                      >
                        <MessageSquare size={13} />
                        <span>Invia WhatsApp</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={copiaLinkTerminale}
                      className="inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm font-semibold text-blue-800 hover:bg-blue-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {copiedLink ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                      <span aria-live="polite">{copiedLink ? "Link copiato" : "Copia link"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copiaPin(a.id, a.pin)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      title="Copia il PIN personale senza visualizzarlo"
                    >
                      {copiedPinId === a.id ? <Check size={14} className="text-emerald-700" /> : <Key size={14} />}
                      <span aria-live="polite">{copiedPinId === a.id ? "PIN copiato" : "Copia PIN"}</span>
                    </button>
                    </div>
                    <p className="text-xs text-slate-600">
                      {a.telefono ? "Il messaggio WhatsApp contiene il link di accesso e il PIN personale." : "Telefono non disponibile: usa Copia link e Copia PIN per condividere l’accesso."}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
