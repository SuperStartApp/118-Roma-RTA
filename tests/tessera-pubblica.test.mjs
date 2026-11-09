import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function carica(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports, require: name => imports[name] ?? require(name), Request, Response, URL, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test" } }, ...globals });
  return exports;
}
const tokens = carica("app/lib/tessera-token.ts");
const associazione = { urlGestionale: "https://gestionale.romarta.it" };
const whatsapp = carica("app/lib/whatsapp.ts", { "./associazione": { associazione } });
const post = body => new Request("https://example.test/api/tessera-pubblica", { method: "POST", body: JSON.stringify(body) });
test("Token: 256 bit casuali, formato URL e hash stabile distinto dal segreto", () => {
  const values = new Set(Array.from({ length: 1000 }, () => tokens.nuovoToken()));
  assert.equal(values.size, 1000);
  for (const token of values) { assert.ok(tokens.tokenValido(token)); assert.match(tokens.hashToken(token), /^[0-9a-f]{64}$/); assert.notEqual(tokens.hashToken(token), token); }
  for (const value of [null, {}, "", "id-paziente", "x".repeat(42), "x".repeat(44), "/".repeat(43)]) assert.equal(tokens.tokenValido(value), false);
});
test("API pubblica: nessuna query senza token, configurazione assente chiusa", async () => {
  let chiamate = 0;
  const api = carica("app/api/tessera-pubblica/route.ts", { "@/app/lib/tessera-token": tokens, "@/app/lib/supabase-server": { createSupabaseServerClient: () => { chiamate++; return null; } } });
  assert.equal((await api.POST(post({ token: "id-paziente" }))).status, 404);
  assert.equal(chiamate, 0);
  assert.equal((await api.POST(post({ token: tokens.nuovoToken() }))).status, 503);
});
test("API pubblica: sconosciuto/revocato/scaduto senza dati; errore RPC distinto", async () => {
  for (const result of [{ data: [], error: null }, { data: null, error: { message: "secret SQL" } }]) {
    const api = carica("app/api/tessera-pubblica/route.ts", { "@/app/lib/tessera-token": tokens, "@/app/lib/supabase-server": { createSupabaseServerClient: () => ({ rpc: async () => result }) } });
    const response = await api.POST(post({ token: tokens.nuovoToken() }));
    assert.equal(response.status, result.error ? 503 : 404);
    assert.ok(!(await response.text()).includes("secret SQL"));
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});
test("API pubblica: passa solo hash alla RPC e filtra i campi HTTP", async () => {
  const token = tokens.nuovoToken(); let args;
  const api = carica("app/api/tessera-pubblica/route.ts", { "@/app/lib/tessera-token": tokens, "@/app/lib/supabase-server": { createSupabaseServerClient: () => ({ rpc: async (...input) => { args = input; return { data: [{ nome: "Mario", cognome: "Rossi", numero: "501", anno: 2026, emissione: null, scadenza: "2026-12-31", codice_fiscale: "SEGRETO", paziente_id: "SEGRETO", patologia: "SEGRETO" }], error: null }; } }) } });
  const response = await api.POST(post({ token, pazienteId: "altro-paziente" }));
  assert.equal(response.status, 200);
  assert.equal(args[0], "roma_rta_leggi_tessera"); assert.equal(args[1].p_hash, tokens.hashToken(token));
  const body = await response.text(); assert.ok(!body.includes("SEGRETO")); assert.ok(!body.includes(token));
  assert.deepEqual(Object.keys(JSON.parse(body).tessera).sort(), ["anno", "cognome", "emissione", "nome", "numero", "scadenza"]);
});
function gestione({ user = true, allowed = true, rpcError = false } = {}) {
  const calls = [];
  let clientOptions, jwtVerificato;
  const client = { auth: { getUser: async (jwt) => { jwtVerificato = jwt; return { data: { user: user ? { id: "operatore" } : null }, error: null }; } }, rpc: async (name, args) => { calls.push([name, args]); return name === "roma_rta_operatore_abilitato" ? { data: allowed, error: null } : { data: "2026-12-01", error: rpcError ? (typeof rpcError === "string" ? { code: rpcError, message: "DETTAGLIO_SQL_RISERVATO" } : {}) : null }; } };
  return { calls, options: () => clientOptions, jwt: () => jwtVerificato, api: carica("app/api/tessere/condivisione/route.ts", { "@supabase/supabase-js": { createClient: (_url, _key, options) => { clientOptions = options; return client; } }, "@/app/lib/tessera-token": tokens, "@/app/lib/associazione": { associazione } }) };
}
const gestioneRequest = (azione = "crea", auth = true) => new Request("https://example.test/api/tessere/condivisione", { method: "POST", headers: auth ? { Authorization: "Bearer sessione-test" } : {}, body: JSON.stringify({ pazienteId: "11111111-1111-4111-8111-111111111111", azione }) });
test("Gestione link: anonimo, sessione invalida e non operatore non emettono link", async () => {
  for (const [options, auth, expected] of [[{}, false, 401], [{ user: false }, true, 401], [{ allowed: false }, true, 403]]) {
    const s = gestione(options); assert.equal((await s.api.POST(gestioneRequest("crea", auth))).status, expected);
    assert.ok(!s.calls.some(([name]) => name === "roma_rta_condividi_tessera"));
  }
});
test("Gestione link: crea URL personale, DB riceve solo hash, revoca e fallimento chiuso", async () => {
  const s = gestione(); const response = await s.api.POST(gestioneRequest());
  assert.equal(response.status, 200); const body = await response.json(); const url = new URL(body.link);
  assert.equal(url.pathname, "/tessera-pubblica"); assert.ok(tokens.tokenValido(url.hash.slice(1)));
  assert.equal(s.calls.at(-1)[1].p_hash, tokens.hashToken(url.hash.slice(1)));
  assert.equal((await s.api.POST(gestioneRequest("revoca"))).status, 200); assert.equal(s.calls.at(-1)[0], "roma_rta_revoca_tessera");
  const failed = await gestione({ rpcError: true }).api.POST(gestioneRequest()); assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("tessera-pubblica#"));
});
test("Avviso autista: numero valido, link corretto e messaggio generico senza PIN o paziente", () => {
  for (const number of [null, "", "123", "333abc1111111", "+00000000", "++393331111111", "39+3331111111"]) assert.equal(whatsapp.avvisoAutistaUrl(number), null);
  for (const number of ["333 111 1111", "+39 333 111 1111", "0039 3331111111"]) {
    const url = new URL(whatsapp.avvisoAutistaUrl(number));
    assert.equal(url.hostname, "web.whatsapp.com"); assert.equal(url.searchParams.get("phone"), "393331111111");
    const text = url.searchParams.get("text"); assert.ok(text.includes("https://gestionale.romarta.it/autista")); assert.match(text, /sospeso/); assert.ok(!/PIN|paziente|Mario|Rossi|indirizzo|patologia/i.test(text));
  }
});
test("Avviso autista: pulsante assente senza assegnazione o telefono valido", () => {
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  const Button = carica("components/AvvisaAutista.tsx", { "@/app/lib/whatsapp": whatsapp }).default;
  for (const props of [{}, { telefono: "3331111111" }, { autistaId: "id", telefono: "123" }]) assert.equal(renderToStaticMarkup(React.createElement(Button, props)), "");
  assert.match(renderToStaticMarkup(React.createElement(Button, { autistaId: "id", telefono: "3331111111" })), /Avvisa autista/);
});

test("Layout: unica eccezione pubblica esatta; tutte le pagine operative restano nel gate", () => {
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  for (const pathname of ["/tessera-pubblica", "/tessera-pubblica/altro", "/", "/pazienti", "/prenotazioni", "/tessera/id", "/autista", "/autista/dashboard"]) {
    let montaggi = 0;
    const Layout = carica("app/layout.tsx", {
      "next/navigation": { usePathname: () => pathname }, "next/font/google": { Inter: () => ({ className: "font" }) }, "./globals.css": {},
      "@/components/AccessoCentrale": { __esModule: true, default: () => React.createElement("p", null, "Accesso richiesto"), PulsanteLogout: () => null },
      "next/link": { __esModule: true, default: () => null },
    }).default;
    function Page() { montaggi++; return React.createElement("p", null, "Contenuto"); }
    renderToStaticMarkup(React.createElement(Layout, null, React.createElement(Page)));
    assert.equal(montaggi, pathname === "/tessera-pubblica" ? 1 : 0, pathname);
  }
});

test("RPC gestionali: JWT originale verificato e inoltrato, senza client service", async () => {
  const s = gestione(); assert.equal((await s.api.POST(gestioneRequest())).status, 200);
  assert.equal(s.jwt(), "sessione-test");
  assert.equal(s.options().global.headers.Authorization, "Bearer sessione-test");
  assert.equal(s.options().auth.persistSession, false);
  const source = fs.readFileSync("app/api/tessere/condivisione/route.ts", "utf8");
  assert.ok(!source.includes("SERVICE_ROLE"));
  assert.ok(!source.includes("createSupabaseServerClient"));
});
test("Errori RPC: autorizzazione, input e concorrenza gestiti senza dettagli SQL", async () => {
  for (const [code, expected] of [["42501", 403], ["22023", 400], ["P0002", 404], ["55P03", 409], ["40P01", 409], ["40001", 409], ["XX000", 503]]) {
    for (const azione of ["crea", "revoca"]) {
      const response = await gestione({ rpcError: code }).api.POST(gestioneRequest(azione));
      assert.equal(response.status, expected, code + " " + azione);
      const body = await response.text(); assert.ok(!body.includes("DETTAGLIO_SQL_RISERVATO")); assert.ok(!body.includes("tessera-pubblica#"));
    }
  }
});
test("Confine pubblico: unica RPC limitata, segreto solo nel modulo server-only", () => {
  const route = fs.readFileSync("app/api/tessera-pubblica/route.ts", "utf8");
  assert.ok(!/\.from\s*\(/.test(route));
  assert.equal([...route.matchAll(/\.rpc\s*\(/g)].length, 1);
  assert.ok(route.includes('rpc("roma_rta_leggi_tessera"'));
  const server = fs.readFileSync("app/lib/supabase-server.ts", "utf8");
  assert.ok(server.includes('import "server-only"'));
  assert.ok(!server.includes("headers:"));
  for (const file of ["app/tessera-pubblica/page.tsx", "app/lib/condivisione-tessera.ts", "app/pazienti/page.tsx"]) assert.ok(!fs.readFileSync(file, "utf8").includes("SERVICE_ROLE"));
});
test("SQL proposto: contratto di scadenza annuale e sicurezza, senza eseguire DDL", () => {
  const sql = fs.readFileSync("supabase/migrations/20261109000100_tessera_pubblica.sql", "utf8");
  assert.ok(!sql.includes("30 days"));
  assert.ok(sql.includes("scadenza := make_timestamptz(a + 1, 1, 1, 0, 0, 0, 'Europe/Rome')"));
  assert.ok(sql.includes("scade_il > statement_timestamp()"));
  assert.ok(sql.includes("FOR EACH ROW WHEN (OLD.numero_tessera IS DISTINCT FROM NEW.numero_tessera"));
  assert.ok(!sql.includes("AFTER UPDATE OF"));
  assert.equal(sql.split("CREATE FUNCTION ").length - 1, 4);
  // Controllo editoriale: delimitatori bilanciati, nessun blocco duplicato.
  const delimitatore = String.fromCharCode(36, 36);
  assert.equal(sql.split(delimitatore).length - 1, 12);
  assert.equal((sql.match(/COMMIT;/g) || []).length, 1);
  for (const grant of sql.matchAll(/GRANT EXECUTE ON FUNCTION ([^;]+);/g)) assert.ok(!/TO (anon|PUBLIC)/i.test(grant[1]));
  assert.ok(!/CREATE POLICY|ALTER POLICY|ALTER ROLE|ALTER DEFAULT PRIVILEGES|GRANT USAGE ON SCHEMA/i.test(sql));
});
