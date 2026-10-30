import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";
import {
  extractBatch,
  extractDocx,
  validateFile,
  hashBytes,
  classify,
  chunkSegments,
  exactQuote,
} from "../lib/ingestion/extract";
import { seal, unseal } from "../lib/ingestion/crypto";
import { PDF_MIME, draftBodySchema } from "../lib/ingestion/contracts";
function docx(xml: string) {
  return zipSync({ "word/document.xml": strToU8(xml) });
}
describe("binary ingestion", () => {
  it("extracts real generated PDF text with physical page citations", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf
      .addPage()
      .drawText("Gestione del personale e collaborazione documentata.", {
        font,
      });
    pdf
      .addPage()
      .drawText("Valutazione degli esiti del progetto scolastico.", { font });
    const bytes = await pdf.save();
    const batch = await extractBatch(bytes, PDF_MIME);
    expect(batch.pageCount).toBe(2);
    expect(batch.segments[1].page).toBe(2);
    expect(batch.segments[1].text).toContain("Valutazione");
    expect(batch.done).toBe(true);
  }, 30000);
  it("flags image-only / blank pages for OCR review rather than inventing text", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const batch = await extractBatch(await pdf.save(), PDF_MIME);
    expect(batch.warnings[0]).toContain("OCR");
    expect(batch.segments[0].text).toBe("");
  });
  it("rejects spoofed extensions and invalid binary formats", () => {
    expect(() => validateFile(strToU8("not a PDF"), PDF_MIME)).toThrow();
    expect(() => extractDocx(zipSync({ "other.xml": strToU8("x") }))).toThrow(
      /document.xml/,
    );
  });
  it("retains DOCX headings, text and table cells without fake page numbers", () => {
    const result = extractDocx(
      docx(
        '<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Personale</w:t></w:r></w:p><w:p><w:r><w:t>Testo di una sezione con riferimenti.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Voce</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Valore</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
      ),
    );
    expect(result.segments[1].section).toBe("Personale");
    expect(result.segments[2].kind).toBe("table");
    expect(result.segments[2].text).toBe("Voce\tValore");
    expect(result.segments.every((s) => s.page === null)).toBe(true);
  });
  it("rejects entity expansion XML", () => {
    expect(() =>
      extractDocx(docx('<!DOCTYPE a [<!ENTITY x "bad">]><w:document/>')),
    ).toThrow(/Entità/);
  });
  it("deduplicates exact bytes and distinguishes changed versions", () => {
    expect(hashBytes(strToU8("same"))).toBe(hashBytes(strToU8("same")));
    expect(hashBytes(strToU8("one"))).not.toBe(hashBytes(strToU8("two")));
  });
  it("chunks never cross pages and retain exact offsets", () => {
    const text = "Contenuto documentato ".repeat(100);
    const chunks = chunkSegments([
      { ordinal: 0, page: 2, section: "Pagina 2", text, kind: "text" },
    ]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.page).toBe(2);
      expect(c.content).toBe(text.slice(c.start, c.end));
      expect(c.content.length).toBeLessThanOrEqual(800);
    }
  });
  it("classifies with transparent rules and abstains with no evidence", () => {
    expect(classify("F6_Contabilita.docx", "contabilità e bilancio").area).toBe(
      "amministrazione",
    );
    expect(classify("Sconosciuto", "xyz").area).toBeNull();
    expect(classify("F6_Contabilita.docx", "").area).toBe("amministrazione");
    expect(classify("F7_Sistemi_UE.docx", "").area).toBe("europa");
  });
  it("rejects invented quotes and invalid correct option IDs", () => {
    expect(exactQuote("citazione inventata", "testo originale")).toBe(false);
    expect(
      draftBodySchema.safeParse({
        kind: "quiz",
        title: "Quiz",
        prompt: "Una domanda abbastanza lunga",
        options: ["a", "b", "c", "d"].map((id) => ({ id, text: id })),
        correctOptionId: "z",
        explanation: "Motivo",
      }).success,
    ).toBe(false);
  });
});
describe("encrypted OAuth storage", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  it("roundtrips and detects tampering/wrong keys without plaintext storage", () => {
    const ciphertext = seal({ refresh_token: "test-fixture-only" }, key);
    expect(ciphertext).not.toContain("test-fixture-only");
    expect(unseal(ciphertext, key)).toEqual({
      refresh_token: "test-fixture-only",
    });
    const bytes = Buffer.from(ciphertext, "base64url");
    bytes[30] ^= 1;
    expect(() => unseal(bytes.toString("base64url"), key)).toThrow();
    expect(() =>
      unseal(ciphertext, Buffer.alloc(32, 9).toString("base64")),
    ).toThrow();
  });
});
