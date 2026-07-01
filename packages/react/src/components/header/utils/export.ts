import { Message } from "@arco-design/web-react";
import type { Editor } from "sketching-core";
import { Range } from "sketching-core";
import type { Delta } from "sketching-delta";
import { DeltaSet } from "sketching-delta";
import { DateTime, Storage } from "sketching-utils";

import { Background } from "../../../modules/background";
import type { LocalStorageData } from "../../../utils/storage";
import { EXAMPLE, getPageConfig, STORAGE_KEY } from "../../../utils/storage";
import { parseLinks } from "./link";

const PDFKIT_CDN = "https://unpkg.com/pdfkit@0.14.0/js/pdfkit.standalone.js";
const BLOB_STREAM_CDN = "https://unpkg.com/blob-stream@0.1.3/.js";
let pdfModulesPromise: Promise<void> | null = null;

const getPDFWindow = () =>
  window as unknown as {
    PDFDocument?: Window["PDFDocument"];
    blobStream?: Window["blobStream"];
  };

const loadScript = (id: string, src: string, ready: () => boolean) => {
  if (ready()) return Promise.resolve();
  let existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing && !ready()) {
    existing.remove();
    existing = null;
  }
  return new Promise<void>((resolve, reject) => {
    const script = existing || document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.onerror = null;
      script.onload = null;
      reject(new Error(`PDF模块加载超时: ${src}`));
    }, 15000);
    script.onload = () => {
      window.clearTimeout(timeout);
      ready() ? resolve() : reject(new Error(`PDF模块加载失败: ${src}`));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`PDF模块加载失败: ${src}`));
    };
    if (!existing) {
      script.id = id;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.src = src;
      document.body.appendChild(script);
    }
  });
};

const ensurePDFModulesLoaded = async () => {
  const pdfWindow = getPDFWindow();
  if (pdfWindow.PDFDocument && pdfWindow.blobStream) return void 0;
  if (!pdfModulesPromise) {
    pdfModulesPromise = Promise.all([
      loadScript("__pdfkit-script", PDFKIT_CDN, () => !!getPDFWindow().PDFDocument),
      loadScript("__blob-stream-script", BLOB_STREAM_CDN, () => !!getPDFWindow().blobStream),
    ])
      .then(() => void 0)
      .catch(error => {
        pdfModulesPromise = null;
        throw error;
      });
  }
  await pdfModulesPromise;
};

export const exportPDF = async (DPI = 1) => {
  try {
    await ensurePDFModulesLoaded();
    const data = Storage.local.get<LocalStorageData>(STORAGE_KEY) || EXAMPLE;
    const deltaSetLike = data && data.deltaSetLike;
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(data);
    Background.setRange(
      Range.fromRect(data.x, data.y, data.width, pageHeight),
      pageHeight,
      pageCount,
      pageGap,
      pageMargin
    );
    const deltaSet = new DeltaSet(deltaSetLike);
    const deltas: Delta[] = [];
    deltaSet.forEach((_, delta) => deltas.push(delta));
    deltas.sort((a, b) => a.getZ() - b.getZ());

    const { x, y, width } = Background.rect;
    const ratio = Math.ceil(window.devicePixelRatio * 1 || 1) * DPI;
    const pageStride = pageHeight + pageGap;

    const renderPage = async (pageIndex: number) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const tasks: Promise<Delta>[] = [];
      canvas.width = width * ratio;
      canvas.height = pageHeight * ratio;
      canvas.style.width = width + "px";
      canvas.style.height = pageHeight + "px";
      canvas.style.position = "absolute";
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, pageHeight);
      ctx.translate(-x, -(y + pageStride * pageIndex));
      deltas.forEach(delta => {
        const task = delta.drawing(ctx);
        task && tasks.push(task);
      });
      await Promise.all(tasks).then(delta => {
        delta.forEach(it => it.drawing(ctx));
      });
      return canvas.toDataURL("image/jpeg");
    };

    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_, pageIndex) => renderPage(pageIndex))
    );
    const links = parseLinks(deltaSet);
    const doc = new window.PDFDocument({
      size: [width, pageHeight],
    });
    pages.forEach((base64, pageIndex) => {
      if (pageIndex > 0) {
        doc.addPage({ size: [width, pageHeight] });
      }
      doc.image(base64, 0, 0, { width, height: pageHeight });
      const pageTop = pageStride * pageIndex;
      const pageBottom = pageTop + pageHeight;
      links.forEach(link => {
        if (link.y + link.height <= pageTop || link.y >= pageBottom) return;
        doc.link(link.x, link.y - pageTop, link.width, link.height, link.url);
      });
    });
    const stream = doc.pipe(window.blobStream());
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", function () {
        const url = stream.toBlobURL("application/pdf");
        const a = document.createElement("a");
        a.href = url;
        const now = new DateTime().format("yyyyMMdd_hhmmss");
        a.download = "RESUME_" + now + ".pdf";
        a.click();
        resolve();
      });
      stream.on("error", reject);
      doc.end();
    });
  } catch (error) {
    console.error(error);
    Message.error(error instanceof Error ? error.message : "PDF导出失败，请稍后重试");
  }
};

export const exportJSON = (editor: Editor) => {
  const deltaSetLike = editor.deltaSet.getDeltas();
  const storageData: LocalStorageData = {
    ...Background.rect,
    deltaSetLike,
    pageCount: Background.pageCount,
    pageHeight: Background.pageHeight,
    pageGap: Background.pageGap,
    pageMargin: Background.pageMargin,
  };
  const str = JSON.stringify(storageData, null, 2);
  const blob = new Blob([str], { type: "application/json;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  const now = new DateTime().format("yyyyMMdd_hhmmss");
  a.download = "RESUME_" + now + ".json";
  a.click();
};
