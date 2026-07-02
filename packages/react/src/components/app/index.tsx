import type { FC } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ContentChangeEvent } from "sketching-core";
import { Editor, EDITOR_EVENT, LOG_LEVEL, Range } from "sketching-core";
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
  safeSetLocalStorageData,
  STORAGE_KEY,
} from "../../utils/storage";
import { Body } from "../body";
import { ContextMenu } from "../context-menu";
import { Header } from "../header";

// COMPAT: 避免升级的不兼容问题
Storage.setSuffix("");

export const App: FC = () => {
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
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(storageData);
    Background.setRange(
      Range.fromRect(storageData.x, storageData.y, storageData.width, pageHeight),
      pageHeight,
      pageCount,
      pageGap,
      pageMargin
    );
    const deltaSetLike = storageData.deltaSetLike;
    return new Editor({
      deltaSet: new DeltaSet(deltaSetLike),
      logLevel: LOG_LEVEL.INFO,
    });
  }, []);

  useLayoutEffect(() => {
    window.editor = editor;
    const el = ref.current;
    el && editor.onMount(el);
    Background.init(editor);
    window.editor = editor;
    return () => {
      Background.destroy(editor);
      editor.destroy();
    };
  }, [editor]);

  useEffect(() => {
    const onContentChange = (e: ContentChangeEvent) => {
      const deltaSetLike = e.current.getDeltas();
      const storageData: LocalStorageData = {
        ...Background.rect,
        deltaSetLike,
        pageCount: Background.pageCount,
        pageHeight: Background.pageHeight,
        pageGap: Background.pageGap,
        pageMargin: Background.pageMargin,
      };
      safeSetLocalStorageData(storageData);
    };
    editor.event.on(EDITOR_EVENT.CONTENT_CHANGE, onContentChange);
    return () => {
      editor.event.off(EDITOR_EVENT.CONTENT_CHANGE, onContentChange);
    };
  }, [editor]);

  return (
    <WithEditor editor={editor}>
      <Header></Header>
      <Body ref={ref}></Body>
      <ContextMenu></ContextMenu>
    </WithEditor>
  );
};
