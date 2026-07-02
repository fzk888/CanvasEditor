import { Button, Message, Modal } from "@arco-design/web-react";
import type { FC } from "react";
import { useMemo, useState } from "react";
import type { Editor } from "sketching-core";
import { Range } from "sketching-core";
import { DeltaSet } from "sketching-delta";
import { cs } from "sketching-utils";

import { Background } from "../../../../modules/background";
import type { TemplateConfig } from "../../../../modules/template";
import { loadTemplate, TEMPLATE_CONFIG } from "../../../../modules/template";
import { createPagedTemplateData } from "../../../../utils/page-template";
import type { LocalStorageData } from "../../../../utils/storage";
import { getPageConfig, safeSetLocalStorageData } from "../../../../utils/storage";
import styles from "./index.m.scss";

export const Template: FC<{
  editor: Editor;
}> = ({ editor }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<TemplateConfig | null>(null);

  const CONFIG = useMemo(() => {
    const result: TemplateConfig[][] = [];
    TEMPLATE_CONFIG.forEach((item, index) => {
      if (index % 2 === 0) result.push([item]);
      else result[Math.floor(index / 2)].push(item);
    });
    return result;
  }, []);

  const getConfig = (item: TemplateConfig) => {
    if (!item) return void 0;
    return (
      <div className={styles.preview}>
        <div className={styles.imgContainer}>
          <img src={item.image}></img>
        </div>
        <div className={styles.name}>{item.name}</div>
      </div>
    );
  };

  const onUseTemplate = async (item: TemplateConfig) => {
    setLoading(true);
    const res: LocalStorageData | null = await loadTemplate(item.template);
    setLoading(false);
    if (!res) return Message.error("模板加载失败");
    const config = getPageConfig(res);
    const pageCount = Math.max(config.pageCount, Background.pageCount);
    const storageData = createPagedTemplateData(res, { ...config, pageCount });
    if (!safeSetLocalStorageData(storageData)) {
      Message.warning("模板数据较大，浏览器本地保存失败，但当前页面仍可编辑");
    }
    const deltaSetLike = storageData.deltaSetLike;
    const deltaSet = new DeltaSet(deltaSetLike);
    const nextConfig = getPageConfig(storageData);
    editor.state.setContent(deltaSet);
    Background.setRange(
      Range.fromRect(storageData.x, storageData.y, storageData.width, nextConfig.pageHeight),
      nextConfig.pageHeight,
      nextConfig.pageCount,
      nextConfig.pageGap,
      nextConfig.pageMargin
    );
    Background.render();
    editor.canvas.reset();
    setPreview(null);
    Message.success("模板已应用");
  };

  return (
    <>
      <div className={styles.container}>
        {CONFIG.map((row, rowIndex) => (
          <div className={styles.row} key={rowIndex}>
            <div className={styles.item} onClick={() => row[0] && setPreview(row[0])}>
              {getConfig(row[0])}
            </div>
            <div
              className={cs(styles.item, !row[1] && styles.hidden)}
              onClick={() => row[1] && setPreview(row[1])}
            >
              {getConfig(row[1])}
            </div>
          </div>
        ))}
      </div>
      <Modal
        visible={!!preview}
        title={preview ? `预览模板 - ${preview.name}` : "预览模板"}
        className={styles.previewModal}
        footer={
          <div className={styles.previewFooter}>
            <Button onClick={() => setPreview(null)}>取消</Button>
            <Button
              type="primary"
              loading={loading}
              disabled={!preview}
              onClick={() => preview && onUseTemplate(preview)}
            >
              使用模板
            </Button>
          </div>
        }
        onCancel={() => setPreview(null)}
      >
        {preview && (
          <div className={styles.modalPreview}>
            <img src={preview.image} alt={preview.name}></img>
          </div>
        )}
      </Modal>
    </>
  );
};
