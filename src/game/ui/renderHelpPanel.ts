import type Phaser from 'phaser';

import type { InputDevice } from '../input/device';
import { HELP_CONTENT, inputDeviceLabel } from './helpContent';
import { bodyTextStyle } from './text';

export function renderHelpPanel(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  device: InputDevice,
): void {
  container.add(
    scene.add
      .text(240, 38, `帮助 // ${inputDeviceLabel(device)}`, {
        ...bodyTextStyle('#d8f7ff'),
        fontSize: '17px',
      })
      .setOrigin(0.5),
  );
  container.add(
    scene.add
      .text(
        240,
        59,
        device === 'gamepad'
          ? '检测到手柄输入 · 按键盘或点击鼠标可切换说明'
          : '检测到键盘/鼠标输入 · 操作手柄可切换说明',
        bodyTextStyle('#8ce7ff'),
      )
      .setOrigin(0.5),
  );

  const groups = HELP_CONTENT[device];
  groups.forEach((group, groupIndex) => {
    const x = groupIndex === 0 ? 22 : 246;
    container.add(scene.add.text(x, 79, group.title, bodyTextStyle('#ffb454')));
    group.rows.forEach((row, rowIndex) => {
      const y = 99 + rowIndex * 25;
      container.add(
        scene.add.text(x, y, row.control, {
          ...bodyTextStyle('#07101d'),
          fixedWidth: 82,
          align: 'center',
          backgroundColor: device === 'gamepad' ? '#ffb454' : '#43d8e8',
          padding: { x: 3, y: 3 },
        }),
      );
      container.add(
        scene.add.text(x + 89, y - 1, `${row.action}\n${row.description}`, {
          ...bodyTextStyle('#d8f7ff'),
          fontSize: '10px',
          lineSpacing: 1,
        }),
      );
    });
  });

  container.add(
    scene.add
      .text(
        240,
        238,
        device === 'gamepad'
          ? 'LB 再次关闭 · 菜单仍使用鼠标点击'
          : 'H 或 ESC 关闭 · 鼠标仅用于菜单',
        bodyTextStyle('#8da1c8'),
      )
      .setOrigin(0.5),
  );
}
