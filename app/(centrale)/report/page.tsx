"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import ErroreCaricamento from "@/components/ErroreCaricamento";
import { associazione } from "@/app/lib/associazione";
import { statoPrenotazione, rimborsoPendente, riepilogoEconomico, formattaImporto, costoValido } from "@/app/lib/stato-prenotazione";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // <--- Import corretto per Next.js / Turbopack
import { 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  Filter, 
  FileText, 
  Loader2,
  RotateCcw
} from "lucide-react";

export default function ReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData(dateFilters = { startDate, endDate }) {
    setLoading(true);
    setErroreCaricamento(null);
    try {
      let query = supabase
        .from("prenotazioni")
        .select(`*, pazienti(nome, cognome), autisti(nome, cognome)`)
        .order("data_appuntamento", { ascending: false });

      if (dateFilters.startDate) query = query.gte("data_appuntamento", dateFilters.startDate);
      if (dateFilters.endDate) query = query.lte("data_appuntamento", dateFilters.endDate);

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error(err);
      setErroreCaricamento("Impossibile caricare i report. Verifica la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    void fetchData({ startDate: "", endDate: "" });
  };

  // KPI Economici
  const totali = riepilogoEconomico(data);
  const indicatori = [
    { label: "Valore corse attive", value: totali.valoreAttive },
    { label: "Da incassare (corse attive)", value: totali.daIncassare },
    { label: "Incassi registrati", value: totali.incassiRegistrati },
    { label: "Rimborsi da effettuare", value: totali.rimborsiPendenti },
    { label: "Rimborsi effettuati", value: totali.rimborsiEffettuati },
    { label: "Saldo netto", value: totali.saldoNetto },
  ];
  const corseCompletate = data.filter((c) => !c.annullata_il && Boolean(c.ora_fine_effettiva)).length;

  // 1. EXPORT EXCEL
  const exportToExcel = () => {
    const excelData = data.map((item) => ({
      Data: item.data_appuntamento,
      Orario: item.ora_appuntamento || "",
      Paziente: `${item.pazienti?.nome || ""} ${item.pazienti?.cognome || ""}`.trim(),
      Autista: item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "Non assegnato",
      Costo_Euro: item.costo || 0,
      Incasso_Originale: item.pagato ? "Incassato" : "Non incassato",
      Stato_Prenotazione: statoPrenotazione(item),
      Annullata_Il: item.annullata_il || "",
      Rimborso_Effettuato_Il: item.rimborso_effettuato_il || "",
      Rimborso_Pendente_Euro: rimborsoPendente(item) ? item.costo : 0,
      Rimborso_Effettuato_Euro: item.annullata_il && item.pagato && item.rimborso_effettuato_il ? item.costo : 0,
      Metodo: item.metodo_pagamento || "N/D",
      Stato: item.annullata_il ? "Annullata" : !item.ora_inizio_effettiva
        ? "In Attesa"
        : !item.ora_fine_effettiva
        ? "In Corso"
        : "Completata",
      Durata_Minuti:
        item.ora_inizio_effettiva && item.ora_fine_effettiva
          ? Math.floor(
              (new Date(item.ora_fine_effettiva).getTime() -
                new Date(item.ora_inizio_effettiva).getTime()) /
                60000
            )
          : "—",
      Partenza: `${item.partenza_via || ""} ${item.partenza_civico || ""}, ${item.partenza_citta || ""}`,
      Arrivo: `${item.arrivo_via || ""} ${item.arrivo_civico || ""}, ${item.arrivo_citta || ""}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rendiconto Servizi");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(indicatori.map((i) => ({ Voce: i.label, Euro: i.value }))), "Riepilogo economico");
    XLSX.writeFile(workbook, `Report_Ambulanze_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // 2. EXPORT PDF GENERALE (RISOLTO CON autoTable(doc, ...))
  const exportAllToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Report Rendiconto Servizi Sanitari", 14, 18);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const periodo = startDate && endDate ? `Dal ${startDate} al ${endDate}` : "Tutto lo storico disponibile";
    doc.text(`Periodo di riferimento: ${periodo}  |  Generato il: ${new Date().toLocaleDateString("it-IT")}`, 14, 25);

    indicatori.forEach((i, index) => doc.text(`${i.label}: ${formattaImporto(i.value)}`, 14, 32 + index * 6));
    doc.text("Valori riferiti alla data del servizio, non alla data dei movimenti.", 14, 71);
    const tableColumn = ["Data", "Paziente", "Autista", "Stato prenotazione", "Costo originale", "Rimborso"];
    const tableRows = data.map((item) => [
      item.data_appuntamento || "—",
      `${item.pazienti?.nome || ""} ${item.pazienti?.cognome || ""}`,
      item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "Non assegnato",
      item.annullata_il ? statoPrenotazione(item) : `${statoPrenotazione(item)}\n${!item.ora_inizio_effettiva ? "In attesa" : !item.ora_fine_effettiva ? "In corso" : "Completata"}`,
      formattaImporto(item.costo),
      item.annullata_il && item.pagato ? `${formattaImporto(item.costo)} ${item.rimborso_effettuato_il ? "effettuato" : "da effettuare"}` : "Non previsto",
    ]);

    // Chiamata standard diretta della funzione
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 78,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Report_Generale_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // 3. EXPORT TICKET PDF SINGOLO
  const exportSinglePDF = (item: any) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margine = 14;
    const larghezza = doc.internal.pageSize.getWidth() - margine * 2;
    const limitePagina = doc.internal.pageSize.getHeight() - margine;
    let y = margine;

    // Testi a capo e nuove pagine evitano sovrapposizioni con nomi e indirizzi lunghi.
    const scriviTesto = (testo: string, dimensione = 10, grassetto = false) => {
      doc.setFont("helvetica", grassetto ? "bold" : "normal");
      doc.setFontSize(dimensione);
      doc.setTextColor(15, 23, 42);
      const righe: string[] = doc.splitTextToSize(testo, larghezza);
      const altezzaRiga = dimensione * 0.3528 * 1.4;
      for (const riga of righe) {
        if (y + altezzaRiga > limitePagina) {
          doc.addPage();
          y = margine;
        }
        doc.text(riga, margine, y);
        y += altezzaRiga;
      }
      y += 2;
    };

    scriviTesto(associazione.denominazione, 18, true);
    scriviTesto(associazione.denominazioneCompleta, 9, true);
    scriviTesto(associazione.distaccamento, 9, true);
    scriviTesto(associazione.indirizzo, 9);
    scriviTesto(`Tel. ${associazione.telefono} | Cell. ${associazione.cellulare} | ${associazione.email}`, 9);
    scriviTesto(`C.F. ${associazione.codiceFiscale} | P. IVA ${associazione.partitaIva}`, 9);
    scriviTesto(associazione.iscrizioni.join(" | "), 8);
    y += 3;

    scriviTesto("RICEVUTA DI TRASPORTO SANITARIO ORDINARIO", 12, true);
    scriviTesto(`Identificativo Servizio: #${(item.id || "").slice(0, 8).toUpperCase()}`, 9);
    scriviTesto(`Data Emissione: ${new Date().toLocaleDateString("it-IT")}`, 9);
    y += 3;

    scriviTesto("DATI PAZIENTE E ASSEGNAZIONE", 10, true);
    scriviTesto(`Assistito: ${item.pazienti?.nome || ""} ${item.pazienti?.cognome || ""}`);
    scriviTesto(`Equipaggio / Autista: ${item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "Non indicato"}`);
    y += 3;

    scriviTesto("DETTAGLI LOGISTICI", 10, true);
    scriviTesto(`Data e Ora Convocazione: ${item.data_appuntamento || "Non indicata"} alle ore ${item.ora_appuntamento || "--:--"}`, 9);
    scriviTesto(`Punto di Prelievo: ${item.partenza_via || ""} ${item.partenza_civico || ""}, ${item.partenza_citta || ""}`, 9);
    scriviTesto(`Destinazione Finale: ${item.arrivo_via || ""} ${item.arrivo_civico || ""}, ${item.arrivo_citta || ""}`, 9);
    y += 3;

    scriviTesto("RIEPILOGO ECONOMICO", 10, true);
    scriviTesto(`Costo originale del servizio: ${formattaImporto(item.costo)}`, 12, true);
    scriviTesto(`Stato prenotazione: ${statoPrenotazione(item)}`, 9);
    scriviTesto(`Incasso originale: ${item.pagato ? "RICEVUTO" : "NON RICEVUTO"}`, 9);
    if (item.annullata_il) {
      scriviTesto(`Annullata il: ${new Date(item.annullata_il).toLocaleString("it-IT")}`, 9);
      if (item.pagato) scriviTesto(`Rimborso integrale: ${formattaImporto(item.costo)} - ${item.rimborso_effettuato_il ? "effettuato" : "da effettuare"}`, 9);
      if (item.rimborso_effettuato_il) scriviTesto(`Denaro restituito il: ${new Date(item.rimborso_effettuato_il).toLocaleString("it-IT")}`, 9);
    }
    if (item.metodo_pagamento) {
      scriviTesto(`Metodo di pagamento: ${item.metodo_pagamento}`, 9);
    }
    if (item.ore_incluse !== null && item.ore_incluse !== undefined && item.ore_incluse !== "") {
      scriviTesto(`Ore incluse: ${item.ore_incluse}`, 9);
    }
    if (item.costo_ora_supplementare !== null && item.costo_ora_supplementare !== undefined && item.costo_ora_supplementare !== "") {
      scriviTesto(`Costo ora supplementare: ${item.costo_ora_supplementare} €`, 9);
    }

    doc.save(`Ricevuta_${item.pazienti?.cognome || "Paziente"}_${item.data_appuntamento}.pdf`);
  };

  if (erroreCaricamento && !loading) return <ErroreCaricamento messaggio={erroreCaricamento} onRiprova={() => void fetchData()} />;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* INTESTAZIONE E AZIONI EXPORT */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <FileSpreadsheet size={14} /> Rendiconto Contabile
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Report & Esportazioni
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              disabled={data.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm disabled:opacity-50"
            >
              <Download size={15} />
              <span>Esporta Excel</span>
            </button>
            <button
              onClick={exportAllToPDF}
              disabled={data.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm disabled:opacity-50"
            >
              <FileText size={15} />
              <span>Esporta PDF</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600">Valori riferiti ai servizi del periodo selezionato, non alla data di incasso o rimborso. Gli incassi registrati comprendono gli anticipi delle corse annullate.</p>
        {data.some((p) => !costoValido(p.costo)) && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Sono presenti importi mancanti o non validi, esclusi dai totali. Verificare i dati originali.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {indicatori.map((i) => (
            <div key={i.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-600">{i.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formattaImporto(i.value)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">Servizi selezionati: {data.length} | Annullati: {data.filter((c) => !!c.annullata_il).length} | Completati non annullati: {corseCompletate}</p>

        {/* FILTRI */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Filter size={13} /> Seleziona Arco Temporale
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Da data:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            <div className="flex-1 relative">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">A data:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            <div className="flex gap-2 sm:self-end">
              <button
                onClick={() => void fetchData()}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Filtra Risultati
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={resetFilters}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                  title="Resetta date"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABELLA / CARD */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-400">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            Nessun servizio trovato nel periodo selezionato.
          </div>
        ) : (
          <>
            {/* SCHEDE MOBILE */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {data.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2.5"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold text-slate-400">
                        {item.data_appuntamento ? new Date(item.data_appuntamento).toLocaleDateString("it-IT") : ""}
                      </span>
                      <h2 className="font-bold text-slate-900 text-base">
                        {item.pazienti?.nome} {item.pazienti?.cognome}
                      </h2>
                    </div>
                    <span className="font-black text-slate-900 text-base">{formattaImporto(item.costo)}</span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700">{statoPrenotazione(item)}</p>
                  <div className="text-xs text-slate-600 flex justify-between items-center pt-2 border-t border-slate-100">
                    <span>Autista: {item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "N/D"}</span>
                    <button
                      onClick={() => exportSinglePDF(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition"
                    >
                      <Download size={12} /> Ricevuta PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* TABELLA DESKTOP */}
            <div className="hidden md:block bg-white shadow-sm rounded-xl overflow-x-auto border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-semibold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Paziente</th>
                    <th className="py-3 px-4">Equipaggio</th>
                    <th className="py-3 px-4 text-center">Stato</th>
                    <th className="py-3 px-4 text-right">Importo</th>
                    <th className="py-3 px-4 text-center">Ricevuta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.map((item) => {
                    const stato = item.annullata_il ? "Annullata" : !item.ora_inizio_effettiva
                      ? "In Attesa"
                      : !item.ora_fine_effettiva
                      ? "In Corso"
                      : "Completata";

                    const badgeStyle = rimborsoPendente(item)
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : item.annullata_il ? "bg-slate-100 text-slate-700"
                      : item.pagato ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {item.data_appuntamento
                            ? new Date(item.data_appuntamento).toLocaleDateString("it-IT")
                            : "—"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.pazienti?.nome} {item.pazienti?.cognome}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeStyle}`}>
                            {statoPrenotazione(item)}
                          </span>
                          {!item.annullata_il && <span className="mt-1 block text-xs text-slate-500">{stato}</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formattaImporto(item.costo)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => exportSinglePDF(item)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition"
                            title="Scarica Ricevuta PDF"
                          >
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
