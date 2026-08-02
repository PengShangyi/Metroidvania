import { describe, expect, it } from 'vitest';

import {
  BUTTON,
  CHIP,
  ENDING,
  HELP,
  HUD,
  LINE_BOX,
  MAP,
  OVERLAY,
  PAUSE,
  SETTINGS,
  TITLE,
  TUTORIAL_HUD,
  UI,
  mapPoint,
  panelBox,
  type LayoutBox,
} from './layout';
import { HELP_CONTENT } from './helpContent';
import { ROOM_MAP_LAYOUT } from './mapLayout';

const overlayPanel = panelBox(OVERLAY.panel);

describe('UI 布局锚点', () => {
  it('覆盖层面板留在安全区内', () => {
    expectInsideSafeArea(overlayPanel);
    expectInsideSafeArea(panelBox(TUTORIAL_HUD.panel));
  });

  it('暂停菜单的按钮互不重叠且落在面板内', () => {
    const rows = PAUSE.rows.map((y) => centeredRow(y, BUTTON.height));
    expectStacked([headingRow(), ...rows]);
    for (const row of rows) expectVerticalFit(row, overlayPanel);
  });

  it('设置菜单的按钮、说明与返回键互不重叠', () => {
    const rows = [
      ...SETTINGS.rows.map((y) => centeredRow(y, BUTTON.height)),
      centeredRow(SETTINGS.note.y, LINE_BOX.caption),
      centeredRow(SETTINGS.back.y, BUTTON.height),
    ];
    expectStacked([headingRow(), ...rows]);
    for (const row of rows) expectVerticalFit(row, overlayPanel);
  });

  it('地图的区域标签、节点、当前位置与图例互不重叠', () => {
    const nodes = Object.values(ROOM_MAP_LAYOUT).map(mapPoint);
    const nodeBand: LayoutBox = {
      top: Math.min(...nodes.map((point) => point.y)) - MAP.currentNode.halfHeight,
      bottom: Math.max(...nodes.map((point) => point.y)) + MAP.currentNode.halfHeight,
      left: Math.min(...nodes.map((point) => point.x)) - MAP.currentNode.halfWidth,
      right: Math.max(...nodes.map((point) => point.x)) + MAP.currentNode.halfWidth,
    };
    expectInside(nodeBand, overlayPanel);
    expectStacked([
      headingRow(),
      centeredRow(MAP.regionLabelY, LINE_BOX.hud),
      nodeBand,
      centeredRow(MAP.current.y, LINE_BOX.hud),
      centeredRow(MAP.legend.y, LINE_BOX.caption),
    ]);
  });

  it('地图图例的每个条目横向不重叠', () => {
    // 图例是「色块 + 短标签」，标签用 16px 正文字，按最宽的四个汉字估算。
    const widest = 4 * 16;
    const entries = MAP.legend.entryX.map((x) => ({
      left: x,
      right: x + MAP.legend.swatch + MAP.legend.labelGap + widest,
      top: MAP.legend.y - LINE_BOX.caption / 2,
      bottom: MAP.legend.y + LINE_BOX.caption / 2,
    }));
    for (let index = 1; index < entries.length; index += 1) {
      expect(entries[index]!.left).toBeGreaterThan(entries[index - 1]!.right);
    }
    for (const entry of entries) expectInside(entry, overlayPanel);
  });

  it('帮助面板的两栏放得下按键胶囊与说明，且不互相侵入', () => {
    const [leftX, rightX] = HELP.columnX;
    const columnRight = (x: number): number => x + HELP.descriptionOffsetX + HELP.descriptionWrap;
    expect(CHIP.width).toBeLessThan(HELP.descriptionOffsetX);
    expect(columnRight(leftX!)).toBeLessThan(rightX!);
    expect(columnRight(rightX!)).toBeLessThanOrEqual(overlayPanel.right);
    expect(leftX!).toBeGreaterThanOrEqual(overlayPanel.left);
  });

  it('帮助面板的行距容得下按键胶囊，且最后一行不压到页脚', () => {
    const rowHeight = Math.max(CHIP.height, LINE_BOX.prose);
    expect(HELP.rowGap).toBeGreaterThan(rowHeight);
    // 行数从内容里数出来，不要写死：写死 5 的那阵子首栏已经是六行，而多出来的那行
    // 正压在页脚上，测试却照样绿。
    const rows = Array.from({ length: longestHelpGroup() }, (_, index) => ({
      top: HELP.firstRowY + index * HELP.rowGap,
      bottom: HELP.firstRowY + index * HELP.rowGap + rowHeight,
      left: HELP.columnX[0]!,
      right: columnEnd(),
    }));
    expectStacked([
      headingRow(),
      centeredRow(HELP.subtitle.y, LINE_BOX.caption),
      // 分组标题左对齐、按左上角摆，和居中的标题/副标题不是一回事。
      topAnchoredRow(HELP.groupTitle.y, LINE_BOX.hud),
      ...rows,
      centeredRow(HELP.footer.y, LINE_BOX.caption),
    ]);
    for (const row of rows) expectInside(row, overlayPanel);
    expectVerticalFit(centeredRow(HELP.footer.y, LINE_BOX.caption), overlayPanel);
  });

  it('游戏内 HUD 的文本互不重叠且留在安全区内', () => {
    const toast: LayoutBox = {
      top: HUD.toast.bottom - LINE_BOX.prose * 3,
      bottom: HUD.toast.bottom,
      left: HUD.toast.x - HUD.toast.wrap / 2,
      right: HUD.toast.x + HUD.toast.wrap / 2,
    };
    expectStacked([
      { ...centeredRow(HUD.bossBar.y + LINE_BOX.hud / 2, LINE_BOX.hud), left: 0, right: UI.width },
      toast,
      {
        top: HUD.roomLabel.y - LINE_BOX.hud,
        bottom: HUD.roomLabel.y,
        left: HUD.roomLabel.x,
        right: UI.width - UI.safe,
      },
    ]);
    expectInsideSafeArea(toast);
    // 左上生命与右上探索度共用同一条基线，只能靠横向留白分开。
    expect(HUD.healthText.y).toBe(HUD.exploration.y);
    expect(HUD.healthIcon.x).toBeGreaterThanOrEqual(UI.safe);
    expect(HUD.exploration.x).toBeLessThanOrEqual(UI.width - UI.safe);
    expect(HUD.keyHint.y).toBeGreaterThanOrEqual(HUD.exploration.y + LINE_BOX.hud);
    expect(HUD.bossBar.y).toBeGreaterThanOrEqual(HUD.keyHint.y + LINE_BOX.hud);
  });

  it('标题画面从主标题到按键提示逐行不重叠', () => {
    expectStacked([
      centeredRow(TITLE.heading.y, LINE_BOX.title),
      centeredRow(TITLE.version.y, LINE_BOX.hud),
      ...TITLE.menuRows.map((y) => centeredRow(y, BUTTON.height)),
      centeredRow(TITLE.saveStatus.y, LINE_BOX.prose),
      centeredRow(TITLE.keyHint.y, LINE_BOX.hud),
    ]);
    expectVerticalFit(centeredRow(TITLE.keyHint.y, LINE_BOX.hud), safeArea());
    expectVerticalFit(centeredRow(TITLE.heading.y, LINE_BOX.title), safeArea());
  });

  it('结局画面的标题、正文、数值与按键提示不重叠', () => {
    expectStacked([
      centeredRow(ENDING.heading.y, LINE_BOX.title),
      topAnchoredRow(ENDING.prose.y, LINE_BOX.prose * 2),
      topAnchoredRow(ENDING.stats.y, LINE_BOX.hud * 4),
      centeredRow(ENDING.keyHint.y, LINE_BOX.hud),
    ]);
  });

  it('训练 HUD 的头部条容得下目标与效果两行', () => {
    const band = {
      top: TUTORIAL_HUD.band.y - TUTORIAL_HUD.band.height / 2,
      bottom: TUTORIAL_HUD.band.y + TUTORIAL_HUD.band.height / 2,
      left: UI.centerX - TUTORIAL_HUD.band.width / 2,
      right: UI.centerX + TUTORIAL_HUD.band.width / 2,
    };
    // 目标行按两行留位：文案变长时不能挤到效果行上。
    const objective = topAnchoredRow(TUTORIAL_HUD.objective.y, LINE_BOX.prose * 2);
    const effect = topAnchoredRow(TUTORIAL_HUD.effect.y, LINE_BOX.caption);
    expectStacked([topAnchoredRow(TUTORIAL_HUD.title.y, LINE_BOX.hud), objective, effect]);
    expectVerticalFit(objective, band);
    expectVerticalFit(effect, band);
    expect(TUTORIAL_HUD.objective.wrap).toBeLessThanOrEqual(TUTORIAL_HUD.band.width);
    expect(TUTORIAL_HUD.progress.y).toBe(TUTORIAL_HUD.title.y);
    expect(TUTORIAL_HUD.keyHint.y).toBe(TUTORIAL_HUD.title.y);
  });

  it('训练完成面板的标题、正文与按钮不重叠', () => {
    const panel = panelBox(TUTORIAL_HUD.panel);
    const rows = [
      centeredRow(TUTORIAL_HUD.panelHeading.y, LINE_BOX.heading),
      topAnchoredRow(TUTORIAL_HUD.panelBody.y, LINE_BOX.prose * 2),
      centeredRow(TUTORIAL_HUD.panelButton.y, BUTTON.height),
    ];
    expectStacked(rows);
    for (const row of rows) expectVerticalFit(row, panel);
    expect(TUTORIAL_HUD.panelBody.wrap).toBeLessThan(TUTORIAL_HUD.panel.width);
  });
});

function longestHelpGroup(): number {
  return Math.max(
    ...Object.values(HELP_CONTENT)
      .flat()
      .map((group) => group.rows.length),
  );
}

function headingRow(): LayoutBox {
  return centeredRow(OVERLAY.heading.y, LINE_BOX.heading);
}

function columnEnd(): number {
  return HELP.columnX[1]! + HELP.descriptionOffsetX + HELP.descriptionWrap;
}

function centeredRow(y: number, height: number): LayoutBox {
  return { top: y - height / 2, bottom: y + height / 2, left: 0, right: UI.width };
}

function topAnchoredRow(y: number, height: number): LayoutBox {
  return { top: y, bottom: y + height, left: 0, right: UI.width };
}

function expectStacked(rows: readonly LayoutBox[]): void {
  const sorted = [...rows].sort((a, b) => a.top - b.top);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (previous.right <= current.left || current.right <= previous.left) continue;
    expect(current.top).toBeGreaterThanOrEqual(previous.bottom);
  }
}

function expectInside(box: LayoutBox, container: LayoutBox): void {
  expect(box.left).toBeGreaterThanOrEqual(container.left);
  expect(box.right).toBeLessThanOrEqual(container.right);
  expectVerticalFit(box, container);
}

/** 居中排布的整行文本没有可预测的横向范围，只校验纵向。 */
function expectVerticalFit(box: LayoutBox, container: LayoutBox): void {
  expect(box.top).toBeGreaterThanOrEqual(container.top);
  expect(box.bottom).toBeLessThanOrEqual(container.bottom);
}

function safeArea(): LayoutBox {
  return {
    left: UI.safe,
    right: UI.width - UI.safe,
    top: UI.safe,
    bottom: UI.height - UI.safe,
  };
}

function expectInsideSafeArea(box: LayoutBox): void {
  expectInside(box, safeArea());
}
