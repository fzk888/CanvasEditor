import { Button, Dropdown, InputNumber, Menu, Modal } from "@arco-design/web-react";
import type { RefInputType } from "@arco-design/web-react/es/Input";
import { IconDown, IconGithub, IconRedo, IconUndo } from "@arco-design/web-react/icon";
import { useMemoFn } from "@block-kit/utils/dist/es/hooks";
import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "sketching-core";
import { EDITOR_EVENT, Range } from "sketching-core";
import { DeltaSet } from "sketching-delta";
import {
  PAGE_COUNT_MAX,
  PAGE_COUNT_MIN,
  PAGE_GAP_MAX,
  PAGE_GAP_MIN,
  PAGE_HEIGHT_MAX,
  PAGE_HEIGHT_MIN,
  PAGE_MARGIN_MAX,
  PAGE_MARGIN_MIN,
} from "../../../utils/constant";
import { cs, Storage } from "sketching-utils";

import { Background } from "../../../modules/background";
import { createPagedTemplateData } from "../../../utils/page-template";
import type { LocalStorageData } from "../../../utils/storage";
import { EXAMPLE, getPageConfig, STORAGE_KEY } from "../../../utils/storage";
import styles from "../index.m.scss";
import { exportJSON, exportPDF } from "../utils/export";
import { importJSON } from "../utils/import";

export const Right: FC<{
  editor: Editor;
}> = ({ editor }) => {
  const [undoAble, setUndoAble] = useState<boolean>(false);
  const [redoAble, setRedoAble] = useState<boolean>(false);
  const widthRef = useRef<RefInputType>(null);
  const heightRef = useRef<RefInputType>(null);
  const pageCountRef = useRef<RefInputType>(null);
  const pageHeightRef = useRef<RefInputType>(null);
  const pageGapRef = useRef<RefInputType>(null);
  const pageMarginRef = useRef<RefInputType>(null);

  const query = useMemoFn(() => {
    setUndoAble(editor.history.canUndo());
    setRedoAble(editor.history.canRedo());
  });

  useEffect(() => {
    query();
    editor.event.on(EDITOR_EVENT.CONTENT_CHANGE, query);
    return () => {
      editor.event.off(EDITOR_EVENT.CONTENT_CHANGE, query);
    };
  }, [editor, query]);

  const getCurrentStorageData = (): LocalStorageData => {
    const data = Storage.local.get<LocalStorageData>(STORAGE_KEY) || EXAMPLE;
    return {
      ...data,
      ...Background.rect,
      deltaSetLike: editor.deltaSet.getDeltas(),
      pageCount: Background.pageCount,
      pageHeight: Background.pageHeight,
      pageGap: Background.pageGap,
      pageMargin: Background.pageMargin,
    };
  };

  const applyPagedData = (
    data: LocalStorageData,
    overrides: Parameters<typeof createPagedTemplateData>[1]
  ) => {
    const storageData = createPagedTemplateData(data, overrides);
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(storageData);
    Background.setRange(
      Range.fromRect(storageData.x, storageData.y, storageData.width, pageHeight),
      pageHeight,
      pageCount,
      pageGap,
      pageMargin
    );
    editor.state.setContent(new DeltaSet(storageData.deltaSetLike));
    Storage.local.set(STORAGE_KEY, storageData);
    Background.render();
    editor.canvas.reset();
  };

  const onResizeBackGround = () => {
    const { x, y, width, height } = Background.rect;
    Modal.confirm({
      title: "调整画布大小",
      className: styles.resizeModal,
      content: (
        <div className={styles.modalContent}>
          <div>宽(width) x 高(height):</div>
          <InputNumber
            size="small"
            ref={widthRef}
            className={styles.input}
            min={600}
            max={2000}
            defaultValue={width}
          />
          <InputNumber
            size="small"
            ref={heightRef}
            className={styles.input}
            min={1000}
            max={4000}
            defaultValue={height}
          />
        </div>
      ),
      onConfirm: () => {
        if (!widthRef.current || !heightRef.current) return;
        const width = Number(widthRef.current.dom.value);
        const height = Number(heightRef.current.dom.value);
        if (!width || !height) return;
        applyPagedData(
          {
            ...getCurrentStorageData(),
            x,
            y,
            width,
            height,
          },
          {
            pageCount: 1,
            pageHeight: height,
            pageGap: Background.pageGap,
            pageMargin: Background.pageMargin,
          }
        );
      },
    });
  };

  const onSwitchPageCount = (count: number) => {
    const data = getCurrentStorageData();
    const { pageHeight, pageGap, pageMargin } = getPageConfig(data);
    applyPagedData(data, {
      pageCount: count,
      pageHeight,
      pageGap,
      pageMargin,
    });
  };

  const onSetPageCount = () => {
    const data = getCurrentStorageData();
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(data);
    Modal.confirm({
      title: "设置页数",
      className: styles.resizeModal,
      content: (
        <div className={styles.modalContent}>
          <div>页数(page count):</div>
          <InputNumber
            size="small"
            ref={pageCountRef}
            className={styles.input}
            min={PAGE_COUNT_MIN}
            max={PAGE_COUNT_MAX}
            defaultValue={pageCount}
          />
        </div>
      ),
      onConfirm: () => {
        if (!pageCountRef.current) return;
        const nextCount = Number(pageCountRef.current.dom.value);
        if (!nextCount) return;
        applyPagedData(data, {
          pageCount: nextCount,
          pageHeight,
          pageGap,
          pageMargin,
        });
      },
    });
  };

  const onSetPageHeight = () => {
    const data = getCurrentStorageData();
    const { pageCount, pageHeight: currentHeight, pageGap, pageMargin } = getPageConfig(data);
    Modal.confirm({
      title: "设置页高",
      className: styles.resizeModal,
      content: (
        <div className={styles.modalContent}>
          <div>页高(height, 单位px):</div>
          <InputNumber
            size="small"
            ref={pageHeightRef}
            className={styles.input}
            min={PAGE_HEIGHT_MIN}
            max={PAGE_HEIGHT_MAX}
            defaultValue={currentHeight}
          />
        </div>
      ),
      onConfirm: () => {
        if (!pageHeightRef.current) return;
        const pageHeight = Number(pageHeightRef.current.dom.value);
        if (!pageHeight) return;
        applyPagedData(data, {
          pageCount,
          pageHeight,
          pageGap,
          pageMargin,
        });
      },
    });
  };

  const onSetPageGap = () => {
    const data = getCurrentStorageData();
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(data);
    Modal.confirm({
      title: "设置页间距",
      className: styles.resizeModal,
      content: (
        <div className={styles.modalContent}>
          <div>页间距(gap, 单位px):</div>
          <InputNumber
            size="small"
            ref={pageGapRef}
            className={styles.input}
            min={PAGE_GAP_MIN}
            max={PAGE_GAP_MAX}
            defaultValue={pageGap}
          />
        </div>
      ),
      onConfirm: () => {
        if (!pageGapRef.current) return;
        const nextGap = Number(pageGapRef.current.dom.value);
        if (Number.isNaN(nextGap)) return;
        applyPagedData(data, {
          pageCount,
          pageHeight,
          pageGap: nextGap,
          pageMargin,
        });
      },
    });
  };

  const onSetPageMargin = () => {
    const data = getCurrentStorageData();
    const { pageCount, pageHeight, pageGap, pageMargin } = getPageConfig(data);
    Modal.confirm({
      title: "设置页边距",
      className: styles.resizeModal,
      content: (
        <div className={styles.modalContent}>
          <div>页内上下边距(margin, 单位px):</div>
          <InputNumber
            size="small"
            ref={pageMarginRef}
            className={styles.input}
            min={PAGE_MARGIN_MIN}
            max={PAGE_MARGIN_MAX}
            defaultValue={pageMargin}
          />
        </div>
      ),
      onConfirm: () => {
        if (!pageMarginRef.current) return;
        const nextMargin = Number(pageMarginRef.current.dom.value);
        if (Number.isNaN(nextMargin)) return;
        applyPagedData(data, {
          pageCount,
          pageHeight,
          pageGap,
          pageMargin: nextMargin,
        });
      },
    });
  };

  return (
    <div className={cs(styles.externalGroup)}>
      <div className={styles.history}>
        <Button
          onClick={() => editor.history.undo()}
          disabled={!undoAble}
          iconOnly
          icon={<IconUndo />}
          type="text"
          size="small"
        ></Button>
        <Button
          onClick={() => editor.history.redo()}
          disabled={!redoAble}
          iconOnly
          icon={<IconRedo />}
          type="text"
          size="small"
        ></Button>
      </div>
      <Dropdown
        droplist={
          <Menu className={styles.menu}>
            <Menu.Item key="0">
              <a href="?preview" target="_blank">
                预览
              </a>
            </Menu.Item>
            <Menu.Item key="1">
              <div className={styles.export} onClick={() => onResizeBackGround()}>
                画布大小
              </div>
            </Menu.Item>
            <Menu.Item key="pageCount-single" onClick={() => onSwitchPageCount(1)}>
              简历页数 - 单页
            </Menu.Item>
            <Menu.Item key="pageCount-double" onClick={() => onSwitchPageCount(2)}>
              简历页数 - 双页
            </Menu.Item>
            <Menu.Item key="pageCount">
              <div className={styles.export} onClick={() => onSetPageCount()}>
                页数设置
              </div>
            </Menu.Item>
            <Menu.Item key="pageHeight">
              <div className={styles.export} onClick={() => onSetPageHeight()}>
                页高设置
              </div>
            </Menu.Item>
            <Menu.Item key="pageGap">
              <div className={styles.export} onClick={() => onSetPageGap()}>
                页间距设置
              </div>
            </Menu.Item>
            <Menu.Item key="pageMargin">
              <div className={styles.export} onClick={() => onSetPageMargin()}>
                页边距设置
              </div>
            </Menu.Item>
            <Menu.Item key="2">
              <div className={styles.export} onClick={() => importJSON(editor)}>
                导入JSON
              </div>
            </Menu.Item>
          </Menu>
        }
        trigger="click"
        position="br"
      >
        <Button size="mini" type="text">
          操作
          <IconDown />
        </Button>
      </Dropdown>
      <Dropdown
        droplist={
          <Menu className={styles.menu}>
            <Menu.Item key="1">
              <div className={styles.export} onClick={() => exportPDF()}>
                PDF
              </div>
            </Menu.Item>
            <Menu.Item key="3">
              <div className={styles.export} onClick={() => exportJSON(editor)}>
                JSON
              </div>
            </Menu.Item>
            <Menu.Item key="2">
              <div className={styles.export} onClick={() => exportPDF(2)}>
                PDF(高清)
              </div>
            </Menu.Item>
          </Menu>
        }
        trigger="click"
        position="br"
      >
        <Button size="mini" type="text">
          导出
          <IconDown />
        </Button>
      </Dropdown>
      <a
        className={styles.github}
        target="_blank"
        href={"https://github.com/WindrunnerMax/CanvasEditor"}
      >
        <IconGithub />
      </a>
    </div>
  );
};
