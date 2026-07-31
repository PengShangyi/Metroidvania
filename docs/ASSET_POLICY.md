# 资源策略

- `art/source/`：保留最终选中的 ImageGen 高分辨率源图，由 Git LFS 管理。
- `art/prompts/manifest.json`：记录每次生成的用途、完整提示词、背景策略和状态。
- `public/assets/`：仅保存游戏实际加载的优化 PNG/WebP；不得引用 Codex 默认生成目录。
- 每个生成目标单独调用内置 ImageGen。透明资源先生成纯色键控背景，再使用技能内置脚本去背。
- 最终资源需通过 `pnpm assets:validate` 与 `pnpm perf:budget`；资源总量上限 20MB、生产首屏上限 8MB，单边尺寸上限 4096px。
- 标题页只加载标题、主角基础图集和 UI；三个区域的背景、瓦片、敌人与 Boss 资源按区域进入时加载，失败时保留程序化安全渲染。
- 所有素材必须原创，不使用第三方商标、角色、截图或训练参考作品名称。
