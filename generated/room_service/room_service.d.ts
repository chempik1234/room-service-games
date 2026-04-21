// Auto-generated TypeScript declarations for room_service protobuf
// This is a minimal stub - you may want to generate full declarations with protoc-gen-ts

export interface EmptyMessage {}

export interface ErrorMessage {
  error: string;
}

export enum DateEditMode {
  SET = 0,
  DELETE = 1,
  APPEND = 2,
  REMOVE = 3
}

export interface Value {
  stringValue?: string;
  intValue?: number;
  floatValue?: number;
  boolValue?: boolean;
  binaryValue?: Buffer;
  listValue?: ListValue;
  mapValue?: MapValue;
}

export interface ListValue {
  values: Value[];
}

export interface MapValue {
  values: { [key: string]: Value };
}

export interface User {
  id: string;
  name: string;
  metadata: { [key: string]: string };
}

export interface RoomShort {
  roomOptions: { [key: string]: string };
  roomId: string;
  roomOwnerId: string;
}

export interface RoomData {
  values: { [key: string]: Value };
}

export interface Command {
  commandId?: string;
  timestamp: number;
  roomId?: string;
  userId: string;
  createRoom?: CreateRoomCommandBody;
  deleteRoom?: DeleteRoomCommandBody;
  joinRoom?: JoinRoomCommandBody;
  leaveRoom?: LeaveRoomCommandBody;
  affectData?: SetAppendDeleteDataCommandBody;
  setOwner?: SetOwnerUserID;
  refreshRoom?: RefreshRoomCommandBody;
}

export interface CreateRoomCommandBody {
  roomOptions: { [key: string]: string };
}

export interface DeleteRoomCommandBody {
  deleteApprove: boolean;
}

export interface JoinRoomCommandBody {
  userFull: User;
}

export interface LeaveRoomCommandBody {
  kickedUserId?: string;
}

export interface SetAppendDeleteDataCommandBody {
  dataId: string;
  dataValue?: Value;
  commandMode: DateEditMode;
  itemIndex?: string;
}

export interface SetOwnerUserID {
  newOwnerId: string;
}

export interface RefreshRoomCommandBody {
  refreshRoom: boolean;
}

export interface Event {
  timestamp: number;
  roomId: string;
  userId: string;
  roomCreated?: RoomCreatedEventBody;
  roomDeleted?: RoomDeletedEventBody;
  joinedRoom?: JoinedRoomEventBody;
  leftRoom?: LeftRoomEventBody;
  dataEdited?: DataEditedEventBody;
  ownerChanged?: OwnerChangedEventBody;
  fullRoom?: FullRoomSnapshotEventBody;
  errorMessage?: ErrorMessage;
}

export interface RoomCreatedEventBody {
  roomOptions: { [key: string]: string };
  roomId: string;
}

export interface RoomDeletedEventBody {
  deletedRoomId: string;
}

export interface JoinedRoomEventBody {
  userFull: User;
  roomId: string;
}

export interface LeftRoomEventBody {
  roomId: string;
  kickedUserId?: string;
}

export interface DataEditedEventBody {
  dataId: string;
  dataValue?: Value;
  commandMode: DateEditMode;
  roomId: string;
}

export interface OwnerChangedEventBody {
  newOwnerId: string;
  ownerHasChanged: boolean;
}

export interface FullRoomSnapshotEventBody {
  room: RoomData;
  users: User[];
  roomOptions: { [key: string]: string };
  roomId: string;
}

export interface RoomsShortList {
  rooms: RoomShort[];
}

export interface RoomServiceClient {
  stream(): any;
  singleCommand(request: Command, callback: (err: ServiceError, response: Event) => void): any;
  singleCommand(request: Command, metadata: any, callback: (err: ServiceError, response: Event) => void): any;
  roomsList(request: EmptyMessage, callback: (err: ServiceError, response: RoomsShortList) => void): any;
  roomsList(request: EmptyMessage, metadata: any, callback: (err: ServiceError, response: RoomsShortList) => void): any;
  close(): void;
}

export interface ServiceError extends Error {
  code: number;
  details: string;
  metadata: { [key: string]: string };
}
