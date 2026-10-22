import Link from 'next/link';
import { PlusCircle, Calendar, Users, FileText } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Card Nuova Prenotazione */}
        <Link href="/prenotazione" className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 text-center border-b-8 border-blue-600">
          <div className="flex justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform">
            <PlusCircle size={60} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Nuova Prenotazione</h2>
          <p className="text-gray-500">Inserisci i dati del paziente e organizza una nuova corsa</p>
        </Link>

        {/* Card Lista Corse / Agenda */}
        <Link href="/prenotazioni" className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 text-center border-b-8 border-green-600">
          <div className="flex justify-center mb-4 text-green-600 group-hover:scale-110 transition-transform">
            <Calendar size={60} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Programmazione</h2>
          <p className="text-gray-500">Visualizza l'agenda, gestisci i pagamenti e gli orari</p>
        </Link>

        {/* Card Gestione Staff */}
        <Link href="/autisti" className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 text-center border-b-8 border-orange-500">
          <div className="flex justify-center mb-4 text-orange-500 group-hover:scale-110 transition-transform">
            <Users size={60} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Gestione Staff</h2>
          <p className="text-gray-500">Crea nuovi autisti e gestisci i loro codici PIN</p>
        </Link>

        {/* Card Report */}
        <Link href="/report" className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 text-center border-b-8 border-purple-600">
          <div className="flex justify-center mb-4 text-purple-600 group-hover:scale-110 transition-transform">
            <FileText size={60} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Report & Export</h2>
          <p className="text-gray-500">Scarica i dati delle corse in formato Excel per la contabilità</p>
        </Link>

      </div>
    </div>
  );
}