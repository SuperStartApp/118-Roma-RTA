import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function carica(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: (name) => imports[name] ?? require(name), setTimeout, clearTimeout, setInterval, clearInterval });
  return exports;
}
const { creaAccessoCentrale } = carica("app/lib/accesso-centrale.ts");
const utente = { id: "utente-simulato" };
function simulazione({ user = utente, authError = null, allowed = true, rpcError = null } = {}) {
  const stati = [];
  const chiamate = [];
  const client = {
    auth: {
      getUser: async () => { chiamate.push("getUser"); return { data: { user }, error: authError }; },
      signInWithPassword: async (credenziali) => { chiamate.push(credenziali); return { error: null }; },
      signOut: async (options) => { chiamate.push(options); return { error: null }; },
    },
    rpc: async (name, ...args) => { chiamate.push([name, ...args]); return { data: allowed, error: rpcError }; },
  };
  return { stati, chiamate, client, controllo: creaAccessoCentrale(client, (stato) => stati.push(stato)) };
}

test("Auth: sessione assente o scaduta non interroga il ruolo e non autorizza", async () => {
  for (const authError of [null, { name: "AuthSessionMissingError" }, { status: 401 }]) {
    const s = simulazione({ user: null, authError });
    await s.controllo.verifica();
    assert.equal(s.stati.at(-1).stato, "anonimo");
    assert.deepEqual(s.chiamate, ["getUser"]);
  }
});

test("Auth: utente valido autorizzato solo con booleano true dal database", async () => {
  for (const allowed of [true, false, null, "true", { abilitato: true }]) {
    const s = simulazione({ allowed });
    await s.controllo.verifica();
    assert.equal(s.stati.at(-1).stato, allowed === true ? "autorizzato" : "negato");
    assert.equal(s.chiamate[0], "getUser");
    assert.equal(s.chiamate[1].length, 1); // Non invia ID o ruolo dichiarati dal client.
    assert.equal(s.chiamate[1][0], "roma_rta_operatore_abilitato");
  }
});

test("Auth: errore Auth, RPC mancante e rete falliscono senza mostrare dati", async () => {
  for (const options of [{ user: null, authError: { status: 500 } }, { rpcError: { code: "PGRST202" } }]) {
    const s = simulazione(options);
    await s.controllo.verifica();
    assert.equal(s.stati.at(-1).stato, "errore");
  }
  const s = simulazione();
  s.client.rpc = async () => { throw new Error("Rete simulata"); };
  await s.controllo.verifica();
  assert.equal(s.stati.at(-1).stato, "errore");
});

test("Auth: login email/password verificato da Auth e poi dal database", async () => {
  const s = simulazione();
  await s.controllo.accedi(" operatore@example.test ", "segreto-simulato");
  assert.equal(s.chiamate[0].email, "operatore@example.test");
  assert.equal(s.chiamate[0].password, "segreto-simulato");
  assert.equal(s.stati.at(-1).stato, "autorizzato");
  s.client.auth.signInWithPassword = async () => ({ error: { message: "Credenziali simulate errate" } });
  await s.controllo.accedi("operatore@example.test", "errata");
  assert.equal(s.stati.at(-1).stato, "anonimo");
  assert.ok(!s.stati.at(-1).messaggio.includes("Credenziali simulate errate"));
});

test("Auth: logout nasconde subito i dati e non dichiara successo se fallisce", async () => {
  const s = simulazione();
  await s.controllo.verifica();
  let concludi;
  s.client.auth.signOut = () => new Promise((resolve) => { concludi = resolve; });
  const uscita = s.controllo.esci();
  assert.equal(s.stati.at(-1).stato, "verifica");
  concludi({ error: { message: "Errore simulato" } });
  await uscita;
  assert.equal(s.stati.at(-1).stato, "errore");
  s.client.auth.signOut = async ({ scope }) => { assert.equal(scope, "local"); return { error: null }; };
  await s.controllo.esci();
  assert.equal(s.stati.at(-1).stato, "anonimo");
});

test("Auth: una risposta tardiva non riapre l'accesso dopo logout o smontaggio", async () => {
  for (const fine of ["sessioneTerminata", "chiudi"]) {
    const s = simulazione();
    let concludi, avviata;
    const chiamataAvviata = new Promise((resolve) => { avviata = resolve; });
    s.client.rpc = () => new Promise((resolve) => { concludi = resolve; avviata(); });
    const attesa = s.controllo.verifica();
    await chiamataAvviata;
    s.controllo[fine]();
    const numeroStati = s.stati.length;
    concludi({ data: true, error: null });
    await attesa;
    assert.equal(s.stati.length, numeroStati);
    assert.notEqual(s.stati.at(-1).stato, "autorizzato");
  }
});

test("Auth: controllo periodico preserva il modulo, revoca e cambio account lo chiudono", async () => {
  const s = simulazione();
  await s.controllo.verifica();
  const prima = s.stati.length;
  await s.controllo.verifica();
  assert.deepEqual(s.stati.slice(prima).map((x) => x.stato), ["autorizzato"]);
  s.controllo.sessioneAggiornata("altro-utente");
  assert.equal(s.stati.at(-1).stato, "verifica");
  s.client.rpc = async () => ({ data: false, error: null });
  await s.controllo.verifica();
  assert.equal(s.stati.at(-1).stato, "negato");
});

test("Auth: pagina operativa non montata senza autorizzazione; area autista sempre sospesa", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const HomePage = carica("app/page.tsx", {
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
  }).default;
  for (const stato of ["verifica", "anonimo", "negato", "errore", "autorizzato"]) {
    for (const pathname of ["/", "/pazienti", "/prenotazione", "/prenotazioni/id", "/report", "/agenda", "/tessera/id", "/autisti", "/autista", "/autista/dashboard"]) {
      let montaggi = 0;
      const Gate = carica("components/AccessoCentrale.tsx", {
        react: { ...React, useState: (iniziale) => React.useState(iniziale?.stato ? { stato, messaggio: "Messaggio simulato" } : iniziale) },
        "next/navigation": { usePathname: () => pathname },
        "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
        "@/app/lib/supabase": { supabase: {} },
        "@/app/lib/accesso-centrale": { creaAccessoCentrale },
        "@/app/autista/page": { __esModule: true, default: () => React.createElement("p", null, "PIN sospeso") },
      }).default;
      function Operativa() { montaggi++; return React.createElement(HomePage); }
      const html = renderToStaticMarkup(React.createElement(Gate, null, React.createElement(Operativa)));
      const driver = pathname === "/autista" || pathname.startsWith("/autista/");
      assert.equal(montaggi, stato === "autorizzato" && !driver ? 1 : 0, `${stato} ${pathname}`);
      assert.equal(html.includes("Nuovo trasporto"), stato === "autorizzato" && !driver);
      assert.ok(!html.includes("PIN master"));
      assert.ok(!html.includes("Sblocca Centrale"));
      if (driver) assert.ok(html.includes("PIN sospeso"));
    }
  }
});

test("SQL: ambito limitato, nessuna policy anon, nessuna modifica RPC o drive_*", () => {
  const sql = fs.readFileSync("supabase/migrations/20261108000200_accesso_centrale.sql", "utf8");
  assert.ok(sql.includes("AND roles = ARRAY['public']::name[]"));
  assert.ok(sql.includes("Viste da verificare"));
  assert.ok(sql.includes("SECURITY DEFINER accessibili non ancora verificate"));
  assert.ok(sql.includes("AS RESTRICTIVE FOR ALL TO authenticated"));
  assert.ok(sql.includes("REVOKE ALL ON TABLE roma_rta_private.operatori_centrale"));
  assert.ok(sql.includes("o.user_id = (SELECT auth.uid())"));
  assert.ok(sql.includes("SET search_path = ''"));
  assert.ok(!/(ALTER|DROP|CREATE OR REPLACE)\s+FUNCTION\s+public\.genera_prossima_tessera/i.test(sql));
  assert.ok(!/(ALTER|DROP|CREATE)\s+TABLE\s+(?:public\.)?drive_/i.test(sql));
});
