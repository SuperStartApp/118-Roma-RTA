import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";

const sezioni = [
  {
    titolo: "Nuova prenotazione", href: "/prenotazione",
    passi: [
      "Cerca prima il paziente in rubrica oppure scegli Nuovo paziente. Il codice fiscale è facoltativo.",
      "Scegli l’autista oppure assegnalo in seguito. Inserisci data, ora, partenza e destinazione.",
      "Compila costo, eventuali ore incluse e tariffa supplementare. Controlla il riepilogo e conferma.",
    ],
    nota: "Se la corsa non viene salvata dopo la creazione del paziente, riprova nello stesso modulo: l’anagrafica appena creata viene riutilizzata.",
  },
  {
    titolo: "Pazienti e tessere", href: "/pazienti",
    passi: [
      "Cerca per nome, cognome, telefono o codice fiscale. Usa Modifica per aggiornare l’anagrafica.",
      "Per il tesseramento inserisci il numero oppure usa Assegna Prossimo N°. Verifica l’anno e salva la scheda.",
      "Apri Tessera dalla centrale autenticata per stamparla o salvarla in PDF. La condivisione pubblica del collegamento è temporaneamente sospesa.",
    ],
    nota: "Non inviare il collegamento WhatsApp come se fosse pubblico: attualmente richiede l’accesso centrale. La data di emissione appare soltanto se registrata.",
  },
  {
    titolo: "Gestione corse", href: "/prenotazioni",
    passi: [
      "Consulta il turno di oggi, le corse da assegnare oppure Tutte / Archivio.",
      "Cerca il paziente e usa i filtri. Apri Scheda o Dettagli per vedere il servizio completo.",
      "Sulle prenotazioni attive puoi cambiare l’autista. Usa Aggiorna elenco per leggere lo stato più recente.",
    ],
    nota: "Le prenotazioni annullate restano nello storico e non compaiono tra le attività da eseguire.",
  },
  {
    titolo: "Pagamenti, annullamenti e rimborsi", href: "/prenotazioni",
    passi: [
      "Il metodo di pagamento indica come si pagherà. Conferma Pagamento già ricevuto soltanto dopo l’incasso; la centrale può aggiornare lo stato anche da Gestione corse.",
      "Per annullare, scegli Annulla prenotazione e conferma i dati. Una corsa non pagata non richiede rimborso; se era pagata, il rimborso è obbligatorio e integrale.",
      "Restituisci effettivamente tutto l’importo al cliente, poi scegli Registra rimborso e conferma. Usa il filtro Rimborsi da effettuare per i casi ancora aperti.",
    ],
    nota: "La registrazione del rimborso non trasferisce denaro. Non sono previsti rimborsi parziali o penali. L’incasso originale resta nello storico.",
  },
  {
    titolo: "Autisti e accesso", href: "/autisti",
    passi: [
      "La centrale può gestire gli autisti e assegnare le corse dal gestionale.",
      "L’accesso al pannello tramite PIN è temporaneamente sospeso. I PIN esistenti non sono stati modificati.",
      "Per comunicare le corse agli autisti, contattali direttamente. Non inviare il link di accesso come se fosse operativo.",
    ],
    nota: "La conferma dell’incasso dal pannello autista NON è attiva. Gli incassi vengono registrati dalla centrale.",
  },
  {
    titolo: "Report e statistiche", href: "/report",
    passi: [
      "Scegli l’intervallo e premi Filtra Risultati. Azzera filtri ricarica tutto lo storico disponibile.",
      "Leggi separatamente valore delle corse attive, importi da incassare, incassi, rimborsi pendenti, rimborsi effettuati e saldo netto.",
      "Esporta Excel o PDF per il riepilogo, oppure scarica il documento della singola corsa.",
    ],
    nota: "L’intervallo riguarda la data del servizio, non quella dell’incasso o del rimborso. Gli incassi comprendono anche gli anticipi delle corse annullate.",
  },
];

export default function GuidaPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl bg-slate-900 p-5 text-white sm:p-7">
          <BookOpen size={25} className="mb-3 text-blue-300" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Guida rapida ROMA R.T.A.</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Apri una sezione per seguire i passaggi principali. I pulsanti portano direttamente agli strumenti del gestionale.</p>
        </header>
        {sezioni.map((sezione, index) => (
          <details key={sezione.titolo} open={index === 0} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <summary className="cursor-pointer text-base font-bold text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{index + 1}. {sezione.titolo}</summary>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">{sezione.passi.map((passo) => <li key={passo}>{passo}</li>)}</ol>
            <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-relaxed text-blue-950">{sezione.nota}</p>
            <Link href={sezione.href} className="rta-primary-action mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold sm:w-auto">Vai alla sezione <ArrowRight size={16} aria-hidden="true" /></Link>
          </details>
        ))}
      </div>
    </div>
  );
}
