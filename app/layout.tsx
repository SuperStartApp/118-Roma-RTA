"use client";

import React, { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  PlusCircle, 
  ClipboardList, 
  CalendarDays, 
  Ambulance, 
  ShieldAlert 
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

function Navbar() {
  const pathname = usePathname();

  // Nascondi la Navbar se siamo nell'area autista
  if (pathname?.startsWith("/autista")) {
    return null;
  }

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/prenotazioni", label: "Corse", icon: ClipboardList },
    { href: "/prenotazione", label: "Nuova", icon: PlusCircle, highlight: true },
  ];

  return (
    <>
      {/* HEADER SUPERIORE: Pulito, professionale, compatto */}
      <header className="sticky top-0 z-40 w-full bg-slate-900 text-slate-100 border-b border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          
          {/* Logo e Nome */}
          <Link href="/" className="flex items-center space-x-2.5 focus:outline-none">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Ambulance size={18} strokeWidth={2.2} />
            </div>
            <div>
              <span className="font-bold text-base md:text-lg tracking-tight text-white block leading-tight">
                Ambulance<span className="text-blue-400">Pro</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">
                Gestione Servizi
              </span>
            </div>
          </Link>

          {/* MENU DESKTOP (nascosto su smartphone) */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="ml-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition shadow-sm"
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    isActive
                      ? "text-white bg-slate-800"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label === "Nuova" ? "Nuova Corsa" : item.label === "Corse" ? "Lista Corse" : item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Badge Operativo su Mobile */}
          <div className="md:hidden flex items-center gap-1 text-[11px] font-medium bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Centrale
          </div>
        </div>
      </header>

      {/* BOTTOM NAVIGATION BAR PER CELLULARI (fissa in basso stile vera app) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 py-1.5 px-2 flex justify-around items-center backdrop-blur-md bg-opacity-95 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 active:scale-95 transition">
                  <Icon size={22} strokeWidth={2.3} />
                </div>
                <span className="text-[10px] font-semibold text-blue-400 mt-1">
                  Nuova
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-3 rounded-lg transition ${
                isActive ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 flex flex-col`}>
        <Suspense fallback={<div className="h-14 bg-slate-900" />}>
          <Navbar />
        </Suspense>
        
        {/* pb-24 serve per evitare che la barra inferiore copra i contenuti da smartphone */}
        <main className="flex-1 w-full pb-24 md:pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}