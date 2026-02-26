import { useEffect, useMemo, useRef, useState } from 'react';

import ui from '../../ui/ui.module.css';
import { Accordion } from '../../ui/Accordion';
import { Button } from '../../ui/Button';
import { downloadBlob } from '../../../core';
import { usePresetSlots, type PresetPayload } from '../../hooks/usePresetSlots';

type Props = {
  currentPayload: PresetPayload;
  onApplyPayload: (payload: PresetPayload) => void;
};

function formatUpdatedAt(value: string): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleString();
}

export function PresetSlots({ currentPayload, onApplyPayload }: Props) {
  const { slots, filledCount, saveSlot, renameSlot, clearSlot, exportJson, importJson } = usePresetSlots();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storageSupported = typeof navigator !== 'undefined' && typeof navigator.storage !== 'undefined';
  const canRequestPersist = storageSupported && typeof navigator.storage.persist === 'function';
  const canCheckPersisted = storageSupported && typeof navigator.storage.persisted === 'function';

  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!canCheckPersisted) return;
    navigator.storage
      .persisted()
      .then((v) => setPersisted(v))
      .catch(() => setPersisted(null));
  }, [canCheckPersisted]);

  const persistedLabel = useMemo(() => {
    if (!storageSupported) return '当前环境不支持 Storage API';
    if (persisted === true) return '存储：已持久化（更不容易被清理）';
    if (persisted === false) return '存储：可能被浏览器清理（建议导出 JSON 备份）';
    return '存储：未知';
  }, [persisted, storageSupported]);

  return (
    <Accordion title={`预设槽位（已保存 ${filledCount}）`} defaultOpen={false}>
      <div className={ui.hint}>保存“项目（模板 + 图层 + 水印）+ 导出设置”组合到本机浏览器（localStorage），并始终保留一个空槽位用于新增。</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div className={ui.hint}>{persistedLabel}</div>
        {persisted === false && canRequestPersist ? (
          <Button
            type="button"
            onClick={async () => {
              setError(null);
              setMessage(null);
              try {
                const ok = await navigator.storage.persist();
                setPersisted(ok);
                setMessage(ok ? '已申请持久化存储' : '浏览器未授予持久化存储');
              } catch (err) {
                setError(err instanceof Error ? err.message : '申请持久化失败');
              }
            }}
          >
            申请持久化
          </Button>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slots.map((slot, index) => {
          const label = slot?.name ?? `槽位 ${index + 1}`;
          const meta = slot ? `更新：${formatUpdatedAt(slot.updatedAt)}` : '空槽位 · 可保存当前设置';

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 10,
                paddingBottom: 10,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word' }}>
                  {label}
                </div>
                <div className={ui.muted} style={{ fontSize: 11 }}>
                  {meta}
                </div>
              </div>

              <div className={ui.buttonRow} style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  disabled={!slot}
                  onClick={() => {
                    if (!slot) return;
                    setError(null);
                    setMessage(null);
                    if (!window.confirm(`加载“${label}”将覆盖当前设置，继续？`)) return;
                    onApplyPayload(slot.payload);
                    setMessage(`已加载：${label}`);
                  }}
                >
                  加载
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    if (slot && !window.confirm(`覆盖“${label}”？`)) return;
                    saveSlot(index, currentPayload);
                    setMessage(`已保存：${label}`);
                  }}
                >
                  保存
                </Button>

                <Button
                  type="button"
                  disabled={!slot}
                  onClick={() => {
                    if (!slot) return;
                    setError(null);
                    setMessage(null);
                    const next = window.prompt('重命名槽位', slot.name);
                    if (next === null) return;
                    if (!next.trim()) return;
                    renameSlot(index, next);
                    setMessage('已重命名');
                  }}
                >
                  重命名
                </Button>

                <Button
                  type="button"
                  variant="danger"
                  disabled={!slot}
                  onClick={() => {
                    if (!slot) return;
                    setError(null);
                    setMessage(null);
                    if (!window.confirm(`清空“${label}”？`)) return;
                    clearSlot(index);
                    setMessage(`已清空：${label}`);
                  }}
                >
                  清空
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={ui.buttonRow}>
        <Button
          type="button"
          onClick={() => {
            setError(null);
            setMessage(null);
            try {
              const blob = exportJson();
              downloadBlob(blob, 'exif-watermark-presets.json');
              setMessage('已导出预设 JSON');
            } catch (err) {
              setError(err instanceof Error ? err.message : '导出失败');
            }
          }}
        >
          导出 JSON
        </Button>

        <Button
          type="button"
          onClick={() => {
            setError(null);
            setMessage(null);
            fileInputRef.current?.click();
          }}
        >
          导入 JSON
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            if (!file) return;
            setError(null);
            setMessage(null);
            if (!window.confirm('导入会覆盖当前全部槽位，继续？')) return;

            try {
              const result = await importJson(file);
              setMessage(`导入完成：${result.imported} 个槽位`);
            } catch (err) {
              setError(err instanceof Error ? err.message : '导入失败');
            }
          }}
        />
      </div>

      {error ? <div className={ui.error}>{error}</div> : message ? <div className={ui.hint}>{message}</div> : null}
    </Accordion>
  );
}
