# master ← plugin 合并复盘清单（2026-02-26）

## 1) 合并元信息
- 目标分支：`master`
- 来源分支：`plugin`
- 合并方式：`--no-ff`
- 合并提交：`122491b32097735a7ba5097deb543e99c9162bbb`
- 里程碑标签：`milestone/v2-plugin-merge-2026-02-26`

## 2) 变更规模（master..plugin）
- 提交数：25
- 文件数：42
- 代码量：`+5937 / -546`

## 3) 技术栈级别变化（核心）
- 新增 V2 项目渲染管线：`src/core/project/pipeline.ts`
- 新增 Node 注册与内置节点系统：`src/core/project/registry.ts`, `src/core/project/builtins.ts`
- 模板迁移为 v2 节点定义：`src/core/project/defs/*.v2.json`
- 旧渲染入口改为走 ProjectJsonV2：`src/core/render/renderer.ts`

## 4) 关键功能变化（产品侧）
- Inspector 新增“图层”工作流：`src/app/panels/InspectorPanel/LayersTab.tsx`
- 预设槽位升级（含 V2 project payload、动态空槽位）：`src/app/hooks/usePresetSlots.ts`
- 预设槽位 UI 可读性优化（名称可换行、按钮换行）：`src/app/panels/InspectorPanel/PresetSlots.tsx`
- 导入与列表性能优化（批次导入、可见区优先缩略图）：`src/app/hooks/useImages.ts`, `src/app/panels/ImageListPanel.tsx`
- 预览性能优化（解码缓存、复用渲染输入）：`src/app/panels/PreviewPanel.tsx`

## 5) 复盘关注点（建议）
- 架构：V2 `ProjectJsonV2` 是否已覆盖主要模板/水印扩展诉求
- 交互：图层编辑路径是否比旧“样式面板”更直观
- 性能：大批量导入（100+）时首屏/滚动/导出体验
- 可维护性：后续插件（二维码、胶片颗粒等）接入成本

## 6) 已知事项
- 当前仓库有一处历史类型检查问题（非本次合并引入）：`src/app/utils/generateThumbnail.ts`

