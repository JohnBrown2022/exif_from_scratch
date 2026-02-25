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

type Props = {
  images: Array<{
    id: string;
    file: File;
    url: string;
    thumbnailUrl: string | null;
  }>;
  selectedIndex: number;
  onSelect: (index: number) => void;
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

const LIST_ITEM_HEIGHT = 52;
const LIST_OVERSCAN = 4;

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
  selectedIndex,
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
  const pendingScrollTop = useRef(0);

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
      requestAnimationFrame(updateHeight);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
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
  const start = Math.max(0, Math.floor(scrollTop / LIST_ITEM_HEIGHT) - LIST_OVERSCAN);
  const end = Math.min(
    images.length,
    Math.ceil((scrollTop + viewportHeight) / LIST_ITEM_HEIGHT) + LIST_OVERSCAN,
  );
  const visibleImages = images.slice(start, end);

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
        <div className={ui.list} ref={listRef} onScroll={onScroll}>
          <div className={ui.listHeight} style={{ height: totalHeight }}>
            {visibleImages.map((image, offset) => {
              const index = start + offset;
              const rowStyle: CSSProperties = {
                top: index * LIST_ITEM_HEIGHT,
                left: 0,
                right: 0,
                height: LIST_ITEM_HEIGHT,
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
