import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Layout comune neutro: navigazione e autenticazione appartengono a (centrale).
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="it"><body className={inter.className + " min-h-screen bg-slate-50 text-slate-900 flex flex-col"}>{children}</body></html>;
}
