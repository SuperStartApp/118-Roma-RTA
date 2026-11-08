"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { associazione } from "@/app/lib/associazione";
import { useRouter } from "next/navigation";
import { 
  Play, 
  CheckCircle2, 
  LogOut, 
  MapPin, 
  Clock, 
  AlertCircle, 
  Navigation, 
  Loader2,
  Phone,
  MessageCircle,
  Calendar,
  Wind,
  Stethoscope,
  ShieldCheck,
  RotateCcw
} from "lucide-react";

export default function AutistaDashboard() {
  const [corse, setCorse] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [nomeAutista, setNomeAutista] = useState("");
  const [tesseraAutista, setTesseraAutista] = useState<string | null>(null);
  const [erroreTesseraAutista, setErroreTesseraAutista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // DATA ODIERNA DEFERITA (risolve l'avviso di Next.js)
  const [today, setToday] = useState<string>("");

  // STATI TAB E FILTRI
  const [tabAttivo, setTabAttivo] = useState<"oggi" | "future" | "storico">("oggi");
  const [filtroDataSpecifica, setFiltroDataSpecifica] = useState<string>("");

  const router = useRouter();

  useEffect(() => {
    // Calcoliamo la data odierna sul client
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setToday(`${year}-${month}-${day}`);

    const autistaId = localStorage.getItem("autista_id");
    const nome = localStorage.getItem("autista_nome");

    if (!autistaId) {
      router.push("/autista");
      return;
    }

    setNomeAutista(nome || "Operatore");
    fetchDatiAutista(autistaId);
    fetchMieCorse(autistaId);
  }, [router]);

  async function fetchDatiAutista(id: string) {
    setErroreTesseraAutista(null);
    try {
      const { data, error: metadataError } = await supabase
        .from("autisti")
        .select("numero_tessera, anno_tessera")
        .eq("id", id)
        .single();

      if (metadataError) throw metadataError;
      if (data?.numero_tessera) {
        setTesseraAutista(`${data.numero_tessera}/${data.anno_tessera || ""}`);
      }
    } catch {
      setErroreTesseraAutista("Dati della tessera autista non disponibili.");
    }
  }

  async function fetchMieCorse(id: string) {
    try {
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from("prenotazioni")
        .select(`*, pazienti(*)`)
        .eq("autista_id", id)
        .is("annullata_il", null)
        .order("data_appuntamento", { ascending: true })
        .order("ora_appuntamento", { ascending: true });

      if (dbError) throw dbError;
      setCorse(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Errore fetch corse autista:", err);
      setError(err?.message || "Errore nel caricamento delle corse assegnate.");
    } finally {
      setLoading(false);
    }
  }

  async function registraOra(id: string, tipo: "inizio" | "fine") {
    setActionLoading(id);
    const oraAttuale = new Date().toISOString();
    const colonna = tipo === "inizio" ? "ora_inizio_effettiva" : "ora_fine_effettiva";

    try {
      const autistaId = localStorage.getItem("autista_id");
      if (!autistaId) throw new Error("Accesso autista non disponibile. Rientra con il PIN.");
      const { data, error: dbError } = await supabase
        .from("prenotazioni")
        .update({ [colonna]: oraAttuale })
        .eq("id", id)
        .eq("autista_id", autistaId)
        .is("annullata_il", null)
        .select("id").maybeSingle();

      if (dbError) throw dbError;
      if (!data) throw new Error("La corsa non è più eseguibile o assegnata a te. Aggiorna l’elenco.");

      await fetchMieCorse(autistaId);
    } catch (err: any) {
      alert("Errore registrazione: " + (err?.message || "Riprova tra poco"));
    } finally {
      setActionLoading(null);
    }
  }

  function logout() {
    if (confirm("Sei sicuro di voler effettuare il logout dal turno?")) {
      localStorage.clear();
      router.push("/autista");
    }
  }

  const apriNavigatore = (via?: string, civico?: string, citta?: string) => {
    if (!via && !citta) return;
    const query = encodeURIComponent(`${via || ""} ${civico || ""}, ${citta || ""}`.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  // 1. MESSAGGIO RAPIDO DI ARRIVO
  const inviaWhatsAppArrivo = (corsa: any) => {
    if (!corsa?.pazienti?.telefono) {
      alert("Nessun recapito telefonico memorizzato per questo paziente.");
      return;
    }
    const cleanPhone = corsa.pazienti.telefono.replace(/\D/g, "");
    const numero = cleanPhone.startsWith("39") ? cleanPhone : `39${cleanPhone}`;
    const msg = `Buongiorno ${corsa.pazienti.nome}, sono l'autista dell'ambulanza. Ti avviso che siamo in arrivo per il tuo trasporto sanitario.`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // 2. INVIA TESSERA SOCIO SOSTENITORE (GENERA SE MANCA E MANDA LINK UFFICIALE)
  const inviaTesseraWhatsApp = async (corsa: any) => {
    if (!corsa?.pazienti?.telefono) {
      alert("Nessun recapito telefonico registrato per questo paziente.");
      return;
    }

    let numTessera = corsa.pazienti.numero_tessera;
    const annoTessera = corsa.pazienti.anno_tessera || new Date().getFullYear();

    // Se il paziente non ha ancora una tessera, la generiamo all'istante
    if (!numTessera) {
      try {
        const { data: prossimoNum, error: rpcErr } = await supabase.rpc("genera_prossima_tessera", {
          tabella: "pazienti",
          offset_iniziale: 500
        });

        if (rpcErr) throw rpcErr;

        const { data: emessa, error: emissioneError } = await supabase
          .from("pazienti")
          .update({
            numero_tessera: prossimoNum,
            anno_tessera: annoTessera,
            data_tesseramento: new Date().toISOString().split("T")[0]
          })
          .eq("id", corsa.pazienti.id)
          .is("numero_tessera", null)
          .select("id, numero_tessera, anno_tessera, data_tesseramento")
          .maybeSingle();

        if (emissioneError) throw emissioneError;
        if (!emessa || emessa.numero_tessera !== prossimoNum) throw new Error("Emissione non confermata. Aggiorna l’elenco prima di riprovare.");
        numTessera = emessa.numero_tessera;
        setCorse((prev) => prev.map((item) => item.pazienti?.id === emessa.id
          ? { ...item, pazienti: { ...item.pazienti, ...emessa } } : item));
      } catch (e: any) {
        console.error("Errore generazione tessera:", e);
        alert("Tessera non emessa: verifica connessione e permessi, poi aggiorna l’elenco. Nessun messaggio WhatsApp è stato preparato.");
        return;
      }
    }

    const cleanPhone = corsa.pazienti.telefono.replace(/\D/g, "");
    const numero = cleanPhone.startsWith("39") ? cleanPhone : `39${cleanPhone}`;
    const linkTessera = new URL(`/tessera/${encodeURIComponent(corsa.pazienti.id)}`, associazione.urlGestionale).href;

    const msg = 
      `🚑 *TESSERA SOCIO SOSTENITORE*\n\n` +
      `Gentile *${corsa.pazienti.nome} ${corsa.pazienti.cognome}*,\n` +
      `ecco la Sua tessera annuale ufficiale:\n\n` +
      `💳 *Tessera N°:* #${numTessera || "In emissione"}/${annoTessera}\n` +
      `📅 *Validità:* fino al 31/12/${annoTessera}\n\n` +
      `👉 *Apri, salva o stampa la tua tessera digitale:*\n${linkTessera}\n\n` +
      `Grazie di cuore per il vostro prezioso sostegno!`;

    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // DIVISIONE IN CATEGORIE (OGGI, FUTURE, STORICO)
  const corseOggi = today ? corse.filter(c => c.data_appuntamento === today && !c.ora_fine_effettiva) : [];
  const corseFuture = today ? corse.filter(c => c.data_appuntamento > today) : [];
  const corseStorico = today ? corse.filter(c => Boolean(c.ora_fine_effettiva) || c.data_appuntamento < today) : [];

  // APPLICAZIONE FILTRO ATTIVO
  let corseVisualizzate = [];
  if (filtroDataSpecifica) {
    corseVisualizzate = corse.filter(c => c.data_appuntamento === filtroDataSpecifica);
  } else {
    if (tabAttivo === "oggi") corseVisualizzate = corseOggi;
    else if (tabAttivo === "future") corseVisualizzate = corseFuture;
    else corseVisualizzate = corseStorico;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-900 text-white space-y-3">
        <Loader2 className="animate-spin text-blue-400" size={38} />
        <p className="text-sm font-semibold tracking-wide text-slate-300">Caricamento foglio servizio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center space-y-4">
        <AlertCircle size={44} className="text-red-500" />
        <div>
          <p className="text-slate-800 font-bold text-base">Impossibile caricare le corse</p>
          <p className="text-xs text-rose-600 font-mono mt-1 max-w-md mx-auto">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const id = localStorage.getItem("autista_id");
              if (id) fetchMieCorse(id);
              else router.push("/autista");
            }}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-800 transition"
          >
            Ricarica Dati
          </button>
          <button
            onClick={logout}
            className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-300 transition"
          >
            Rifai Login PIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      
      {/* TESTATA OPERATIVA DI BORDO */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-sm">
              {nomeAutista.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">In Servizio</span>
                {tesseraAutista && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                    Socio #{tesseraAutista}
                  </span>
                )}
              </div>
              <h1 className="text-base font-bold text-white leading-tight">
                {nomeAutista}
              </h1>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition"
            title="Fine Turno"
          >
            <LogOut size={15} />
            <span>Esci</span>
          </button>
        </div>
      </header>

      {/* CONTENUTO DASHBOARD */}
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {erroreTesseraAutista && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{erroreTesseraAutista} <button type="button" className="font-semibold underline" onClick={() => { const id = localStorage.getItem("autista_id"); if (id) void fetchDatiAutista(id); }}>Riprova</button></div>}
        
        {/* SELEZIONE TABS (OGGI / FUTURE / STORICO) */}
        <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-3 gap-1">
          <button
            onClick={() => { setTabAttivo("oggi"); setFiltroDataSpecifica(""); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              tabAttivo === "oggi" && !filtroDataSpecifica
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Oggi</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              tabAttivo === "oggi" && !filtroDataSpecifica ? "bg-white text-blue-700" : "bg-slate-200 text-slate-700"
            }`}>
              {corseOggi.length}
            </span>
          </button>

          <button
            onClick={() => { setTabAttivo("future"); setFiltroDataSpecifica(""); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              tabAttivo === "future" && !filtroDataSpecifica
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Future</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              tabAttivo === "future" && !filtroDataSpecifica ? "bg-white text-blue-700" : "bg-slate-200 text-slate-700"
            }`}>
              {corseFuture.length}
            </span>
          </button>

          <button
            onClick={() => { setTabAttivo("storico"); setFiltroDataSpecifica(""); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              tabAttivo === "storico" && !filtroDataSpecifica
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Storico</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              tabAttivo === "storico" && !filtroDataSpecifica ? "bg-white text-blue-700" : "bg-slate-200 text-slate-700"
            }`}>
              {corseStorico.length}
            </span>
          </button>
        </div>

        {/* FILTRO PER DATA RAPIDA */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-semibold shrink-0">
            <Calendar size={16} className="text-blue-600" />
            <span>Filtra Data:</span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <input
              type="date"
              value={filtroDataSpecifica}
              onChange={(e) => setFiltroDataSpecifica(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
            />
            {filtroDataSpecifica && (
              <button
                onClick={() => setFiltroDataSpecifica("")}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0 border border-slate-200"
                title="Azzera filtro data"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* LISTA DELLE MISSIONI */}
        <div className="space-y-4">
          {corseVisualizzate.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center text-slate-500 border border-slate-200 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-slate-800">Nessuna missione trovata</p>
              <p className="text-xs text-slate-400">Nessuna corsa corrisponde alla vista selezionata.</p>
            </div>
          ) : (
            corseVisualizzate.map((corsa) => {
              const haIniziato = Boolean(corsa.ora_inizio_effettiva);
              const haFinito = Boolean(corsa.ora_fine_effettiva);
              const isInCorso = haIniziato && !haFinito;
              const isWorking = actionLoading === corsa.id;
              const haTessera = corsa.pazienti?.numero_tessera;

              return (
                <div
                  key={corsa.id}
                  className={`bg-white rounded-2xl p-5 shadow-sm border transition-all space-y-3.5 ${
                    isInCorso 
                      ? "border-amber-400 ring-2 ring-amber-400/20" 
                      : haFinito 
                      ? "border-slate-200 opacity-80" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  
                  {/* INTESTAZIONE SCHEDA */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {corsa.ora_appuntamento || "--:--"}
                        </span>
                        {isInCorso && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                            In Viaggio
                          </span>
                        )}
                        {haFinito && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            Completata
                          </span>
                        )}
                      </div>
                      
                      <div className="font-bold text-slate-900 text-base mt-1 flex items-center gap-1.5">
                        <span>{corsa.pazienti ? `${corsa.pazienti.nome} ${corsa.pazienti.cognome}` : "Paziente non specificato"}</span>
                      </div>

                      {haTessera && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md mt-1">
                          <ShieldCheck size={11} className="text-amber-600" />
                          SOCIO N° #{corsa.pazienti.numero_tessera}/{corsa.pazienti.anno_tessera || ""}
                        </span>
                      )}
                    </div>

                    <div className="text-right text-xs font-semibold text-slate-500">
                      {corsa.data_appuntamento ? new Date(corsa.data_appuntamento).toLocaleDateString("it-IT") : ""}
                    </div>
                  </div>

                  {/* BADGE DI TRASPORTO (OSSIGENO, MEDICO) */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {corsa.serve_ossigeno && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px]">
                        <Wind size={13} /> Serve Ossigeno
                      </span>
                    )}
                    {corsa.serve_medico && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-purple-50 text-purple-800 border border-purple-200 text-[11px]">
                        <Stethoscope size={13} /> Medico Necessario
                      </span>
                    )}
                  </div>

                  {/* CLINICO E NOTE */}
                  {(corsa.pazienti?.patologia || corsa.note) && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                      {corsa.pazienti?.patologia && (
                        <div className="text-slate-700">
                          <span className="font-bold text-slate-900">Patologia: </span>
                          {corsa.pazienti.patologia}
                        </div>
                      )}
                      {corsa.note && (
                        <div className="text-slate-700">
                          <span className="font-bold text-slate-900">Note: </span>
                          {corsa.note}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ITINERARIO E NAVIGAZIONE 1-TAP GOOGLE MAPS */}
                  <div className="space-y-2 text-xs text-slate-700">
                    {/* Partenza */}
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-blue-700">Ritiro</span>
                            <span className="text-[10px] text-slate-400">
                              {corsa.partenza_piano ? `P.${corsa.partenza_piano}` : "P.Terra"} {corsa.partenza_ascensore ? "• Ascensore" : "• No Ascensore"}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 block text-xs">
                            {corsa.partenza_via ? `${corsa.partenza_via}, ${corsa.partenza_civico || ""}` : "Indirizzo non inserito"}
                          </span>
                          <span className="text-slate-500 block text-[11px]">{corsa.partenza_citta}</span>
                          {corsa.partenza_dettagli_ospedale && (
                            <span className="text-[10px] font-semibold text-blue-800 block mt-0.5">
                              {corsa.partenza_dettagli_ospedale}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => apriNavigatore(corsa.partenza_via, corsa.partenza_civico, corsa.partenza_citta)}
                        className="p-2.5 text-blue-700 bg-blue-100/80 hover:bg-blue-200 rounded-xl shrink-0 transition flex items-center gap-1 font-bold text-xs"
                        title="Avvia Google Maps"
                      >
                        <Navigation size={15} /> Maps
                      </button>
                    </div>

                    {/* Arrivo */}
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-emerald-700">Destinazione</span>
                            <span className="text-[10px] text-slate-400">
                              {corsa.arrivo_piano ? `P.${corsa.arrivo_piano}` : "P.Terra"} {corsa.arrivo_ascensore ? "• Ascensore" : "• No Ascensore"}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 block text-xs">
                            {corsa.arrivo_via ? `${corsa.arrivo_via}, ${corsa.arrivo_civico || ""}` : "Indirizzo non inserito"}
                          </span>
                          <span className="text-slate-500 block text-[11px]">{corsa.arrivo_citta}</span>
                          {corsa.arrivo_dettagli_ospedale && (
                            <span className="text-[10px] font-semibold text-emerald-800 block mt-0.5">
                              {corsa.arrivo_dettagli_ospedale}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => apriNavigatore(corsa.arrivo_via, corsa.arrivo_civico, corsa.arrivo_citta)}
                        className="p-2.5 text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 rounded-xl shrink-0 transition flex items-center gap-1 font-bold text-xs"
                        title="Avvia Google Maps"
                      >
                        <Navigation size={15} /> Maps
                      </button>
                    </div>
                  </div>

                  {/* CONTATTO RAPIDO PAZIENTE + INVIA TESSERA SEPARATA */}
                  {corsa.pazienti?.telefono && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:${corsa.pazienti.telefono}`}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                        >
                          <Phone size={14} className="text-blue-600" /> Chiama
                        </a>
                        <button
                          onClick={() => inviaWhatsAppArrivo(corsa)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs transition"
                        >
                          <MessageCircle size={14} className="text-blue-600" /> Avviso Arrivo
                        </button>
                      </div>

                      {/* PULSANTE TESSERA SOCIO SOSTENITORE */}
                      <button
                        onClick={() => inviaTesseraWhatsApp(corsa)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-sm transition active:scale-[0.98]"
                      >
                        <ShieldCheck size={16} /> 
                        <span>Invia Tessera Socio al Paziente</span>
                      </button>
                    </div>
                  )}

                  {/* PULSANTI OPERATIVI INIZIO / FINE */}
                  <div className="pt-2 border-t border-slate-100">
                    {!haIniziato ? (
                      <button
                        disabled={isWorking}
                        onClick={() => registraOra(corsa.id, "inizio")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                      >
                        {isWorking ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <Play size={18} fill="currentColor" />
                            <span>AVVIA CORSA</span>
                          </>
                        )}
                      </button>
                    ) : !haFinito ? (
                      <button
                        disabled={isWorking}
                        onClick={() => registraOra(corsa.id, "fine")}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] disabled:opacity-50 animate-pulse"
                      >
                        {isWorking ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            <span>TERMINA CORSA</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="w-full bg-slate-100 text-slate-500 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-200">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>Missione conclusa</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
}
