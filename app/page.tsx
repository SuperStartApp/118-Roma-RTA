import Link from "next/link";
import { 
  PlusCircle, 
  CalendarDays, 
  Users, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Ambulance, 
  ShieldCheck,
  ClipboardList
} from "lucide-react";

export default function HomePage() {
  const cards = [
    {
      href: "/prenotazione",
      title: "Nuova Prenotazione",
      description: "Inserisci i dati del paziente, gli indirizzi di prelievo e assegna l'equipaggio.",
      icon: PlusCircle,
      badge: "Accettazione",
      iconColor: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      href: "/agenda",
      title: "Agenda di Oggi",
      description: "Consulta i servizi programmati per il turno odierno e monitora gli orari.",
      icon: CalendarDays,
      badge: "Turno Giornaliero",
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      href: "/prenotazioni",
      title: "Archivio Corse",
      description: "Elenco generale di tutti i trasporti con filtri per autista, data e stato pagamenti.",
      icon: ClipboardList,
      badge: "Database Servizi",
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
      href: "/autisti",
      title: "Gestione Personale",
      description: "Anagrafica autisti e soccorritori, recapiti telefonici e PIN operativi di bordo.",
      icon: Users,
      badge: "Staff & Risorse",
      iconColor: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      href: "/report",
      title: "Reportistica & Export",
      description: "Esporta i dati contabili in Excel o genera le ricevute di trasporto in formato PDF.",
      icon: FileSpreadsheet,
      badge: "Amministrazione",
      iconColor: "text-slate-700 bg-slate-100 border-slate-200",
    },
    {
      href: "/autista",
      title: "Area Terminale Autista",
      description: "Accesso rapido con codice PIN per il personale in servizio sull'ambulanza.",
      icon: Ambulance,
      badge: "Personale Viaggiante",
      iconColor: "text-rose-600 bg-rose-50 border-rose-100",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* BANNER DI BENVENUTO / STATUS CENTRALE */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Centrale Operativa Attiva
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Pannello di Controllo <span className="text-blue-400">AmbulancePro</span>
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Gestione centralizzata dei trasporti sanitari ordinari, dialisi, dimissioni ospedaliere e servizi d'urgenza programmata.
            </p>
          </div>

          <div className="flex md:flex-col justify-end gap-2 text-right">
            <Link
              href="/prenotazione"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              <PlusCircle size={16} />
              <span>Nuovo Servizio</span>
            </Link>
          </div>
        </div>

        {/* GRIGLIA FUNZIONALITÀ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${card.iconColor} transition group-hover:scale-105`}>
                      <Icon size={22} strokeWidth={2.2} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                      {card.badge}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center justify-between">
                    <span>{card.title}</span>
                    <ArrowUpRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h2>

                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition">
                  <span>Accedi alla sezione</span>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}