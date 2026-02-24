import { useCallback, useMemo, useState, type DragEvent } from 'react';
import styles from './OnboardingPanel.module.css';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function makeDemoLandscape(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0B1020');
  bg.addColorStop(0.55, '#111827');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Soft “mountain” silhouettes
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.bezierCurveTo(w * 0.2, h * 0.55, w * 0.35, h * 0.85, w * 0.55, h * 0.68);
  ctx.bezierCurveTo(w * 0.72, h * 0.52, w * 0.82, h * 0.84, w, h * 0.66);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.82);
  ctx.bezierCurveTo(w * 0.2, h * 0.7, w * 0.32, h * 0.95, w * 0.5, h * 0.82);
  ctx.bezierCurveTo(w * 0.65, h * 0.7, w * 0.82, h * 0.92, w, h * 0.78);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Subtle grain
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.6 + 0.2;
    ctx.fillStyle = `rgba(255,255,255,${clamp01(Math.random() * 0.9)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

async function makeDemoJpegFile(input: { name: string; width: number; height: number }): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(input.width));
  canvas.height = Math.max(1, Math.round(input.height));

  makeDemoLandscape(canvas);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Failed to create demo image'));
        else resolve(b);
      },
      'image/jpeg',
      0.92,
    );
  });

  return new File([blob], input.name, { type: 'image/jpeg', lastModified: Date.now() });
}

type Props = {
  onPickFiles: () => void;
  onFilesDropped: (files: FileList | File[]) => void;
};

export default function OnboardingPanel({ onPickFiles, onFilesDropped }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const tipItems = useMemo(
    () => [
      { title: '导入照片', desc: '拖拽或选择文件' },
      { title: '选择模板', desc: '一键套用风格' },
      { title: '导出图片', desc: '导出不包含 EXIF 元数据' },
    ],
    [],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      const files = event.dataTransfer?.files;
      if (files && files.length) onFilesDropped(files);
    },
    [onFilesDropped],
  );

  return (
    <div className={styles.root}>
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={onDrop}
      >
        <div className={styles.hero}>
          <div className={styles.heroTitle}>拖入照片，立刻生成 EXIF 水印</div>
          <div className={styles.heroSubtitle}>纯本地处理；图片不上传；导出默认不包含 EXIF 元数据</div>

          <div className={styles.heroActions}>
            <button className={styles.primary} type="button" onClick={onPickFiles}>
              选择照片
            </button>
            <button
              className={styles.secondary}
              type="button"
              disabled={isGeneratingDemo}
              onClick={async () => {
                setDemoError(null);
                setIsGeneratingDemo(true);
                try {
                  const file = await makeDemoJpegFile({ name: 'demo.jpg', width: 1800, height: 1200 });
                  onFilesDropped([file]);
                } catch (err) {
                  setDemoError(err instanceof Error ? err.message : '示例照片生成失败');
                } finally {
                  setIsGeneratingDemo(false);
                }
              }}
            >
              {isGeneratingDemo ? '生成中…' : '体验示例照片'}
            </button>
          </div>

          {demoError ? <div className={styles.error}>{demoError}</div> : null}
        </div>

        <div className={styles.tips}>
          {tipItems.map((item, idx) => (
            <div key={item.title} className={styles.tip}>
              <div className={styles.tipIndex}>{idx + 1}</div>
              <div className={styles.tipBody}>
                <div className={styles.tipTitle}>{item.title}</div>
                <div className={styles.tipDesc}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.dropHint}>
          {isDragging ? '松开鼠标即可导入' : '也可以直接把照片拖到这个区域'}
        </div>
      </div>
    </div>
  );
}
