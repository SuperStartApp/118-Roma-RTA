import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function carica(nome, dipendenze = {}, ambiente = {}) {
  const exports = {};
  const source = readFileSync("app/lib/" + nome + ".ts", "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  vm.runInNewContext(outputText, { exports, require: (id) => dipendenze[id] ?? require(id), File, Uint8Array, ...ambiente });
  return exports;
}

const numerazione = carica("formatta-numero");
const associazione = carica("associazione");
const ricevute = carica("ricevute", {
  "./associazione": associazione,
  "./formatta-numero": numerazione,
  "./stato-prenotazione": carica("stato-prenotazione"),
}, {
  fetch: async (url) => {
    assert.equal(url, "/roma-rta-logo.jpeg");
    return new Response(readFileSync("public/roma-rta-logo.jpeg"));
  },
});

test("I progressivi hanno almeno quattro cifre e i numeri storici restano leggibili", () => {
  assert.equal(numerazione.formattaNumero(500), "0500");
  assert.equal(numerazione.formattaNumero(1), "0001");
  assert.equal(numerazione.formattaNumero("00021"), "0021");
  assert.equal(numerazione.formattaNumero(123456), "123456");
});

test("PDF ricevuta con il logo locale e anteprima distinguibile dal documento emesso", async () => {
  const dati = {
    emittente: associazione.associazione, dettagli: { data_nascita: "1980-03-02", luogo_nascita: "Roma", citta: "Roma", cap: "00133", descrizione: null }, serie: "DIG", intestatario: "Intestatario sintetico",
    codice_fiscale: null, indirizzo: null, causale: "Trasporto infermi",
    importo: 50, metodo_pagamento: "Contanti", data_servizio: "2026-12-31",
  };
  const anteprima = await ricevute.creaPdfRicevuta(dati);
  const pdf = await ricevute.creaPdfRicevuta(dati, { ...dati, numero: 500, anno: 2026, emessa_il: "2026-12-31T12:00:00Z" });
  const bozza = Buffer.from(await anteprima.arrayBuffer()).toString("latin1");
  const emessa = Buffer.from(await pdf.arrayBuffer()).toString("latin1");
  assert.match(bozza, /ANTEPRIMA NON FISCALE - SENZA NUMERO/);
  assert.match(emessa, /^%PDF/);
  assert.match(emessa, /\/DCTDecode/);
  assert.match(emessa, /Intestatario sintetico/);
  assert.match(emessa, /ORGANIZZAZIONE EUROPEA VOLONTARI/);
  assert.match(emessa, /118rta@gmail\.com/);
  assert.match(emessa, /02\/03\/1980/);
  assert.match(emessa, /00133/);
  assert.match(emessa, /Ora: 13:00/);
  assert.match(emessa, /cinquanta euro e zero centesimi/);
  assert.match(emessa, /Firma/);
  assert.match(emessa, /DIG 0500\/2026/);
  assert.doesNotMatch(emessa, /ANTEPRIMA/);
  assert.equal(pdf.name, "Ricevuta-DIG-0500-2026.pdf");
});

test("Importo in lettere con centesimi e gruppi", () => {
  assert.equal(ricevute.importoInLettere(180.21), "centottanta euro e ventuno centesimi");
  assert.equal(ricevute.importoInLettere(1003.01), "milletré euro e uno centesimo");
});
