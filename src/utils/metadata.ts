/**
 * Metadata utilities for RoomService gRPC calls
 */

import * as grpc from '@grpc/grpc-js';

export interface RoomServiceConfig {
  host: string;
  apiKey: string;
  secure: boolean;
  timeout: number;
  retryAttempts?: number;
}

/**
 * Create gRPC metadata with API key
 */
export function createMetadata(apiKey?: string, roomId?: string): grpc.Metadata {
  const metadata = new grpc.Metadata();

  if (apiKey) {
    metadata.set('x-api-key', apiKey);
  }

  // Add room-id for optimized single-room streaming
  if (roomId) {
    metadata.set('room-id', roomId);
  }

  return metadata;
}

/**
 * Get API key from config or environment variable
 */
export function getApiKey(config: RoomServiceConfig): string {
  // Priority: config apiKey > environment variable > default
  return (
    config.apiKey ||
    process.env.ROOM_SERVICE_API_KEY ||
    '123'
  );
}

/**
 * Parse host string into host and port
 * Handles various hostname formats:
 * - localhost:50050
 * - roomservice-proxy.up.railway.app
 * - https://roomservice-proxy.up.railway.app
 * - http://roomservice-proxy.up.railway.app
 * - grpc://roomservice-proxy.up.railway.app
 */
export function parseHost(host: string): { host: string; port: number } {
  let cleanedHost = host.trim();

  // Strip protocol prefixes if present
  cleanedHost = cleanedHost.replace(/^https:\/\//, '');
  cleanedHost = cleanedHost.replace(/^http:\/\//, '');
  cleanedHost = cleanedHost.replace(/^grpc:\/\//, '');

  // Remove any trailing slashes
  cleanedHost = cleanedHost.replace(/\/+$/, '');

  // Split by colon to separate host and port
  const colonIndex = cleanedHost.lastIndexOf(':');

  // Check if there's a port (must be after the last colon and be a number)
  let hostname = cleanedHost;
  let port = 50050; // Default gRPC port

  if (colonIndex !== -1) {
    const potentialPort = cleanedHost.substring(colonIndex + 1);
    const portNum = parseInt(potentialPort, 10);

    // Only treat as port if it's a valid number and not part of an IPv6 address
    if (!isNaN(portNum) && portNum > 0 && portNum < 65536 && !cleanedHost.includes('[')) {
      hostname = cleanedHost.substring(0, colonIndex);
      port = portNum;
    }
  }

  return { host: hostname, port };
}
