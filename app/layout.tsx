"use client"; // Rendiamo tutto client-side per evitare ogni errore di rendering
import React, { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, List, Calendar } from 'lucide-react';

const inter = Inter({ subsets: ["latin"] });

// COMPONENTE NAVBAR (Integrato qui dentro per eliminare l'errore di import)
function Navbar() {
  const pathname = usePathname();

  // Nascondi la Navbar se siamo nell'area autista
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

// LAYOUT PRINCIPALE
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={inter.className}>
        <Suspense fallback={<div className="h-16 bg-blue-700" />}>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}