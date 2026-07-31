# 星骸回声

《星骸回声》（Star Echo）是一款原创单人科幻银河城游戏。你将扮演回收员伊娅，在 17 个相互回环的房间中找回“相位冲刺”和“磁附跃迁”，抵达零点核心并关闭守核者 Λ。`v0.1.0` 是一段可完整通关、约 15–25 分钟的桌面浏览器垂直切片。

![《星骸回声》标题画面](docs/qa/title.png)

## 运行游戏

环境要求：Node.js `24.14.0+`、pnpm `11.9.0`。项目不支持触屏，建议使用 960×540 或更大的 16:9 桌面浏览器窗口。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的本地地址，在标题页选择“新建任务”。生产构建与本地预览：

```bash
pnpm build
pnpm preview
```

## 游戏目标

主线顺序为：坠星船坞 → 中央井 → 回声库取得相位冲刺 → 返回中央井并进入生化锻造区 → 磁巢取得磁附跃迁 → 打开前庭捷径 → 穿越零点反应堆 → 击败守核者 Λ。

死亡会回到最近同步过的终端并恢复生命；能力、永久拾取和探索记录不会丢失。击败 Boss 后可从结局页继续自由探索。

## 控制

| 动作     | 键盘               | 手柄           |
| -------- | ------------------ | -------------- |
| 移动     | `A` / `D` 或方向键 | 左摇杆 / D-pad |
| 跳跃     | `Space`            | A              |
| 能量枪   | `J`                | X              |
| 能量刃   | `K`                | Y              |
| 相位冲刺 | `Shift`            | B              |
| 交互     | `E`                | RB             |
| 地图     | `Tab`              | View           |
| 暂停     | `Esc`              | Menu           |
| 全屏     | `F`                | —              |

鼠标只用于菜单。完整手感与辅助选项见 [控制说明](docs/CONTROLS.md)。

## 存档与设置

进度自动写入 `localStorage` 的 `star-echo.save.v1`，设置写入 `star-echo.settings.v1`。损坏或未知版本的存档会被安全隔离并在标题页提示；浏览器拒绝存储时仍可继续本次游玩。

暂停菜单可调整主音量、屏幕震动和强闪光。音频在首次输入后解锁；浏览器拒绝 Web Audio 时静默降级，不会阻断游戏。

## 开发与验证

```bash
pnpm format:check       # Prettier
pnpm lint               # ESLint
pnpm typecheck          # TypeScript
pnpm test               # Vitest
pnpm assets:validate    # 图像尺寸、接缝和 20MB 预算
pnpm build              # 生产构建
pnpm perf:budget        # 首屏 8MB、总资源 20MB、测试接口移除
pnpm test:e2e           # Chromium / Firefox / WebKit
pnpm check              # 除浏览器旅程外的统一质量门
```

生产构建完全移除 `window.__STAR_ECHO_TEST__`。测试模式才加载受控旅程桥，用于验证完整能力路线、损坏存档、Boss、结局和通关后探索。

核心目录：

- `src/game/`：Phaser 场景、玩家、战斗、敌人、Boss、存档和 UI。
- `src/game/world/rooms.json`：17 个可验证房间及其能力图。
- `art/source/`：Git LFS 管理的 7 张高分辨率生成源图。
- `art/prompts/manifest.json`：完整生成提示词、约束和处理记录。
- `public/assets/`：只包含裁切、限色和优化后的运行时资源。
- `docs/qa/`：960×540 Chromium 发布视觉基线。

详细规格见 [游戏设计](docs/GAME_DESIGN.md)、[视觉规范](docs/ART_BIBLE.md)、[资源策略](docs/ASSET_POLICY.md)、[制作与 AI 披露](docs/CREDITS.md)和[发布验收记录](docs/RELEASE_CHECKLIST.md)。

本仓库当前未附加开源许可证。
