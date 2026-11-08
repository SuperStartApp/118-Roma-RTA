import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function transpile(source, context) {
  return vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { Date, URL, Response, console: { error: () => {} }, ...context });
}

function named(file, name, context = {}) {
  const root = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let value;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) value = node.getText(root);
    if (ts.isVariableDeclaration(node) && node.name.getText(root) === name) value = `const ${name} = ${node.initializer.getText(root)};`;
    ts.forEachChild(node, visit);
  }
  visit(root);
  assert.ok(value, name);
  return transpile(`${value}\n${name};`, context);
}

const noop = () => {};
const associazione = { denominazione: "ROMA R.T.A.", urlGestionale: "https://gestionale.romarta.it" };

test("A: Azzera filtri esegue una query senza le date precedenti", async () => {
  const conditions = [];
  const query = {
    select: () => query, order: () => query,
    gte: (...args) => { conditions.push(args); return query; },
    lte: (...args) => { conditions.push(args); return query; },
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  const fetchData = named("app/report/page.tsx", "fetchData", {
    startDate: "2026-11-01", endDate: "2026-11-08", supabase: { from: () => query },
    setLoading: noop, setErroreCaricamento: noop, setData: noop,
  });
  let pending;
  named("app/report/page.tsx", "resetFilters", {
    setStartDate: noop, setEndDate: noop, fetchData: (filters) => { pending = fetchData(filters); },
  })();
  await pending;
  assert.equal(conditions.length, 0);
});

test("B: fallisce la corsa, ma il tentativo successivo riutilizza il paziente creato", async () => {
  const file = "app/prenotazione/page.tsx";
  const initial = named(file, "initialFormState");
  const ref = { current: null };
  const ids = [];
  let patients = 0, bookings = 0;
  const supabase = { from: (table) => table === "pazienti" ? {
    insert: () => {
      patients++;
      return { select() { return this; }, single: async () => ({ data: { id: "paziente-creato" }, error: null }) };
    },
  } : { insert: async (rows) => {
    ids.push(rows[0].paziente_id);
    return { error: ++bookings === 1 ? { message: "Errore simulato corsa" } : null };
  } } };
  const save = named(file, "handleSubmit", {
    formData: { ...initial, nome: "Mario", cognome: "Rossi", telefono: "3331111111" },
    initialFormState: initial, existingPazienteId: null, pazienteCreatoRef: ref, supabase,
    setLoading: noop, setStatusMessage: noop, setWhatsAppUrl: noop, setExistingPazienteId: noop,
    setFormData: noop, setTesseraSocioInfo: noop, router: { replace: noop },
    window: { open: noop, scrollTo: noop }, generaMessaggioWhatsApp: () => "https://example.test",
  });
  await save({ preventDefault: noop });
  assert.equal(ref.current, "paziente-creato");
  await save({ preventDefault: noop });
  assert.equal(patients, 1);
  assert.equal(bookings, 2);
  assert.deepEqual(ids, ["paziente-creato", "paziente-creato"]);
  assert.equal(ref.current, null);
});

test("C: tutti i campi anagrafici esistenti sono in sola lettura", () => {
  const file = "app/prenotazione/page.tsx";
  const root = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Set();
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node)) {
      const attrs = node.attributes.properties;
      const name = attrs.find((a) => a.name?.getText(root) === "name")?.initializer?.text;
      if (["nome", "cognome", "telefono", "codice_fiscale", "data_nascita", "luogo_nascita", "residenza", "patologia"].includes(name)) {
        assert.ok(attrs.some((a) => a.name?.getText(root) === "readOnly" && a.initializer.expression.getText(root) === "!!existingPazienteId"));
        found.add(name);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
  assert.equal(found.size, 8);
});

test("D/E: emissione verificata prima di WhatsApp e link tessera sempre pubblico", async () => {
  for (const outcome of ["error", "no-row", "success"]) {
    let opened, displayed = [{ pazienti: { id: "p-demo", nome: "Mario", cognome: "Rossi", telefono: "3331111111" } }];
    const query = {
      update: () => query, eq: () => query, is: () => query, select: () => query,
      maybeSingle: async () => ({
        error: outcome === "error" ? { message: "Errore simulato" } : null,
        data: outcome === "success" ? { id: "p-demo", numero_tessera: 501, anno_tessera: 2026 } : null,
      }),
    };
    const send = named("app/autista/dashboard/page.tsx", "inviaTesseraWhatsApp", {
      associazione, supabase: { rpc: async () => ({ data: 501, error: null }), from: () => query },
      setCorse: (fn) => { displayed = fn(displayed); }, alert: noop,
      window: { location: { origin: "http://localhost:3000" }, open: (url) => { opened = url; } },
    });
    await send(displayed[0]);
    if (outcome !== "success") {
      assert.equal(opened, undefined);
      assert.equal(displayed[0].pazienti.numero_tessera, undefined);
    } else {
      assert.equal(displayed[0].pazienti.numero_tessera, 501);
      const message = new URL(opened).searchParams.get("text");
      assert.ok(message.includes("https://gestionale.romarta.it/tessera/p-demo"));
      assert.ok(!message.includes("localhost"));
    }
  }
});

test("F: Link copiato appare solo dopo il successo della Clipboard API", async () => {
  for (const fail of [false, true]) {
    let copied = true, resolve, reject, alerted = false;
    const pending = new Promise((ok, bad) => { resolve = ok; reject = bad; });
    const copy = named("app/autisti/page.tsx", "copiaLinkTerminale", {
      navigator: { clipboard: { writeText: () => pending } }, getAutistaLoginUrl: () => "https://example.test/autista",
      setCopiedLink: (value) => { copied = value; }, setTimeout: noop, alert: () => { alerted = true; },
    });
    const action = copy();
    assert.equal(copied, false);
    if (fail) reject(new Error("Permesso simulato negato")); else resolve();
    await action;
    assert.equal(copied, !fail);
    assert.equal(alerted, fail);
  }
});

test("G/H: zero visualizzato e vecchio login PIN sospeso", () => {
  assert.ok(fs.readFileSync("app/prenotazioni/[id]/page.tsx", "utf8").includes("{formattaImporto(corsa.costo)}"));
  const login = fs.readFileSync("app/autista/page.tsx", "utf8");
  assert.ok(login.includes("temporaneamente sospeso"));
  assert.ok(!login.includes("localStorage"));
  assert.ok(!login.includes(".from("));
  assert.ok(fs.readFileSync("app/autisti/page.tsx", "utf8").includes("da 4 a 6 cifre"));
});

test("I: letture fallite producono un errore distinto dall’elenco vuoto", async () => {
  for (const [file, method] of [["app/report/page.tsx", "fetchData"], ["app/prenotazioni/page.tsx", "fetchPrenotazioni"], ["app/agenda/page.tsx", "fetchCorseOggi"], ["app/autisti/page.tsx", "fetchAutisti"], ["app/pazienti/page.tsx", "fetchPazientiEStorico"]]) {
    let error, changed = false;
    const query = { select: () => query, eq: () => query, is: () => query, order: () => query, then: (resolve) => Promise.resolve({ data: null, error: { message: "Errore simulato" } }).then(resolve) };
    await named(file, method, {
      startDate: "", endDate: "", setLoading: noop, setErroreCaricamento: (value) => { error = value; },
      setData: () => { changed = true; }, setCorse: () => { changed = true; }, setAutisti: () => { changed = true; },
      setPazienti: () => { changed = true; }, setPrenotazioni: () => { changed = true; },
      caricaPazienti: async () => ({ data: null, error: { message: "Errore simulato" } }), supabase: { from: () => query },
    })("2026-11-08");
    assert.ok(error);
    assert.equal(changed, false);
  }
});

test("Guida: sei sezioni, collegamenti validi e informazioni sulle funzioni inattive", () => {
  const sections = named("app/guida/page.tsx", "sezioni");
  assert.equal(sections.length, 6);
  for (const section of sections) {
    assert.ok(fs.existsSync(`app${section.href}/page.tsx`));
    assert.ok(section.passi.length >= 2);
  }
  assert.ok(sections[4].nota.includes("NON è attiva"));
  assert.ok(sections[3].nota.includes("non trasferisce denaro"));
  assert.ok(fs.readFileSync("app/layout.tsx", "utf8").includes('href: "/guida"'));
});

test("Endpoint incasso: 503 anche con configurazione simulata presente", async () => {
  const source = fs.readFileSync("app/api/autista/conferma-incasso/route.ts", "utf8");
  for (const configured of [false, true]) {
    const exports = {};
    transpile(source, { exports, require: () => ({ isSupabaseServerConfigured: () => configured }) });
    const response = await exports.POST();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, false);
  }
});
