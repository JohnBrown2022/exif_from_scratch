export * from './exif/types';
export * from './exif/readExif';
export * from './exif/readRotation';
export * from './exif/format';

export * from './image/decodeImage';
export * from './image/palette';

export * from './brand/makerLogo';

export * from './fingerprint/md5';

export * from './watermark/types';

export * from './render/templates';
export * from './render/renderer';
export * from './render/engine/builtins';
export * from './render/engine/overrides';
export type { ElementSpec, MakerLogoElement, TemplateJson, TextElement } from './render/engine/types';

export * from './export/exportWatermarked';
export * from './export/download';

export * from './batch/types';
export * from './batch/runBatchExport';

export * from './project/registry';
export * from './project/init';
export { renderProject, compileProject } from './project/pipeline';
export { createLegacyProjectV2 } from './project/legacyAdapter';
export { isNativeV2TemplateId } from './project/nativeTemplates';
export { getTemplateNodeBundle, getTopologyAutoAnchor } from './project/templateNodes';
export { replaceProjectTemplate } from './project/templateOps';
export type { CanvasBackground, CanvasSpec, NodeClip, NodeLayout, ProjectJsonV2, RenderNodeJson } from './project/types';
