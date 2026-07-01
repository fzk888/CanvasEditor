import { Point } from "sketching-core";

// 暂时认为`DPI`为`96`
export const DPI = 96;
export const A4 = { width: 210, height: 296.99 };
export const PAGE_OFFSET = new Point(160, 30);

export const IMAGE_INPUT_DOM_ID = "__image-upload-input";

export const PAGE_HEIGHT_MIN = 600;
export const PAGE_HEIGHT_MAX = 2000;
export const PAGE_GAP_MIN = 0;
export const PAGE_GAP_MAX = 200;
export const DEFAULT_PAGE_GAP = 24;
export const PAGE_MARGIN_MIN = 0;
export const PAGE_MARGIN_MAX = 200;
export const DEFAULT_PAGE_MARGIN = 24;
export const DEFAULT_PAGE_HEIGHT = Math.ceil((A4.height * DPI) / 25.4); // 1122
export const PAGE_WIDTH = Math.ceil((A4.width * DPI) / 25.4); // 793
export const PAGE_COUNT_MIN = 1;
export const PAGE_COUNT_MAX = 10;
export const DEFAULT_PAGE_COUNT = 1;
