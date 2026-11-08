export interface DatiEconomiciPrenotazione {
  costo: number | string | null;
  pagato: boolean;
  annullata_il: string | null;
  rimborso_effettuato_il: string | null;
}

export function statoPrenotazione(p: DatiEconomiciPrenotazione) {
  if (!p.annullata_il) return p.pagato ? "Attiva — Incassata" : "Attiva — Da incassare";
  if (!p.pagato) return "Annullata — Nessun rimborso";
  return p.rimborso_effettuato_il ? "Annullata — Rimborsata" : "Annullata — Rimborso da effettuare";
}

export function rimborsoPendente(p: DatiEconomiciPrenotazione) {
  return !!p.annullata_il && p.pagato === true && !p.rimborso_effettuato_il;
}

export function costoValido(costo: DatiEconomiciPrenotazione["costo"]) {
  return costo !== null && costo !== "" && Number.isFinite(Number(costo)) && Number(costo) >= 0;
}

export function formattaImporto(costo: DatiEconomiciPrenotazione["costo"]) {
  return costoValido(costo)
    ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(costo))
    : "Importo non disponibile";
}

export function riepilogoEconomico(prenotazioni: DatiEconomiciPrenotazione[]) {
  const totali = { valoreAttive: 0, daIncassare: 0, incassiRegistrati: 0, rimborsiPendenti: 0, rimborsiEffettuati: 0 };
  for (const p of prenotazioni) {
    // Somme in centesimi: nessun calcolo di tariffe o ore effettive.
    const centesimi = costoValido(p.costo) ? Math.round(Number(p.costo) * 100) : 0;
    if (!p.annullata_il) {
      totali.valoreAttive += centesimi;
      if (p.pagato === false) totali.daIncassare += centesimi;
    }
    if (p.pagato === true) totali.incassiRegistrati += centesimi;
    if (rimborsoPendente(p)) totali.rimborsiPendenti += centesimi;
    if (p.annullata_il && p.pagato === true && p.rimborso_effettuato_il) totali.rimborsiEffettuati += centesimi;
  }
  return {
    valoreAttive: totali.valoreAttive / 100,
    daIncassare: totali.daIncassare / 100,
    incassiRegistrati: totali.incassiRegistrati / 100,
    rimborsiPendenti: totali.rimborsiPendenti / 100,
    rimborsiEffettuati: totali.rimborsiEffettuati / 100,
    saldoNetto: (totali.incassiRegistrati - totali.rimborsiEffettuati) / 100,
  };
}
