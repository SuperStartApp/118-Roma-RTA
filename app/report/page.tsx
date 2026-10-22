"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Download, FileSpreadsheet, Calendar, Filter, FileText } from 'lucide-react';

export default function ReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      let query = supabase
        .from('prenotazioni')
        .select(`*, pazienti(nome, cognome), autisti(nome, cognome)`)
        .order('data_appuntamento', { ascending: false });

      if (startDate) query = query.gte('data_appuntamento', startDate);
      if (endDate) query = query.lte('data_appuntamento', endDate);

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 1. EXPORT EXCEL
  const exportToExcel = () => {
    const excelData = data.map(item => ({
      Data: item.data_appuntamento,
      Paziente: `${item.pazienti?.nome} ${item.pazienti?.cognome}`,
      Autista: `${item.autisti?.nome} ${item.autisti?.cognome}`,
      Costo: item.costo,
      Stato: !item.ora_inizio_effettiva ? 'In Attesa' : (!item.ora_fine_effettiva ? 'In Corso' : 'Completata'),
      Durata: item.ora_inizio_effettiva && item.ora_fine_effettiva ? 
              `${Math.floor((new Date(item.ora_fine_effettiva).getTime() - new Date(item.ora_inizio_effettiva).getTime()) / 60000)} min` : '---'
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `Report_Ambulanze.xlsx`);
  };

  // 2. EXPORT PDF TOTALE
  const exportAllToPDF = () => {
    const doc = new jsPDF();
    doc.text("Report Generale Trasporti Sanitari", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periodo: ${startDate || 'Tutti'} - ${endDate || 'Tutti'}`, 14, 22);

    const tableColumn = ["Data", "Paziente", "Autista", "Costo", "Stato"];
    const tableRows = data.map(item => [
      item.data_appuntamento,
      `${item.pazienti?.nome} ${item.pazienti?.cognome}`,
      `${item.autisti?.nome} ${item.autisti?.cognome}`,
      `${item.costo}€`,
      !item.ora_inizio_effettiva ? 'In Attesa' : (!item.ora_fine_effettiva ? 'In Corso' : 'Completata')
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });

    doc.save(`Report_Totale_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // 3. EXPORT PDF SINGOLO (TICKET)
  const exportSinglePDF = (item: any) => {
    const doc = new jsPDF();
    
    // Design del Ticket
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 255);
    doc.text("RICEVUTA DI TRASPORTO SANITARIO", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Data Corsa: ${item.data_appuntamento}`, 14, 35);
    doc.text(`Paziente: ${item.pazienti?.nome} ${item.pazienti?.cognome}`, 14, 42);
    doc.text(`Autista: ${item.autisti?.nome} ${item.autisti?.cognome}`, 14, 49);
    
    doc.line(14, 55, 196, 55); // Linea separatrice

    doc.text("DETTAGLI LOGISTICI", 14, 65);
    doc.setFontSize(10);
    doc.text(`Partenza: ${item.partenza_via}, ${item.partenza_citta}`, 14, 72);
    doc.text(`Arrivo: ${item.arrivo_via}, ${item.arrivo_citta}`, 14, 79);
    
    doc.setFontSize(12);
    doc.text("TEMPI E COSTI", 14, 95);
    doc.text(`Inizio: ${item.ora_inizio_effettiva ? new Date(item.ora_inizio_effettiva).toLocaleTimeString() : '---'}`, 14, 102);
    doc.text(`Fine: ${item.ora_fine_effettiva ? new Date(item.ora_fine_effettiva).toLocaleTimeString() : '---'}`, 14, 109);
    doc.text(`Costo Totale: ${item.costo} €`, 14, 116);
    
    doc.setFontSize(10);
    doc.text(`Stato: ${!item.ora_inizio_effettiva ? 'In Attesa' : (!item.ora_fine_effettiva ? 'In Corso' : 'Completata')}`, 14, 123);

    doc.save(`Ticket_${item.pazienti?.cognome}_${item.data_appuntamento}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <FileSpreadsheet size={32} className="text-purple-600" /> Report Aziendali
          </h1>
          <div className="flex gap-3">
            <button onClick={exportToExcel} disabled={data.length === 0} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition disabled:bg-gray-400">
              <Download size={18} /> Excel
            </button>
            <button onClick={exportAllToPDF} disabled={data.length === 0} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition disabled:bg-gray-400">
              <FileText size={18} /> PDF Totale
            </button>
          </div>
        </div>

        {/* FILTRI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600 flex items-center gap-1"><Calendar size={14} /> Dal:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600 flex items-center gap-1"><Calendar size={14} /> Al:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <button onClick={fetchData} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition flex items-center gap-2">
            <Filter size={18} /> Applica
          </button>
        </div>

        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Paziente</th>
                <th className="p-4">Autista</th>
                <th className="p-4 text-center">Stato</th>
                <th className="p-4 text-center">Costo</th>
                <th className="p-4 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center">Caricamento...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-500">Nessuna corsa trovata.</td></tr>
              ) : (
                data.map((item, idx) => {
                  const stato = !item.ora_inizio_effettiva ? 'In Attesa' : (!item.ora_fine_effettiva ? 'In Corso' : 'Completata');
                  const badgeColor = stato === 'Completata' ? 'bg-green-100 text-green-700' : (stato === 'In Corso' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600');
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition text-sm">
                      <td className="p-4">{new Date(item.data_appuntamento).toLocaleDateString('it-IT')}</td>
                      <td className="p-4 font-medium">{item.pazienti?.nome} {item.pazienti?.cognome}</td>
                      <td className="p-4">{item.autisti?.nome} {item.autisti?.cognome}</td>
                      <td className="p-4 text-center">
                        <span className={`${badgeColor} px-3 py-1 rounded-full text-xs font-bold`}>{stato}</span>
                      </td>
                      <td className="p-4 text-center font-bold">{item.costo} €</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => exportSinglePDF(item)} 
                          className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition"
                          title="Scarica Ticket PDF"
                        >
                          <FileText size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}