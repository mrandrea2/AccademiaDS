import { test, expect, type Page } from "@playwright/test";
async function go(page: Page, name: string) {
  await expect(page.locator(".skeleton")).toHaveCount(0);
  if (
    await page
      .getByRole("button", { name: "Apri menu", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "Apri menu", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name, exact: true })
    .click();
}
test("dashboard, lesson completion and persistent quiz results", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Archivio locale pronto", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Il tuo futuro inizia da qui." }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo locale · dati salvati", { exact: false }),
  ).toBeVisible();
  await go(page, "Percorsi di studio");
  await page.getByRole("button", { name: "Esplora l’area" }).first().click();
  await page.getByRole("button", { name: "Segna come studiata" }).click();
  await expect(
    page.getByRole("button", { name: "Lezione completata" }),
  ).toBeDisabled();
  await go(page, "Quiz e simulazioni");
  await page.getByRole("button", { name: "Inizia sessione" }).click();
  await page
    .getByLabel("Raccogliere fatti, fonti pertinenti e informazioni mancanti.")
    .check();
  await page.getByRole("button", { name: "Conferma risposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Risposta corretta", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Termina sessione" }).click();
  await expect(page.getByText("1 risposte corrette su 9")).toBeVisible();
  await expect(page.getByRole("status").last()).toHaveText(
    "Salvato in questo browser",
  );
  await page.reload();
  await go(page, "Statistiche");
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
});
test("private text import, grounded retrieval, export and deletion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Archivio locale pronto", { exact: true }),
  ).toBeVisible();
  await go(page, "Biblioteca");
  await page
    .getByRole("button", { name: "Aggiungi documento", exact: true })
    .click();
  await page.getByLabel("Titolo", { exact: true }).fill("Appunti di gestione");
  await page
    .getByLabel("Contenuto", { exact: true })
    .fill(
      "La collaborazione nel gruppo richiede ascolto e obiettivi espliciti. Un indicatore utile è la partecipazione.",
    );
  await page.getByRole("button", { name: "Salva documento" }).click();
  await expect(
    page.getByRole("heading", { name: "Appunti di gestione" }),
  ).toBeVisible();
  await go(page, "Tutor AI");
  await page.getByLabel("Che cosa vuoi approfondire?").fill("collaborazione");
  await page.getByRole("button", { name: "Cerca nei miei documenti" }).click();
  await expect(
    page.getByRole("heading", { name: "[1] Appunti di gestione" }),
  ).toBeVisible();
  await expect(
    page.getByText("Pagina 1 · versione 1", { exact: false }),
  ).toBeVisible();
  await go(page, "Impostazioni");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta archivio" }).click();
  expect((await downloaded).suggestedFilename()).toBe(
    "ds-academy-esportazione.json",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancella dati di studio" }).click();
  await go(page, "Biblioteca");
  await expect(
    page.getByRole("heading", {
      name: "La tua biblioteca prende forma da qui",
    }),
  ).toBeVisible();
});
test("written autosave, flashcard scheduling and empty retrieval", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Archivio locale pronto", { exact: true }),
  ).toBeVisible();
  await go(page, "Prova scritta");
  await page
    .getByLabel("La tua risposta")
    .fill(
      "Inquadro il problema raccogliendo informazioni e distinguendo fatti da ipotesi.",
    );
  await expect(page.getByRole("status").last()).toHaveText(
    "Salvato in questo browser",
  );
  await page.reload();
  await expect(page.getByLabel("La tua risposta")).toHaveValue(
    /Inquadro il problema/,
  );
  await go(page, "Flashcard");
  await page.getByRole("button", { name: "Mostra risposta" }).click();
  await page.getByRole("button", { name: "Ricordata", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Prossimo ripasso",
  );
  await go(page, "Tutor AI");
  await page.getByLabel("Che cosa vuoi approfondire?").fill("Normativa");
  await page.getByRole("button", { name: "Cerca nei miei documenti" }).click();
  await expect(
    page.getByText("Non ho trovato evidenze sufficienti.", { exact: false }),
  ).toBeVisible();
});
test("configurable simulation expires and keeps omitted answers distinct", async ({
  page,
}) => {
  await page.goto("/?section=quiz");
  await expect(
    page.getByText("Archivio locale pronto", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Modalità", exact: true })
    .selectOption("simulazione");
  await page.getByLabel("Durata (minuti)").fill("1");
  await page.getByLabel("Numero di quesiti").fill("2");
  await page.getByLabel("Punti risposta omessa").fill("-0.25");
  await page.clock.install();
  await page.getByRole("button", { name: "Inizia sessione" }).click();
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("heading", { name: "0 risposte corrette su 2" }),
  ).toBeVisible();
  await expect(
    page.getByText("0 risposte date · 2 omesse", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Punteggio personale: -0.5.", { exact: false }),
  ).toBeVisible();
});
test("mobile keyboard menu closes on Escape and preserves focus", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Mobile navigation only");
  await page.goto("/");
  await expect(
    page.getByText("Archivio locale pronto", { exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", { name: "Apri menu", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});
test("unconfigured private endpoints fail closed without claiming cloud access", async ({
  request,
}) => {
  const workspace = await request.get("/api/workspace");
  expect(workspace.status()).toBe(503);
  const tutor = await request.post("/api/tutor", {
    data: { query: "normativa" },
  });
  expect(tutor.status()).toBe(503);
  const deletion = await request.delete("/api/account", {
    data: { confirm: "ELIMINA ACCOUNT" },
  });
  expect(deletion.status()).toBe(503);
});
