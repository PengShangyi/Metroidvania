import type Phaser from 'phaser';

import type { InputDevice } from '../input/device';
import { HELP_CONTENT, inputDeviceLabel } from './helpContent';
import { helpPanelLayout } from './helpPanelLayout';
import { CHIP, HELP, OVERLAY, UI } from './layout';
import { headingTextStyle, hudTextStyle, proseTextStyle } from './text';

export function renderHelpPanel(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  device: InputDevice,
): void {
  container.add(
    scene.add
      .text(
        UI.centerX,
        OVERLAY.heading.y,
        `帮助 // ${inputDeviceLabel(device)}`,
        headingTextStyle(),
      )
      .setOrigin(0.5),
  );
  container.add(
    scene.add
      .text(
        UI.centerX,
        HELP.subtitle.y,
        device === 'gamepad'
          ? '检测到手柄输入 · 按键盘或点击鼠标可切换说明'
          : '检测到键盘/鼠标输入 · 操作手柄可切换说明',
        proseTextStyle('#8ce7ff', 'caption'),
      )
      .setOrigin(0.5),
  );

  const groups = HELP_CONTENT[device];
  const boxes = helpPanelLayout(groups);
  groups.forEach((group, groupIndex) => {
    const columnX = HELP.columnX[groupIndex] ?? HELP.columnX[0] ?? 0;
    container.add(scene.add.text(columnX, HELP.groupTitle.y, group.title, hudTextStyle('#ffb454')));
  });
  for (const box of boxes) {
    const row = groups[box.groupIndex]?.rows[box.rowIndex];
    if (!row) continue;
    if (box.kind === 'control') {
      container.add(
        scene.add.text(box.x, box.y, row.control, {
          ...hudTextStyle('#07101d'),
          fixedWidth: CHIP.width,
          align: 'center',
          backgroundColor: device === 'gamepad' ? '#ffb454' : '#43d8e8',
          padding: { x: CHIP.paddingX, y: CHIP.paddingY },
        }),
      );
      continue;
    }
    container.add(
      scene.add
        .text(
          box.x,
          box.y,
          `${row.action} · ${row.description}`,
          proseTextStyle('#d8f7ff', 'caption'),
        )
        .setWordWrapWidth(HELP.descriptionWrap),
    );
  }

  container.add(
    scene.add
      .text(
        UI.centerX,
        HELP.footer.y,
        device === 'gamepad'
          ? 'LB 再次关闭 · 菜单仍使用鼠标点击'
          : 'H 或 ESC 关闭 · 鼠标仅用于菜单',
        proseTextStyle('#8da1c8', 'caption'),
      )
      .setOrigin(0.5),
  );
}
