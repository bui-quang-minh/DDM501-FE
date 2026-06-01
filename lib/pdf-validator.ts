export interface PdfValidationResult {
  valid: boolean;
  pageCount: number;
  reason?: string;
}

// Average characters per sampled page below this → treat as scanned
const MIN_AVG_CHARS = 50;

export async function validatePdfIsReadable(
  file: File
): Promise<PdfValidationResult> {
  const pdfjs = await import("pdfjs-dist");

  // Load worker from CDN matching the installed version
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = pdf.numPages;

  // Sample up to the first 3 pages
  const sampleCount = Math.min(3, pageCount);
  let totalChars = 0;

  for (let p = 1; p <= sampleCount; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join("");
    totalChars += text.trim().length;
  }

  const avgChars = totalChars / sampleCount;

  if (avgChars < MIN_AVG_CHARS) {
    return {
      valid: false,
      pageCount,
      reason:
        "This PDF appears to be a scanned document. Please upload a text-based PDF with selectable text.",
    };
  }

  return { valid: true, pageCount };
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ")
      .trim();
    if (pageText) pages.push(`--- Trang ${p} ---\n${pageText}`);
  }

  return pages.join("\n\n");
}
