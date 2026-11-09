"use client";

import React, { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AccessoCentrale, { PulsanteLogout } from "@/components/AccessoCentrale";
import { 
  Home, 
  PlusCircle, 
  ClipboardList, 
  CalendarDays, 
  Ambulance, 
  Users,
  BookOpen
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

function Navbar() {
  const pathname = usePathname();

  // Nascondi la Navbar se siamo nell'area autista
  if (pathname?.startsWith("/autista")) {
    return null;
  }

  const navItems = [
    { href: "/", label: "Centrale operativa", mobileLabel: "Centrale", icon: Home },
    { href: "/agenda", label: "Agenda", mobileLabel: "Agenda", icon: CalendarDays },
    { href: "/prenotazioni", label: "Gestione corse", mobileLabel: "Corse", icon: ClipboardList },
    { href: "/pazienti", label: "Pazienti e tessere", mobileLabel: "Pazienti", icon: Users },
    { href: "/prenotazione", label: "Nuovo trasporto", mobileLabel: "Nuovo", icon: PlusCircle, highlight: true },
    { href: "/guida", label: "Guida", mobileLabel: "Guida", icon: BookOpen },
  ];
  const isActiveRoute = (href: string) => pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  return (
    <>
      {/* HEADER SUPERIORE */}
      <header className="sticky top-0 z-40 w-full bg-slate-900 text-slate-100 border-b border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 lg:h-16 flex items-center justify-between gap-4">
          
          {/* Logo e Nome */}
          <Link href="/" aria-label="Torna alla centrale operativa" title="Torna alla centrale operativa" className="flex shrink-0 items-center space-x-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Ambulance size={18} strokeWidth={2.2} />
            </div>
            <div>
              <span className="font-bold text-base md:text-lg tracking-tight text-white block leading-tight">
                ROMA<span className="text-blue-400">R.T.A.</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">
                Centrale operativa
              </span>
            </div>
          </Link>

          {/* MENU DESKTOP */}
          <nav aria-label="Navigazione principale" className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);
              
              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className="rta-primary-action ml-2 inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold shadow-sm"
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
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 ${
                    isActive
                      ? "text-white bg-slate-800"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <PulsanteLogout />
          {/* Ritorno alla centrale dalle pagine interne su mobile */}
          {pathname !== "/" && (
            <Link href="/" className="xl:hidden inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
              <Home size={15} aria-hidden="true" /> Centrale
            </Link>
          )}
        </div>
      </header>

      {/* BOTTOM BAR MOBILE */}
      <nav aria-label="Navigazione mobile" className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 py-2 px-1 flex justify-around items-center shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.href);

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              >
                <div className="rta-primary-action w-10 h-10 rounded-xl flex items-center justify-center">
                  <Icon size={22} strokeWidth={2.3} />
                </div>
                <span className="text-[10px] font-semibold text-blue-400 mt-1">
                  {item.mobileLabel}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 min-w-0 flex-1 flex-col items-center py-1 px-1 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 ${
                isActive ? "text-blue-300 bg-slate-800 font-semibold" : "text-slate-300 hover:text-white"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span className="text-[11px] mt-0.5">{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

// Il pathname viene letto sotto Suspense, come richiesto da Cache Components.
function ContenutoLayout({ children }: { children: React.ReactNode }) {
  const pubblica = usePathname() === "/tessera-pubblica";
  return pubblica ? <main>{children}</main> : (
    <AccessoCentrale>
      <Navbar />
      <main className="flex-1 w-full pb-24 xl:pb-8">{children}</main>
    </AccessoCentrale>
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
        <Suspense fallback={<div className="p-6 text-center text-sm text-slate-600">Verifica accesso alla centrale…</div>}>
          <ContenutoLayout>{children}</ContenutoLayout>
        </Suspense>
      </body>
    </html>
  );
}
