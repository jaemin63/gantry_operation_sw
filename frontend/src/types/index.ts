export interface DataPoint {
  key: string;
  description: string;
  addressType: 'D' | 'R' | 'M' | 'X' | 'Y';
  address: number;
  length: number;
  bit?: number;
  type: 'number' | 'string' | 'bool';
  pollingInterval: number; // 폴링 주기 (ms)
}

export interface PlcDataResponse {
  value: number[] | string | boolean;
  timestamp: Date;
  error?: string;
}

export interface PollingStatus {
  isPolling: boolean;
  dataPointCount: number;
}
