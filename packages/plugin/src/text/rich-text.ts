import { TEXT_1 } from "sketching-utils";

import { TRULY } from "../utils/constant";
import { DEFAULT, DIVIDING_LINE_OFFSET, TEXT_ATTRS } from "./constant";
import {
  drawingBackground,
  drawingDividingLine,
  drawingList,
  drawingStrikeThrough,
  drawingUnderline,
  getLineOffset,
} from "./drawing";
import type {
  Attributes,
  RichTextLines,
  TextMatrices,
  TextMatrix,
  TextMatrixItem,
  TextPageFlow,
} from "./types";

export class RichText {
  private ctx: CanvasRenderingContext2D;
  private map: Map<string, TextMetrics>;
  constructor() {
    this.map = new Map();
    const canvas = document.createElement("canvas");
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  }

  private getFont = (config: Attributes) => {
    const fontFamily = config[TEXT_ATTRS.FAMILY] || DEFAULT[TEXT_ATTRS.FAMILY];
    const fontSize = config[TEXT_ATTRS.SIZE] || DEFAULT[TEXT_ATTRS.SIZE];
    const fontWeight = config[TEXT_ATTRS.WEIGHT] || DEFAULT[TEXT_ATTRS.WEIGHT];
    const fontStyle = config[TEXT_ATTRS.STYLE] || DEFAULT[TEXT_ATTRS.STYLE];
    return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  };

  public measure = (text: string, config: Attributes) => {
    const font = this.getFont(config);
    this.ctx.font = font;
    const key = `${font}-${text}`;
    if (this.map.has(key)) {
      return { metric: this.map.get(key), font };
    }
    const metric = this.ctx.measureText(text);
    this.map.set(key, metric);
    return { metric, font };
  };

  public parse = (lines: RichTextLines, width: number) => {
    const group: TextMatrices = [];
    for (const line of lines) {
      const lineHeight = Number(
        line.config[TEXT_ATTRS.LINE_HEIGHT] || DEFAULT[TEXT_ATTRS.LINE_HEIGHT]
      );
      const lineOffset = getLineOffset(line);
      const getDefaultMatrix = (): TextMatrix => ({
        items: [],
        // COMPAT: 高度给予最小值
        originHeight: DEFAULT[TEXT_ATTRS.SIZE],
        height: DEFAULT[TEXT_ATTRS.SIZE] * lineHeight,
        width: 0,
        lineHeight,
        offsetX: lineOffset,
        config: { ...line.config },
        ascent: 0,
        descent: 0,
      });
      let matrix: TextMatrix = getDefaultMatrix();
      for (const fragment of line.chars) {
        for (const character of fragment.char) {
          const item = { char: character, config: { ...fragment.config } };
          const { metric, font } = this.measure(item.char, item.config);
          if (!metric) continue;
          const text: TextMatrixItem = {
            char: item.char,
            font,
            config: item.config,
            width: metric.width,
            height: 0,
            ascent: metric.actualBoundingBoxAscent,
            descent: metric.actualBoundingBoxDescent,
          };
          if (matrix.width + text.width + lineOffset > width) {
            group.push(matrix);
            // 重置行`matrix`
            matrix = getDefaultMatrix();
            // 换行标记
            matrix.config[TEXT_ATTRS.BREAK_LINE_START] = TRULY;
          }
          const fontHeight = metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent;
          text.height = fontHeight;
          matrix.originHeight = Math.max(matrix.originHeight, fontHeight);
          matrix.height = Math.max(matrix.height, fontHeight * lineHeight);
          matrix.width = matrix.width + text.width;
          matrix.ascent = Math.max(matrix.ascent, metric.actualBoundingBoxAscent);
          matrix.descent = Math.max(matrix.descent, metric.actualBoundingBoxDescent);
          matrix.items.push(text);
        }
      }
      matrix.break = true;
      group.push(matrix);
    }
    return group;
  };

  private getFlowPage = (y: number, flow: TextPageFlow) => {
    const pageStride = flow.pageHeight + flow.pageGap;
    const relativeY = y - flow.pageY;
    const rawIndex = Math.floor(relativeY / pageStride);
    const pageIndex = Math.min(Math.max(rawIndex, 0), flow.pageCount - 1);
    const pageTop = flow.pageY + pageStride * pageIndex;
    const pageBottom = pageTop + flow.pageHeight;
    const contentTop = pageTop + flow.pageMargin;
    const contentBottom = Math.max(contentTop, pageBottom - flow.pageMargin);
    return { pageIndex, pageTop, pageBottom, contentTop, contentBottom, pageStride };
  };

  private normalizeFlowY = (y: number, flow?: TextPageFlow) => {
    if (!flow) return y;
    const page = this.getFlowPage(y, flow);
    if (y >= page.contentBottom && page.pageIndex < flow.pageCount - 1) {
      return page.pageTop + page.pageStride + flow.pageMargin;
    }
    return y;
  };

  private getNextFlowY = (offsetY: number, matrixHeight: number, flow?: TextPageFlow) => {
    if (!flow) return offsetY;
    const currentY = this.normalizeFlowY(offsetY, flow);
    const page = this.getFlowPage(currentY, flow);
    if (currentY + matrixHeight > page.contentBottom && page.pageIndex < flow.pageCount - 1) {
      return page.pageTop + page.pageStride + flow.pageMargin;
    }
    return currentY;
  };

  public measureHeight = (matrices: TextMatrices, y: number, flow?: TextPageFlow) => {
    let offsetY = y;
    for (const matrix of matrices) {
      offsetY = this.getNextFlowY(offsetY, matrix.height, flow);
      if (flow) {
        const page = this.getFlowPage(offsetY, flow);
        if (page.pageIndex >= flow.pageCount - 1 && offsetY + matrix.height > page.contentBottom) {
          offsetY = page.contentBottom;
          break;
        }
      }
      offsetY = matrix.config[TEXT_ATTRS.DIVIDING_LINE]
        ? offsetY + DIVIDING_LINE_OFFSET
        : offsetY + matrix.height;
    }
    return Math.max(0, offsetY - y);
  };

  private clip = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    flow?: TextPageFlow
  ) => {
    ctx.beginPath();
    if (!flow) {
      ctx.rect(x, y, width, height);
    } else {
      const pageStride = flow.pageHeight + flow.pageGap;
      const flowY = this.normalizeFlowY(y, flow);
      const bottom = Math.max(y + height, flowY + height);
      for (let i = 0; i < flow.pageCount; i++) {
        const pageTop = flow.pageY + pageStride * i;
        const pageBottom = pageTop + flow.pageHeight;
        const top = Math.max(y, pageTop);
        const clippedBottom = Math.min(bottom, pageBottom);
        if (clippedBottom > top) {
          ctx.rect(x, top, width, clippedBottom - top);
        }
      }
    }
    ctx.clip();
  };

  public render = (
    matrices: TextMatrices,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    flow?: TextPageFlow
  ) => {
    ctx.save();
    this.clip(ctx, x, y, width, height, flow);
    ctx.textBaseline = "bottom";
    let offsetX = x;
    let offsetY = y;
    const bottom = flow ? Math.max(y + height, this.normalizeFlowY(y, flow) + height) : y + height;
    for (const matrix of matrices) {
      offsetY = this.getNextFlowY(offsetY, matrix.height, flow);
      const offsetYBaseLine = offsetY + matrix.height;
      if (offsetYBaseLine > bottom) break;
      if (flow) {
        const page = this.getFlowPage(offsetY, flow);
        if (page.pageIndex >= flow.pageCount - 1 && offsetYBaseLine > page.contentBottom) break;
      }
      if (drawingDividingLine(ctx, matrix, width, offsetX, offsetY)) {
        offsetX = x;
        offsetY = offsetY + DIVIDING_LINE_OFFSET;
        continue;
      }
      const middleOffsetY = offsetYBaseLine - matrix.originHeight / 2;
      drawingList(ctx, matrix.config, offsetX, middleOffsetY, offsetYBaseLine);
      offsetX = offsetX + matrix.offsetX;
      const gap = matrix.break
        ? 0
        : Math.max(0, (width - matrix.width - matrix.offsetX) / matrix.items.length);
      const halfGap = gap / 2;
      for (let i = 0; i < matrix.items.length; ++i) {
        const item = matrix.items[i];
        // Debug Text Render
        // drawingDebugLine(ctx, matrix, item, halfGap, offsetX, offsetY, offsetYBaseLine);
        // 连续绘制背景
        drawingBackground(ctx, matrix, item, i, halfGap, offsetX, offsetYBaseLine);
        // 绘制文字
        ctx.font = item.font;
        ctx.fillStyle = item.config[TEXT_ATTRS.COLOR] || TEXT_1;
        ctx.fillText(item.char, offsetX, offsetYBaseLine);
        // 绘制下划线
        drawingUnderline(ctx, matrix, item, halfGap, offsetX, offsetYBaseLine);
        // 绘制中划线
        drawingStrikeThrough(ctx, item, halfGap, offsetX, middleOffsetY);
        offsetX = offsetX + item.width + gap;
      }
      offsetX = x;
      offsetY = offsetYBaseLine;
    }
    ctx.restore();
  };
}
