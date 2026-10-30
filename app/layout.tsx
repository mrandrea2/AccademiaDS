import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DS Academy · Il tuo percorso verso la dirigenza",
  description:
    "Spazio personale di studio per la preparazione al concorso per dirigente scolastico. Fonti tracciabili, pratica e ripasso.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
