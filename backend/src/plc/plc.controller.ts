import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from "@nestjs/swagger";
import { PlcService } from "./services/plc.service";
import { RegisterDataPointDto, WriteNumbersDto, WriteStringDto, WriteBoolDto, PlcDataResponseDto, DataPointInfoDto } from "./dto/plc-data.dto";
import { PlcValue } from "./plc.types";

@Controller("plc")
export class PlcController {
  private readonly logger = new Logger(PlcController.name);

  constructor(private readonly plcService: PlcService) {}

  // ==================== Data Points ====================

  @Get("data-points")
  @ApiTags("data-points")
  @ApiOperation({
    summary: "데이터 포인트 목록 조회",
    description: "DB에 등록된 모든 데이터 포인트를 조회합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "데이터 포인트 목록 반환 성공",
    type: [DataPointInfoDto],
  })
  async getRegisteredDataPoints(): Promise<DataPointInfoDto[]> {
    const dataPoints = await this.plcService.getDataPoints();
    return dataPoints.map((dp) => ({
      key: dp.key,
      description: dp.description,
      addressType: dp.addressType,
      address: dp.address,
      length: dp.length,
      bit: dp.bit,
      type: dp.type,
      pollingInterval: dp.pollingInterval,
    }));
  }

  @Post("data-points")
  @ApiTags("data-points")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "데이터 포인트 등록",
    description: "새로운 PLC 데이터 포인트를 DB에 등록합니다.",
  })
  @ApiBody({ type: RegisterDataPointDto })
  @ApiResponse({ status: 201, description: "데이터 포인트 등록 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async registerDataPoint(@Body() dto: RegisterDataPointDto): Promise<{ message: string; dataPoint: DataPointInfoDto }> {
    const saved = await this.plcService.registerDataPoint(dto);

    return {
      message: `Data point ${saved.key} registered successfully`,
      dataPoint: {
        key: saved.key,
        description: saved.description,
        addressType: saved.addressType,
        address: saved.address,
        length: saved.length,
        bit: saved.bit,
        type: saved.type,
        pollingInterval: saved.pollingInterval,
      },
    };
  }

  @Delete("data-points/:key")
  @ApiTags("data-points")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "데이터 포인트 삭제",
    description: "DB에서 데이터 포인트를 삭제합니다.",
  })
  @ApiParam({
    name: "key",
    description: "삭제할 데이터 포인트 키",
    example: "temperature_sensor",
  })
  @ApiResponse({ status: 204, description: "데이터 포인트 삭제 성공" })
  async unregisterDataPoint(@Param("key") key: string): Promise<void> {
    await this.plcService.unregisterDataPoint(key);
  }

  // ==================== Polling ====================

  @Get("polling/status")
  @ApiTags("polling")
  @ApiOperation({
    summary: "폴링 상태 조회",
    description: "현재 폴링 상태와 등록된 데이터 포인트 수를 조회합니다.",
  })
  @ApiResponse({ status: 200, description: "상태 정보 반환 성공" })
  async getStatus(): Promise<{ isPolling: boolean; dataPointCount: number }> {
    const dataPoints = await this.plcService.getDataPoints();
    return {
      isPolling: this.plcService.isPolling(),
      dataPointCount: dataPoints.length,
    };
  }

  @Post("polling/start")
  @ApiTags("polling")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "폴링 시작",
    description: "등록된 데이터 포인트에 대한 주기적 폴링을 시작합니다.",
  })
  @ApiResponse({ status: 200, description: "폴링 시작 성공" })
  async startPolling(): Promise<{ message: string }> {
    await this.plcService.startPolling();
    return { message: "Polling started" };
  }

  @Post("polling/stop")
  @ApiTags("polling")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "폴링 중지",
    description: "실행 중인 폴링을 중지합니다.",
  })
  @ApiResponse({ status: 200, description: "폴링 중지 성공" })
  stopPolling(): { message: string } {
    this.plcService.stopPolling();
    return { message: "Polling stopped" };
  }

  @Get("polling/metrics")
  @ApiTags("polling")
  @ApiOperation({
    summary: "폴링 성능 메트릭 조회",
    description: "PLC read 성능 메트릭을 조회합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "성능 메트릭 반환",
    schema: {
      type: "object",
      properties: {
        readCount: { type: "number", description: "총 read 횟수" },
        readsPerSecond: {
          type: "number",
          description: "초당 read 횟수",
        },
        elapsedSeconds: {
          type: "number",
          description: "경과 시간 (초)",
        },
      },
    },
  })
  getPollingMetrics(): {
    readCount: number;
    readsPerSecond: number;
    elapsedSeconds: number;
  } {
    return this.plcService.getPollingMetrics();
  }

  // ==================== Data ====================

  @Get("data/:key")
  @ApiTags("data")
  @ApiOperation({
    summary: "데이터 읽기",
    description: "DB에 저장된 최신 데이터를 조회합니다.",
  })
  @ApiParam({
    name: "key",
    description: "읽을 데이터 포인트 키",
    example: "temperature_sensor",
  })
  @ApiResponse({
    status: 200,
    description: "데이터 읽기 성공",
    type: PlcDataResponseDto,
  })
  @ApiResponse({ status: 404, description: "데이터를 찾을 수 없음" })
  async readData(@Param("key") key: string): Promise<PlcDataResponseDto> {
    const item = await this.plcService.getCacheItem(key);
    if (!item) {
      throw new NotFoundException(`Data for '${key}' not found in DB. Make sure polling is running and the data point is registered.`);
    }
    return {
      value: item.value,
      timestamp: item.timestamp,
      error: item.error,
    };
  }

  @Post("data/:key")
  @ApiTags("data")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "데이터 쓰기",
    description: "PLC에 데이터를 쓰고 DB에 저장합니다.",
  })
  @ApiParam({
    name: "key",
    description: "쓸 데이터 포인트 키",
    example: "temperature_sensor",
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: "object",
          properties: {
            values: {
              type: "array",
              items: { type: "number" },
              description: "숫자 배열 (number 타입 데이터 포인트용)",
              example: [100, 200, 300],
            },
          },
          required: ["values"],
        },
        {
          type: "object",
          properties: {
            value: {
              type: "string",
              description: "문자열 (string 타입 데이터 포인트용)",
              example: "HELLO",
            },
          },
          required: ["value"],
        },
        {
          type: "object",
          properties: {
            value: {
              type: "boolean",
              description: "불린 값 (bool 타입 데이터 포인트용)",
              example: true,
            },
          },
          required: ["value"],
        },
      ],
    },
  })
  @ApiResponse({
    status: 200,
    description: "PLC 쓰기 및 DB 저장 성공",
  })
  @ApiResponse({
    status: 400,
    description: "잘못된 데이터 타입 또는 데이터 포인트를 찾을 수 없음",
  })
  async writeData(
    @Param("key") key: string,
    @Body() body: WriteNumbersDto | WriteStringDto | WriteBoolDto
  ): Promise<{ message: string; saved: PlcDataResponseDto }> {
    const definition = await this.plcService.getDataPoint(key);
    if (!definition) {
      throw new NotFoundException(`Data point '${key}' not found`);
    }

    let value: PlcValue;

    if (definition.type === "number") {
      if ("values" in body) {
        value = body.values;
      } else {
        throw new BadRequestException(`Data point ${key} expects number array (values)`);
      }
    } else if (definition.type === "string") {
      if ("value" in body && typeof body.value === "string") {
        value = body.value;
      } else {
        throw new BadRequestException(`Data point ${key} expects string (value)`);
      }
    } else if (definition.type === "bool") {
      if ("value" in body && typeof body.value === "boolean") {
        value = body.value;
      } else {
        throw new BadRequestException(`Data point ${key} expects boolean (value)`);
      }
    } else {
      throw new BadRequestException(`Unknown data point type: ${definition.type}`);
    }

    try {
      await this.plcService.writeData(key, value);
      const saved = await this.plcService.getCacheItem(key);

      return {
        message: `Data written to PLC and saved to DB for ${key}`,
        saved: {
          value: saved!.value,
          timestamp: saved!.timestamp,
          error: saved!.error,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to write to ${key}`, (error as Error).stack);
      throw error;
    }
  }
}
