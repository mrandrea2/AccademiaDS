import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("navigation, WCAG automated checks and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByText("Archivio locale pronto", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/ds-academy-${info.project.name}.png`,
    fullPage: true,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const section of [
    "dashboard",
    "biblioteca",
    "percorsi",
    "quiz",
    "flashcard",
    "scritta",
    "orale",
    "tutor",
    "normativa",
    "statistiche",
    "impostazioni",
    "materiali",
  ]) {
    await page.goto(`/?section=${section}`);
    await expect(
      page.getByText("Archivio locale pronto", { exact: true }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("legal source version history and persisted self-assessment", async ({
  page,
}) => {
  await page.goto("/?section=normativa");
  await page.getByRole("button", { name: "Registra fonte normativa" }).click();
  await page.getByLabel("Titolo dell’atto").fill("Fonte personale di test");
  await page
    .getByLabel("Collegamento alla fonte originale")
    .fill("https://www.normattiva.it/");
  await page.getByLabel("Versione consultata").fill("Consultazione personale");
  await page.getByRole("button", { name: "Salva fonte" }).click();
  await page.getByLabel("Stato di verifica personale").selectOption("outdated");
  await page.getByText("Storico aggiornamenti").click();
  await expect(
    page.getByText("Stato personale: outdated", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("status").last()).toHaveText(
    "Salvato in questo browser",
  );
  await page.reload();
  await expect(page.getByLabel("Stato di verifica personale")).toHaveValue(
    "outdated",
  );
});
