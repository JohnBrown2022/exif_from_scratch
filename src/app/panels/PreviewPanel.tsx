import { useEffect, useState } from 'react';
import ui from './Panels.module.css';

type Props = {
  file: File | null;
};

export default function PreviewPanel({ file }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return (
    <div className={ui.panelRoot}>
      <div className={ui.panelHeader}>
        <div>
          <div className={ui.panelTitle}>预览</div>
          <div className={ui.panelSubtitle}>Canvas 渲染器将在 M2 接入</div>
        </div>
      </div>

      {!url ? (
        <div className={ui.emptyState}>选择一张图片开始</div>
      ) : (
        <div className={ui.previewFrame}>
          <img className={ui.previewImage} src={url} alt="preview" />
          <div className={ui.previewOverlay}>
            <div className={ui.previewOverlayTag}>水印预览占位</div>
          </div>
        </div>
      )}
    </div>
  );
}

