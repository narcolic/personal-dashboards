import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function PdfPreview({ file }: { file: File }) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(500);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let cleanup: (() => Promise<void>) | undefined;
    void (async () => {
      const { getDocument } = await import("@/lib/energy/pdf");
      if (!active) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!active) return;
      const task = getDocument({ data: bytes });
      cleanup = () => task.destroy();
      const pdf = await task.promise;
      if (active) setDocument(pdf);
    })().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      void cleanup?.();
    };
  }, [file]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, entry.contentRect.width - 24)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let active = true;
    let cancel: (() => void) | undefined;
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (!active || !canvas.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: (width / base.width) * zoom });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.current.width = Math.ceil(viewport.width * ratio);
      canvas.current.height = Math.ceil(viewport.height * ratio);
      canvas.current.style.width = `${viewport.width}px`;
      canvas.current.style.height = `${viewport.height}px`;
      const task = pdfPage.render({
        canvas: canvas.current,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      cancel = () => task.cancel();
      await task.promise;
    })().catch((err) => {
      if (active && err?.name !== "RenderingCancelledException") setError(true);
    });
    return () => {
      active = false;
      cancel?.();
    };
  }, [document, page, width, zoom]);

  return (
    <section className="energy-panel" aria-label={t("energy.pdfPreview")}>
      <div className="energy-panel-head energy-row">
        <h2>{t("energy.pdfPreview")}</h2>
        <div className="energy-actions">
          <button
            className="energy-button"
            type="button"
            aria-label={t("energy.previousPage")}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span className="text-xs" aria-live="polite">
            {page} / {document?.numPages ?? "…"}
          </span>
          <button
            className="energy-button"
            type="button"
            aria-label={t("energy.nextPage")}
            disabled={!document || page >= document.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
          <label className="sr-only" htmlFor="energy-zoom">
            {t("energy.zoom")}
          </label>
          <select
            id="energy-zoom"
            className="energy-input"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value={1}>{t("energy.fitWidth")}</option>
            <option value={1.25}>125%</option>
            <option value={1.75}>175%</option>
          </select>
        </div>
      </div>
      <div ref={container} className="energy-pdf">
        {error ? (
          <p role="alert">{t("energy.pdfRenderError")}</p>
        ) : (
          <>
            {!document && <p role="status">{t("energy.reading")}</p>}
            <canvas ref={canvas} aria-label={t("energy.pdfPage", { page })} />
          </>
        )}
      </div>
    </section>
  );
}
