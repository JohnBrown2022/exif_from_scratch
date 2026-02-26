import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from 'react';
import ui from './Panels.module.css';
import type { ImportProgress } from '../hooks/useImages';

type Props = {
  images: Array<{
    id: string;
    file: File;
    url: string;
    thumbnailUrl: string | null;
  }>;
  importProgress: ImportProgress;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRequestVisibleThumbnails: (start: number, end: number) => void;
  onImport: () => void;
  onRemoveSelected: () => void;
  onClearAll: () => void;
  onFilesDropped: (files: FileList) => void;
};

type ImageListItemProps = {
  image: {
    id: string;
    file: File;
    url: string;
    thumbnailUrl: string | null;
  };
  active: boolean;
  index: number;
  onSelect: (index: number) => void;
  style: CSSProperties;
};

const LIST_ITEM_HEIGHT = 54;
const LIST_OVERSCAN = 4;
const PRELOAD_OVERSCAN = 12;
const FALLBACK_VISIBLE_ROWS = 12;

const ImageListItem = memo(function ImageListItem({
  image,
  active,
  index,
  onSelect,
  style,
}: ImageListItemProps) {
  const file = image.file;
  const itemClass = active ? ui.listItemActive : ui.listItem;
  const fileSize = useMemo(() => (file.size / 1024 / 1024).toFixed(1), [file.size]);

  const onClick = useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);

  return (
    <li className={ui.listItemWrapper} style={style}>
      <button className={itemClass} type="button" onClick={onClick} title={file.name}>
        <div className={ui.listItemRow}>
          <img className={ui.thumb} src={image.thumbnailUrl ?? image.url} alt="" loading="lazy" />
          <div className={ui.listItemText}>
            <div className={ui.listItemName}>{file.name}</div>
            <div className={ui.listItemMeta}>{fileSize} MB</div>
          </div>
        </div>
      </button>
    </li>
  );
});

export default function ImageListPanel({
  images,
  importProgress,
  selectedIndex,
  onRequestVisibleThumbnails,
  onSelect,
  onImport,
  onRemoveSelected,
  onClearAll,
  onFilesDropped,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollRafRef = useRef<number | null>(null);
  const listHeightRafRef = useRef<number | null>(null);
  const pendingScrollTop = useRef(0);
  const { total, processed, currentBatch, totalBatches, isImporting } = importProgress;
  const showImportProgress = total > 0 && isImporting;
  const importPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  const empty = images.length === 0;

  const description = useMemo(() => {
    if (empty) return '拖拽图片到这里，或点击右上角“导入图片”';
    return '点击选择一张图片进行预览';
  }, [empty]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const updateHeight = () => {
      setViewportHeight(container.clientHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      if (listHeightRafRef.current !== null) return;
      listHeightRafRef.current = requestAnimationFrame(() => {
        updateHeight();
        listHeightRafRef.current = null;
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (listHeightRafRef.current !== null) cancelAnimationFrame(listHeightRafRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    pendingScrollTop.current = event.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(pendingScrollTop.current);
      scrollRafRef.current = null;
    });
  }, []);

  const totalHeight = images.length * LIST_ITEM_HEIGHT;
  const effectiveHeight = viewportHeight > 0 ? viewportHeight : LIST_ITEM_HEIGHT * FALLBACK_VISIBLE_ROWS;
  const visibleStart = Math.max(0, Math.floor(scrollTop / LIST_ITEM_HEIGHT));
  const visibleEnd = Math.min(
    images.length,
    Math.ceil((scrollTop + effectiveHeight) / LIST_ITEM_HEIGHT),
  );
  const start = Math.max(0, visibleStart - LIST_OVERSCAN);
  const end = Math.min(
    images.length,
    visibleEnd + LIST_OVERSCAN,
  );
  const preloadStart = Math.max(0, visibleStart - PRELOAD_OVERSCAN);
  const preloadEnd = Math.min(images.length, visibleEnd + PRELOAD_OVERSCAN);
  const visibleImages = images.slice(start, end);

  useEffect(() => {
    onRequestVisibleThumbnails(preloadStart, preloadEnd);
  }, [onRequestVisibleThumbnails, preloadStart, preloadEnd]);

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
          {showImportProgress ? (
            <div className={ui.importProgressRow}>
              <div className={ui.importProgressLabel}>
                导入中：{processed}/{total}（{currentBatch}/{totalBatches} 批次）
              </div>
              <div
                className={ui.importProgressBar}
                role="progressbar"
                aria-valuenow={importPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={ui.importProgressFill} style={{ width: `${importPercent}%` }} />
              </div>
            </div>
          ) : null}
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
        <div className={ui.list} ref={listRef} onScroll={onScroll}>
          <div className={ui.listHeight} style={{ height: totalHeight }}>
            {visibleImages.map((image, offset) => {
              const index = start + offset;
              const rowStyle: CSSProperties = {
                left: 0,
                right: 0,
                height: LIST_ITEM_HEIGHT,
                top: 0,
                transform: `translateY(${index * LIST_ITEM_HEIGHT}px)`,
              };
              return (
                <ImageListItem
                  key={image.id}
                  image={image}
                  index={index}
                  active={index === selectedIndex}
                  onSelect={onSelect}
                  style={rowStyle}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
