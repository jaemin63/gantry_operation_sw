import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException } from "@nestjs/common";
import { PlcCommunicationService, DeviceCode } from "./plc-communication.service";
import { PlcDbService } from "./plc-db.service";
import { DataPoint } from "../entities/data-point.entity";
import { PlcCache } from "../entities/plc-cache.entity";
import { RegisterDataPointDto } from "../dto/plc-data.dto";
import { PlcValue } from "../plc.types";

/**
 * PLC 비즈니스 로직 서비스
 * - 각 데이터 포인트가 자신의 폴링 주기에 따라 독립적으로 폴링
 */
@Injectable()
export class PlcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlcService.name);

  // 개별 데이터 포인트 폴링 타이머들
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  private isPollingActive = false;

  // 폴링 성능 메트릭
  private readCount = 0;
  private pollingStartTime: Date | null = null;

  constructor(
    private readonly communication: PlcCommunicationService,
    private readonly db: PlcDbService
  ) {}

  async onModuleInit() {
    this.logger.log("PLC Service initialized");
    try {
      await this.communication.connect();
      this.logger.log("PLC connection established");
    } catch (error) {
      this.logger.error("Failed to connect to PLC", error.stack);
    }
  }

  async onModuleDestroy() {
    this.stopPolling();
    await this.communication.disconnect();
    this.logger.log("PLC Service destroyed");
  }

  // ==================== 데이터 포인트 관리 ====================

  async registerDataPoint(dto: RegisterDataPointDto): Promise<DataPoint> {
    const dataPoint = new DataPoint();
    dataPoint.key = dto.key;
    dataPoint.description = dto.description;
    dataPoint.addressType = dto.addressType;
    dataPoint.address = dto.address;
    dataPoint.length = dto.length;
    dataPoint.bit = dto.bit;
    dataPoint.type = dto.type;
    dataPoint.pollingInterval = dto.pollingInterval ?? 1000;

    const saved = await this.db.createDataPoint(dataPoint);
    this.logger.log(`Registered data point: ${saved.key} (${saved.pollingInterval}ms)`);

    // 폴링 중이면 바로 시작
    if (this.isPollingActive) {
      this.startPollingForDataPoint(saved);
    }

    return saved;
  }

  async unregisterDataPoint(key: string): Promise<void> {
    // 해당 데이터 포인트의 폴링 중지
    this.stopPollingForDataPoint(key);
    await this.db.deleteDataPoint(key);
    this.logger.log(`Unregistered data point: ${key}`);
  }

  async getDataPoints(): Promise<DataPoint[]> {
    return this.db.findAllDataPoints();
  }

  async getDataPoint(key: string): Promise<DataPoint | null> {
    return this.db.findDataPoint(key);
  }

  // ==================== 폴링 제어 ====================

  async startPolling(): Promise<void> {
    if (this.isPollingActive) {
      this.logger.warn("Polling already active");
      return;
    }

    // PLC 연결 확인
    if (!this.communication.isConnectionActive()) {
      await this.communication.connect();
    }

    this.isPollingActive = true;
    this.readCount = 0;
    this.pollingStartTime = new Date();

    this.logger.log("Starting polling for all data points");

    // 모든 데이터 포인트의 폴링 시작
    const dataPoints = await this.db.findAllDataPoints();
    for (const dataPoint of dataPoints) {
      this.startPollingForDataPoint(dataPoint);
    }
  }

  stopPolling(): void {
    if (!this.isPollingActive) {
      return;
    }

    this.isPollingActive = false;
    this.readCount = 0;
    this.pollingStartTime = null;

    this.logger.log("Stopping all polling");

    // 모든 타이머 중지
    for (const [key, timer] of this.pollingTimers) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();
  }

  isPolling(): boolean {
    return this.isPollingActive;
  }

  /**
   * 개별 데이터 포인트 폴링 시작
   */
  private startPollingForDataPoint(dataPoint: DataPoint): void {
    this.stopPollingForDataPoint(dataPoint.key);

    this.logger.log(`Start polling: ${dataPoint.key} every ${dataPoint.pollingInterval}ms`);

    const timer = setInterval(() => {
      this.pollDataPoint(dataPoint).catch((err) => {
        this.logger.error(`Unhandled error while polling ${dataPoint.key}`, err.stack);
      });
    }, dataPoint.pollingInterval);

    this.pollingTimers.set(dataPoint.key, timer);

    // 즉시 한 번 실행
    this.pollDataPoint(dataPoint).catch((err) => {
      this.logger.error(`Initial poll failed for ${dataPoint.key}`, err.stack);
    });
  }

  /**
   * 개별 데이터 포인트 폴링 중지
   */
  private stopPollingForDataPoint(key: string): void {
    const timer = this.pollingTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(key);
      this.logger.log(`Stopped polling: ${key}`);
    }
  }

  /**
   * 단일 데이터 포인트 읽기 및 캐시 저장
   */
  private async pollDataPoint(dataPoint: DataPoint): Promise<void> {
    try {
      const deviceCode = this.getDeviceCode(dataPoint.addressType);
      let value: PlcValue;

      switch (dataPoint.type) {
        case "number":
          value = await this.communication.readNumbers(deviceCode, dataPoint.address, dataPoint.length);
          break;
        case "string":
          value = await this.communication.readString(deviceCode, dataPoint.address, "ascii", dataPoint.length);
          break;
        case "bool":
          if (dataPoint.bit === undefined || dataPoint.bit === null) {
            throw new BadRequestException(`Bit position required for ${dataPoint.key}`);
          }
          value = await this.communication.readBit(deviceCode, dataPoint.address, dataPoint.bit);
          break;
        default:
          throw new BadRequestException(`Unknown type: ${dataPoint.type}`);
      }

      this.readCount++;

      await this.db.saveCache({
        key: dataPoint.key,
        value,
        timestamp: new Date(),
        error: undefined,
      });
    } catch (error) {
      this.logger.error(`Failed to poll ${dataPoint.key}`, error.stack);

      await this.db.saveCache({
        key: dataPoint.key,
        value: this.getEmptyValueForType(dataPoint.type),
        timestamp: new Date(),
        error: (error as Error).message,
      });
    }
  }

  private getEmptyValueForType(type: DataPoint["type"]): PlcValue {
    switch (type) {
      case "number":
        return [];
      case "bool":
        return false;
      case "string":
      default:
        return "";
    }
  }

  // ==================== 데이터 읽기/쓰기 ====================

  async getCacheItem(key: string): Promise<PlcCache | null> {
    return this.db.findCache(key);
  }

  async writeData(key: string, value: PlcValue): Promise<void> {
    // 1. 데이터 포인트 정의 조회
    const dataPoint = await this.db.findDataPoint(key);
    if (!dataPoint) {
      throw new BadRequestException(`Data point not found: ${key}`);
    }

    const { type, address, bit, addressType } = dataPoint;
    const deviceCode = this.getDeviceCode(addressType);

    // 2. 타입별로 값 검증 + PLC 쓰기
    switch (type) {
      case "number": {
        if (!Array.isArray(value)) {
          throw new BadRequestException(`Value must be number array for ${key}`);
        }

        // 필요하면 length 검사도 여기서 가능 (옵션)
        // if (value.length !== dataPoint.length) { ... }

        await this.communication.writeNumbers(deviceCode, address, value);
        break;
      }

      case "string": {
        if (typeof value !== "string") {
          throw new BadRequestException(`Value must be string for ${key}`);
        }

        await this.communication.writeString(deviceCode, address, value, "ascii");
        break;
      }

      case "bool": {
        if (typeof value !== "boolean") {
          throw new BadRequestException(`Value must be boolean for ${key}`);
        }
        if (bit === undefined || bit === null) {
          throw new BadRequestException(`Bit position required for ${key}`);
        }

        await this.communication.writeBit(deviceCode, address, bit, value);
        break;
      }

      default:
        throw new BadRequestException(`Unknown data point type: ${type}`);
    }

    // 3. 캐시 업데이트
    await this.db.saveCache({
      key,
      value,
      timestamp: new Date(),
      error: undefined,
    });

    this.logger.log(`Wrote PLC data for key='${key}' (type=${type}, address=${address}${type === "bool" ? `.${bit}` : ""})`);
  }

  // ==================== 성능 메트릭 ====================

  getPollingMetrics(): { readCount: number; readsPerSecond: number; elapsedSeconds: number } {
    if (!this.isPollingActive || !this.pollingStartTime) {
      return { readCount: 0, readsPerSecond: 0, elapsedSeconds: 0 };
    }

    const elapsedMs = Date.now() - this.pollingStartTime.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const readsPerSecond = elapsedSeconds > 0 ? Math.floor(this.readCount / elapsedSeconds) : 0;

    return {
      readCount: this.readCount,
      readsPerSecond,
      elapsedSeconds,
    };
  }

  // ==================== 유틸리티 ====================

  private getDeviceCode(addressType: string): DeviceCode {
    const map: Record<string, DeviceCode> = {
      D: DeviceCode.D,
      R: DeviceCode.R,
      M: DeviceCode.M,
      X: DeviceCode.X,
      Y: DeviceCode.Y,
    };
    const code = map[addressType.toUpperCase()];
    if (!code) {
      throw new BadRequestException(`Invalid address type: ${addressType}`);
    }
    return code;
  }
}
