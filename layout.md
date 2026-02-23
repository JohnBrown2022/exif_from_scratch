# Watermark Layout Notes (from reference repos)

> 目的：从 `third_repo/` 中的开源实现里“学习布局思路”，整理成可复用的 Canvas 布局模板，并在本项目中以**重新实现**的方式落地（不拷贝代码/素材）。

## 参考仓库（本地路径）

- EZMark: `third_repo/EZMark-main`（README 有示例图链接）
- camera-watermark: `third_repo/camera-watermark-main`（README 有示例图链接）
- Picseal: `third_repo/picseal-master`（README 本地 `public/screenshot.png`）
- EXIF Frame: `third_repo/exif-frame-main`（GPLv3，仅借鉴思路）

---

## 1) EZMark（卡片 + 白色信息条 + 色卡）

**导出结构**

- 输出是一个“卡片”：上半部分为原图，下半部分为白色信息条；整体有圆角 + drop shadow。
- 信息条左右分区：
  - 左侧：`Model`（加粗）+ `DateTimeOriginal`（灰色小字）
  - 右侧：品牌 Logo + 竖分隔线 + 参数行（焦段/光圈/快门/ISO）+ 色卡行（从图中提取的主色）

**布局要点（可迁移）**

- 统一的卡片宽度档位（如 576px 及其他尺寸档位），信息条在不同宽度下保持可读字号。
- 右侧参数行采用紧凑水平排列；缺字段则自动收缩，不留“孤立分隔符”。
- 色卡最多展示 N 个（默认 4），过多会挤占横向空间。

**本项目可实现的模板**

- `EZMark 卡片`：带圆角/阴影的 card + 白色 footer + 参数行 +（可选）色卡。

---

## 2) camera-watermark（经典底栏 / 背景模糊模板）

**经典底栏（Classic）**

- 输出画布高度 = 图片高度 + 固定底栏高度（`LOGOHEIGHT = 60`）。
- 底栏背景纯白。
- 左组（靠左、竖向两行）：相机 `Model`（较大、加粗）+ `LensModel`（较小、灰色）。
- 中间：品牌 Logo（缩放后居中）。
- 右组（靠右、单行）：焦段 / 光圈 / 快门 / ISO（用 “ | ” 分隔；最后一个分隔符会被移除）。

**背景模糊（Blur）**

- 先绘制“模糊放大背景图”（cover），再绘制“清晰前景图”（contain，带强阴影）。
- 底栏可选：独立白底栏，或把文字直接叠在图片底部。

**布局要点（可迁移）**

- 底栏高度固定、文本垂直居中（通过计算 group height 做居中）。
- 宽度达到上限（`MAXWIDTH = 1200`）时，字体会升级一档（例如 20/16/14 vs 16/12/14）以避免显得过小。

**本项目可实现的模板**

- `经典白底栏`：图 + 白底 footer（左右组 + 中间品牌文字/标记）。
- `模糊背景卡片`：blur cover 背景 + contain 前景 + footer/叠加信息（后续可选）。

---

## 3) Picseal（小米/徕卡风格：底部横幅 + 右上品牌）

**导出结构**

- 预览容器有白底 + box-shadow。
- 底部信息横幅（banner）是一个独立区域：
  - 左侧：`model`（加粗大字）+ `date`（灰色小字）
  - 中间：竖分隔线（高度随 banner scale 变化）
  - 右侧：`device`（加粗）+ `gps`（灰色小字）
  - 品牌 logo：绝对定位在 banner 的右上角（占满 banner 高度）

**布局要点（可迁移）**

- 用单一 scale 因子控制 padding/字号/分隔线高度（CSS 变量 `--banner-scale`）。
- 文本强制不换行（`white-space: nowrap`），避免导出时信息条高度被撑高。

**本项目可实现的模板**

- `Picseal 横幅`：底部 banner（两列 + 竖分隔线）+ 右上角品牌文字标记（不用直接搬运 SVG）。

---

## 4) EXIF Frame（主题化模板集合：Simple/Lightroom/Monitor/ShotOn/Strap/Poster/Cinemascope…）

> 注意：`third_repo/exif-frame-main` 为 GPLv3；本项目只借鉴其“布局类型与参数化方式”，不拷贝实现细节与素材。

**可借鉴的布局类别**

- **Simple / Film / Lightroom**：底部信息行（左/中/右对齐，留足 padding）。
- **Monitor / Shot on**：底部 ticker（均分排布关键参数，或附带 “Shot on …”）。
- **Strap**：底部左右分栏 + 中间分隔线/Logo，字符串模板化替换 `{ISO}` `{F}` 等。
- **Poster**：大字装饰（不一定展示 EXIF）。
- **Cinemascope**：固定宽高比的 letterbox 画面（裁切/加黑边）。

**本项目可实现的模板**

- `Lightroom 底栏`、`Monitor 底栏`、`Shot on 底栏`、`Cinemascope 电影宽银幕`。

---

## 迁移到本项目的落地原则

- 只迁移“布局思路”（分区、对齐、字体层级、透明度、背景条/边框/阴影），不复制第三方代码与素材。
- Canvas 输出允许改变最终画布尺寸（例如“图片 + 底栏高度”），因此模板需要能定义：`canvasSize` 与 `imageRect`。
- 对缺失 EXIF 字段要稳健：没有焦段/ISO 时不显示该项，也不留下多余分隔符。

