import type { DeltaLike, DeltaSetLike } from "sketching-delta";
import { ROOT_DELTA } from "sketching-utils";

import type { LocalStorageData } from "./storage";
import { getPageConfig } from "./storage";

type PageConfig = ReturnType<typeof getPageConfig>;

const cloneDelta = (delta: DeltaLike): DeltaLike => ({
  ...delta,
  attrs: { ...(delta.attrs || {}) },
  children: [...(delta.children || [])],
});

const getPageTop = (data: Pick<LocalStorageData, "y">, config: PageConfig, index: number) => {
  return data.y + (config.pageHeight + config.pageGap) * index;
};

const intersectsPage = (
  delta: DeltaLike,
  data: Pick<LocalStorageData, "y">,
  config: PageConfig,
  pageIndex: number
) => {
  const pageTop = getPageTop(data, config, pageIndex);
  const pageBottom = pageTop + config.pageHeight;
  const deltaTop = delta.y;
  const deltaBottom = delta.y + delta.height;
  return deltaBottom > pageTop && deltaTop < pageBottom;
};

const isInKeptPages = (
  delta: DeltaLike,
  data: Pick<LocalStorageData, "y">,
  config: PageConfig
) => {
  for (let i = 0; i < config.pageCount; i++) {
    if (intersectsPage(delta, data, config, i)) return true;
  }
  return false;
};

const getRoot = (deltas: DeltaSetLike) => {
  return (
    deltas[ROOT_DELTA] || {
      x: -999999,
      y: -999999,
      z: 0,
      id: ROOT_DELTA,
      key: "entry",
      width: 0,
      height: 0,
      attrs: {},
      children: [],
    }
  );
};

const normalizeChildren = (deltas: DeltaSetLike) => {
  const ids = new Set(Object.keys(deltas));
  Object.values(deltas).forEach(delta => {
    delta.children = (delta.children || []).filter(id => ids.has(id));
  });
  const root = deltas[ROOT_DELTA];
  const ordered = new Set(root.children || []);
  Object.keys(deltas).forEach(id => {
    if (id !== ROOT_DELTA && !ordered.has(id)) {
      root.children = [...(root.children || []), id];
    }
  });
};

const keepVisibleDeltas = (
  deltaSetLike: DeltaSetLike,
  data: Pick<LocalStorageData, "y">,
  config: PageConfig
) => {
  const next: DeltaSetLike = {};
  next[ROOT_DELTA] = cloneDelta(getRoot(deltaSetLike));
  Object.entries(deltaSetLike).forEach(([id, delta]) => {
    if (id === ROOT_DELTA) return;
    if (!isInKeptPages(delta, data, config)) return;
    next[id] = cloneDelta(delta);
  });
  next[ROOT_DELTA].children = (next[ROOT_DELTA].children || []).filter(id => !!next[id]);
  normalizeChildren(next);
  return next;
};

export const createPagedTemplateData = (
  data: LocalStorageData,
  overrides: Partial<PageConfig> = {}
): LocalStorageData => {
  const config = { ...getPageConfig(data), ...overrides };
  const height = config.pageHeight * config.pageCount + config.pageGap * (config.pageCount - 1);
  const next = keepVisibleDeltas(data.deltaSetLike, data, config);

  normalizeChildren(next);
  return {
    ...data,
    height,
    deltaSetLike: next,
    pageCount: config.pageCount,
    pageHeight: config.pageHeight,
    pageGap: config.pageGap,
    pageMargin: config.pageMargin,
  };
};
