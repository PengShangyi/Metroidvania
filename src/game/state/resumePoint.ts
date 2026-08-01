import type { GameSessionState } from './GameSession';

export interface SessionEntryPoint {
  roomId: string;
  spawnId: string;
}

/**
 * 存档只记录终端的房间与生成点，`currentRoomId` 则会被任意一次拾取写入。
 * 读档时把会话拉回终端房间，否则续关会落在最后一次存档的房间里。
 */
export function resumeSession(saved: GameSessionState): GameSessionState {
  return { ...saved, currentRoomId: saved.checkpointRoomId };
}

/**
 * `checkpointSpawnId` 只在 `checkpointRoomId` 内有定义。会话停在别处时必须显式退回
 * 房间自身的首个生成点，而不是让同名生成点静默匹配到错误的门。
 */
export function sessionEntryPoint(session: GameSessionState): SessionEntryPoint {
  const atCheckpoint = session.currentRoomId === session.checkpointRoomId;
  return {
    roomId: session.currentRoomId,
    spawnId: atCheckpoint ? session.checkpointSpawnId : '',
  };
}
