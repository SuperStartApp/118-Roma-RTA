"use client";
import Link from 'next/link';
import { Home, PlusCircle, List, Calendar } from 'lucide-react';
import { usePathname } from 'next/navigation'; // Importiamo l'utility per leggere l'URL

export default function Navbar() {
  const pathname = usePathname(); // Leggiamo dove si trova l'utente

  // SE l'URL contiene "/autista", non mostrare nulla (ritorna null)
  if (pathname?.startsWith('/autista')) {
    return null;
  }

  return (
    <nav className="bg-blue-700 text-white shadow-md p-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2 font-bold text-xl">
          <span className="text-2xl">🚑</span>
          <span>Ambulance Manager</span>
        </div>
        
        <div className="flex space-x-6">
          <Link href="/" className="flex items-center space-x-1 hover:text-blue-200 transition">
            <Home size={20} /> <span>Home</span>
          </Link>
          <Link href="/prenotazione" className="flex items-center space-x-1 hover:text-blue-200 transition">
            <PlusCircle size={20} /> <span>Nuova Corsa</span>
          </Link>
          <Link href="/prenotazioni" className="flex items-center space-x-1 hover:text-blue-200 transition">
            <List size={20} /> <span>Lista Corse</span>
          </Link>
          <Link href="/agenda" className="flex items-center space-x-1 hover:text-blue-200 transition">
            <Calendar size={20} /> <span>Agenda Oggi</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}