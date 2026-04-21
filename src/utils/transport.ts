/**
 * Transport utilities for RoomService SDK
 * Supports both gRPC and HTTP transports
 */

import * as grpc from '@grpc/grpc-js';

export interface TransportConfig {
  host: string;
  port: number;
  secure: boolean;
  apiKey: string;
}

export enum TransportMode {
  GRPC = 'grpc',
  HTTP = 'http',
  AUTO = 'auto' // Automatically detect best transport
}

/**
 * Detect the best transport mode based on host and port
 */
export function detectTransportMode(host: string, port: number): TransportMode {
  // Use HTTP for standard web ports or when host contains HTTP
  if (port === 80 || port === 8080 || port === 443 || host.includes('http')) {
    return TransportMode.HTTP;
  }

  // Use gRPC for standard gRPC ports
  if (port === 50051 || port === 50052) {
    return TransportMode.GRPC;
  }

  // Default to gRPC
  return TransportMode.GRPC;
}

/**
 * Create HTTP/JSON transport for Railway compatibility
 */
export function createHTTPTransport(config: TransportConfig) {
  const protocol = config.secure ? 'https' : 'http';
  const baseURL = `${protocol}://${config.host}:${config.port}`;

  return {
    async singleCommand(method: string, request: any): Promise<any> {
      const url = `${baseURL}/grpc/${method}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
        throw new Error(error.message || 'HTTP request failed');
      }

      return response.json();
    },

    async close(): Promise<void> {
      // HTTP transport doesn't need closing
    }
  };
}

/**
 * Create gRPC transport for direct backend access
 */
export function createGRPCTransport(config: TransportConfig, protoDefinition: any) {
  const credentials = config.secure
    ? grpc.ChannelCredentials.createSsl()
    : grpc.ChannelCredentials.createInsecure();

  const client = new protoDefinition.RoomService(
    `${config.host}:${config.port}`,
    credentials,
    {
      'grpc.max_receive_message_length': 4 * 1024 * 1024,
      'grpc.primary_user_agent': 'RoomService-TS-SDK/1.0',
    }
  );

  return {
    async singleCommand(method: string, request: any): Promise<any> {
      return new Promise((resolve, reject) => {
        const metadata = new grpc.Metadata();
        metadata.add('x-api-key', config.apiKey);

        client[method](request, metadata, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
    },

    async close(): Promise<void> {
      grpc.closeClient(client);
    }
  };
}