#!/bin/bash

# Build script for generating protobuf JavaScript files from RoomService proto definition

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ROOM_SERVICE_PATH="$PROJECT_ROOT/../RoomService"
OUTPUT_DIR="$PROJECT_ROOT/generated/room_service"

echo "Building protobuf files..."
echo "RoomService path: $ROOM_SERVICE_PATH"
echo "Output directory: $OUTPUT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if protoc is installed
if ! command -v protoc &> /dev/null; then
    echo "Error: protoc is not installed."
    echo "Please install Protocol Buffers compiler:"
    echo "  - macOS: brew install protobuf"
    echo "  - Ubuntu: apt-get install protobuf-compiler"
    echo "  - Windows: Download from https://github.com/protocolbuffers/protobuf/releases"
    exit 1
fi

# Check if grpc-tools plugin is installed
if ! command -y grpc_tools_node_protoc_plugin &> /dev/null; then
    echo "Note: grpc_tools_node_protoc_plugin not found in PATH"
    echo "Installing grpc-tools..."
    npm install -g grpc-tools
fi

# Generate protobuf files
echo "Generating JavaScript protobuf files..."

# Check if proto files already exist
if [ -f "$OUTPUT_DIR/room_service_pb.js" ]; then
    echo "Proto files already exist, skipping generation..."
    echo "To regenerate, delete: $OUTPUT_DIR/room_service_pb.js"
    echo "Note: Using existing proto files. grpc-tools plugin may need manual setup for regeneration."
else
    protoc \
        -I "$ROOM_SERVICE_PATH/api" \
        --js_out="import_style=commonjs,binary:$OUTPUT_DIR" \
        --grpc_out="grpc_js:$OUTPUT_DIR" \
        --plugin=protoc-gen-grpc="$(which grpc_tools_node_protoc_plugin || which grpc_node_plugin)" \
        "$ROOM_SERVICE_PATH/api/room_service/room_service.proto"
    echo "Protobuf files generated successfully!"
fi

echo ""
echo "Generated files:"
ls -la "$OUTPUT_DIR"

# Create TypeScript declaration file stub
cat > "$OUTPUT_DIR/room_service.d.ts" << 'EOF'
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
EOF

echo "TypeScript declarations created"
echo ""
echo "Done!"
