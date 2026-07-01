import { Button, Dropdown, InputNumber, Menu, Modal } from "@arco-design/web-react";
import type { RefInputType } from "@arco-design/web-react/es/Input";
import { IconDown, IconGithub, IconRedo, IconUndo } from "@arco-design/web-react/icon";
import { useMemoFn } from "@block-kit/utils/dist/es/hooks";
import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "sketching-core";
import { EDITOR_EVENT, Range } from "sketching-core";
import {
  DEFAULT_PAGE_COUNT,
  DEFAULT_PAGE_HEIGHT,
  PAGE_COUNT_MAX,
  PAGE_COUNT_MIN,
  PAGE_HEIGHT_MAX,
  PAGE_HEIGHT_MIN,
} from "../../../utils/constant";
import { cs, Storage } from "sketching-utils";

import { Background } from "../../../modules/background";
import type { LocalStorageData } from "../../../utils/storage";
import { EXAMPLE, STORAGE_KEY } from "../../../utils/storage";
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
        width && height && Background.setRange(Range.fromRect(x, y, width, height));
        const deltaSetLike = editor.deltaSet.getDeltas();
        const storageData: LocalStorageData = { ...Background.rect, deltaSetLike };
        Storage.local.set(STORAGE_KEY, storageData);
        Background.render();
      },
    });
  };

  const onSwitchPageCount = (count: number) => {
    const data = Storage.local.get<LocalStorageData>(STORAGE_KEY) || EXAMPLE;
    const pageHeight = data.pageHeight ?? DEFAULT_PAGE_HEIGHT;
    Background.setRange(Range.fromRect(data.x, data.y, data.width, pageHeight), pageHeight, count);
    const deltaSetLike = editor.deltaSet.getDeltas();
    const storageData: LocalStorageData = { ...Background.rect, deltaSetLike, pageCount: count, pageHeight };
    Storage.local.set(STORAGE_KEY, storageData);
    Background.render();
    editor.canvas.reset();
  };

  const onSetPageHeight = () => {
    const data = Storage.local.get<LocalStorageData>(STORAGE_KEY) || EXAMPLE;
    const currentHeight = data.pageHeight ?? DEFAULT_PAGE_HEIGHT;
    Modal.confirm({
      title: "设置页高",
      className: styles.resizeModal,
      content: (
        <div className={styles.modalContent}>
          <div>页高(height, 单位px):</div>
          <InputNumber
            size="small"
            className={styles.input}
            min={PAGE_HEIGHT_MIN}
            max={PAGE_HEIGHT_MAX}
            defaultValue={currentHeight}
          />
        </div>
      ),
      onConfirm: () => {
        const input = document.querySelector(`.${styles.resizeModal} .arco-input-number`) as HTMLInputElement;
        if (!input) return;
        const pageHeight = Number(input.value);
        if (!pageHeight) return;
        const pageCount = data.pageCount ?? DEFAULT_PAGE_COUNT;
        Background.setRange(Range.fromRect(data.x, data.y, data.width, pageHeight), pageHeight, pageCount);
        const deltaSetLike = editor.deltaSet.getDeltas();
        const storageData: LocalStorageData = { ...Background.rect, deltaSetLike, pageCount, pageHeight };
        Storage.local.set(STORAGE_KEY, storageData);
        Background.render();
        editor.canvas.reset();
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
            <Menu.Item key="pageHeight">
              <div className={styles.export} onClick={() => onSetPageHeight()}>
                页高设置
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
