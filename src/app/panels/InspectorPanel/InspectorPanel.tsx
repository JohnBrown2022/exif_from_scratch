import { useMemo, useState } from 'react';

import panel from '../Panels.module.css';
import { Tabs, type TabItem } from '../../ui/Tabs';
import type { BatchUpdate, ExifData, ExportFormat, JpegBackgroundMode, TemplateId, TopologyWatermarkSettings } from '../../../core';
import type { PresetPayload } from '../../hooks/usePresetSlots';

import { ExportTab } from './ExportTab';
import { LayersTab } from './LayersTab';
import { StyleTab } from './StyleTab';

type TabId = 'style' | 'layers' | 'export';

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

  topologyWatermarkSettings: TopologyWatermarkSettings;
  onTopologyWatermarkSettingsChange: (patch: Partial<TopologyWatermarkSettings>) => void;
  topologyMd5: string | null;
  topologyMd5Error: string | null;
  isComputingTopologyMd5: boolean;

  presetPayload: PresetPayload;
  onApplyPresetPayload: (payload: PresetPayload) => void;

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
  const [tab, setTab] = useState<TabId>('style');

  const failedCount = props.batchState ? props.batchState.jobs.filter((job) => job.status === 'error').length : 0;
  const batchBadge = props.batchState?.running
    ? `${props.batchState.completed}/${props.batchState.total}`
    : failedCount
      ? failedCount
      : undefined;

  const items = useMemo<TabItem<TabId>[]>(
    () => [
      { id: 'style', label: '样式' },
      { id: 'layers', label: '图层' },
      { id: 'export', label: '导出', badge: batchBadge },
    ],
    [batchBadge],
  );

  return (
    <div className={panel.panelRoot}>
      <div className={panel.panelHeader}>
        <div>
          <div className={panel.panelTitle}>设置</div>
        </div>
      </div>

      <div className={panel.form}>
        <Tabs value={tab} items={items} onChange={setTab} idPrefix="inspector" ariaLabel="设置面板 Tabs" />

        {tab === 'style' ? (
          <div role="tabpanel" id="panel-inspector-style" aria-labelledby="tab-inspector-style">
            <StyleTab
              templateId={props.templateId}
              onTemplateChange={props.onTemplateChange}
              onTemplateOverridesChange={props.onTemplateOverridesChange}
              hasSelection={props.hasSelection}
              exif={props.exif}
              exifError={props.exifError}
              isReadingExif={props.isReadingExif}
              exportFormat={props.exportFormat}
              jpegBackground={props.jpegBackground}
              onJpegBackgroundChange={props.onJpegBackgroundChange}
              jpegBackgroundMode={props.jpegBackgroundMode}
              onJpegBackgroundModeChange={props.onJpegBackgroundModeChange}
              blurRadius={props.blurRadius}
              onBlurRadiusChange={props.onBlurRadiusChange}
              topologyWatermarkSettings={props.topologyWatermarkSettings}
              onTopologyWatermarkSettingsChange={props.onTopologyWatermarkSettingsChange}
              topologyMd5={props.topologyMd5}
              topologyMd5Error={props.topologyMd5Error}
              isComputingTopologyMd5={props.isComputingTopologyMd5}
            />
          </div>
        ) : null}

        {tab === 'layers' ? (
          <div role="tabpanel" id="panel-inspector-layers" aria-labelledby="tab-inspector-layers">
            <LayersTab
              templateId={props.templateId}
              hasSelection={props.hasSelection}
              topologyWatermarkSettings={props.topologyWatermarkSettings}
              onTopologyWatermarkSettingsChange={props.onTopologyWatermarkSettingsChange}
              topologyMd5={props.topologyMd5}
              topologyMd5Error={props.topologyMd5Error}
              isComputingTopologyMd5={props.isComputingTopologyMd5}
            />
          </div>
        ) : null}

        {tab === 'export' ? (
          <div role="tabpanel" id="panel-inspector-export" aria-labelledby="tab-inspector-export">
            <ExportTab
              exportFormat={props.exportFormat}
              onExportFormatChange={props.onExportFormatChange}
              jpegQuality={props.jpegQuality}
              onJpegQualityChange={props.onJpegQualityChange}
              maxEdge={props.maxEdge}
              onMaxEdgeChange={props.onMaxEdgeChange}
              hasSelection={props.hasSelection}
              imagesCount={props.imagesCount}
              isExporting={props.isExporting}
              exportStatus={props.exportStatus}
              onExportSelected={props.onExportSelected}
              onExportAll={props.onExportAll}
              batchState={props.batchState}
              onCancelBatch={props.onCancelBatch}
              onRetryFailed={props.onRetryFailed}
              presetPayload={props.presetPayload}
              onApplyPresetPayload={props.onApplyPresetPayload}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
