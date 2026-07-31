# 星骸回声

《星骸回声》（Star Echo）是一款原创单人科幻银河城游戏。你将扮演回收员伊娅，在 17 个相互回环的房间中找回“相位冲刺”和“磁附跃迁”，抵达零点核心并关闭守核者 Λ。`v0.2.0` 是一段可完整通关、约 15–25 分钟的桌面浏览器垂直切片，并加入冲刺穿盾、短窗反射和墙跳贯穿三项战斗融合机制。

![《星骸回声》标题画面](docs/qa/title.png)

## 从零安装并运行

项目面向桌面浏览器，不需要后端、数据库或账号。完整环境要求为 Node.js 24 LTS
（`>=24.14.0`）、pnpm `11.9.0`、Git 和 Git LFS。建议使用 960×540 或更大的 16:9
窗口；最低 `480×270` 视口也经过中文清晰度验收。项目不支持触屏。

### 第 1 步：安装 Git 和 Git LFS

1. 从 [Git 官方下载页](https://git-scm.com/downloads/) 安装适合当前系统的 Git。
2. 从 [Git LFS 官方页](https://git-lfs.com/) 安装 Git LFS。Windows 的 Git 安装器若已包含
   Git LFS，可跳过重复安装；macOS 使用 Homebrew 时可运行 `brew install git-lfs`；Linux
   可通过发行版软件源安装 `git-lfs`。
3. 关闭并重新打开终端（Windows 可使用 PowerShell），逐条运行以下命令：

```bash
git --version
git lfs version
git lfs install
```

前两条命令应分别显示 Git 与 Git LFS 的版本；最后一条只需为当前系统用户执行一次。

### 第 2 步：安装 Node.js 24

1. 打开 [Node.js 官方下载页](https://nodejs.org/en/download)，选择 **24.x LTS**，不要选择
   低于 24.14.0 的版本。
2. 按页面给出的 Windows、macOS 或 Linux 方式完成安装，然后重新打开终端。
3. 验证 Node.js 和随附的 npm：

```bash
node --version
npm --version
```

`node --version` 应显示 `v24.14.0` 或更高的 24.x 版本。

### 第 3 步：安装项目锁定的 pnpm

使用 Node.js 自带的 npm 安装准确版本，避免不同 pnpm 版本改写锁文件：

```bash
npm install --global pnpm@11.9.0
pnpm --version
```

第二条命令应输出 `11.9.0`。也可依据 [pnpm 官方安装说明](https://pnpm.io/installation)
使用 Corepack，但进入本仓库后仍应确认版本为 `11.9.0`。

### 第 4 步：下载项目

先在终端进入你希望存放项目的父目录，再执行：

```bash
git clone https://github.com/PengShangyi/Metroidvania.git
cd Metroidvania
git lfs pull
```

`git lfs pull` 会取回 `art/source/` 中的高分辨率源图。正常游玩只读取
`public/assets/` 的优化资源，但完整克隆应包含源图而不是 LFS 指针文本。

### 第 5 步：安装依赖

确认终端当前目录包含 `package.json`，然后按锁文件安装：

```bash
pnpm install --frozen-lockfile
```

命令成功结束且没有 `ERR_PNPM_*` 错误后，依赖安装完成。以后只要
`pnpm-lock.yaml` 没有变化，无需每次启动前重复安装。

### 第 6 步：启动开发服务器并游玩

```bash
pnpm dev
```

保持该终端运行，在桌面浏览器打开终端 `Local` 一行显示的地址，通常是
`http://localhost:5173/`。如果 5173 端口被占用，Vite 会显示另一个可用地址，应以终端输出
为准。进入标题页后建议先选择“新手训练”；游戏中按 `H` 或手柄 `LB` 可随时查看会随最近
输入设备切换的帮助页。按 `Ctrl+C` 可停止服务器。

### 第 7 步：验证生产构建（可选）

需要确认最终发布版本时运行：

```bash
pnpm build
pnpm preview
```

第一条命令将可发布文件写入 `dist/`；第二条会启动本地生产预览，通常位于
`http://localhost:4173/`，仍以终端实际地址为准。

### 常见安装问题

- `git`、`git lfs`、`node` 或 `pnpm` 显示“command not found”：重新打开终端；若仍失败，
  将对应工具重新安装并确认安装器已把它加入 `PATH`。
- Node.js 版本低于 24.14.0：安装 Node.js 24 LTS 后重新执行 `node --version`，不要忽略
  pnpm 的 engine 警告。
- pnpm 版本不是 11.9.0：重新运行 `npm install --global pnpm@11.9.0`，再执行
  `pnpm --version`。
- `art/source/` 中只看到很短的指针文件：在仓库根目录重新运行 `git lfs pull`。
- 页面没有声音：先点击游戏或按任意游戏键以解锁浏览器音频；拒绝音频权限不会阻止游玩。
- “继续任务”不可用：首次运行没有存档是正常情况，请选择“新建任务”；隐私模式或被禁用的
  `localStorage` 可能无法跨会话保存。

## 游戏目标

主线顺序为：坠星船坞 → 中央井 → 回声库取得相位冲刺 → 返回中央井并进入生化锻造区 → 磁巢取得磁附跃迁 → 打开前庭捷径 → 穿越零点反应堆 → 击败守核者 Λ。

死亡会回到最近同步过的终端并恢复生命；能力、永久拾取和探索记录不会丢失。击败 Boss 后可从结局页继续自由探索。

## v0.2 战斗融合

- **冲刺穿盾**：相位冲刺越过带盾爬行体中心，可在抵达侧暴露核心 1.8 秒；必须从核心侧攻击。
- **短窗反射**：能量刃挥砍的前 80ms 可反射炮台弹和守核者扇形弹，反射弹造成 2 点伤害。
- **墙跳贯穿**：成功墙跳会武装一次贯穿射击，可连续命中多个普通敌人；落地、死亡或换房会清除。

标题页“新手训练”以九步正式判定教学覆盖基础移动、双武器和三项融合技巧；游玩中可随时按 `H` 或手柄 `LB` 打开自适应 Help 页复习。

## 控制

| 动作     | 键盘               | 手柄           | 说明           |
| -------- | ------------------ | -------------- | -------------- |
| 移动     | `A` / `D` 或方向键 | 左摇杆 / D-pad | 地面与空中移动 |
| 跳跃     | `Space`            | A              | 可变高度跳跃   |
| 能量枪   | `J`                | X              | 墙跳首发贯穿   |
| 能量刃   | `K`                | Y              | 前 80ms 反射   |
| 相位冲刺 | `Shift`            | B              | 穿盾开核       |
| 交互     | `E`                | RB             | 终端与通道     |
| 地图     | `Tab`              | View           | 探索地图       |
| 暂停     | `Esc`              | Menu           | 暂停与设置     |
| 帮助     | `H`                | LB             | 自适应控制说明 |
| 全屏     | `F`                | —              | 切换浏览器全屏 |

鼠标只用于菜单。帮助页会根据最近一次实际输入自动显示键鼠版或手柄版。完整手感与辅助选项见
[控制说明](docs/CONTROLS.md)。

## 存档与设置

进度自动写入 `localStorage` 的 `star-echo.save.v1`，设置写入 `star-echo.settings.v1`。损坏或未知版本的存档会被安全隔离并在标题页提示；浏览器拒绝存储时仍可继续本次游玩。

暂停菜单可调整主音量、屏幕震动和强闪光。音频在首次输入后解锁；浏览器拒绝 Web Audio 时静默降级，不会阻断游戏。

## 开发与验证

首次运行浏览器旅程前，还需要安装 Playwright 的三个浏览器：

```bash
pnpm exec playwright install chromium firefox webkit
```

Linux 若提示缺少系统库，可根据 Playwright 的错误提示，改用具备管理员权限的终端运行
`pnpm exec playwright install --with-deps chromium firefox webkit`。之后可执行：

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

生产构建完全移除 `window.__STAR_ECHO_TEST__`。测试模式才加载受控旅程桥，用于验证完整能力路线、融合战斗、损坏存档、Boss、结局和通关后探索。

核心目录：

- `src/game/`：Phaser 场景、玩家、战斗、敌人、Boss、存档和 UI。
- `src/game/world/rooms.json`：17 个可验证房间及其能力图。
- `art/source/`：Git LFS 管理的 7 张高分辨率生成源图。
- `art/prompts/manifest.json`：完整生成提示词、约束和处理记录。
- `public/assets/`：只包含裁切、限色和优化后的运行时资源。
- `docs/qa/`：960×540 发布画面及 480×270 中文与帮助页视觉基线。

详细规格见 [游戏设计](docs/GAME_DESIGN.md)、[视觉规范](docs/ART_BIBLE.md)、[资源策略](docs/ASSET_POLICY.md)、[制作与 AI 披露](docs/CREDITS.md)和[发布验收记录](docs/RELEASE_CHECKLIST.md)。

本仓库当前未附加开源许可证。
