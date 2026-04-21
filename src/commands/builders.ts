/**
 * Command builders for RoomService
 *
 * These functions help construct proper gRPC commands for the RoomService API.
 * The main client class uses these internally, so you typically don't need to call them directly.
 */

import { toValue } from './helpers';

export type DataEditMode = 'SET' | 'DELETE' | 'APPEND' | 'REMOVE';

export interface User {
  id: string;
  name: string;
  metadata?: { [key: string]: string };
}

export interface JoinOptions {
  userId: string;
  userName: string;
  metadata?: { [key: string]: string };
}

/**
 * Build a CreateRoom command
 */
export function buildCreateRoomCommand(
  userId: string,
  roomOptions: { [key: string]: string }
): any {
  return {
    timestamp: Date.now() * 1000,
    userId,
    createRoom: {
      roomOptions: roomOptions // Send as flat map<string, string> as per protobuf definition
    }
  };
}

/**
 * Build a DeleteRoom command
 */
export function buildDeleteRoomCommand(
  userId: string,
  roomId: string
): any {
  return {
    timestamp: Date.now() * 1000,
    userId,
    roomId,
    deleteRoom: {
      deleteApprove: true
    }
  };
}

/**
 * Build a JoinRoom command
 */
export function buildJoinRoomCommand(
  userId: string,
  roomId: string,
  options: JoinOptions
): any {
  return {
    timestamp: Date.now() * 1000,
    userId,
    roomId,
    joinRoom: {
      userFull: {
        id: options.userId,
        name: options.userName,
        metadata: options.metadata || {}
      }
    }
  };
}

/**
 * Build a LeaveRoom command
 */
export function buildLeaveRoomCommand(
  userId: string,
  roomId: string,
  kickedUserId?: string
): any {
  return {
    timestamp: Date.now() * 1000,
    userId,
    roomId,
    leaveRoom: {
      kickedUserId: kickedUserId || ''
    }
  };
}

/**
 * Build a SetData command (handles SET, DELETE, APPEND, REMOVE modes)
 */
export function buildSetDataCommand(
  userId: string,
  roomId: string,
  dataId: string,
  value: any,
  mode: DataEditMode = 'SET',
  itemIndex?: string
): any {
  const modeMap: Record<DataEditMode, number> = {
    SET: 0,
    DELETE: 1,
    APPEND: 2,
    REMOVE: 3
  };

  const command: any = {
    timestamp: Date.now() * 1000,
    userId,
    roomId,
    affectData: {
      dataId,
      commandMode: modeMap[mode],
      itemIndex: itemIndex || ''
    }
  };

  // Only include dataValue for SET, APPEND modes (not DELETE or REMOVE)
  if (mode !== 'DELETE' && mode !== 'REMOVE') {
    command.affectData.dataValue = toValue(value);
  }

  return command;
}

/**
 * Build a SetOwner command
 */
export function buildSetOwnerCommand(
  userId: string,
  roomId: string,
  newOwnerId: string
): any {
  return {
    timestamp: Date.now() * 1000,
    userId,
    roomId,
    setOwner: {
      newOwnerId
    }
  };
}

/**
 * Build a RefreshRoom command (get full snapshot)
 */
export function buildRefreshRoomCommand(
  userId: string,
  roomId: string
): any {
  return {
    timestamp: Date.now() * 1000,
    userId,
    roomId,
    refreshRoom: {
      refreshRoom: true
    }
  };
}
