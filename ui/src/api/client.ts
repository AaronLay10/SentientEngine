import type {
  HealthResponse,
  ReadinessResponse,
  ControllerListResponse,
  PowerListResponse,
  PowerToggleRequest,
  PowerToggleResponse,
  PowerBulkRequest,
  PowerBulkResponse,
  OperatorResponse,
} from '@/types';

/**
 * HTTP client with Basic Auth support
 */
class ApiClient {
  private baseUrl: string;
  private authHeader: string | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set Basic Auth credentials
   */
  setCredentials(username: string, password: string): void {
    const encoded = btoa(`${username}:${password}`);
    this.authHeader = `Basic ${encoded}`;
  }

  /**
   * Clear credentials
   */
  clearCredentials(): void {
    this.authHeader = null;
  }

  /**
   * Check if credentials are set
   */
  hasCredentials(): boolean {
    return this.authHeader !== null;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiError('Unauthorized', 401);
      }
      if (response.status === 403) {
        throw new ApiError('Forbidden', 403);
      }
      const text = await response.text();
      throw new ApiError(text || response.statusText, response.status);
    }

    return response.json();
  }

  // Health endpoints (no auth required)

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async getReady(): Promise<ReadinessResponse> {
    return this.request<ReadinessResponse>('/ready');
  }

  // Controller endpoints - snapshot FROM BACKEND

  async getControllers(): Promise<ControllerListResponse> {
    return this.request<ControllerListResponse>('/api/controllers');
  }

  // Power topology endpoint - snapshot FROM BACKEND

  async getPower(): Promise<PowerListResponse> {
    return this.request<PowerListResponse>('/api/power');
  }

  // Power control endpoints

  async togglePower(req: PowerToggleRequest): Promise<PowerToggleResponse> {
    return this.request<PowerToggleResponse>('/api/power/toggle', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async bulkPower(req: PowerBulkRequest): Promise<PowerBulkResponse> {
    return this.request<PowerBulkResponse>('/api/power/bulk', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // Device action endpoint

  async executeDeviceAction(
    controllerId: string,
    deviceId: string,
    action: string
  ): Promise<OperatorResponse> {
    return this.request<OperatorResponse>('/api/device/action', {
      method: 'POST',
      body: JSON.stringify({
        controller_id: controllerId,
        device_id: deviceId,
        action,
      }),
    });
  }

  // Game control endpoints (admin only)

  async startGame(sceneId?: string): Promise<OperatorResponse> {
    return this.request<OperatorResponse>('/game/start', {
      method: 'POST',
      body: JSON.stringify({ scene_id: sceneId }),
    });
  }

  async stopGame(): Promise<OperatorResponse> {
    return this.request<OperatorResponse>('/game/stop', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Singleton API client
 */
let apiClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClient) {
    apiClient = new ApiClient();
  }
  return apiClient;
}
