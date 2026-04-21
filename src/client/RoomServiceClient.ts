/**
 * RoomServiceClient - Main client class for RoomService
 *
 * This is the main entry point for interacting with RoomService.
 * It provides a simple, clean API that hides all the gRPC complexity.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import { RoomServiceError, wrapGrpcError } from '../utils/errors';
import { getApiKey, parseHost, type RoomServiceConfig } from '../utils/metadata';
import {
  buildCreateRoomCommand,
  buildDeleteRoomCommand,
  buildJoinRoomCommand,
  buildLeaveRoomCommand,
  buildSetDataCommand,
  buildSetOwnerCommand,
  buildRefreshRoomCommand,
  type JoinOptions,
  type DataEditMode,
  type User
} from '../commands/builders';
import { parseEvent, parseRoomSnapshot, parseRoomsList } from '../events/handlers';
import type { RoomSnapshot, RoomInfo } from '../events/types';

export interface RoomServiceClientOptions {
  /**
   * RoomService host address (default: localhost:50050)
   */
  host?: string;

  /**
   * API key for authentication (default: from ROOM_SERVICE_API_KEY env var or '123')
   */
  apiKey?: string;

  /**
   * Use TLS/SSL connection (default: false)
   */
  secure?: boolean;

  /**
   * Request timeout in milliseconds (default: 5000)
   */
  timeout?: number;
}

export class RoomServiceClient {
  private client: any;
  private config: Required<RoomServiceConfig>;
  private protoLoaded: boolean = false;
  private protoDefinition: any;

  constructor(options: RoomServiceClientOptions = {}) {
    const host = options.host || 'localhost:50050';
    this.config = {
      host,
      apiKey: options.apiKey || process.env.ROOM_SERVICE_API_KEY || '123',
      secure: options.secure || false,
      timeout: options.timeout || 5000,
      retryAttempts: 3
    };
  }

  /**
   * Initialize the gRPC client (called automatically on first use)
   */
  private ensureClient(): void {
    if (this.protoLoaded) {
      return;
    }

    const { host, port } = parseHost(this.config.host);
    const credentials = this.config.secure
      ? grpc.ChannelCredentials.createSsl()
      : grpc.ChannelCredentials.createInsecure();

    // Load proto file
    const protoPath = this.findProtoFile();

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDefinition = grpc.loadPackageDefinition(packageDefinition) as any;

    if (!protoDefinition.api || !protoDefinition.api.RoomService) {
      throw new RoomServiceError(
        `Failed to load RoomService from ${protoPath}`,
        2
      );
    }

    const RoomServiceClient = protoDefinition.api.RoomService;
    const address = `${host}:${port}`;

    this.client = new RoomServiceClient(address, credentials, {
      'grpc.max_receive_message_length': -1,
      'grpc.max_send_message_length': -1,
    });

    this.protoLoaded = true;
  }

  /**
   * Find the proto file in various possible locations
   */
  private findProtoFile(): string {
    const possiblePaths = [
      // The ENV
      path.resolve(process.env.ROOM_SERVICE_PROTO_PATH || './room_service.proto'),
      // In the app
      path.resolve(__dirname, '../../../../../room_service.proto'),
    ];

    for (const protoPath of possiblePaths) {
      if (fs.existsSync(protoPath)) {
        return protoPath;
      }
    }

    throw new RoomServiceError(
      `Proto file not found. Searched in:\n${possiblePaths.join('\n')}\n\n` +
      `Make sure RoomService is checked out alongside this project, or set ` +
      `ROOM_SERVICE_PROTO_PATH environment variable.`,
      2
    );
  }

  /**
   * Create metadata with API key
   */
  private createMetadata(): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.set('x-api-key', this.config.apiKey);
    return metadata;
  }

  /**
   * Execute a single command and return the result
   */
  private async singleCommand(command: any): Promise<any> {
    this.ensureClient();

    console.log('[RoomService SDK] Sending command:', JSON.stringify(command, null, 2));

    return new Promise((resolve, reject) => {
      const metadata = this.createMetadata();

      this.client.singleCommand(command, metadata, (error: any, response: any) => {
        if (error) {
          reject(wrapGrpcError(error));
        } else {
          console.log('[RoomService SDK] Response:', JSON.stringify(response, null, 2));
          resolve(response);
        }
      });
    });
  }

  // ==================== Room Management ====================

  /**
   * Create a new room
   *
   * @param roomOptions - Optional room metadata (e.g., max_users, game_type)
   * @param userId - User ID who will be the room owner (default: auto-generated)
   * @returns The ID of the newly created room
   *
   * @example
   * const roomId = await client.createRoom({
   *   max_users: '10',
   *   game_type: 'tic-tac-toe'
   * });
   */
  async createRoom(
    roomOptions: { [key: string]: string } = {},
    userId?: string
  ): Promise<string> {
    const effectiveUserId = userId || `user-${Date.now()}-${Math.random()}`;
    const command = buildCreateRoomCommand(effectiveUserId, roomOptions);

    try {
      const response = await this.singleCommand(command);

      if (response.roomCreated) {
        return response.roomCreated.roomId;
      }

      if (response.errorMessage) {
        throw new RoomServiceError(response.errorMessage.error, 2);
      }

      throw new RoomServiceError('Unexpected response from createRoom', 2);
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  /**
   * Delete a room (owner only)
   *
   * @param roomId - The ID of the room to delete
   * @param userId - User ID of the room owner
   *
   * @example
   * await client.deleteRoom(roomId, 'owner-user-id');
   */
  async deleteRoom(roomId: string, userId: string): Promise<void> {
    const command = buildDeleteRoomCommand(userId, roomId);

    try {
      const response = await this.singleCommand(command);

      if (response.errorMessage) {
        throw new RoomServiceError(response.errorMessage.error, response.errorMessage.code || 7);
      }
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  /**
   * List all rooms
   *
   * @returns Array of room information (without user lists or internal data)
   *
   * @example
   * const rooms = await client.listRooms();
   * const availableRooms = rooms.filter(r =>
   *   r.roomOptions.game_type === 'chess' &&
   *   r.roomOptions.status === 'waiting'
   * );
   */
  async listRooms(): Promise<RoomInfo[]> {
    this.ensureClient();

    return new Promise((resolve, reject) => {
      const metadata = this.createMetadata();

      this.client.roomsList({}, metadata, (error: any, response: any) => {
        if (error) {
          reject(wrapGrpcError(error));
        } else {
          resolve(parseRoomsList(response));
        }
      });
    });
  }

  /**
   * List rooms that a specific user is currently in
   *
   * @param userId - The user ID to filter rooms by
   * @returns Array of room information (without user lists or internal data)
   *
   * @example
   * const myRooms = await client.getUserActiveRooms('player-1');
   * console.log('Player 1 is in:', myRooms.length, 'rooms');
   *
   * // Find specific game types
   * const myChessGames = myRooms.filter(r =>
   *   r.roomOptions.game_type === 'chess'
   * );
   */
  async getUserActiveRooms(userId: string): Promise<RoomInfo[]> {
    this.ensureClient();

    return new Promise((resolve, reject) => {
      const metadata = this.createMetadata();

      this.client.userActiveRoomsList(
        { userId },
        metadata,
        (error: any, response: any) => {
          if (error) {
            reject(wrapGrpcError(error));
          } else {
            resolve(parseRoomsList(response));
          }
        }
      );
    });
  }

  // ==================== User Management ====================

  /**
   * Join a room (idempotent - safe to call multiple times)
   *
   * @param roomId - The ID of the room to join
   * @param options - User information
   *
   * @example
   * await client.joinRoom(roomId, {
   *   userId: 'player-1',
   *   userName: 'Alice',
   *   metadata: { avatar: 'cat.png' }
   * });
   */
  async joinRoom(roomId: string, options: JoinOptions): Promise<RoomSnapshot | null> {
    const command = buildJoinRoomCommand(options.userId, roomId, options);

    try {
      const response = await this.singleCommand(command);

      // First join returns FullRoomSnapshot
      if (response.fullRoom) {
        return parseRoomSnapshot(roomId, response);
      }

      // Subsequent joins return JoinedRoom event
      if (response.joinedRoom) {
        return null; // No snapshot on re-join
      }

      if (response.errorMessage) {
        throw new RoomServiceError(response.errorMessage.error, 2);
      }

      return null;
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  /**
   * Leave a room (idempotent - safe to call multiple times)
   *
   * @param roomId - The ID of the room to leave
   * @param userId - User ID of the user leaving
   * @param kickedUserId - Optional: if provided, kick this user instead (owner only)
   *
   * @example
   * // Leave room
   * await client.leaveRoom(roomId, 'my-user-id');
   *
   * // Kick another user (owner only)
   * await client.leaveRoom(roomId, 'owner-id', 'trouble-maker-id');
   */
  async leaveRoom(roomId: string, userId: string, kickedUserId?: string): Promise<void> {
    const command = buildLeaveRoomCommand(userId, roomId, kickedUserId);

    try {
      await this.singleCommand(command);
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  // ==================== Data Management ====================

  /**
   * Set data in a room (SET mode)
   *
   * @param roomId - The ID of the room
   * @param userId - User ID making the change
   * @param dataId - The data key to set
   * @param value - The value to set (string, number, boolean, array, object)
   *
   * @example
   * await client.setData(roomId, 'game_state', 'player_1_turn');
   * await client.setData(roomId, 'score', 100);
   * await client.setData(roomId, 'players', ['Alice', 'Bob']);
   * await client.setData(roomId, 'config', { max: 10, private: true });
   */
  async setData(
    roomId: string,
    userId: string,
    dataId: string,
    value: any
  ): Promise<void> {
    await this.setDataMode(roomId, userId, dataId, value, 'SET');
  }

  /**
   * Set data with a specific mode
   *
   * @param roomId - The ID of the room
   * @param userId - User ID making the change
   * @param dataId - The data key
   * @param value - The value (for SET, APPEND modes)
   * @param mode - The edit mode: 'SET', 'DELETE', 'APPEND', or 'REMOVE'
   * @param itemIndex - Optional index/key for list/map operations (REMOVE mode)
   *
   * @example
   * // SET - Replace entire value
   * await client.setDataMode(roomId, userId, 'status', 'active', 'SET');
   *
   * // DELETE - Remove data key
   * await client.setDataMode(roomId, userId, 'temp', null, 'DELETE');
   *
   * // APPEND - Add to list
   * await client.setDataMode(roomId, userId, 'moves', 'e2-e4', 'APPEND');
   *
   * // REMOVE - Remove from list/map by index/key
   * await client.setDataMode(roomId, userId, 'players', null, 'REMOVE', '0');
   */
  async setDataMode(
    roomId: string,
    userId: string,
    dataId: string,
    value: any,
    mode: DataEditMode,
    itemIndex?: string
  ): Promise<void> {
    const command = buildSetDataCommand(userId, roomId, dataId, value, mode, itemIndex);

    try {
      await this.singleCommand(command);
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  /**
   * Delete data from a room
   *
   * @param roomId - The ID of the room
   * @param userId - User ID making the change
   * @param dataId - The data key to delete
   *
   * @example
   * await client.deleteData(roomId, userId, 'temp_data');
   */
  async deleteData(roomId: string, userId: string, dataId: string): Promise<void> {
    await this.setDataMode(roomId, userId, dataId, null, 'DELETE');
  }

  /**
   * Append to a list
   *
   * @param roomId - The ID of the room
   * @param userId - User ID making the change
   * @param dataId - The data key (must be a list)
   * @param value - The value to append
   *
   * @example
   * await client.appendToList(roomId, userId, 'moves', 'e2-e4');
   */
  async appendToList(roomId: string, userId: string, dataId: string, value: any): Promise<void> {
    await this.setDataMode(roomId, userId, dataId, value, 'APPEND');
  }

  /**
   * Remove from a list or map
   *
   * @param roomId - The ID of the room
   * @param userId - User ID making the change
   * @param dataId - The data key
   * @param itemIndex - The list index or map key to remove
   *
   * @example
   * // Remove list item at index 0
   * await client.removeFromList(roomId, userId, 'players', '0');
   *
   * // Remove map entry
   * await client.removeFromList(roomId, userId, 'config', 'timeout');
   */
  async removeFromList(roomId: string, userId: string, dataId: string, itemIndex: string): Promise<void> {
    await this.setDataMode(roomId, userId, dataId, null, 'REMOVE', itemIndex);
  }

  // ==================== Queries ====================

  /**
   * Get a full room snapshot
   *
   * @param roomId - The ID of the room
   * @param userId - User ID requesting the snapshot
   * @returns Complete room state including data, users, and options
   *
   * @example
   * const snapshot = await client.getRoomSnapshot(roomId);
   * console.log('Users:', snapshot.users);
   * console.log('Data:', snapshot.data);
   */
  async getRoomSnapshot(roomId: string, userId?: string): Promise<RoomSnapshot> {
    const effectiveUserId = userId || `user-${Date.now()}`;
    const command = buildRefreshRoomCommand(effectiveUserId, roomId);

    try {
      const response = await this.singleCommand(command);

      if (response.fullRoom) {
        return parseRoomSnapshot(roomId, response);
      }

      if (response.errorMessage) {
        throw new RoomServiceError(response.errorMessage.error, 2);
      }

      throw new RoomServiceError('Unexpected response from getRoomSnapshot', 2);
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  // ==================== Owner Management ====================

  /**
   * Transfer room ownership to another user
   *
   * @param roomId - The ID of the room
   * @param userId - Current owner's user ID
   * @param newOwnerId - New owner's user ID (must be in the room)
   *
   * @example
   * await client.setOwner(roomId, 'current-owner-id', 'new-owner-id');
   */
  async setOwner(roomId: string, userId: string, newOwnerId: string): Promise<void> {
    const command = buildSetOwnerCommand(userId, roomId, newOwnerId);

    try {
      await this.singleCommand(command);
    } catch (error) {
      throw wrapGrpcError(error);
    }
  }

  // ==================== Streaming ====================

  /**
   * Open a bidirectional stream for real-time updates
   *
   * @returns A RoomServiceStream object for sending commands and receiving events
   *
   * @example
   * const stream = await client.openStream();
   *
   * stream.on('event', (event) => {
   *   console.log('Received event:', event.type);
   * });
   *
   * stream.on('RoomCreated', (event) => {
   *   console.log('Room created:', event.roomId);
   * });
   *
   * await stream.createRoom({ game: 'chess' });
   * await stream.setData(roomId, userId, 'move', 'e2-e4');
   *
   * // Later...
   * await stream.close();
   */
  async openStream(): Promise<RoomServiceStream> {
    this.ensureClient();
    return new RoomServiceStream(this.client, this.createMetadata());
  }

  // ==================== Cleanup ====================

  /**
   * Close the client connection
   *
   * @example
   * await client.close();
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        this.client.close();
      } catch (error) {
        // Ignore close errors
      }
      this.protoLoaded = false;
    }
  }
}

// ==================== Stream Class ====================

/**
 * RoomServiceStream - Bidirectional streaming for real-time updates
 *
 * Use this for real-time games and collaborative applications.
 */
export class RoomServiceStream {
  private stream: any;
  private metadata: grpc.Metadata;
  private eventHandlers: Map<string, Set<(event: any) => void>> = new Map();
  private ended: boolean = false;

  constructor(grpcClient: any, metadata: grpc.Metadata) {
    this.metadata = metadata;
    this.stream = grpcClient.stream(this.metadata);

    // Start receiving events
    this.stream.on('data', (data: any) => {
      this.handleData(data);
    });

    this.stream.on('error', (error: any) => {
      this.handleError(error);
    });

    this.stream.on('end', () => {
      this.ended = true;
    });
  }

  /**
   * Handle incoming data from the stream
   */
  private handleData(data: any): void {
    const event = parseEvent(data);

    // Emit to 'event' handlers (all events)
    this.emit('event', event);

    // Emit to specific event type handlers
    this.emit(event.type, event);
  }

  /**
   * Handle stream errors
   */
  private handleError(error: any): void {
    this.emit('error', wrapGrpcError(error));
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventType} handler:`, error);
        }
      });
    }
  }

  /**
   * Register an event handler
   *
   * @param eventType - The event type ('event' for all events, or specific types like 'RoomCreated')
   * @param handler - The callback function
   *
   * @example
   * stream.on('event', (event) => {
   *   console.log('All events:', event);
   * });
   *
   * stream.on('RoomCreated', (event) => {
   *   console.log('Room created:', event.roomId);
   * });
   */
  on(eventType: string, handler: (event: any) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Remove an event handler
   *
   * @param eventType - The event type
   * @param handler - The callback function to remove
   */
  off(eventType: string, handler: (event: any) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Send a command through the stream
   */
  private sendCommand(command: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ended) {
        reject(new RoomServiceError('Stream has ended', 2));
        return;
      }

      this.stream.write(command, (error: any) => {
        if (error) {
          reject(wrapGrpcError(error));
        } else {
          resolve();
        }
      });
    });
  }

  // ==================== Stream Commands ====================

  /**
   * Create a room via stream
   */
  async createRoom(
    roomOptions: { [key: string]: string },
    userId?: string
  ): Promise<void> {
    const effectiveUserId = userId || `user-${Date.now()}-${Math.random()}`;
    await this.sendCommand(buildCreateRoomCommand(effectiveUserId, roomOptions));
  }

  /**
   * Delete a room via stream
   */
  async deleteRoom(roomId: string, userId: string): Promise<void> {
    await this.sendCommand(buildDeleteRoomCommand(userId, roomId));
  }

  /**
   * Join a room via stream
   */
  async joinRoom(roomId: string, options: {
    userId: string;
    userName: string;
    metadata?: { [key: string]: string };
  }): Promise<void> {
    await this.sendCommand(buildJoinRoomCommand(options.userId, roomId, options));
  }

  /**
   * Leave a room via stream
   */
  async leaveRoom(roomId: string, userId: string, kickedUserId?: string): Promise<void> {
    await this.sendCommand(buildLeaveRoomCommand(userId, roomId, kickedUserId));
  }

  /**
   * Set data via stream
   */
  async setData(
    roomId: string,
    userId: string,
    dataId: string,
    value: any,
    mode: DataEditMode = 'SET',
    itemIndex?: string
  ): Promise<void> {
    await this.sendCommand(buildSetDataCommand(userId, roomId, dataId, value, mode, itemIndex));
  }

  /**
   * Set owner via stream
   */
  async setOwner(roomId: string, userId: string, newOwnerId: string): Promise<void> {
    await this.sendCommand(buildSetOwnerCommand(userId, roomId, newOwnerId));
  }

  /**
   * Refresh room snapshot via stream
   */
  async refreshRoom(roomId: string, userId?: string): Promise<void> {
    const effectiveUserId = userId || `user-${Date.now()}`;
    await this.sendCommand(buildRefreshRoomCommand(effectiveUserId, roomId));
  }

  /**
   * Close the stream
   */
  async close(): Promise<void> {
    if (!this.ended) {
      this.stream.end();
      this.ended = true;
    }
  }
}

// Re-export types
export type { RoomSnapshot, RoomInfo, User, DataEditMode, JoinOptions };
export type { RoomEvent, EventType } from '../events/types';
