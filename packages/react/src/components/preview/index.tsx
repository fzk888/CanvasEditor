import type { FC } from "react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Editor, LOG_LEVEL, Range } from "sketching-core";
import { DeltaSet } from "sketching-delta";
import { Storage } from "sketching-utils";

import { WithEditor } from "../../hooks/use-editor";
import { Background } from "../../modules/background";
import { createPagedTemplateData } from "../../utils/page-template";
import type { LocalStorageData } from "../../utils/storage";
import {
  backupRawStorage,
  EXAMPLE,
  getPageConfig,
  normalizeLocalStorageData,
  STORAGE_KEY,
} from "../../utils/storage";
import { Body } from "./components/body";

export const Preview: FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const editor = useMemo(() => {
    let storageData: LocalStorageData = EXAMPLE;
    try {
      const data = normalizeLocalStorageData(Storage.local.get<LocalStorageData>(STORAGE_KEY));
      if (data) {
        storageData = createPagedTemplateData(data, getPageConfig(data));
      } else {
        backupRawStorage();
      }
    } catch (error) {
      backupRawStorage();
      console.error(error);
    }
    const deltaSetLike = storageData.deltaSetLike;
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(storageData);
    Background.setRange(
      Range.fromRect(storageData.x, storageData.y, storageData.width, pageHeight),
      pageHeight,
      pageCount,
      pageGap,
      pageMargin
    );
    return new Editor({
      deltaSet: new DeltaSet(deltaSetLike),
      logLevel: LOG_LEVEL.INFO,
      readonly: true,
    });
  }, []);

  useLayoutEffect(() => {
    window.editor = editor;
    const el = ref.current;
    el && editor.onMount(el);
    window.editor = editor;
    editor.canvas.grab.setState(false);
    const { x, y } = Background.rect;
    editor.canvas.setOffset(x, y);
    return () => {
      editor.destroy();
    };
  }, [editor]);

  return (
    <WithEditor editor={editor}>
      <Body ref={ref} editor={editor}></Body>
    </WithEditor>
  );
};
