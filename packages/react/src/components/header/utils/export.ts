import { Message } from "@arco-design/web-react";
import type { Editor } from "sketching-core";
import { Range } from "sketching-core";
import type { Delta } from "sketching-delta";
import { DeltaSet } from "sketching-delta";
import { DateTime, Storage } from "sketching-utils";

import { Background } from "../../../modules/background";
import type { LocalStorageData } from "../../../utils/storage";
import { EXAMPLE, STORAGE_KEY } from "../../../utils/storage";
import { DEFAULT_PAGE_HEIGHT } from "../../../utils/constant";
import { parseLinks } from "./link";

export const exportPDF = async (DPI = 1) => {
  if (!window.PDFDocument || !window.blobStream) {
    Message.warning("PDF模块未加载完成，请稍后");
  }
  const data = Storage.local.get<LocalStorageData>(STORAGE_KEY) || EXAMPLE;
  const deltaSetLike = data && data.deltaSetLike;
  const pageCount = data.pageCount ?? 1;
  const pageHeight = data.pageHeight ?? DEFAULT_PAGE_HEIGHT;
  Background.setRange(Range.fromRect(data.x, data.y, data.width, pageHeight), pageCount);
  const deltaSet = new DeltaSet(deltaSetLike);
  const deltas: Delta[] = [];
  const tasks: Promise<Delta>[] = [];
  deltaSet.forEach((_, delta) => deltas.push(delta));
  deltas.sort((a, b) => a.getZ() - b.getZ());

  if (pageCount === 1) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const { x, y, width, height } = Background.rect;
    const ratio = Math.ceil(window.devicePixelRatio * 1 || 1) * DPI;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.style.position = "absolute";
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.translate(-x, -y);
    deltas.forEach(delta => {
      const task = delta.drawing(ctx);
      task && tasks.push(task);
    });
    await Promise.all(tasks).then(delta => {
      delta.forEach(it => it.drawing(ctx));
    });
    const base64 = canvas.toDataURL("image/jpeg");
    const links = parseLinks(deltaSet);
    const doc = new window.PDFDocument({
      size: [width, height],
    });
    links.forEach(link => {
      doc.link(link.x, link.y, link.width, link.height, link.url);
    });
    doc.image(base64, 0, 0, { width, height });
    const stream = doc.pipe(window.blobStream());
    doc.end();
    stream.on("finish", function () {
      const url = stream.toBlobURL("application/pdf");
      const a = document.createElement("a");
      a.href = url;
      const now = new DateTime().format("yyyyMMdd_hhmmss");
      a.download = "RESUME_" + now + ".pdf";
      a.click();
    });
  } else {
    const { x, y, width } = Background.rect;
    const ratio = Math.ceil(window.devicePixelRatio * 1 || 1) * DPI;

    const page1Deltas: Delta[] = [];
    const page2Deltas: Delta[] = [];
    deltas.forEach(delta => {
      const rect = delta.getRect();
      const deltaY = rect.y;
      if (deltaY < pageHeight) {
        page1Deltas.push(delta);
      } else if (deltaY < pageHeight * 2) {
        page2Deltas.push(delta);
      }
    });

    // 渲染第一页
    const canvas1 = document.createElement("canvas");
    const ctx1 = canvas1.getContext("2d") as CanvasRenderingContext2D;
    canvas1.width = width * ratio;
    canvas1.height = pageHeight * ratio;
    canvas1.style.width = width + "px";
    canvas1.style.height = pageHeight + "px";
    canvas1.style.position = "absolute";
    ctx1.scale(ratio, ratio);
    ctx1.fillStyle = "#fff";
    ctx1.fillRect(0, 0, width, pageHeight);
    ctx1.translate(-x, -y);

    const tasks1: Promise<Delta>[] = [];
    page1Deltas.forEach(delta => {
      const task = delta.drawing(ctx1);
      task && tasks1.push(task);
    });
    await Promise.all(tasks1).then(delta => {
      delta.forEach(it => it.drawing(ctx1));
    });
    const base64_1 = canvas1.toDataURL("image/jpeg");

    // 渲染第二页
    const canvas2 = document.createElement("canvas");
    const ctx2 = canvas2.getContext("2d") as CanvasRenderingContext2D;
    canvas2.width = width * ratio;
    canvas2.height = pageHeight * ratio;
    canvas2.style.width = width + "px";
    canvas2.style.height = pageHeight + "px";
    canvas2.style.position = "absolute";
    ctx2.scale(ratio, ratio);
    ctx2.fillStyle = "#fff";
    ctx2.fillRect(0, 0, width, pageHeight);
    ctx2.translate(-x, -(y + pageHeight));

    const tasks2: Promise<Delta>[] = [];
    page2Deltas.forEach(delta => {
      const task = delta.drawing(ctx2);
      task && tasks2.push(task);
    });
    await Promise.all(tasks2).then(delta => {
      delta.forEach(it => it.drawing(ctx2));
    });
    const base64_2 = canvas2.toDataURL("image/jpeg");

    // 生成两页 PDF
    const doc = new window.PDFDocument({
      size: [width, pageHeight],
    });
    doc.image(base64_1, 0, 0, { width, height: pageHeight });
    doc.addPage({ size: [width, pageHeight] });
    doc.image(base64_2, 0, 0, { width, height: pageHeight });
    const stream = doc.pipe(window.blobStream());
    doc.end();
    stream.on("finish", function () {
      const url = stream.toBlobURL("application/pdf");
      const a = document.createElement("a");
      a.href = url;
      const now = new DateTime().format("yyyyMMdd_hhmmss");
      a.download = "RESUME_" + now + ".pdf";
      a.click();
    });
  }
};

export const exportJSON = (editor: Editor) => {
  const deltaSetLike = editor.deltaSet.getDeltas();
  const storageData = { ...Background.rect, deltaSetLike };
  const str = JSON.stringify(storageData, null, 2);
  const blob = new Blob([str], { type: "application/json;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  const now = new DateTime().format("yyyyMMdd_hhmmss");
  a.download = "RESUME_" + now + ".json";
  a.click();
};
