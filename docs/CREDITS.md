# 制作、资源与 AI 辅助披露

## 原创内容

《星骸回声》的世界观、角色伊娅、守核者 Λ、17 个房间、能力名称、叙事文本、关卡布局、敌人规则与界面均为本项目原创内容。项目没有使用第三方游戏截图、受版权保护角色、商标化徽记、音乐采样或付费素材包。

## 图像生成与规整

项目使用 OpenAI 内置 ImageGen 生成 7 组原创高分辨率视觉锚点：主角、敌人阵容、Boss、三个区域背景和标题图。生成接口未返回可独立验证的具体后端模型版本，因此清单将生成方式记录为 `built-in-imagegen`，不虚构模型标识。

每次生成的完整提示词、用途、背景约束、选中源图和处理步骤均保存在 [`art/prompts/manifest.json`](../art/prompts/manifest.json)。透明主体使用纯色键控背景和 ImageGen 技能提供的去背脚本；随后由 Sharp 完成裁切、去溢色、最近邻缩放、限色和运行时格式转换。

生成图只作为造型、纹理和氛围基准。主角 24×32 动画图集、孢子四帧图集、16px 无缝瓦片、碰撞轮廓和最终 Boss 轮廓均经过确定性规整。7 张选中源图由 Git LFS 管理，游戏只加载 `public/assets/` 内的优化 PNG/WebP。

## 程序化音频

三个区域环境循环以及武器、受伤、拾取、终端和 Boss 音效均由项目内 Web Audio 振荡器、噪声缓冲和包络实时合成，没有使用外部音频文件或生成式音乐素材。

## 字体

界面使用两套简体中文字体，均以 SIL Open Font License 1.1 授权。

像素字体是 TakWolf 的 Fusion Pixel Font 12px proportional `zh_hans` WebFont，版本 `2026.07.20`，用于数值、按键胶囊与其他需要定宽步进的短标签。运行时 WOFF2 的 SHA-256 为 `9d8d2f0bae6214568c591c72f4f3e8cbc39b2eeda461861e521e45d966ccefac`；完整许可证及字体所含组件许可证保存在 [`docs/licenses/fusion-pixel-font/`](licenses/fusion-pixel-font/)。

正文字体是 Noto Sans CJK SC Regular 的子集，用于帮助面板、结局、教学目标等成段中文——12px 像素网格在这些位置已到中文可读极限。子集由 `pnpm art:font` 用 `subset-font`（HarfBuzz）从 Git LFS 中的上游 OTF 生成，只收录源码里实际出现的字符；`@font-face` 名称改为项目独占的 `Star Echo Sans SC`，以免与系统同名字体混淆。完整许可证见 [`docs/licenses/noto-sans-sc/`](licenses/noto-sans-sc/)，字体来源与再生成方式见 [`public/assets/fonts/README.md`](../public/assets/fonts/README.md)。

## 工具与依赖

- Phaser 3.90：渲染、场景、输入和 Arcade Physics。
- TypeScript 5.9 与 Vite 7.3：类型系统和构建。
- Vitest 4.1 与 Playwright 1.62：单元、浏览器旅程和视觉验收。
- Sharp：确定性图像处理与资源验证。
- OpenAI Codex：实现、测试、文档、资源管线和仓库整理的 AI 辅助。

各依赖保留其各自许可证。本项目自身在 `v0.2.0` 暂未附加开源许可证。
