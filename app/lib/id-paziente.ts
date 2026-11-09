export function idPazienteValido(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function richiediIdPaziente(value: unknown): string {
  if (!idPazienteValido(value)) {
    throw new Error("Identificativo della scheda paziente non valido: è richiesto un UUID. Aggiorna l’elenco e riapri la scheda; se persiste, contatta la centrale.");
  }
  return value;
}

export function linkTesseraInterna(paziente: { id: unknown }): string {
  return "/tessera/" + encodeURIComponent(richiediIdPaziente(paziente.id));
}
