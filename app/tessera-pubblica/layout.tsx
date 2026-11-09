import type { ReactNode } from "react";

// Nessun import del gestionale o del client Auth nel ramo pubblico.
export default function LayoutTesseraPubblica({ children }: { children: ReactNode }) {
  return <main>{children}</main>;
}
