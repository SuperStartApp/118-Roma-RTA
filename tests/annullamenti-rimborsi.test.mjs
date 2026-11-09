import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

function compile(source, context = {}) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return vm.runInNewContext(js, context);
}

function load(file, dependencies = {}) {
  const exports = {};
  compile(fs.readFileSync(file, "utf8"), {
    exports,
    require: (name) => {
      assert.ok(name in dependencies, `Dipendenza non simulata: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const stato = load("app/lib/stato-prenotazione.ts");
const operazioni = load("app/lib/operazioni-prenotazioni.ts", { "./stato-prenotazione": stato });

function prenotazione(values = {}) {
  return {
    id: "corsa-demo", costo: 120.50, pagato: false, metodo_pagamento: "Contanti",
    annullata_il: null, rimborso_effettuato_il: null, autista_id: "autista-demo",
    data_appuntamento: "2026-11-08", pazienti: { nome: "Mario", cognome: "Rossi" },
    ...values,
  };
}

// Nessun client reale: le condizioni sono valutate sullo stato corrente al
// momento dell'UPDATE, anche quando due richieste partono dallo stesso snapshot.
function database(initial, options = {}) {
  const rows = structuredClone(initial);
  const writes = [];
  const client = {
    from: () => {
      const conditions = [];
      let patch;
      const matching = () => rows.filter((row) => conditions.every(([key, value]) => row[key] === value));
      const query = {
        update: (values) => { patch = values; return query; },
        eq: (key, value) => { conditions.push([key, value]); return query; },
        is: (key, value) => { conditions.push([key, value]); return query; },
        select: () => query,
        order: () => query,
        delete: () => { throw new Error("DELETE non consentito nei test"); },
        maybeSingle: () => Promise.resolve().then(() => {
          if (options.error) return { data: null, error: { message: "Errore simulato" } };
          if (options.noRows) return { data: null, error: null };
          const found = matching();
          assert.ok(found.length <= 1);
          if (!found.length) return { data: null, error: null };
          if (patch) {
            writes.push(structuredClone(patch));
            Object.assign(found[0], patch);
          }
          return { data: structuredClone(found[0]), error: null };
        }),
        then: (resolve, reject) => Promise.resolve({ data: structuredClone(matching()), error: null }).then(resolve, reject),
      };
      return query;
    },
  };
  return { rows, writes, client };
}

function functionFromPage(file, name, context) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node.getText(source);
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) {
      declaration = `const ${name} = ${node.initializer.getText(source)};`;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration, name);
  return compile(`${declaration}\n${name};`, { Date, console, setErroreCaricamento: () => {}, ...context });
}

test("1. annullamento non pagato: solo timestamp, storico ed economia conservati", async () => {
  const p = prenotazione();
  const db = database([p]);
  const result = await operazioni.annullaPrenotazione(db.client, p);
  assert.ok(result.annullata_il);
  assert.equal(stato.statoPrenotazione(result), "Annullata — Nessun rimborso");
  assert.equal(db.rows.length, 1);
  assert.deepEqual(Object.keys(db.writes[0]), ["annullata_il"]);
  assert.deepEqual(db.rows[0], { ...p, annullata_il: result.annullata_il });
});

test("2. annullamento pagato: rimborso integrale pendente, incasso originale conservato", async () => {
  const p = prenotazione({ pagato: true });
  const db = database([p]);
  const result = await operazioni.annullaPrenotazione(db.client, p);
  assert.equal(stato.statoPrenotazione(result), "Annullata — Rimborso da effettuare");
  assert.equal(result.pagato, true);
  assert.equal(result.costo, p.costo);
  assert.equal(result.metodo_pagamento, p.metodo_pagamento);
  assert.equal(result.rimborso_effettuato_il, null);
});

test("3. rimborso integrale: solo timestamp, costo e pagato invariati", async () => {
  const p = prenotazione({ pagato: true, annullata_il: "2026-11-08T10:00:00Z" });
  const db = database([p]);
  const result = await operazioni.registraRimborso(db.client, p);
  assert.equal(stato.statoPrenotazione(result), "Annullata — Rimborsata");
  assert.deepEqual(Object.keys(db.writes[0]), ["rimborso_effettuato_il"]);
  assert.deepEqual(db.rows[0], { ...p, rimborso_effettuato_il: result.rimborso_effettuato_il });
  assert.equal(stato.riepilogoEconomico(db.rows).rimborsiEffettuati, p.costo);
});

test("4. doppio annullamento concorrente: una sola modifica confermata", async () => {
  const p = prenotazione();
  const db = database([p]);
  const results = await Promise.allSettled([
    operazioni.annullaPrenotazione(db.client, p), operazioni.annullaPrenotazione(db.client, p),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(db.writes.length, 1);
  await assert.rejects(operazioni.annullaPrenotazione(db.client, db.rows[0]));
});

test("5. doppio rimborso concorrente: una sola registrazione", async () => {
  const p = prenotazione({ pagato: true, annullata_il: "2026-11-08T10:00:00Z" });
  const db = database([p]);
  const results = await Promise.allSettled([
    operazioni.registraRimborso(db.client, p), operazioni.registraRimborso(db.client, p),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(db.writes.length, 1);
  await assert.rejects(operazioni.registraRimborso(db.client, db.rows[0]));
});

test("6. pagamento non modificabile dopo annullamento, anche con interfaccia obsoleta", async () => {
  const old = prenotazione({ pagato: true });
  const cancelled = { ...old, annullata_il: "2026-11-08T10:00:00Z" };
  const db = database([cancelled]);
  await assert.rejects(operazioni.cambiaPagamento(db.client, cancelled));
  await assert.rejects(operazioni.cambiaPagamento(db.client, old));
  assert.equal(db.writes.length, 0);
  assert.equal(db.rows[0].pagato, true);
});

test("7. agenda e dashboard autista escludono le corse annullate", async () => {
  const active = prenotazione();
  const cancelled = prenotazione({ id: "annullata", annullata_il: "2026-11-08T10:00:00Z" });
  const other = prenotazione({ id: "altra", autista_id: "altro-autista" });
  const db = database([active, cancelled, other]);
  let agendaRows, driverRows;
  await functionFromPage("app/(centrale)/agenda/page.tsx", "fetchCorseOggi", {
    supabase: db.client, setLoading: () => {}, setCorse: (rows) => { agendaRows = rows; },
  })("2026-11-08");
  await functionFromPage("app/(centrale)/autista/dashboard/page.tsx", "fetchMieCorse", {
    supabase: db.client, setLoading: () => {}, setError: () => {}, setCorse: (rows) => { driverRows = rows; },
  })("autista-demo");
  assert.deepEqual(agendaRows.map((p) => p.id).sort(), ["altra", "corsa-demo"]);
  assert.deepEqual(driverRows.map((p) => p.id), ["corsa-demo"]);
  assert.equal(db.writes.length, 0);
});

test("8. report: sei totali coerenti per i cinque stati", () => {
  const rows = [
    prenotazione({ costo: 100 }), prenotazione({ costo: 200, pagato: true }),
    prenotazione({ costo: 300, annullata_il: "2026-11-08T10:00:00Z" }),
    prenotazione({ costo: 400, pagato: true, annullata_il: "2026-11-08T10:00:00Z" }),
    prenotazione({ costo: 500, pagato: true, annullata_il: "2026-11-08T10:00:00Z", rimborso_effettuato_il: "2026-11-08T11:00:00Z" }),
  ];
  const total = stato.riepilogoEconomico(rows);
  assert.equal(total.valoreAttive, 300);
  assert.equal(total.daIncassare, 100);
  assert.equal(total.incassiRegistrati, 1100);
  assert.equal(total.rimborsiPendenti, 400);
  assert.equal(total.rimborsiEffettuati, 500);
  assert.equal(total.saldoNetto, 600);
  assert.equal(new Set(rows.map(stato.statoPrenotazione)).size, 5);
  assert.equal(stato.riepilogoEconomico([prenotazione({ costo: 0.1 }), prenotazione({ costo: 0.2 })]).valoreAttive, 0.3);
});

test("importo variato dopo la lettura: rimborso rifiutato senza modifiche", async () => {
  const old = prenotazione({ pagato: true, annullata_il: "2026-11-08T10:00:00Z" });
  const db = database([{ ...old, costo: 150 }]);
  await assert.rejects(operazioni.registraRimborso(db.client, old));
  assert.equal(db.writes.length, 0);
  await assert.rejects(operazioni.registraRimborso(db.client, { ...old, costo: null }));
});

test("conferma esplicita rifiutata: nessuna richiesta di modifica", async () => {
  const p = prenotazione();
  const db = database([p]);
  let message;
  const lock = { current: false };
  const confirm = functionFromPage("app/(centrale)/prenotazioni/page.tsx", "confermaOperazione", {
    operationLock: lock, supabase: db.client, ...operazioni, ...stato,
    window: { confirm: (text) => { message = text; return false; } },
    setProcessingId: () => {}, setEsito: () => {},
    setPrenotazioni: () => { throw new Error("Interfaccia modificata senza conferma"); },
  });
  await confirm(p, "annulla");
  assert.ok(message.includes("Mario Rossi"));
  assert.ok(message.includes("08/11/2026"));
  assert.ok(message.includes("120,50"));
  assert.equal(lock.current, false);
  assert.equal(db.writes.length, 0);
});

test("nessuna riga restituita o errore RLS/rete: nessun aggiornamento ottimistico", async () => {
  for (const options of [{ noRows: true }, { error: true }]) {
    const p = prenotazione();
    const db = database([p], options);
    let esito;
    const confirm = functionFromPage("app/(centrale)/prenotazioni/page.tsx", "confermaOperazione", {
      operationLock: { current: false }, supabase: db.client, ...operazioni, ...stato,
      window: { confirm: () => true }, setProcessingId: () => {}, setEsito: (value) => { esito = value; },
      setPrenotazioni: () => { throw new Error("Aggiornamento ottimistico vietato"); },
    });
    await confirm(p, "annulla");
    assert.equal(esito.type, "error");
    assert.equal(db.writes.length, 0);
  }
});

test("rimborso non ammesso senza annullamento o senza pagamento", async () => {
  for (const p of [prenotazione({ pagato: true }), prenotazione({ annullata_il: "2026-11-08T10:00:00Z" })]) {
    const db = database([p]);
    await assert.rejects(operazioni.registraRimborso(db.client, p));
    assert.equal(db.writes.length, 0);
  }
});

test("concorrenza tra pagamento e annullamento: la richiesta obsoleta non modifica la riga", async () => {
  for (const paymentFirst of [true, false]) {
    const p = prenotazione();
    const db = database([p]);
    const requests = paymentFirst
      ? [operazioni.cambiaPagamento(db.client, p), operazioni.annullaPrenotazione(db.client, p)]
      : [operazioni.annullaPrenotazione(db.client, p), operazioni.cambiaPagamento(db.client, p)];
    const results = await Promise.allSettled(requests);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(db.writes.length, 1);
  }
});

test("Excel conserva annullamenti, date e riepilogo separato senza salvare file reali", () => {
  const data = [prenotazione({ pagato: true, annullata_il: "2026-11-08T10:00:00Z", rimborso_effettuato_il: "2026-11-08T11:00:00Z" })];
  let saved;
  const XLSX = {
    utils: {
      json_to_sheet: (rows) => structuredClone(rows),
      book_new: () => ({}),
      book_append_sheet: (book, sheet, name) => { book[name] = sheet; },
    },
    writeFile: (book) => { saved = book; },
  };
  functionFromPage("app/(centrale)/report/page.tsx", "exportToExcel", {
    data, indicatori: [{ label: "Saldo netto", value: 0 }], XLSX, ...stato,
  })();
  const row = saved["Rendiconto Servizi"][0];
  assert.equal(row.Stato_Prenotazione, "Annullata — Rimborsata");
  assert.equal(row.Costo_Euro, 120.5);
  assert.equal(row.Rimborso_Effettuato_Euro, 120.5);
  assert.equal(row.Rimborso_Effettuato_Il, data[0].rimborso_effettuato_il);
  assert.equal(saved["Riepilogo economico"][0].Euro, 0);
});

test("PDF generale e ricevuta espongono rimborso e incasso originale, solo in memoria", () => {
  const p = prenotazione({ pagato: true, annullata_il: "2026-11-08T10:00:00Z", rimborso_effettuato_il: "2026-11-08T11:00:00Z" });
  let doc, table;
  const lines = [];
  function Pdf() {
    doc = new jsPDF();
    const text = doc.text.bind(doc);
    doc.text = (value, ...args) => { lines.push(value); return text(value, ...args); };
    doc.save = () => doc;
    return doc;
  }
  functionFromPage("app/(centrale)/report/page.tsx", "exportAllToPDF", {
    data: [p], startDate: "", endDate: "", indicatori: [{ label: "Saldo netto", value: 0 }],
    jsPDF: Pdf, ...stato, autoTable: (pdf, options) => { table = options; autoTable(pdf, options); },
  })();
  assert.ok(table.body[0].includes("Annullata — Rimborsata"));
  assert.ok(doc.output("arraybuffer").byteLength > 1000);
  assert.equal(doc.getNumberOfPages(), 1);
  const { associazione } = load("app/lib/associazione.ts");
  functionFromPage("app/(centrale)/report/page.tsx", "exportSinglePDF", { jsPDF: Pdf, associazione, ...stato })(p);
  assert.ok(lines.some((line) => typeof line === "string" && line.includes("Incasso originale: RICEVUTO")));
  assert.ok(lines.some((line) => typeof line === "string" && line.includes("Rimborso integrale:")));
  assert.ok(lines.some((line) => typeof line === "string" && line.includes("Denaro restituito il:")));
  assert.ok(doc.output("arraybuffer").byteLength > 1000);
});

test("conteggio paziente distingue prenotazioni totali e annullate", async () => {
  const db = database([
    prenotazione({ id: "a", paziente_id: "paziente-demo" }),
    prenotazione({ id: "b", paziente_id: "paziente-demo", annullata_il: "2026-11-08T10:00:00Z" }),
    prenotazione({ id: "c", paziente_id: "paziente-demo", annullata_il: "2026-11-08T10:00:00Z" }),
  ]);
  let patients;
  await functionFromPage("app/(centrale)/pazienti/page.tsx", "fetchPazientiEStorico", {
    supabase: db.client, setLoading: () => {}, setPazienti: (rows) => { patients = rows; },
    caricaPazienti: async () => ({ data: [{ id: "paziente-demo", nome: "Mario", cognome: "Rossi" }], error: null }),
  })();
  assert.equal(patients[0].totaleCorse, 3);
  assert.equal(patients[0].corseAnnullate, 2);
  assert.equal(patients[0].totaleCorse - patients[0].corseAnnullate, 1);
});

test("interfaccia aggiornata solo dopo il risultato positivo, senza rimuovere la prenotazione", async () => {
  const p = prenotazione();
  const db = database([p]);
  let displayed = [p], esito;
  const confirm = functionFromPage("app/(centrale)/prenotazioni/page.tsx", "confermaOperazione", {
    operationLock: { current: false }, supabase: db.client, ...operazioni, ...stato,
    window: { confirm: () => true }, setProcessingId: () => {}, setEsito: (value) => { esito = value; },
    setPrenotazioni: (callback) => { displayed = callback(displayed); },
  });
  const pending = confirm(p, "annulla");
  assert.equal(displayed[0].annullata_il, null);
  await pending;
  assert.equal(displayed.length, 1);
  assert.ok(displayed[0].annullata_il);
  assert.equal(displayed[0].costo, p.costo);
  assert.equal(esito.type, "success");
});

test("una corsa annullata non può più registrare orari dal pannello autista", async () => {
  const p = prenotazione({ annullata_il: "2026-11-08T10:00:00Z" });
  const db = database([p]);
  let error;
  await functionFromPage("app/(centrale)/autista/dashboard/page.tsx", "registraOra", {
    supabase: db.client, localStorage: { getItem: () => "autista-demo" }, setActionLoading: () => {},
    alert: (message) => { error = message; },
    fetchMieCorse: () => { throw new Error("Aggiornamento non confermato"); },
  })(p.id, "inizio");
  assert.equal(db.writes.length, 0);
  assert.ok(error);
});
