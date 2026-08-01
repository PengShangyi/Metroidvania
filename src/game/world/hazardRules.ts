export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 危险区必须按物理体判定。玩家精灵是 24×32，碰撞体只有 14×28（offset 5,4），
 * 用 `getBounds()` 的显示矩形会在左右各多出 5px、头顶多出 4px 的隐形受伤范围。
 *
 * 相交语义与 Phaser.Geom.Intersects.RectangleToRectangle 保持一致：边缘相接算接触。
 */
export function intersectsAnyHazard(box: AABB, hazards: readonly AABB[]): boolean {
  return hazards.some((hazard) => overlaps(box, hazard));
}

function overlaps(first: AABB, second: AABB): boolean {
  return !(
    first.x + first.width < second.x ||
    second.x + second.width < first.x ||
    first.y + first.height < second.y ||
    second.y + second.height < first.y
  );
}
