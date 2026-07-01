import type { DeltaSetLike } from "sketching-delta";

import {
  DEFAULT_PAGE_COUNT,
  DEFAULT_PAGE_GAP,
  DEFAULT_PAGE_HEIGHT,
  DEFAULT_PAGE_MARGIN,
  PAGE_COUNT_MAX,
  PAGE_COUNT_MIN,
  PAGE_GAP_MAX,
  PAGE_GAP_MIN,
  PAGE_MARGIN_MAX,
  PAGE_MARGIN_MIN,
} from "./constant";

export type LocalStorageData = {
  x: number;
  y: number;
  width: number;
  height: number;
  deltaSetLike: DeltaSetLike;
  pageCount?: number;   // default 1
  pageHeight?: number;  // per-page height in px, default 1122
  pageGap?: number;     // visual gap between pages, default 24
  pageMargin?: number;  // inner page top/bottom margin, inferred from template when absent
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const inferPageMargin = (
  data: Pick<LocalStorageData, "y" | "deltaSetLike" | "pageMargin">
) => {
  if (typeof data.pageMargin === "number") {
    return data.pageMargin;
  }
  const deltas = data.deltaSetLike;
  if (!deltas) return DEFAULT_PAGE_MARGIN;
  const topList = Object.entries(deltas)
    .filter(([id, delta]) => id !== "ROOT" && typeof delta.y === "number")
    .map(([, delta]) => delta.y);
  if (!topList.length) return DEFAULT_PAGE_MARGIN;
  const top = Math.min(...topList);
  const inferred = Math.round(top - data.y);
  if (inferred < PAGE_MARGIN_MIN || inferred > 80) {
    return DEFAULT_PAGE_MARGIN;
  }
  return inferred;
};

export const getPageConfig = (
  data: Pick<
    LocalStorageData,
    "y" | "height" | "deltaSetLike" | "pageCount" | "pageHeight" | "pageGap" | "pageMargin"
  >
) => {
  const pageCount = clamp(Math.round(data.pageCount || DEFAULT_PAGE_COUNT), PAGE_COUNT_MIN, PAGE_COUNT_MAX);
  const pageGap = clamp(Math.round(data.pageGap ?? DEFAULT_PAGE_GAP), PAGE_GAP_MIN, PAGE_GAP_MAX);
  const pageMargin = clamp(Math.round(inferPageMargin(data)), PAGE_MARGIN_MIN, PAGE_MARGIN_MAX);
  const pageHeight =
    data.pageHeight ||
    (data.height - pageGap * (pageCount - 1)) / pageCount ||
    DEFAULT_PAGE_HEIGHT;
  return { pageCount, pageHeight, pageGap, pageMargin };
};

export const STORAGE_KEY = "__sketching-storage";
export const EXAMPLE: LocalStorageData = {
  x: 160,
  y: 30,
  width: 793.7007874015749,
  height: 1122.4818897637797,
  deltaSetLike: {
    ROOT: {
      x: -999999,
      y: -999999,
      z: 0,
      id: "ROOT",
      key: "entry",
      width: 0,
      height: 0,
      attrs: {},
      children: ["ltfRU5Rmpi", "MAhBg3wRaK"],
    },
    ltfRU5Rmpi: {
      x: 417.5,
      y: 387,
      z: 0,
      id: "ltfRU5Rmpi",
      key: "rect",
      width: 278,
      height: 14,
      attrs: {
        "L": "false",
        "R": "false",
        "T": "false",
        "B": "true",
        "border-color": "#020202B8",
      },
      children: [],
    },
    MAhBg3wRaK: {
      x: 460.5,
      y: 352,
      z: 0,
      id: "MAhBg3wRaK",
      key: "text",
      width: 192,
      height: 38,
      attrs: {
        DATA: '[{"chars":[{"char":"基","config":{"WEIGHT":"bold"}},{"char":"于","config":{"WEIGHT":"bold"}},{"char":"C","config":{"WEIGHT":"bold"}},{"char":"a","config":{"WEIGHT":"bold"}},{"char":"n","config":{"WEIGHT":"bold"}},{"char":"v","config":{"WEIGHT":"bold"}},{"char":"a","config":{"WEIGHT":"bold"}},{"char":"s","config":{"WEIGHT":"bold"}},{"char":"实","config":{"WEIGHT":"bold"}},{"char":"现","config":{"WEIGHT":"bold"}},{"char":"的","config":{"WEIGHT":"bold"}},{"char":"简","config":{"WEIGHT":"bold"}},{"char":"历","config":{"WEIGHT":"bold"}},{"char":"编","config":{"WEIGHT":"bold"}},{"char":"辑","config":{"WEIGHT":"bold"}},{"char":"器","config":{"WEIGHT":"bold"}}],"config":{}}]',
        ORIGIN_DATA: '[{"children":[{"text":"基于Canvas实现的简历编辑器","bold":true}]}]',
      },
      children: [],
    },
  },
};
