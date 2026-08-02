# 界面字体

游戏用两套字体，都在启动前完成加载（见 `src/game/ui/fontLoader.ts`）。分界线是**定宽 vs 流式**，不是标签 vs 正文：需要可预测步进的内容（数值、Boss 血条的菱形格、按键胶囊）用像素字体，成段的中文用矢量字体。

## Fusion Pixel Font 12px —— 像素字体

- 上游：<https://github.com/TakWolf/fusion-pixel-font>
- 发布版本：`2026.07.20`
- 文件：`fusion-pixel-12px-proportional-zh_hans.otf.woff2`
- SHA-256：`9d8d2f0bae6214568c591c72f4f3e8cbc39b2eeda461861e521e45d966ccefac`
- 授权：SIL Open Font License 1.1；完整许可证见 `docs/licenses/fusion-pixel-font/`。

字形网格是 12px，**只能用 12 的整数倍字号**（项目里是 24 / 36 / 48）。其他字号会出现半像素笔画。不要使用浏览器合成粗体，也不要缩放 Text 对象。

## Star Echo Sans SC —— 正文矢量字体

- 上游：Noto Sans CJK SC Regular，<https://github.com/notofonts/noto-cjk>
- 文件：`star-echo-sans-sc-subset.woff2` + `star-echo-sans-sc-subset.charset.txt`
- 授权：SIL Open Font License 1.1（无保留字体名，允许子集化与改名）；完整许可证见 `docs/licenses/noto-sans-sc/`。

这是用 `subset-font`（HarfBuzz）做的子集，**不是**上游原文件：完整 woff2 有 4MB 以上，会变成标题画面之前的一次阻塞下载。用 `pnpm art:font` 从 `art/source/fonts/NotoSansCJKsc-Regular.otf`（Git LFS）重新生成。

`@font-face` 里的 family 名字是项目独占的 `Star Echo Sans SC`，故意不沿用上游名：`document.fonts.check('20px "Noto Sans SC"')` 在装了同名系统字体的机器上会返回 true，让加载守卫失去意义。

子集只收录源码里实际出现的非 ASCII 字符，所以**新增中文文案后必须重跑 `pnpm art:font`**，否则运行时会渲染成豆腐块。`src/game/ui/fontCoverage.test.ts` 会在 `pnpm check` 里把缺字直接列出来。

该字体不固定 SHA-256：它是由提交在仓库里的脚本从 LFS 源生成的构建产物，内容正确性由上面那条覆盖率测试保证。`scripts/validate-assets.mjs` 校验 WOFF2 魔数、512KB 上限和许可证文件存在。
