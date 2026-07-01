import type { CanvasResetEvent, Editor, RangeRect } from "sketching-core";
import { EDITOR_EVENT, Range } from "sketching-core";

import {
  A4,
  DEFAULT_PAGE_COUNT,
  DEFAULT_PAGE_GAP,
  DEFAULT_PAGE_HEIGHT,
  DEFAULT_PAGE_MARGIN,
  DPI,
  PAGE_OFFSET,
} from "../utils/constant";

declare global {
  var __SKETCHING_PAGE_FLOW__:
    | {
        pageY: number;
        pageHeight: number;
        pageGap: number;
        pageMargin: number;
        pageCount: number;
      }
    | undefined;
}

export class Background {
  public static range: Range;
  public static rect: RangeRect;
  public static pageCount = DEFAULT_PAGE_COUNT;
  public static pageHeight = DEFAULT_PAGE_HEIGHT;
  public static pageGap = DEFAULT_PAGE_GAP;
  public static pageMargin = DEFAULT_PAGE_MARGIN;
  private static canvas: HTMLCanvasElement;
  private static ctx: CanvasRenderingContext2D;

  public static init(editor: Editor) {
    const dom = editor.getContainer();
    dom.style.position = "relative";
    Background.canvas = document.createElement("canvas");
    Background.ctx = Background.canvas.getContext("2d") as CanvasRenderingContext2D;
    Background.canvas.style.background = "var(--color-fill-3)";
    Background.canvas.style.position = "absolute";
    Background.canvas.style.zIndex = "-1";
    Background.setRect(dom.offsetWidth, dom.offsetHeight);
    if (!Background.range) {
      const opWidthPX = (A4.width * DPI) / 25.4;
      const opHeightPX = (A4.height * DPI) / 25.4;
      const range = Range.fromRect(PAGE_OFFSET.x, PAGE_OFFSET.y, opWidthPX, opHeightPX);
      Background.setRange(range, opHeightPX, DEFAULT_PAGE_COUNT, DEFAULT_PAGE_GAP, DEFAULT_PAGE_MARGIN);
    }
    dom.insertBefore(Background.canvas, dom.firstChild);
    editor.event.on(EDITOR_EVENT.CANVAS_RESET, Background.onReset);
  }

  public static setRect(width: number, height: number) {
    const ctx = Background.ctx;
    const canvas = Background.canvas;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(ratio, ratio);
  }

  public static setRange(
    range: Range,
    pageHeight?: number,
    pageCount: number = DEFAULT_PAGE_COUNT,
    pageGap: number = DEFAULT_PAGE_GAP,
    pageMargin: number = DEFAULT_PAGE_MARGIN
  ) {
    const prevRect = range.rect();
    Background.pageCount = pageCount;
    Background.pageHeight = pageHeight || prevRect.height;
    Background.pageGap = pageGap;
    Background.pageMargin = Math.min(pageMargin, Math.floor(Background.pageHeight / 2));
    const totalHeight =
      Background.pageHeight * Background.pageCount + Background.pageGap * (Background.pageCount - 1);
    const next = Range.fromRect(
      prevRect.x,
      prevRect.y,
      Math.ceil(prevRect.width),
      Math.ceil(totalHeight)
    );
    Background.range = next;
    Background.rect = next.rect();
    globalThis.__SKETCHING_PAGE_FLOW__ = {
      pageY: prevRect.y,
      pageHeight: Background.pageHeight,
      pageGap: Background.pageGap,
      pageMargin: Background.pageMargin,
      pageCount: Background.pageCount,
    };
  }

  public static render() {
    const ctx = Background.ctx;
    const space = Background.range;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    const rect = space.rect();
    const pageHeight = Background.pageHeight;
    const pageStride = pageHeight + Background.pageGap;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#e5e6eb";
    ctx.lineWidth = 1;
    for (let i = 0; i < Background.pageCount; i++) {
      const pageY = rect.y + pageStride * i;
      ctx.fillRect(rect.x, pageY, rect.width, pageHeight);
      ctx.strokeRect(rect.x, pageY, rect.width, pageHeight);
    }
  }

  private static onReset(e: CanvasResetEvent) {
    const { range, offsetX, offsetY } = e;
    if (!range) return void 0;
    const ctx = Background.ctx;
    const { height, width } = range.rect();
    Background.setRect(width, height);
    ctx.translate(-offsetX, -offsetY);
    Background.render();
  }

  public static destroy(editor: Editor) {
    const dom = editor.getContainer();
    dom.removeChild(Background.canvas);
    editor.event.off(EDITOR_EVENT.CANVAS_RESET, Background.onReset);
  }
}
