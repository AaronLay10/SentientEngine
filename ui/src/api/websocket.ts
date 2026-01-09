import type { WSEvent } from '@/types';

type EventHandler = (event: WSEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

interface WebSocketManagerOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectBackoffMultiplier?: number;
}

/**
 * WebSocket manager with automatic reconnection
 * Handles connection lifecycle and event distribution
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectInterval: number;
  private reconnectBackoffMultiplier: number;
  private currentReconnectInterval: number;
  private reconnectTimeout: number | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private isIntentionallyClosed = false;
  private lastEventTimestamp = 0;
  private eventCount = 0;
  private eventRateWindow: number[] = [];

  constructor(options: WebSocketManagerOptions) {
    this.url = options.url;
    this.reconnectInterval = options.reconnectInterval ?? 1000;
    this.maxReconnectInterval = options.maxReconnectInterval ?? 30000;
    this.reconnectBackoffMultiplier = options.reconnectBackoffMultiplier ?? 1.5;
    this.currentReconnectInterval = this.reconnectInterval;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.createConnection();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Subscribe to events
   */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Get connection state
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get last event timestamp
   */
  getLastEventTimestamp(): number {
    return this.lastEventTimestamp;
  }

  /**
   * Get events per second (rolling 10s window)
   */
  getEventRate(): number {
    const now = Date.now();
    const windowStart = now - 10000;
    this.eventRateWindow = this.eventRateWindow.filter((t) => t > windowStart);
    return this.eventRateWindow.length / 10;
  }

  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.currentReconnectInterval = this.reconnectInterval;
        this.notifyConnectionChange(true);
      };

      this.ws.onclose = () => {
        this.notifyConnectionChange(false);

        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // Error will be followed by close event
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: string): void {
    try {
      const event = JSON.parse(data) as WSEvent;
      this.lastEventTimestamp = Date.now();
      this.eventCount++;
      this.eventRateWindow.push(this.lastEventTimestamp);

      this.eventHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (e) {
          console.error('Event handler error:', e);
        }
      });
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout !== null) {
      return;
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.createConnection();

      // Exponential backoff
      this.currentReconnectInterval = Math.min(
        this.currentReconnectInterval * this.reconnectBackoffMultiplier,
        this.maxReconnectInterval
      );
    }, this.currentReconnectInterval);
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (e) {
        console.error('Connection handler error:', e);
      }
    });
  }
}

/**
 * Create WebSocket URL from current location
 */
export function createWebSocketUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

/**
 * Singleton instance for the app
 */
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager({
      url: createWebSocketUrl('/ws/events'),
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
    });
  }
  return wsManager;
}
