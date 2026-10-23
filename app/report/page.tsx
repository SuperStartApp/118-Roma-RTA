"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // <--- Import corretto per Next.js / Turbopack
import { 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  Filter, 
  FileText, 
  Euro, 
  Clock, 
  CheckCircle2, 
  Loader2,
  RotateCcw
} from "lucide-react";

export default function ReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      let query = supabase
        .from("prenotazioni")
        .select(`*, pazienti(nome, cognome), autisti(nome, cognome)`)
        .order("data_appuntamento", { ascending: false });

      if (startDate) query = query.gte("data_appuntamento", startDate);
      if (endDate) query = query.lte("data_appuntamento", endDate);

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setTimeout(() => {
      fetchData();
    }, 0);
  };

  // KPI Economici
  const totaleFatturato = data.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0);
  const corseCompletate = data.filter((c) => Boolean(c.ora_fine_effettiva)).length;

  // 1. EXPORT EXCEL
  const exportToExcel = () => {
    const excelData = data.map((item) => ({
      Data: item.data_appuntamento,
      Orario: item.ora_appuntamento || "",
      Paziente: `${item.pazienti?.nome || ""} ${item.pazienti?.cognome || ""}`.trim(),
      Autista: item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "Non assegnato",
      Costo_Euro: item.costo || 0,
      Pagamento: item.pagato ? "Pagato" : "Da Saldare",
      Metodo: item.metodo_pagamento || "N/D",
      Stato: !item.ora_inizio_effettiva
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

    const tableColumn = ["Data", "Paziente", "Autista", "Stato", "Importo"];
    const tableRows = data.map((item) => [
      item.data_appuntamento || "—",
      `${item.pazienti?.nome || ""} ${item.pazienti?.cognome || ""}`,
      item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "Non assegnato",
      !item.ora_inizio_effettiva ? "In Attesa" : !item.ora_fine_effettiva ? "In Corso" : "Completata",
      `${item.costo || 0} €`,
    ]);

    // Chiamata standard diretta della funzione
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Report_Generale_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // 3. EXPORT TICKET PDF SINGOLO
  const exportSinglePDF = (item: any) => {
    const doc = new jsPDF();

    // Testata Istituzionale
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 24, "F");

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("RICEVUTA DI TRASPORTO SANITARIO ORDINARIO", 14, 15);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Identificativo Servizio: #${(item.id || "").slice(0, 8).toUpperCase()}`, 14, 34);
    doc.text(`Data Emissione: ${new Date().toLocaleDateString("it-IT")}`, 150, 34);

    // Box Paziente
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 40, 182, 30, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("DATI PAZIENTE E ASSEGNAZIONE", 20, 48);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Assistito: ${item.pazienti?.nome || ""} ${item.pazienti?.cognome || ""}`, 20, 56);
    doc.text(`Equipaggio / Autista: ${item.autisti ? `${item.autisti.nome} ${item.autisti.cognome}` : "Non indicato"}`, 20, 63);

    // Dettagli Tratta
    doc.text("DETTAGLI LOGISTICI", 14, 82);
    doc.setFontSize(9);
    doc.text(`Data e Ora Convocazione: ${item.data_appuntamento} alle ore ${item.ora_appuntamento || "--:--"}`, 14, 90);
    doc.text(`Punto di Prelievo: ${item.partenza_via || ""} ${item.partenza_civico || ""}, ${item.partenza_citta || ""}`, 14, 97);
    doc.text(`Destinazione Finale: ${item.arrivo_via || ""} ${item.arrivo_civico || ""}, ${item.arrivo_citta || ""}`, 14, 104);

    // Riepilogo Economico
    doc.roundedRect(14, 116, 182, 26, 2, 2, "FD");
    doc.setFontSize(10);
    doc.text(`Importo Totale Servizio:`, 20, 128);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(`${item.costo || 0} €`, 85, 128);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Stato Pagamento: ${item.pagato ? "SALDATO" : "DA SALDARE"}`, 20, 136);

    doc.save(`Ricevuta_${item.pazienti?.cognome || "Paziente"}_${item.data_appuntamento}.pdf`);
  };

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

        {/* KPI RAPIDI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fatturato Periodo</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totaleFatturato.toFixed(2)} €</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <Euro size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Servizi Filtrati</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{data.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completate con successo</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{corseCompletate}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

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
                onClick={fetchData}
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
                    <span className="font-black text-slate-900 text-base">{item.costo || 0} €</span>
                  </div>

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
            <div className="hidden md:block bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
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
                    const stato = !item.ora_inizio_effettiva
                      ? "In Attesa"
                      : !item.ora_fine_effettiva
                      ? "In Corso"
                      : "Completata";

                    const badgeStyle =
                      stato === "Completata"
                        ? "bg-slate-100 text-slate-700"
                        : stato === "In Corso"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-blue-50 text-blue-700";

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
                            {stato}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {item.costo || 0} €
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