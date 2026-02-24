import { useMemo, useState } from 'react';
import ui from './Panels.module.css';

type Props = {
  images: Array<{
    id: string;
    file: File;
    url: string;
  }>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onImport: () => void;
  onRemoveSelected: () => void;
  onClearAll: () => void;
  onFilesDropped: (files: FileList) => void;
};

export default function ImageListPanel({
  images,
  selectedIndex,
  onSelect,
  onImport,
  onRemoveSelected,
  onClearAll,
  onFilesDropped,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const empty = images.length === 0;

  const description = useMemo(() => {
    if (empty) return '拖拽图片到这里，或点击右上角“导入图片”';
    return '点击选择一张图片进行预览';
  }, [empty]);

  return (
    <div
      className={ui.panelRoot}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        onFilesDropped(e.dataTransfer.files);
      }}
    >
      <div className={ui.panelHeader}>
        <div>
          <div className={ui.panelTitle}>图片</div>
          <div className={ui.panelSubtitle}>{description}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={ui.ghostButton} type="button" onClick={onImport}>
            添加
          </button>
          <button
            className={ui.ghostButton}
            type="button"
            disabled={images.length === 0}
            onClick={() => {
              onRemoveSelected();
            }}
          >
            删除
          </button>
          <button
            className={ui.ghostButton}
            type="button"
            disabled={images.length === 0}
            onClick={() => {
              if (!window.confirm('清空所有已导入图片？')) return;
              onClearAll();
            }}
          >
            清空
          </button>
        </div>
      </div>

      {isDragOver ? (
        <div className={ui.dropHint}>松开以添加图片</div>
      ) : empty ? (
        <div className={ui.emptyState}>还没有导入图片</div>
      ) : (
        <ul className={ui.list}>
          {images.map((image, index) => {
            const active = index === selectedIndex;
            const file = image.file;
            return (
              <li key={image.id}>
                <button
                  className={active ? ui.listItemActive : ui.listItem}
                  type="button"
                  onClick={() => onSelect(index)}
                  title={file.name}
                >
                  <div className={ui.listItemRow}>
                    <img className={ui.thumb} src={image.url} alt="" loading="lazy" />
                    <div className={ui.listItemText}>
                      <div className={ui.listItemName}>{file.name}</div>
                      <div className={ui.listItemMeta}>
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
