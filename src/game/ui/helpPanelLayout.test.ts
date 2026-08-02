import { describe, expect, it } from 'vitest';

import { HELP_CONTENT } from './helpContent';
import { helpPanelLayout, helpRowBoxesOverlap } from './helpPanelLayout';
import { CHIP, HELP, OVERLAY, panelBox } from './layout';

const panel = panelBox(OVERLAY.panel);

describe('帮助面板几何', () => {
  for (const device of ['keyboardMouse', 'gamepad'] as const) {
    it(`${device}：任意两块内容都不重叠`, () => {
      const boxes = helpPanelLayout(HELP_CONTENT[device]);
      const collisions: string[] = [];
      for (let first = 0; first < boxes.length; first += 1) {
        for (let second = first + 1; second < boxes.length; second += 1) {
          if (helpRowBoxesOverlap(boxes[first]!, boxes[second]!)) {
            collisions.push(`${describeBox(boxes[first]!)} ↔ ${describeBox(boxes[second]!)}`);
          }
        }
      }
      expect(collisions).toEqual([]);
    });

    it(`${device}：每块内容都在面板内`, () => {
      for (const box of helpPanelLayout(HELP_CONTENT[device])) {
        expect(box.x, describeBox(box)).toBeGreaterThanOrEqual(panel.left);
        expect(box.x + box.width, describeBox(box)).toBeLessThanOrEqual(panel.right);
        expect(box.y, describeBox(box)).toBeGreaterThanOrEqual(panel.top);
        expect(box.y + box.height, describeBox(box)).toBeLessThanOrEqual(panel.bottom);
      }
    });

    it(`${device}：说明栏放得下最长的一条文案`, () => {
      // 按 16px 正文字保守估算：汉字满宽，ASCII 半宽。放不下就该加宽栏位，
      // 而不是像以前那样给 helpContent 补一个缩写字段。
      for (const group of HELP_CONTENT[device]) {
        for (const row of group.rows) {
          expect(estimateWidth(`${row.action} · ${row.description}`, 16)).toBeLessThanOrEqual(
            HELP.descriptionWrap,
          );
          expect(estimateWidth(row.control, 24)).toBeLessThanOrEqual(CHIP.width);
        }
      }
    });
  }
});

function describeBox(box: ReturnType<typeof helpPanelLayout>[number]): string {
  return `${box.kind}[${box.groupIndex}][${box.rowIndex}]`;
}

function estimateWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const character of text) {
    width += (character.codePointAt(0) ?? 0) > 0x7f ? fontSize : fontSize / 2;
  }
  return width;
}
