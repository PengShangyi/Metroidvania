import type { GameSessionState } from '../state/GameSession';
import type { RoomDefinition } from '../world/types';

/**
 * `visited` 是走过的房间；`adjacent` 是从走过的房间能看到一扇门、但还没进去的邻居；
 * `hidden` 是玩家还没有任何理由知道它存在的房间。
 */
export type RoomVisibility = 'visited' | 'adjacent' | 'hidden';

export type MapMarkerKind = 'terminal' | 'pickup' | 'gate';

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

/**
 * 标注只在走过的房间里出现——地图的作用是记录「我看到过什么还没拿」，
 * 而不是提前把没去过的地方剧透干净。已经拿走的东西不再标。
 */
export function visibleMarkers(rooms: RoomDefinition[], session: GameSessionState): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const room of rooms) {
    if (!session.visitedRooms.has(room.id)) continue;
    if (room.checkpoint) markers.push({ roomId: room.id, kind: 'terminal' });
    if (room.pickups.some((pickup) => !session.collectedPickups.has(pickup.id))) {
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
