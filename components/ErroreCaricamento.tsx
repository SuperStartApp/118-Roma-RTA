"use client";

import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErroreCaricamento({ messaggio, onRiprova }: { messaggio: string; onRiprova: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div role="alert" className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <AlertCircle className="text-rose-700" aria-hidden="true" />
        <h1 className="text-xl font-bold text-slate-900">Caricamento non riuscito</h1>
        <p className="text-sm leading-relaxed text-slate-700">{messaggio} I dati potrebbero essere presenti: riprova prima di procedere.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onRiprova} className="rta-primary-action inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"><RotateCcw size={16} /> Riprova</button>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Torna alla centrale</Link>
        </div>
      </div>
    </div>
  );
}
