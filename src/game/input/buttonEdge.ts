/**
 * 手柄按键的「本帧刚按下」判定。抽出来是因为它有一条不写下来就会反复踩的规则：
 * Phaser 复用 Scene 实例，而场景是可以在按键仍然按住的那一刻被重建的——用手柄 LB
 * 关闭帮助时，HelpScene 走 scene.start('title') 交还控制权，此时 LB 多半还没松开。
 * 若边沿基准清成 false，重建后的第一帧就会凭空得到一次「按下」，帮助立刻被重新打开，
 * 玩家不松手就一直弹。基准必须取「此刻是否已按住」。
 */

/** 场景重建时的边沿基准：取当前实际按住状态，而不是 false。 */
export function seedEdge(pressedNow: boolean): boolean {
  return pressedNow;
}

/** 上一帧没按、这一帧按着，才算一次新的按下。 */
export function edgePressed(now: boolean, previous: boolean): boolean {
  return now && !previous;
}
