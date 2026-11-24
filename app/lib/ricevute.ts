import { associazione } from "./associazione";
import { formattaNumero } from "./formatta-numero";
import { formattaImporto } from "./stato-prenotazione";

type CampoEmittente =
  "denominazione" | "denominazioneCompleta" | "distaccamento" | "indirizzo" |
  "telefono" | "cellulare" | "email" | "codiceFiscale" | "partitaIva";
export type EmittenteRicevuta = Record<CampoEmittente, string> & { iscrizioni: readonly string[] };

export const causaliRicevuta = [
  "Manifestazione sociale", "Trasporto infermi", "Donazione", "Assistenza domiciliare",
  "Trasporto dializzati - disabili", "Altro",
] as const;

export type DettagliRicevuta = {
  data_nascita: string | null;
  luogo_nascita: string | null;
  citta: string | null;
  cap: string | null;
  descrizione: string | null;
};

export type DatiRicevuta = {
  serie: string;
  intestatario: string;
  codice_fiscale: string | null;
  indirizzo: string | null;
  causale: string;
  importo: number;
  metodo_pagamento: string | null;
  data_servizio: string;
  emittente: EmittenteRicevuta;
  dettagli: DettagliRicevuta;
};

export type Ricevuta = DatiRicevuta & {
  id: string;
  prenotazione_id: string;
  anno: number;
  numero: number;
  emessa_il: string;
};

export function identificativoRicevuta(ricevuta: Ricevuta) {
  return [ricevuta.serie, `${formattaNumero(ricevuta.numero)}/${ricevuta.anno}`].filter(Boolean).join(" ");
}

const finoA19 = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove",
  "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const decine = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
const gruppi = [
  [1_000_000_000, "un miliardo", " miliardi", " "],
  [1_000_000, "un milione", " milioni", " "],
  [1_000, "mille", "mila", ""],
] as const;

function numeroInLettere(n: number): string {
  for (const [base, singolare, plurale, separatore] of gruppi) {
    if (n < base) continue;
    const quoziente = Math.floor(n / base);
    const resto = n % base;
    const prefisso = quoziente === 1 ? singolare : numeroInLettere(quoziente) + plurale;
    if (!resto) return prefisso;
    return prefisso + separatore + (resto === 3 && !separatore ? "tré" : numeroInLettere(resto));
  }
  if (n < 20) return finoA19[n];
  if (n < 100) {
    const unita = n % 10;
    const decina = decine[Math.floor(n / 10)];
    return (unita === 1 || unita === 8 ? decina.slice(0, -1) : decina)
      + (unita === 3 ? "tré" : unita ? finoA19[unita] : "");
  }
  const resto = n % 100;
  const centinaia = Math.floor(n / 100);
  const cento = resto === 8 || (resto >= 80 && resto < 90) ? "cent" : "cento";
  return (centinaia === 1 ? "" : finoA19[centinaia]) + cento
    + (resto === 3 ? "tré" : resto ? numeroInLettere(resto) : "");
}

export function importoInLettere(importo: number) {
  const centesimi = Math.round(Number(importo) * 100);
  return numeroInLettere(Math.floor(centesimi / 100)) + " euro e "
    + numeroInLettere(centesimi % 100) + (centesimi % 100 === 1 ? " centesimo" : " centesimi");
}

const dataItaliana = (data: string | null) => data ? data.split("-").reverse().join("/") : "—";

export async function creaPdfRicevuta(dati: DatiRicevuta, emessa?: Ricevuta) {
  const [{ default: jsPDF }, logo] = await Promise.all([import("jspdf"), fetch(associazione.logoRta)]);
  if (!logo.ok) throw new Error("Logo ROMA R.T.A. non disponibile. Riprova.");
  const pdf = new jsPDF();
  const immagine = new Uint8Array(await logo.arrayBuffer());
  const dimensioni = pdf.getImageProperties(immagine);
  const blu = "#123b77";
  const larghezzaLogo = Math.min(23, 36 * dimensioni.width / dimensioni.height);
  pdf.addImage(immagine, "JPEG", 18, 15, larghezzaLogo, larghezzaLogo * dimensioni.height / dimensioni.width);
  const intestazione = dati.emittente;
  pdf.setTextColor(blu).setDrawColor(blu);
  pdf.setFont("helvetica", "bold").setFontSize(18).text(intestazione.denominazione, 47, 21);
  pdf.setFont("helvetica", "normal").setFontSize(9);
  let y = 27;
  for (const riga of [
    intestazione.denominazioneCompleta, intestazione.distaccamento, intestazione.indirizzo,
    `Tel. ${intestazione.telefono} - Cell. ${intestazione.cellulare}`,
    `E-mail: ${intestazione.email}`,
    `Cod. Fisc. ${intestazione.codiceFiscale} - P. IVA ${intestazione.partitaIva}`,
    intestazione.iscrizioni.join(" - "),
  ]) {
    const righe: string[] = pdf.splitTextToSize(riga, 145);
    pdf.text(righe, 47, y, { lineHeightFactor: 1.15 });
    y += righe.length * 4;
  }
  pdf.line(18, y + 1, 192, y + 1);
  y += 9;
  pdf.setFont("helvetica", "bold").setFontSize(13);
  pdf.text("Per rimborso spese per il Servizio Sanitario Sociale e Socio Sanitario", 18, y, { maxWidth: 174 });
  y += 13;
  pdf.setFont("helvetica", "normal").setFontSize(10);
  const istante = emessa && new Date(emessa.emessa_il);
  const stato = emessa
    ? `Ricevuta N. ${identificativoRicevuta(emessa)}`
    : "ANTEPRIMA NON FISCALE - SENZA NUMERO" + (dati.serie ? " - Serie " + dati.serie : "");
  pdf.text(stato, 18, y);
  y += 6;
  const data = istante?.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }) ?? "—";
  const ora = istante?.toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }) ?? "—";
  pdf.text(`Data: ${data}     Ora: ${ora}`, 18, y);
  y += 6;

  const { dettagli } = dati;
  const righe = [
    `Ricevuti da: ${dati.intestatario}`,
    `Data di nascita: ${dataItaliana(dettagli.data_nascita)}     Luogo di nascita: ${dettagli.luogo_nascita || "—"}`,
    `Codice fiscale: ${dati.codice_fiscale || "—"}`,
    `Via: ${dati.indirizzo || "—"}`,
    `Città: ${dettagli.citta || "—"}     CAP: ${dettagli.cap || "—"}`,
    `Causale: ${dati.causale}${dati.causale === "Altro" ? " - " + dettagli.descrizione : ""}`,
    `Importo in lettere: ${importoInLettere(dati.importo)}`,
    `Importo totale: ${formattaImporto(dati.importo)}`,
  ];
  y += 5;
  for (const riga of righe) {
    if (!riga) continue;
    const testo: string[] = pdf.splitTextToSize(riga, 174);
    for (const linea of testo) {
      if (y > 275) {
        pdf.addPage();
        pdf.text(stato, 18, 18);
        y = 30;
      }
      pdf.text(linea, 18, y);
      y += 5;
    }
    y += 4;
  }
  if (y > 251) {
    pdf.addPage();
    pdf.text(stato, 18, 18);
    y = 32;
  }
  pdf.text("Firma", 127, y + 7);
  pdf.line(127, y + 21, 192, y + 21);
  const nome = emessa ? `Ricevuta-${identificativoRicevuta(emessa).replace(/[ /]/g, "-")}.pdf` : "Anteprima-ricevuta.pdf";
  return new File([pdf.output("blob")], nome, { type: "application/pdf" });
}
