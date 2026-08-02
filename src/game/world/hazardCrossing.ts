import { DASH } from '../player/dashMath';
import { MOVEMENT } from '../player/movementMath';
import type { AbilityState } from '../state/GameSession';
import { intersectsAnyHazard, type AABB } from './hazardRules';
import {
  BODY_HALF_WIDTH,
  BODY_HEIGHT,
  FRAME_SECONDS,
  buildSurfaces,
  type Surface,
} from './reachability';
import type { RoomDefinition } from './types';

/** 起跳点的扫描精度。玩家一帧走 1.83px，比这更细没有意义。 */
const FINE_STEP = 0.25;
const COARSE_STEP = 1;
/** 只扫描危险区一侧这么宽的一条带；再远也跳不过来。 */
const SCAN_BAND = 160;
/** 剪枝上界：跳 + 冲刺同高最远约 126px，从高处跳下约 158px。 */
const MAX_REACH = 200;
const MAX_FRAMES = 240;

export interface HazardCrossingRoute {
  fromSurfaceId: string;
  toSurfaceId: string;
  /** 可行起跳点区间的宽度（px）。 */
  window: number;
}

export interface HazardCrossing {
  /** 在 room.hazards 里的下标。 */
  hazardIndex: number;
  /**
   * 危险区把同一层地面切成两半时，直接横跨的那条路线——玩家第一反应会试的就是它。
   * 危险区两侧不在同一层（只能从高处绕）时为 undefined。
   */
  ground?: HazardCrossingRoute;
  /** 所有横跨路线里最宽的一条，含从高处跳下；一条都跳不过去时为 undefined。 */
  best?: HazardCrossingRoute;
}

const dashFrameCount = Math.round(DASH.durationMs / 1000 / FRAME_SECONDS);
/** 冲刺起始帧的扫描上限：起跳后再晚就已经落地了。 */
const MAX_DASH_START = dashFrameCount * 3;

/**
 * 从 from 面起跳横跨 hazard 落到 to 面，逐帧步进真实轨迹，返回可行起跳点的区间宽度。
 *
 * 这是 reachability 那套包络算不出来的一个维度。包络只比较「水平间隙 <= 最远距离」，
 * 于是把只有 2.75px 起跳窗口的封锁堤道酸池判成绿灯——模型放行，人类打不中。
 * 两个包络算不到的因素在这里都照实模拟：
 *
 * - 刺尖比地板高 8px，起跳后要两帧才抬得过去，落地侧同理，两头各吃掉几像素预算；
 * - hazardRules 把边缘相接算作命中，所以判定必须复用它，不能另写一份。
 *
 * 冲刺无敌期内其实可以硬穿过危险区（CombatSystem.damagePlayer 首行就返回 false），
 * 但那是个游戏里从未提及的机制。这里一律把接触算作失败，让窗口保持为下界。
 */
export function crossingWindow(
  from: Surface,
  to: Surface,
  hazards: readonly AABB[],
  abilities: AbilityState,
): number {
  const direction = to.left >= from.right ? 1 : -1;
  const edge = direction === 1 ? from.right : from.left;
  const low = direction === 1 ? Math.max(from.left, edge - SCAN_BAND) : edge;
  const high = direction === 1 ? edge : Math.min(from.right, edge + SCAN_BAND);
  const feasible = (x: number): boolean => reaches(x, from.top, to, hazards, direction, abilities);

  // 先按 1px 粗扫定位可行带，再在两端各 1px 内细化到 0.25px。全程细扫要慢两个数量级。
  let firstCoarse: number | undefined;
  let lastCoarse: number | undefined;
  for (let x = low; x <= high; x += COARSE_STEP) {
    if (!feasible(x)) continue;
    if (firstCoarse === undefined) firstCoarse = x;
    lastCoarse = x;
  }
  if (firstCoarse === undefined || lastCoarse === undefined) return 0;

  let first = firstCoarse;
  for (let x = firstCoarse - COARSE_STEP + FINE_STEP; x < firstCoarse; x += FINE_STEP) {
    if (x >= low && feasible(x)) {
      first = x;
      break;
    }
  }
  let last = lastCoarse;
  for (let x = lastCoarse + COARSE_STEP - FINE_STEP; x > lastCoarse; x -= FINE_STEP) {
    if (x <= high && feasible(x)) {
      last = x;
      break;
    }
  }
  return last - first + FINE_STEP;
}

function reaches(
  startX: number,
  startY: number,
  to: Surface,
  hazards: readonly AABB[],
  direction: number,
  abilities: AbilityState,
): boolean {
  if (simulateJump(startX, startY, to, hazards, direction, null)) return true;
  if (!abilities.phaseDash) return false;
  for (let start = 0; start <= MAX_DASH_START; start += 1) {
    if (simulateJump(startX, startY, to, hazards, direction, start)) return true;
  }
  return false;
}

function simulateJump(
  startX: number,
  startY: number,
  to: Surface,
  hazards: readonly AABB[],
  direction: number,
  dashStart: number | null,
): boolean {
  // 每次模拟只分配一个碰撞盒，逐帧改写它的 x/y——这个函数会被调用上百万次。
  const box: AABB = {
    x: startX - BODY_HALF_WIDTH,
    y: startY - BODY_HEIGHT,
    width: BODY_HALF_WIDTH * 2,
    height: BODY_HEIGHT,
  };
  if (intersectsAnyHazard(box, hazards)) return false;
  let x = startX;
  let y = startY;
  let velocityY: number = MOVEMENT.jumpVelocity;
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    const dashing = dashStart !== null && frame >= dashStart && frame < dashStart + dashFrameCount;
    if (dashing) {
      // 冲刺关重力、竖直速度归零，所以它既加水平距离也延长滞空。
      velocityY = 0;
      x += direction * DASH.speed * FRAME_SECONDS;
    } else {
      velocityY = Math.min(velocityY + MOVEMENT.gravity * FRAME_SECONDS, MOVEMENT.maxFallSpeed);
      y += velocityY * FRAME_SECONDS;
      x += direction * MOVEMENT.speed * FRAME_SECONDS;
    }
    box.x = x - BODY_HALF_WIDTH;
    box.y = y - BODY_HEIGHT;
    if (intersectsAnyHazard(box, hazards)) return false;
    if (velocityY > 0 && y >= to.top) {
      if (x < to.left || x > to.right) return false;
      box.y = to.top - BODY_HEIGHT;
      return !intersectsAnyHazard(box, hazards);
    }
  }
  return false;
}

/**
 * 逐个危险区枚举「真的从一侧跳到另一侧」的路线。从上方平台链绕过去的不算横跨，
 * 那种房间会得到 best === undefined，由调用方结合 roomReachability 单独确认。
 */
export function hazardCrossings(room: RoomDefinition, abilities: AbilityState): HazardCrossing[] {
  const surfaces = buildSurfaces(room);
  const hazards: AABB[] = room.hazards.map((hazard) => ({ ...hazard }));

  return room.hazards.map((hazard, hazardIndex) => {
    const right = hazard.x + hazard.width;
    const leftBank = surfaces.filter((surface) => surface.right <= hazard.x);
    const rightBank = surfaces.filter((surface) => surface.left >= right);
    // 被这道危险区切开的那一层：只看它真正嵌在里面的地面，别让恰好更靠近的高台顶掉
    // 真正的地面路线。判据与 reachability.hazardBlockers 一致。
    const split = (surface: Surface): boolean =>
      hazard.y <= surface.top && hazard.y + hazard.height >= surface.top - BODY_HEIGHT;
    const nearestLeft = leftBank
      .filter(split)
      .reduce<Surface | undefined>(
        (best, surface) => (!best || surface.right > best.right ? surface : best),
        undefined,
      );
    const nearestRight = rightBank
      .filter(split)
      .reduce<Surface | undefined>(
        (best, surface) => (!best || surface.left < best.left ? surface : best),
        undefined,
      );
    const sameLevel =
      nearestLeft && nearestRight && nearestLeft.top === nearestRight.top
        ? [nearestLeft, nearestRight]
        : undefined;

    const pairs = [
      ...leftBank.flatMap((from) => rightBank.map((to) => [from, to] as const)),
      ...rightBank.flatMap((from) => leftBank.map((to) => [from, to] as const)),
    ];

    const result: HazardCrossing = { hazardIndex };
    for (const [from, to] of pairs) {
      // 目标比跳跃上限还高、或水平距离远超任何轨迹的，直接跳过：模拟很贵。
      if (from.top - to.top > MOVEMENT.speed) continue;
      const gap = to.left >= from.right ? to.left - from.right : from.left - to.right;
      if (gap > MAX_REACH) continue;
      const window = crossingWindow(from, to, hazards, abilities);
      if (window <= 0) continue;
      const route: HazardCrossingRoute = {
        fromSurfaceId: from.id,
        toSurfaceId: to.id,
        window,
      };
      if (!result.best || window > result.best.window) result.best = route;
      if (sameLevel && from === sameLevel[0] && to === sameLevel[1]) result.ground = route;
    }
    return result;
  });
}
