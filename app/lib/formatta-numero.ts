export function formattaNumero(numero: string | number | null | undefined, vuoto = "—") {
  return numero == null || numero === "" ? vuoto : String(numero).replace(/^0+(?=\d+$)/, "").padStart(4, "0");
}
