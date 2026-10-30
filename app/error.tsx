"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-shell">
      <h1>Qualcosa non ha funzionato</h1>
      <p>Riprova. Le modifiche già salvate rimangono nel tuo archivio.</p>
      <Button onClick={reset}>Riprova</Button>
    </main>
  );
}
