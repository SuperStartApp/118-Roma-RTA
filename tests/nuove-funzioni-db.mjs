import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

// Uso: node tests/nuove-funzioni-db.mjs <psql> <porta-cluster-locale-isolato>
const [psql, porta] = process.argv.slice(2);
if (!psql || !/^[1-9][0-9]{3,4}$/.test(porta ?? "")) throw new Error("Specificare psql e la porta del cluster isolato.");
const database = "roma_rta_test_" + randomUUID().replaceAll("-", "");

function sql(comandi, db = database) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, ["-X", "-w", "-h", "127.0.0.1", "-p", porta, "-U", "postgres", "-d", db, "-Aqt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], {
      env: { ...process.env, PGCLIENTENCODING: "UTF8" },
    });
    let out = "", err = "";
    child.stdout.setEncoding("utf8").on("data", (parte) => { out += parte; });
    child.stderr.setEncoding("utf8").on("data", (parte) => { err += parte; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(out.replaceAll("\r\n", "\n").trim()) : reject(new Error(err)));
    child.stdin.on("error", reject);
    child.stdin.end(comandi);
  });
}

const operatore = "10000000-0000-4000-8000-000000000001";
const primo = "20000000-0000-4000-8000-000000000001";
const secondo = "20000000-0000-4000-8000-000000000002";
const estraneo = "20000000-0000-4000-8000-000000000003";
const paziente = "30000000-0000-4000-8000-000000000001";
const corsa = "40000000-0000-4000-8000-000000000001";
const altraCorsa = "40000000-0000-4000-8000-000000000002";
const nonPagata = "40000000-0000-4000-8000-000000000003";
const chiamante = "SET ROLE authenticated; SET request.jwt.claim.sub = '" + operatore + "'; ";
const corse = "SET ROLE service_role; ";
const idAutisti = "ARRAY['" + primo + "', '" + secondo + "']::uuid[]";
const spunta = (id, autista, tipo) => "SELECT public.roma_rta_registra_ora('" + id + "', '" + autista + "', '" + tipo + "');";
const emetti = (id, nome = "Intestatario sintetico", importo = id === corsa ? 90 : 80) =>
  "SELECT public.roma_rta_emetti_ricevuta('" + id + "', '" + nome + "', NULL, NULL, 'Trasporto infermi', "
  + importo + ", 'Contanti', '2026-12-31', 'DIG', '{\"cap\":\"00133\",\"data_nascita\":\"1980-01-02\"}', (SELECT emittente FROM public.roma_rta_config_ricevute()));";
const emettiTessera = "INSERT INTO public.pazienti(nome, numero_tessera) VALUES ('Sintetico', 0) RETURNING numero_tessera;";
const assertSql = async (comandi, atteso) => assert.equal(await sql(comandi), atteso);
const concorrenza = (prefisso, a, b) => Promise.all([
  sql(prefisso + "BEGIN; " + a + " SELECT pg_sleep(0.15); COMMIT;"),
  sql(prefisso + b),
]);
const definizioniOrologio = new Map();

async function fermaOrologio(istante) {
  const funzioni = [
    ["roma_rta_private.numerazione_tessera()", "statement_timestamp()"],
    ["public.roma_rta_emetti_ricevuta(uuid,text,text,text,text,numeric,text,date,text,jsonb,jsonb)", "clock_timestamp()"],
  ];
  for (const [nome, orologio] of funzioni) {
    if (!definizioniOrologio.has(nome)) {
      definizioniOrologio.set(nome, await sql("SELECT pg_get_functiondef('" + nome + "'::regprocedure);"));
    }
    const definizione = definizioniOrologio.get(nome);
    await sql(definizione.replaceAll(orologio, "(TIMESTAMPTZ '" + istante + "')") + ";");
  }
}

await sql("CREATE DATABASE " + database + ";", "postgres");
try {
  const preinstallazione = "BEGIN READ ONLY;\n" +
    readFileSync("supabase/checks/preinstallazione_nuove_funzioni.sql", "utf8") + "\nROLLBACK;";
  assert.match(await sql(preinstallazione), /Prerequisiti\|public\.pazienti\|FAIL\|/);
  await sql(readFileSync("supabase/checks/fixture_nuove_funzioni.sql", "utf8"));
  const migrazioni = readdirSync("supabase/migrations").filter((nome) => nome.endsWith(".sql")).sort();
  for (const nome of migrazioni) {
    if (nome.startsWith("20261123000100")) {
      await sql("INSERT INTO public.autisti(id, nome, pin) VALUES ('" + primo + "', 'Primo', '910001'), ('" + secondo + "', 'Secondo', '910002'), ('" + estraneo + "', 'Estraneo', '910003');");
    }
    if (nome.startsWith("20261124000100")) {
      await sql("INSERT INTO auth.users VALUES ('" + operatore + "'); INSERT INTO roma_rta_private.operatori_centrale(user_id, abilitato) VALUES ('" + operatore + "', true);"
        + "INSERT INTO public.pazienti(id, nome, anno_tessera, numero_tessera) VALUES ('" + paziente + "', 'Storico', 2026, 500);"
        + "INSERT INTO public.prenotazioni(id, paziente_id, autista_id, data_appuntamento, costo, metodo_pagamento, pagato) VALUES "
        + "('" + corsa + "', '" + paziente + "', '" + primo + "', '2026-12-31', 90, 'Contanti', true),"
        + "('" + altraCorsa + "', '" + paziente + "', '" + estraneo + "', '2026-12-31', 80, 'Contanti', true),"
        + "('" + nonPagata + "', '" + paziente + "', NULL, '2026-12-31', 80, 'Contanti', false);");
    }
    if (nome.startsWith("20261124000100")) {
      const esiti = await sql(preinstallazione);
      assert.doesNotMatch(esiti, /\|FAIL\|/);
      assert.match(esiti, /Tessere\|Numerazioni e duplicati\|WARNING\|.*0500 occupato nel 2026: 1/);
    }
    await sql(readFileSync("supabase/migrations/" + nome, "utf8"));
  }
  console.log("Applicate tutte le migrazioni al database sintetico.");

  const postinstallazione = "BEGIN READ ONLY;\n" +
    readFileSync("supabase/checks/postinstallazione_nuove_funzioni.sql", "utf8") + "\nROLLBACK;";
  const esiti = (await sql(postinstallazione)).split("\n");
  assert.equal(esiti.length, 7);
  assert.ok(esiti.every((riga) => riga.split("|")[1] === "PASS"));
  await fermaOrologio("2026-12-31 22:59:59+00");
  await sql(chiamante + "INSERT INTO public.pazienti (nome, numero_tessera, anno_tessera) VALUES ('Legacy', 800, 2026);");
  await assert.rejects(sql(chiamante + "INSERT INTO public.pazienti (nome, numero_tessera, anno_tessera) VALUES ('Duplicata', 800, 2026);"), /occupato/);
  await sql("UPDATE roma_rta_private.tessere_config SET accetta_legacy = false;");
  assert.match(await sql(postinstallazione), /Compatibilità tessere prima della pubblicazione\|WARNING\|/);
  await assert.rejects(sql(chiamante + "INSERT INTO public.pazienti (nome, numero_tessera, anno_tessera) VALUES ('Legacy', 801, 2026);"), /automatica/);
  const tessere = await concorrenza(chiamante, emettiTessera, emettiTessera);
  assert.deepEqual(tessere.sort(), ["501", "502"]);
  await assertSql(chiamante + "SELECT numero_tessera FROM public.pazienti WHERE id = '" + paziente + "';", "500");
  await assert.rejects(sql(chiamante + "UPDATE public.pazienti SET numero_tessera = 0 WHERE id = '" + paziente + "';"), /tessera.*emessa/);
  await assert.rejects(sql("SET ROLE authenticated; " + emettiTessera), /42501/);

  await assertSql(chiamante + "SELECT count(*) FROM public.roma_rta_prenotazioni_autisti;", "2");
  await sql(corse + "UPDATE public.prenotazioni SET ora_inizio_effettiva = now() WHERE id = '" + nonPagata + "';");
  const token = "a".repeat(64), ip = "b".repeat(64);
  await assertSql(corse + "SELECT autista_id FROM public.roma_rta_autista_login('910001', '" + ip + "', '" + token + "');", primo);
  await assertSql(corse + "SELECT autista_id FROM public.roma_rta_autista_sessione('" + token + "');", primo);
  await sql(corse + "SELECT public.roma_rta_autista_logout('" + token + "');");
  await assertSql(corse + "SELECT count(*) FROM public.roma_rta_autista_sessione('" + token + "');", "0");
  await assertSql(corse + "SELECT count(*) FROM public.roma_rta_prenotazioni_autisti WHERE autista_id = '" + secondo + "';", "0");
  await sql(chiamante + "SELECT public.roma_rta_assegna_autisti('" + corsa + "', " + idAutisti + ");");
  for (const autista of [primo, secondo]) {
    await assertSql(corse + "SELECT p.id FROM public.prenotazioni p JOIN public.roma_rta_prenotazioni_autisti a ON a.prenotazione_id = p.id WHERE a.autista_id = '" + autista + "';", corsa);
  }
  await assertSql(corse + spunta(corsa, estraneo, "inizio") + spunta(corsa, primo, "fine"), "f\nf");
  assert.deepEqual((await concorrenza(corse, spunta(corsa, primo, "inizio"), spunta(corsa, secondo, "inizio"))).sort(), ["f", "t"]);
  const registrante = await sql("SELECT inizio_registrato_da FROM public.prenotazioni WHERE id = '" + corsa + "';");
  assert.ok([primo, secondo].includes(registrante));
  const registraFine = registrante === primo ? secondo : primo;
  await assertSql(corse + spunta(corsa, registraFine, "fine") + spunta(corsa, registrante, "fine"), "t\nf");
  await assertSql("SELECT fine_registrata_da FROM public.prenotazioni WHERE id = '" + corsa + "';", registraFine);
  await sql(chiamante + "SELECT public.roma_rta_assegna_autisti('" + corsa + "', ARRAY['" + primo + "']::uuid[]);");
  await assertSql(corse + "SELECT count(*) FROM public.roma_rta_prenotazioni_autisti WHERE autista_id = '" + secondo + "';", "0");
  await assertSql("SET ROLE authenticated; SELECT count(*) FROM public.roma_rta_prenotazioni_autisti;", "0");
  await assert.rejects(sql(chiamante + spunta(corsa, primo, "inizio")), /42501/);
  await assert.rejects(sql(chiamante + "UPDATE public.prenotazioni SET ora_fine_effettiva = now();"), /42501/);

  const idNuovo = randomUUID();
  const inserisci = "SELECT public.roma_rta_crea_prenotazione('" + idNuovo + "', '{\"paziente_id\":\"" + paziente + "\",\"data_appuntamento\":\"2027-01-01\"}', " + idAutisti + ");";
  const idRifiutato = randomUUID();
  await assert.rejects(sql(chiamante + inserisci.replace(idNuovo, idRifiutato).replace(secondo, randomUUID())), /Autista non disponibile/);
  await assertSql(chiamante + "SELECT count(*) FROM public.prenotazioni WHERE id = '" + idRifiutato + "';", "0");
  assert.deepEqual(await concorrenza(chiamante, inserisci, inserisci), [idNuovo, idNuovo]);
  await assertSql(chiamante + "SELECT count(*) FROM public.roma_rta_prenotazioni_autisti WHERE prenotazione_id = '" + idNuovo + "';", "2");
  await sql(chiamante + "UPDATE public.prenotazioni SET annullata_il = now() WHERE id = '" + idNuovo + "';");
  await assertSql(corse + spunta(idNuovo, primo, "inizio"), "f");
  console.log("Assegnazioni storiche e multiple, isolamento, idempotenza e concorrenza marcature verificati.");

  await assert.rejects(sql(chiamante + emetti(corsa)), /disabilitata/);
  await assertSql("SELECT count(*) FROM roma_rta_private.ricevute_progressivi;", "0");
  await sql("UPDATE roma_rta_private.ricevute_config SET emissione_attiva = true, serie = 'DIG';");
  assert.match(await sql(postinstallazione), /Numerazione ed emissione ricevute\|FAIL\|/);
  await assert.rejects(sql("SET ROLE authenticated; " + emetti(corsa)), /Accesso negato/);
  await assert.rejects(sql(chiamante + emetti(nonPagata)), /Incasso non emettibile/);
  await assert.rejects(sql(chiamante + emetti(corsa, "Bozza superata", 89)), /cambiati dopo/);
  const [emessa, ripetuta] = await concorrenza(chiamante, emetti(corsa), emetti(corsa));
  assert.equal(emessa, ripetuta);
  await assertSql(chiamante + "SELECT serie, anno, numero, intestatario, importo FROM public.roma_rta_ricevute;", "DIG|2026|500|Intestatario sintetico|90.00");
  await sql(chiamante + "UPDATE public.pazienti SET nome = 'Aggiornato' WHERE id = '" + paziente + "';");
  await assertSql(chiamante + emetti(corsa, "Nome diverso al retry"), emessa);
  await sql("UPDATE roma_rta_private.ricevute_config SET emittente = jsonb_set(emittente, '{telefono}', '\"0000000000\"');");
  await assertSql(chiamante + "SELECT intestatario, emittente->>'telefono', dettagli->>'cap' FROM public.roma_rta_ricevute;", "Intestatario sintetico|06 45776290|00133");
  await assertSql("SET ROLE authenticated; SELECT count(*) FROM public.roma_rta_ricevute;", "0");
  await assert.rejects(sql("SET ROLE anon; SELECT * FROM public.roma_rta_ricevute;"), /42501/);
  await assert.rejects(sql(chiamante + "UPDATE public.roma_rta_ricevute SET importo = 1;"), /42501/);

  await fermaOrologio("2026-12-31 23:00:00+00");
  await assertSql(chiamante + emettiTessera, "1");
  await sql(chiamante + "UPDATE public.prenotazioni SET pagato = true WHERE id = '" + nonPagata + "';");
  const nuoveRicevute = await concorrenza(chiamante, emetti(altraCorsa), emetti(nonPagata));
  assert.notEqual(nuoveRicevute[0], nuoveRicevute[1]);
  await assertSql(chiamante + "SELECT serie, anno, numero FROM public.roma_rta_ricevute ORDER BY anno, numero;", "DIG|2026|500\nDIG|2027|1\nDIG|2027|2");
  await assertSql("SELECT anno, prossimo FROM roma_rta_private.tessere_progressivi ORDER BY anno;", "2026|503\n2027|2");
  await assertSql("SET ROLE anon; SELECT id FROM public.drive_test_isolamento;", "1");
  console.log("Contatori indipendenti, occupazione, rollover Europe/Rome, ricevute immutabili e permessi verificati.");
} finally {
  await sql("DROP DATABASE " + database + ";", "postgres");
}
