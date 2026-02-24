import { useMemo, useState } from 'react';

import panel from '../Panels.module.css';
import ui from '../../ui/ui.module.css';
import { Tabs, type TabItem } from '../../ui/Tabs';
import type { BatchUpdate, ExifData, ExportFormat, JpegBackgroundMode, TemplateId } from '../../../core';

import { BatchTab } from './BatchTab';
import { ExportTab } from './ExportTab';
import { LayoutTab } from './LayoutTab';
import { TemplateTab } from './TemplateTab';

type TabId = 'export' | 'template' | 'layout' | 'batch';

type Props = {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  onTemplateOverridesChange: () => void;

  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  jpegQuality: number;
  onJpegQualityChange: (quality: number) => void;
  maxEdge: number | 'original';
  onMaxEdgeChange: (maxEdge: number | 'original') => void;
  jpegBackground: string;
  onJpegBackgroundChange: (color: string) => void;
  jpegBackgroundMode: JpegBackgroundMode;
  onJpegBackgroundModeChange: (mode: JpegBackgroundMode) => void;
  blurRadius: number;
  onBlurRadiusChange: (radius: number) => void;

  hasSelection: boolean;
  imagesCount: number;
  isExporting: boolean;
  exportStatus: string | null;
  onExportSelected: () => void;
  onExportAll: () => void;

  batchState: BatchUpdate | null;
  onCancelBatch: () => void;
  onRetryFailed: () => void;

  exif: ExifData | null;
  exifError: string | null;
  isReadingExif: boolean;
};

export default function InspectorPanel(props: Props) {
  const [tab, setTab] = useState<TabId>('export');

  const failedCount = props.batchState ? props.batchState.jobs.filter((job) => job.status === 'error').length : 0;
  const batchBadge = props.batchState?.running ? `${props.batchState.completed}/${props.batchState.total}` : failedCount ? failedCount : undefined;

  const items = useMemo<TabItem<TabId>[]>(
    () => [
      { id: 'export', label: '导出' },
      { id: 'template', label: '模板' },
      { id: 'layout', label: '布局' },
      { id: 'batch', label: '批量', badge: batchBadge },
    ],
    [batchBadge],
  );

  return (
    <div className={panel.panelRoot}>
      <div className={panel.panelHeader}>
        <div>
          <div className={panel.panelTitle}>设置</div>
          <div className={panel.panelSubtitle}>更少的默认项；高级能力收起。</div>
        </div>
      </div>

      <div className={panel.form}>
        <Tabs value={tab} items={items} onChange={setTab} idPrefix="inspector" ariaLabel="设置面板 Tabs" />
        <div className={ui.muted} style={{ fontSize: 12 }}>
          提示：所有模板编辑设置都保存在本机浏览器（localStorage）。
        </div>

        {tab === 'export' ? (
          <div role="tabpanel" id="panel-inspector-export" aria-labelledby="tab-inspector-export">
            <ExportTab
              exportFormat={props.exportFormat}
              onExportFormatChange={props.onExportFormatChange}
              jpegQuality={props.jpegQuality}
              onJpegQualityChange={props.onJpegQualityChange}
              maxEdge={props.maxEdge}
              onMaxEdgeChange={props.onMaxEdgeChange}
              jpegBackground={props.jpegBackground}
              onJpegBackgroundChange={props.onJpegBackgroundChange}
              jpegBackgroundMode={props.jpegBackgroundMode}
              onJpegBackgroundModeChange={props.onJpegBackgroundModeChange}
              blurRadius={props.blurRadius}
              onBlurRadiusChange={props.onBlurRadiusChange}
              templateId={props.templateId}
              hasSelection={props.hasSelection}
              imagesCount={props.imagesCount}
              isExporting={props.isExporting}
              exportStatus={props.exportStatus}
              onExportSelected={props.onExportSelected}
              onExportAll={props.onExportAll}
            />
          </div>
        ) : null}

        {tab === 'template' ? (
          <div role="tabpanel" id="panel-inspector-template" aria-labelledby="tab-inspector-template">
            <TemplateTab
              templateId={props.templateId}
              onTemplateChange={props.onTemplateChange}
              onTemplateOverridesChange={props.onTemplateOverridesChange}
              hasSelection={props.hasSelection}
              exif={props.exif}
              exifError={props.exifError}
              isReadingExif={props.isReadingExif}
            />
          </div>
        ) : null}

        {tab === 'layout' ? (
          <div role="tabpanel" id="panel-inspector-layout" aria-labelledby="tab-inspector-layout">
            <LayoutTab templateId={props.templateId} onTemplateOverridesChange={props.onTemplateOverridesChange} />
          </div>
        ) : null}

        {tab === 'batch' ? (
          <div role="tabpanel" id="panel-inspector-batch" aria-labelledby="tab-inspector-batch">
            <BatchTab
              batchState={props.batchState}
              isExporting={props.isExporting}
              onCancelBatch={props.onCancelBatch}
              onRetryFailed={props.onRetryFailed}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
