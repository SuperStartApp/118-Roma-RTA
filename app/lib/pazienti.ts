import { supabase } from "./supabase";

export interface PazienteAnagrafica {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  codice_fiscale: string | null;
  residenza: string | null;
  data_nascita?: string | null;
  luogo_nascita?: string | null;
  peso_approssimativo?: string | null;
  patologia: string | null;
  numero_tessera?: number | null;
  anno_tessera?: number | null;
}

export function caricaPazienti() {
  return supabase.from("pazienti").select("*").order("cognome", { ascending: true });
}

export function corrispondeRicercaPaziente(
  paziente: Pick<PazienteAnagrafica, "nome" | "cognome" | "codice_fiscale" | "telefono">,
  search: string,
) {
  const query = search.toLowerCase();
  const nomeCompleto = `${paziente.nome} ${paziente.cognome}`.toLowerCase();
  const cf = (paziente.codice_fiscale || "").toLowerCase();
  const tel = (paziente.telefono || "").toLowerCase();
  return nomeCompleto.includes(query) || cf.includes(query) || tel.includes(query);
}
