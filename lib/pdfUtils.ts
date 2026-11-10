// Utility functions for client-side PDF processing using pdfjs-dist

export interface ExtractedPdfInfo {
  pageCount: number;
  coverFile: File;
  coverPreviewUrl: string;
  aspectRatio: number; // width / height of Page 1
}

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Dynamically loads the browser-compatible build of pdfjs-dist and configures its local worker.
 */
async function getPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF processing can only be executed in a browser environment.");
  }

  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Set worker source to our local worker in public/pdf.worker.min.js
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      return pdfjs;
    })();
  }

  return pdfjsLibPromise;
}

/**
 * Inspects a client-selected PDF File, reads the page count,
 * and renders Page 1 into a high-quality JPEG cover File & preview URL.
 */
export async function extractPdfMetadataAndCover(pdfFile: File): Promise<ExtractedPdfInfo> {
  const pdfjs = await getPdfJs();

  const arrayBuffer = await pdfFile.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  const loadingTask = pdfjs.getDocument({ data: typedArray });
  const pdfDoc = await loadingTask.promise;

  const pageCount = pdfDoc.numPages;
  if (pageCount < 1) {
    throw new Error("The selected PDF file does not contain any readable pages.");
  }

  // Render Page 1 as the cover
  const page1 = await pdfDoc.getPage(1);
  const scale = 1.6;
  const viewport = page1.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to obtain 2D canvas context for PDF rendering.");
  }

  // Render the page contents into canvas
  await page1.render({
    canvasContext: context,
    viewport,
  }).promise;

  const aspectRatio = viewport.height > 0 ? viewport.width / viewport.height : 0.75;
  const previewDataUrl = canvas.toDataURL("image/jpeg", 0.85);

  // Convert canvas to a File object for multipart upload
  const coverBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });

  if (!coverBlob) {
    throw new Error("Failed to generate image blob from PDF cover canvas.");
  }

  const baseName = pdfFile.name.replace(/\.[^/.]+$/, "");
  const coverFile = new File([coverBlob], `${baseName}-cover.jpg`, {
    type: "image/jpeg",
  });

  return {
    pageCount,
    coverFile,
    coverPreviewUrl: previewDataUrl,
    aspectRatio,
  };
}

/**
 * Downloads and renders every page of a PDF into an array of JPEG Data URLs.
 * Used by the 2-page interactive flipbook reader.
 */
export async function renderPdfPagesToDataUrls(
  pdfUrl: string,
  scale: number = 1.8,
  onProgress?: (current: number, total: number) => void
): Promise<{ pages: string[]; aspectRatio: number }> {
  const pdfjs = await getPdfJs();

  const loadingTask = pdfjs.getDocument(pdfUrl);
  const pdfDoc = await loadingTask.promise;

  const totalPages = pdfDoc.numPages;
  const pages: string[] = [];
  let aspectRatio = 0.75;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    if (pageNum === 1 && viewport.height > 0) {
      aspectRatio = viewport.width / viewport.height;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(`Failed to obtain canvas context for page ${pageNum}.`);
    }

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    pages.push(canvas.toDataURL("image/jpeg", 0.88));

    if (onProgress) {
      onProgress(pageNum, totalPages);
    }
  }

  return {
    pages,
    aspectRatio,
  };
}
