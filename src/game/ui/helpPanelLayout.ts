import type { HelpGroup } from './helpContent';
import { CHIP, HELP, LINE_BOX } from './layout';

export interface HelpRowBox {
  kind: 'control' | 'description';
  groupIndex: number;
  rowIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 帮助面板是全项目最容易撞版的一屏：两栏 × 每栏至多六行 × 每行两块。
 * 几何算在这里，renderHelpPanel 只负责照着摆，helpPanelLayout.test.ts 直接证明它不重叠。
 */
export function helpPanelLayout(groups: readonly HelpGroup[]): HelpRowBox[] {
  const boxes: HelpRowBox[] = [];
  groups.forEach((group, groupIndex) => {
    const x = HELP.columnX[groupIndex] ?? HELP.columnX[HELP.columnX.length - 1] ?? 0;
    group.rows.forEach((_row, rowIndex) => {
      const y = HELP.firstRowY + rowIndex * HELP.rowGap;
      boxes.push({
        kind: 'control',
        groupIndex,
        rowIndex,
        x,
        y,
        width: CHIP.width,
        height: CHIP.height,
      });
      boxes.push({
        kind: 'description',
        groupIndex,
        rowIndex,
        // 和胶囊共用同一条中线，而不是靠一个 +2 的经验偏移对齐。
        x: x + HELP.descriptionOffsetX,
        y: y + Math.round((CHIP.height - LINE_BOX.prose) / 2),
        width: HELP.descriptionWrap,
        height: LINE_BOX.prose,
      });
    });
  });
  return boxes;
}

export function helpRowBoxesOverlap(first: HelpRowBox, second: HelpRowBox): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}
