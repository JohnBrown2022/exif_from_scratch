import { useMemo, useState } from 'react';

import panel from '../Panels.module.css';
import { Tabs, type TabItem } from '../../ui/Tabs';
import type { BatchUpdate, ExifData } from '../../../core';

import { ExportTab } from './ExportTab';
import { StyleTab } from './StyleTab';

type TabId = 'style' | 'export';

type Props = {
  topologyMd5: string | null;
  topologyMd5Error: string | null;
  isComputingTopologyMd5: boolean;

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
              hasSelection={props.hasSelection}
              exif={props.exif}
              exifError={props.exifError}
              isReadingExif={props.isReadingExif}
              topologyMd5={props.topologyMd5}
              topologyMd5Error={props.topologyMd5Error}
              isComputingTopologyMd5={props.isComputingTopologyMd5}
            />
          </div>
        ) : null}

        {tab === 'export' ? (
          <div role="tabpanel" id="panel-inspector-export" aria-labelledby="tab-inspector-export">
            <ExportTab
              hasSelection={props.hasSelection}
              imagesCount={props.imagesCount}
              isExporting={props.isExporting}
              exportStatus={props.exportStatus}
              onExportSelected={props.onExportSelected}
              onExportAll={props.onExportAll}
              batchState={props.batchState}
              onCancelBatch={props.onCancelBatch}
              onRetryFailed={props.onRetryFailed}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
