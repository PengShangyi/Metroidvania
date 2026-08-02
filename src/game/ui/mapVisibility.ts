import type { GameSessionState } from '../state/GameSession';
import type { RoomDefinition } from '../world/types';

/**
 * `visited` 是走过的房间；`adjacent` 是从走过的房间能看到一扇门、但还没进去的邻居；
 * `hidden` 是玩家还没有任何理由知道它存在的房间。
 */
export type RoomVisibility = 'visited' | 'adjacent' | 'hidden';

export type MapMarkerKind = 'terminal' | 'pickup' | 'gate' | 'ability';

export interface MapMarker {
  roomId: string;
  kind: MapMarkerKind;
}

export function buildAdjacency(rooms: RoomDefinition[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    const list = adjacency.get(from);
    if (!list) adjacency.set(from, [to]);
    else if (!list.includes(to)) list.push(to);
  };
  for (const room of rooms) {
    for (const exit of room.exits) {
      link(room.id, exit.targetRoomId);
      link(exit.targetRoomId, room.id);
    }
  }
  return adjacency;
}

export function roomVisibility(
  roomId: string,
  visited: ReadonlySet<string>,
  adjacency: ReadonlyMap<string, string[]>,
): RoomVisibility {
  if (visited.has(roomId)) return 'visited';
  const neighbours = adjacency.get(roomId) ?? [];
  return neighbours.some((neighbour) => visited.has(neighbour)) ? 'adjacent' : 'hidden';
}

/** 只要有一端走过就画连线：玩家站在房间里就看得到门，哪怕还没穿过去。 */
export function connectionVisible(
  fromRoomId: string,
  toRoomId: string,
  visited: ReadonlySet<string>,
): boolean {
  return visited.has(fromRoomId) || visited.has(toRoomId);
}

const ABILITY_PICKUPS = new Set(['phaseDash', 'magneticGrip']);

/**
 * 标注只在走过的房间里出现——地图的作用是记录「我看到过什么还没拿」，
 * 而不是提前把没去过的地方剧透干净。已经拿走的东西不再标。
 *
 * 两个能力模块是唯一的例外，它们从一开始就标出来。能力是主线目标而不是可选收集品：
 * 被能力门挡住的玩家得到的提示只有「通道需要：相位冲刺」，藏起模块的位置并不制造
 * 悬念，只是让人不知道往哪走。拿到之后标注消失，和其他拾取物一致。
 */
export function visibleMarkers(rooms: RoomDefinition[], session: GameSessionState): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const room of rooms) {
    const uncollectedAbility = room.pickups.some(
      (pickup) => ABILITY_PICKUPS.has(pickup.type) && !session.collectedPickups.has(pickup.id),
    );
    if (uncollectedAbility) markers.push({ roomId: room.id, kind: 'ability' });
    if (!session.visitedRooms.has(room.id)) continue;
    if (room.checkpoint) markers.push({ roomId: room.id, kind: 'terminal' });
    // 能力模块已经有自己的标注了，别在同一个房间上再画一个通用道具点。
    if (
      room.pickups.some(
        (pickup) => !ABILITY_PICKUPS.has(pickup.type) && !session.collectedPickups.has(pickup.id),
      )
    ) {
      markers.push({ roomId: room.id, kind: 'pickup' });
    }
    if (room.exits.some((exit) => exit.requirement !== 'none')) {
      markers.push({ roomId: room.id, kind: 'gate' });
    }
  }
  return markers;
}

export function exploredRoomCount(session: GameSessionState): number {
  return session.visitedRooms.size;
}
