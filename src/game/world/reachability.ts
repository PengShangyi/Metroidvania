import { DASH } from '../player/dashMath';
import { MOVEMENT } from '../player/movementMath';
import { WALL_JUMP } from '../player/wallJumpMath';
import type { AbilityState } from '../state/GameSession';
import type {
  CheckpointDefinition,
  ExitDefinition,
  PickupDefinition,
  RoomDefinition,
} from './types';

const FRAME_SECONDS = 1 / 60;
/** 碰撞体是 14×28（Player 构造函数里的 setSize），站立点在体底中心。 */
const BODY_HALF_WIDTH = 7;
const BODY_HEIGHT = 28;
/** RoomRuntime 用 (player.x, player.y - 12) 判定出口与拾取物。 */
const PROBE_OFFSET_Y = 12;
const PICKUP_RADIUS = 25;
const CHECKPOINT_RADIUS = 34;
const ROOM_FLOOR = 400;

export type EnvelopeMode = 'conservative' | 'generous';

export interface MovementEnvelope {
  /** 最大跳跃上升（像素）。 */
  maxRise: number;
  /** 单次墙跳的上升（像素），仅在持有磁附跃迁时有意义。 */
  maxWallRise: number;
  /** 在高度差 dy（正值表示目标更高）处能横越的最大水平距离；不可达时为 -1。 */
  maxRun(dy: number): number;
  /** 是否把世界边界当作可攀爬的墙面。 */
  climbsWorldBounds: boolean;
  /** 是否允许墙跳攀爬。 */
  climbsWalls: boolean;
}

export interface Surface {
  id: string;
  top: number;
  left: number;
  right: number;
}

export interface RoomReachability {
  surfaces: Surface[];
  standable: Surface[];
  exitReachable(exit: ExitDefinition): boolean;
  pickupReachable(pickup: PickupDefinition): boolean;
  checkpointReachable(checkpoint: CheckpointDefinition): boolean;
}

/**
 * Phaser Arcade 是半隐式 Euler（每帧先积速度再积位移），所以实际跳跃上升比解析式
 * v²/2g 少半帧：300²/1800 = 50px，实测只有 47.5px。关卡几何必须按实测值校验。
 */
export function jumpRise(initialVelocity: number): number {
  let velocityY = initialVelocity;
  let rise = 0;
  let peak = 0;
  for (let frame = 0; frame < 600; frame += 1) {
    velocityY = Math.min(velocityY + MOVEMENT.gravity * FRAME_SECONDS, MOVEMENT.maxFallSpeed);
    rise -= velocityY * FRAME_SECONDS;
    peak = Math.max(peak, rise);
    if (velocityY > 0) break;
  }
  return peak;
}

/**
 * 从起跳到落在高度差 dy 的平面上，最远能横越多少水平距离。
 * dashStartFrame 不为 null 时在该帧插入一次冲刺：冲刺期间关闭重力、竖直速度归零，
 * 所以它既加水平距离也延长滞空，必须照实模拟，否则会低估玩家能力。
 */
function trajectoryRun(dy: number, dashStartFrame: number | null): number {
  const dashFrames = Math.round(DASH.durationMs / 1000 / FRAME_SECONDS);
  let velocityY: number = MOVEMENT.jumpVelocity;
  let rise = 0;
  let distance = 0;
  let best = -1;
  for (let frame = 0; frame < 600; frame += 1) {
    const dashing =
      dashStartFrame !== null && frame >= dashStartFrame && frame < dashStartFrame + dashFrames;
    if (dashing) {
      velocityY = 0;
      distance += DASH.speed * FRAME_SECONDS;
    } else {
      velocityY = Math.min(velocityY + MOVEMENT.gravity * FRAME_SECONDS, MOVEMENT.maxFallSpeed);
      rise -= velocityY * FRAME_SECONDS;
      distance += MOVEMENT.speed * FRAME_SECONDS;
    }
    if (rise >= dy) best = distance;
    if (rise < dy - ROOM_FLOOR) break;
  }
  return best;
}

export function deriveEnvelope(abilities: AbilityState, mode: EnvelopeMode): MovementEnvelope {
  const generous = mode === 'generous';
  // 保守包络往回收，用于「必须走得通」的断言；宽松包络往外放，用于「没有能力必须走不通」。
  const riseMargin = generous ? 2 : -2;
  const runMargin = generous ? 4 : -4;
  const rise = jumpRise(MOVEMENT.jumpVelocity) + riseMargin;
  const dashFrames = Math.round(DASH.durationMs / 1000 / FRAME_SECONDS);
  const cache = new Map<number, number>();

  return {
    maxRise: rise,
    maxWallRise: jumpRise(WALL_JUMP.verticalVelocity) + riseMargin,
    climbsWalls: abilities.magneticGrip,
    // 世界边界也会置位 blocked.left/right，理论上可以蹬着屏幕边缘攀爬。
    // 这是个不该被设计依赖的取巧，所以只在宽松包络里承认它。
    climbsWorldBounds: generous && abilities.magneticGrip,
    maxRun(dy: number): number {
      const cached = cache.get(dy);
      if (cached !== undefined) return cached;
      if (dy > rise) {
        cache.set(dy, -1);
        return -1;
      }
      let best = trajectoryRun(dy, null);
      if (abilities.phaseDash) {
        for (let start = 0; start <= dashFrames * 8; start += 1) {
          best = Math.max(best, trajectoryRun(dy, start));
        }
      }
      const result = best < 0 ? -1 : best + runMargin;
      cache.set(dy, result);
      return result;
    },
  };
}

function overlaps(aLeft: number, aRight: number, bLeft: number, bRight: number): boolean {
  return aLeft <= bRight && bLeft <= aRight;
}

interface Interval {
  left: number;
  right: number;
}

function subtractInterval(segments: Interval[], cut: Interval): Interval[] {
  return segments.flatMap((segment) => {
    if (cut.right <= segment.left || cut.left >= segment.right) return [segment];
    const kept: Interval[] = [];
    if (cut.left > segment.left) kept.push({ left: segment.left, right: cut.left });
    if (cut.right < segment.right) kept.push({ left: cut.right, right: segment.right });
    return kept;
  });
}

/** 站在某段平面上时，身体会碰到危险区的 x 区间要从可站立区间里挖掉。 */
function carveSurface(surface: Surface, blockers: Interval[]): Surface[] {
  let segments: Interval[] = [{ left: surface.left, right: surface.right }];
  for (const blocker of blockers) segments = subtractInterval(segments, blocker);
  return segments
    .filter((segment) => segment.right - segment.left >= 2 * BODY_HALF_WIDTH)
    .map((segment, index) => ({
      id: segments.length > 1 ? `${surface.id}#${index}` : surface.id,
      top: surface.top,
      left: segment.left,
      right: segment.right,
    }));
}

function hazardBlockers(surface: Surface, hazards: RoomDefinition['hazards']): Interval[] {
  return hazards
    .filter(
      (hazard) =>
        hazard.y <= surface.top &&
        hazard.y + hazard.height >= surface.top - BODY_HEIGHT &&
        overlaps(hazard.x, hazard.x + hazard.width, surface.left, surface.right),
    )
    .map((hazard) => ({
      left: hazard.x - BODY_HALF_WIDTH,
      right: hazard.x + hazard.width + BODY_HALF_WIDTH,
    }));
}

export function buildSurfaces(room: RoomDefinition): Surface[] {
  const platforms = room.platforms.flatMap((platform, index) => {
    const surface: Surface = {
      id: `p${index}`,
      top: platform.y,
      left: platform.x,
      right: platform.x + platform.width,
    };
    return carveSurface(surface, hazardBlockers(surface, room.hazards));
  });

  // 玩家开着 collideWorldBounds，掉进平台之间的缺口不会坠落到房间之外——
  // 世界底边本身就是一层可以站立、可以横穿的地板，浅坑因此并不构成阻隔。
  const floorSurface: Surface = { id: 'world-floor', top: room.height, left: 0, right: room.width };
  const occupied = room.platforms
    .filter((platform) => platform.y + platform.height > room.height - BODY_HEIGHT)
    .map((platform) => ({ left: platform.x, right: platform.x + platform.width }));
  const floor = carveSurface(floorSurface, [
    ...occupied,
    ...hazardBlockers(floorSurface, room.hazards),
  ]);

  return [...platforms, ...floor];
}

interface WallFace {
  x: number;
  top: number;
  bottom: number;
  surfaceId: string;
}

function buildWallFaces(room: RoomDefinition, surfaces: Surface[]): WallFace[] {
  const faces: WallFace[] = [];
  room.platforms.forEach((platform, index) => {
    const top = surfaces.find((surface) => surface.id.startsWith(`p${index}`));
    if (!top) return;
    for (const x of [platform.x, platform.x + platform.width]) {
      faces.push({
        x,
        top: platform.y,
        bottom: platform.y + platform.height,
        surfaceId: top.id,
      });
    }
  });
  return faces;
}

function standingRange(surface: Surface, mode: EnvelopeMode): { left: number; right: number } {
  // 宽松模式承认「半只脚踩在边缘」也算站得住（Arcade 只要求碰撞体有重叠）。
  const slack = mode === 'generous' ? BODY_HALF_WIDTH : 0;
  return { left: surface.left - slack, right: surface.right + slack };
}

function horizontalGap(
  from: { left: number; right: number },
  to: { left: number; right: number },
): number {
  if (overlaps(from.left, from.right, to.left, to.right)) return 0;
  return from.right < to.left ? to.left - from.right : from.left - to.right;
}

export function roomReachability(
  room: RoomDefinition,
  spawnId: string,
  abilities: AbilityState,
  mode: EnvelopeMode = 'conservative',
): RoomReachability {
  const envelope = deriveEnvelope(abilities, mode);
  const surfaces = buildSurfaces(room);
  const faces = buildWallFaces(room, surfaces);
  const byId = new Map(surfaces.map((surface) => [surface.id, surface]));
  const spawn = room.spawns.find((candidate) => candidate.id === spawnId) ?? room.spawns[0];

  const landing = spawn
    ? surfaces
        .filter(
          (surface) =>
            surface.top >= spawn.y - 1 && spawn.x >= surface.left && spawn.x <= surface.right,
        )
        .sort((a, b) => a.top - b.top)[0]
    : undefined;

  const reached = new Set<string>();
  const queue: Surface[] = [];
  if (landing) {
    reached.add(landing.id);
    queue.push(landing);
  }

  while (queue.length > 0) {
    const current = queue.shift() as Surface;
    const from = standingRange(current, mode);
    for (const target of surfaces) {
      if (reached.has(target.id)) continue;
      const dy = current.top - target.top;
      const run = envelope.maxRun(dy);
      if (run < 0) continue;
      if (horizontalGap(from, standingRange(target, mode)) > run) continue;
      reached.add(target.id);
      queue.push(target);
    }

    if (!envelope.climbsWalls) continue;
    // 墙跳攀爬：只要跳跃途中身体能贴上某个竖直面，就能沿它一路蹬到那块平台的顶面。
    const bodyCeiling = current.top - envelope.maxRise - BODY_HEIGHT;
    for (const face of faces) {
      if (reached.has(face.surfaceId)) continue;
      const target = byId.get(face.surfaceId);
      if (!target || target.top >= current.top) continue;
      if (face.bottom < bodyCeiling || face.top > current.top) continue;
      const reach = envelope.maxRun(0);
      if (reach < 0) continue;
      const gap = horizontalGap(from, {
        left: face.x - BODY_HALF_WIDTH,
        right: face.x + BODY_HALF_WIDTH,
      });
      if (gap > reach) continue;
      reached.add(target.id);
      queue.push(target);
    }

    if (!envelope.climbsWorldBounds) continue;
    for (const target of surfaces) {
      if (reached.has(target.id)) continue;
      const touchesEdge =
        target.left <= BODY_HALF_WIDTH || target.right >= room.width - BODY_HALF_WIDTH;
      const currentTouchesEdge =
        current.left <= BODY_HALF_WIDTH || current.right >= room.width - BODY_HALF_WIDTH;
      if (!touchesEdge || !currentTouchesEdge) continue;
      reached.add(target.id);
      queue.push(target);
    }
  }

  const standable = surfaces.filter((surface) => reached.has(surface.id));

  const nearestStandX = (surface: Surface, x: number): number => {
    const range = standingRange(surface, mode);
    return Math.min(Math.max(x, range.left), range.right);
  };

  // 站立点是确定的（Arcade 把体底精确分离到平面上），所以半径判定只留 1px 容差。
  const radiusSlack = mode === 'generous' ? 0 : 1;

  return {
    surfaces,
    standable,
    exitReachable(exit: ExitDefinition): boolean {
      return standable.some((surface) => {
        const probeY = surface.top - PROBE_OFFSET_Y;
        if (probeY < exit.y || probeY > exit.y + exit.height) return false;
        const range = standingRange(surface, mode);
        return overlaps(range.left, range.right, exit.x, exit.x + exit.width);
      });
    },
    pickupReachable(pickup: PickupDefinition): boolean {
      return standable.some((surface) => {
        const x = nearestStandX(surface, pickup.x);
        const dx = x - pickup.x;
        const dy = surface.top - PROBE_OFFSET_Y - pickup.y;
        return Math.hypot(dx, dy) < PICKUP_RADIUS - radiusSlack;
      });
    },
    checkpointReachable(checkpoint: CheckpointDefinition): boolean {
      return standable.some((surface) => {
        const x = nearestStandX(surface, checkpoint.x);
        const dx = x - checkpoint.x;
        const dy = surface.top - checkpoint.y;
        return Math.hypot(dx, dy) < CHECKPOINT_RADIUS - radiusSlack;
      });
    },
  };
}
