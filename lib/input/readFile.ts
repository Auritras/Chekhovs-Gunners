import { joinPdfLines, linesFromItems, type PdfItem, type PdfLine } from "@/lib/input/pdfText";

export type ReadFileResult =
  | { text: string }
  | { error: "unsupported" | "no_text" | "unreadable" };

const MIN_CHARS = 20;

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: PdfLine[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: PdfItem[] = content.items.flatMap((item) => ("str" in item ? [item] : []));
    pages.push(linesFromItems(items));
  }
  // Rebuild paragraphs: a PDF breaks every printed line, often mid-sentence.
  return joinPdfLines(pages);
}

export async function readFile(file: File): Promise<ReadFileResult> {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  if (![".txt", ".md", ".docx", ".pdf"].includes(ext)) {
    return { error: "unsupported" };
  }
  try {
    let text: string;
    if (ext === ".docx") {
      const mammoth = await import("mammoth/mammoth.browser.js");
      const arrayBuffer = await file.arrayBuffer();
      text = (await mammoth.extractRawText({ arrayBuffer })).value;
    } else if (ext === ".pdf") {
      text = await readPdf(file);
    } else {
      text = await file.text();
    }
    if (text.replace(/\s/g, "").length < MIN_CHARS) return { error: "no_text" };
    return { text };
  } catch {
    return { error: "unreadable" };
  }
}
