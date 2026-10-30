import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import {
  DOCX_MIME,
  PDF_MIME,
  MAX_FILE_BYTES,
  MAX_PAGES,
  type ExtractedBatch,
  type Segment,
  type AreaId,
  type IndexedChunk,
} from "./contracts";
export function hashBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function validateFile(bytes: Uint8Array, mime: string) {
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES)
    throw new Error("Dimensione non consentita (massimo 50 MiB).");
  if (mime === PDF_MIME) {
    if (!new TextDecoder().decode(bytes.slice(0, 8)).startsWith("%PDF-"))
      throw new Error("Il contenuto non è un PDF valido.");
  } else if (mime === DOCX_MIME) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new Error("Il contenuto non è un DOCX valido.");
  } else throw new Error("Sono consentiti solo PDF e DOCX.");
}
type XmlNode = Record<string, unknown>;
function children(node: XmlNode, key: string): XmlNode[] {
  return Array.isArray(node[key]) ? (node[key] as XmlNode[]) : [];
}
function collect(nodes: XmlNode[], tag: string): XmlNode[] {
  return nodes.flatMap((n) => [
    ...(Array.isArray(n[tag]) ? [n] : []),
    ...Object.entries(n)
      .filter(([k, v]) => k !== ":@" && Array.isArray(v))
      .flatMap(([, v]) => collect(v as XmlNode[], tag)),
  ]);
}
function textOf(nodes: XmlNode[]): string {
  return nodes
    .map((n) => {
      if ("#text" in n) return String(n["#text"]);
      return Object.entries(n)
        .filter(([k, v]) => k !== ":@" && Array.isArray(v))
        .map(([k, v]) =>
          k === "w:tab" ? "\t" : k === "w:br" ? "\n" : textOf(v as XmlNode[]),
        )
        .join("");
    })
    .join("");
}
export function extractDocx(bytes: Uint8Array): ExtractedBatch {
  let expanded = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > 30 * 1024 * 1024 || entry.originalSize > 15 * 1024 * 1024)
        throw new Error("DOCX compresso eccessivamente grande.");
      return ["word/document.xml", "docProps/core.xml"].includes(entry.name);
    },
  });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("DOCX privo di word/document.xml.");
  const raw = strFromU8(xml);
  if (/<!DOCTYPE|<!ENTITY/i.test(raw))
    throw new Error("Entità XML non consentite.");
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    processEntities: true,
    parseTagValue: false,
    trimValues: false,
  });
  const tree = parser.parse(raw) as XmlNode[];
  const body = collect(tree, "w:body")[0];
  if (!body) throw new Error("Struttura DOCX non valida.");
  const segments: Segment[] = [];
  let section = "Introduzione";
  for (const node of children(body, "w:body")) {
    if (node["w:p"]) {
      const paragraph = children(node, "w:p");
      const text = textOf(paragraph).trim();
      if (!text) continue;
      const styles = collect(paragraph, "w:pStyle");
      const attrs = styles[0]?.[":@"] as Record<string, string> | undefined;
      if (/heading|titolo/i.test(attrs?.["@_w:val"] ?? ""))
        section = text.slice(0, 500);
      segments.push({
        ordinal: segments.length,
        page: null,
        section,
        text,
        kind: "text",
      });
    } else if (node["w:tbl"]) {
      const rows = children(node, "w:tbl")
        .filter((n) => n["w:tr"])
        .map((row) =>
          children(row, "w:tr")
            .filter((n) => n["w:tc"])
            .map((cell) =>
              collect(children(cell, "w:tc"), "w:p")
                .map((p) => textOf(children(p, "w:p")))
                .join(" "),
            )
            .join("\t"),
        );
      segments.push({
        ordinal: segments.length,
        page: null,
        section,
        text: rows.join("\n"),
        kind: "table",
      });
    }
  }
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  if (total > 3000000 || segments.length > 15000)
    throw new Error("Testo DOCX oltre i limiti di indicizzazione.");
  return {
    segments,
    nextCursor: segments.length,
    done: true,
    pageCount: null,
    warnings: [
      "DOCX: citazioni per sezione; numeri di pagina non disponibili.",
      "Tabelle preservate come righe e celle separate da tabulazioni; verificare l’impaginazione.",
    ],
    metadata: {
      format: "docx",
      paragraphs: segments.length,
      characters: total,
      core: files["docProps/core.xml"]
        ? strFromU8(files["docProps/core.xml"]).slice(0, 10000)
        : null,
    },
  };
}
export async function extractPdf(
  bytes: Uint8Array,
  cursor = 0,
  batchSize = 10,
): Promise<ExtractedBatch> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const require = createRequire(import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    join(
      dirname(require.resolve("pdfjs-dist/package.json")),
      "legacy/build/pdf.worker.mjs",
    ),
  ).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    standardFontDataUrl:
      join(
        dirname(require.resolve("pdfjs-dist/package.json")),
        "standard_fonts",
      ) + "/",
  });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > MAX_PAGES)
      throw new Error(`PDF oltre il limite di ${MAX_PAGES} pagine.`);
    const segments: Segment[] = [];
    const warnings: string[] = [];
    const end = Math.min(pdf.numPages, cursor + batchSize);
    for (let p = cursor + 1; p <= end; p++) {
      const page = await pdf.getPage(p);
      const text = await page.getTextContent();
      let line = "";
      let lastY: number | null = null;
      let lastX = 0;
      const lines: string[] = [];
      for (const item of text.items) {
        if (!("str" in item)) continue;
        const [, , , , x, y] = item.transform;
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (line.trim()) lines.push(line.trim());
          line = "";
        } else if (line && x - lastX > 12) line += "\t";
        else if (line && !line.endsWith(" ")) line += " ";
        line += item.str;
        lastY = y;
        lastX = x + item.width;
        if (item.hasEOL) {
          if (line.trim()) lines.push(line.trim());
          line = "";
          lastY = null;
        }
      }
      if (line.trim()) lines.push(line.trim());
      const content = lines.join("\n");
      if (content.length > 100000)
        throw new Error(`Pagina ${p} oltre il limite di testo.`);
      if (content.replace(/\s/g, "").length < 25)
        warnings.push(
          `Pagina ${p}: testo assente o scarso; verificare scansione/OCR.`,
        );
      segments.push({
        ordinal: p - 1,
        page: p,
        section: `Pagina ${p}`,
        text: content,
        kind: "text",
      });
      page.cleanup();
    }
    const meta =
      cursor === 0 ? await pdf.getMetadata().catch(() => null) : null;
    return {
      segments,
      nextCursor: end,
      done: end === pdf.numPages,
      pageCount: pdf.numPages,
      warnings,
      metadata: {
        format: "pdf",
        ...(meta ? { info: meta.info } : {}),
        layout: "Ordine di lettura stimato; colonne/tabelle da verificare.",
      },
    };
  } finally {
    await task.destroy();
  }
}
export async function extractBatch(
  bytes: Uint8Array,
  mime: string,
  cursor = 0,
) {
  validateFile(bytes, mime);
  return mime === PDF_MIME ? extractPdf(bytes, cursor) : extractDocx(bytes);
}
const terms: Record<AreaId, string[]> = {
  organizzazione: ["ordinamenti", "riforme", "sistema educativo", "autonomia"],
  gestione: ["leadership", "organizzazioni", "ambienti", "dirigenza"],
  programmazione: ["ptof", "valutazione", "rav", "miglioramento"],
  diritto: ["diritto", "responsabilità", "procedimento"],
  amministrazione: ["contabilità", "bilancio", "appalti", "finanziaria"],
  lavoro: ["personale", "contratto", "sindacal", "docenti"],
  didattica: ["inclusione", "didattica", "apprendimento"],
  digitale: ["digitale", "privacy", "informatica"],
  europa: ["sistemi ue", "europa", "europea", "comparat"],
};
export function classify(
  title: string,
  text: string,
): { area: AreaId | null; scores: Record<string, number>; method: string } {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("it")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ");
  const normalizedTitle = normalize(title);
  const content = `${normalizedTitle} ${normalize(text.slice(0, 30000))}`;
  const scores = Object.fromEntries(
    Object.entries(terms).map(([id, words]) => [
      id,
      words.reduce(
        (n, w) =>
          n +
          (content.includes(normalize(w)) ? 1 : 0) +
          (normalizedTitle.includes(normalize(w)) ? 2 : 0),
        0,
      ),
    ]),
  );
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return {
    area: ranked[0][1] > 0 ? (ranked[0][0] as AreaId) : null,
    scores,
    method:
      "Regole lessicali trasparenti; classificazione modificabile, non programma ufficiale.",
  };
}
export function chunkSegments(
  segments: Segment[],
  size = 800,
  overlap = 120,
): IndexedChunk[] {
  if (size < 50 || overlap < 0 || overlap >= size)
    throw new Error("Parametri chunk non validi");
  const chunks: IndexedChunk[] = [];
  for (const s of segments) {
    for (let start = 0; start < s.text.length; start += size - overlap) {
      const end = Math.min(start + size, s.text.length);
      const content = s.text.slice(start, end);
      if (content.trim())
        chunks.push({
          ordinal: chunks.length,
          page: s.page,
          section: s.section,
          content,
          start,
          end,
        });
      if (end === s.text.length) break;
    }
  }
  return chunks;
}
export function exactQuote(quote: string, text: string) {
  return quote.length >= 10 && quote.length <= 600 && text.includes(quote);
}
