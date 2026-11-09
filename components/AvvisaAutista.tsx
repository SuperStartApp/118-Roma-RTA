"use client";
import { avvisoAutistaUrl } from "@/app/lib/whatsapp";
export default function AvvisaAutista({ autistaId, telefono }: { autistaId?: string | null; telefono?: string | null }) {
  const url = autistaId ? avvisoAutistaUrl(telefono) : null;
  if (!url) return null;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-bold text-green-800" title="Prepara un messaggio; accesso autista ancora sospeso">Avvisa autista</a>;
}
