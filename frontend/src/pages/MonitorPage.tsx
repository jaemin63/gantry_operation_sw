// src/pages/MonitorPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { getDataPoints, getPollingStatus, startPolling, stopPolling, getPollingMetrics, readData, writeData, deleteDataPoint } from "../services/api";
import { DataPoint, PlcDataResponse, PollingStatus } from "../types";
import "./MonitorPage.css";

const MonitorPage: React.FC = () => {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>({
    isPolling: false,
    dataPointCount: 0,
  });
  const [dataCache, setDataCache] = useState<Record<string, PlcDataResponse>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editArrayValues, setEditArrayValues] = useState<number[]>([]);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [frontendPollingInterval, setFrontendPollingInterval] = useState<number>(1000);
  const [metrics, setMetrics] = useState<{
    readCount: number;
    readsPerSecond: number;
    elapsedSeconds: number;
  }>({ readCount: 0, readsPerSecond: 0, elapsedSeconds: 0 });

  // Load data points and polling status
  const loadData = useCallback(async () => {
    try {
      const [points, status] = await Promise.all([getDataPoints(), getPollingStatus()]);
      setDataPoints(points);
      setPollingStatus(status);
    } catch (error: any) {
      console.error("Failed to load data:", error);
    }
  }, []);

  // Load cached data
  const loadCachedData = useCallback(async () => {
    try {
      const cache: Record<string, PlcDataResponse> = {};
      for (const point of dataPoints) {
        try {
          const data = await readData(point.key);
          cache[point.key] = data;
        } catch {
          // Skip if data not found
        }
      }
      setDataCache(cache);
    } catch (error) {
      console.error("Failed to load cached data:", error);
    }
  }, [dataPoints]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (dataPoints.length > 0) {
      loadCachedData();
    }
  }, [dataPoints, loadCachedData]);

  // Auto-refresh data when polling is active (프론트엔드 폴링 주기)
  useEffect(() => {
    if (pollingStatus.isPolling) {
      const interval = setInterval(() => {
        loadCachedData();
      }, frontendPollingInterval);
      return () => clearInterval(interval);
    }
  }, [pollingStatus.isPolling, frontendPollingInterval, loadCachedData]);

  // 폴링 활성화 시 성능 메트릭 자동 갱신 (500ms마다)
  useEffect(() => {
    if (pollingStatus.isPolling) {
      const interval = setInterval(async () => {
        try {
          const data = await getPollingMetrics();
          setMetrics(data);
        } catch (error) {
          console.error("Failed to get polling metrics:", error);
        }
      }, 500);
      return () => clearInterval(interval);
    } else {
      setMetrics({ readCount: 0, readsPerSecond: 0, elapsedSeconds: 0 });
    }
  }, [pollingStatus.isPolling]);

  const handleStartPolling = async () => {
    try {
      await startPolling();
      await loadData();
      setMessage({ type: "success", text: "Polling started" });
    } catch (error: any) {
      setMessage({ type: "error", text: "Failed to start polling" });
    }
  };

  const handleStopPolling = async () => {
    try {
      await stopPolling();
      await loadData();
      setMessage({ type: "success", text: "Polling stopped" });
    } catch (error: any) {
      setMessage({ type: "error", text: "Failed to stop polling" });
    }
  };

  const handleSetFrontendInterval = (intervalMs: number) => {
    setFrontendPollingInterval(intervalMs);
    setMessage({
      type: "success",
      text: `Frontend refresh interval set to ${intervalMs}ms`,
    });
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Are you sure you want to delete "${key}"?`)) {
      return;
    }

    try {
      await deleteDataPoint(key);
      await loadData();
      setMessage({ type: "success", text: `Data point "${key}" deleted` });
    } catch (error: any) {
      setMessage({ type: "error", text: "Failed to delete data point" });
    }
  };

  const handleEdit = (point: DataPoint) => {
    setEditingKey(point.key);
    const cachedData = dataCache[point.key];
    if (cachedData) {
      if (point.type === "bool") {
        setEditValue(String(cachedData.value));
        setEditArrayValues([]);
      } else if (point.type === "number" && Array.isArray(cachedData.value)) {
        setEditArrayValues([...cachedData.value]);
        setEditValue("");
      } else {
        setEditValue(String(cachedData.value));
        setEditArrayValues([]);
      }
    } else {
      // 기본값 설정
      if (point.type === "number") {
        setEditArrayValues(Array(point.length).fill(0));
        setEditValue("");
      } else {
        setEditValue("");
        setEditArrayValues([]);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setEditArrayValues([]);
  };

  const handleArrayValueChange = (index: number, value: string) => {
    const newValues = [...editArrayValues];
    const numValue = parseInt(value);
    newValues[index] = isNaN(numValue) ? 0 : numValue;
    setEditArrayValues(newValues);
  };

  const handleSaveEdit = async (point: DataPoint) => {
    try {
      let value: number[] | string | boolean;

      if (point.type === "number" && editArrayValues.length > 0) {
        value = editArrayValues;
      } else if (point.type === "bool") {
        value = editValue.toLowerCase() === "true" || editValue === "1";
      } else {
        value = editValue;
      }

      await writeData(point.key, value);
      setMessage({
        type: "success",
        text: `Value written to "${point.key}"`,
      });
      setEditingKey(null);
      setEditValue("");
      setEditArrayValues([]);

      // Reload data immediately
      setTimeout(() => loadCachedData(), 500);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to write value",
      });
    }
  };

  const formatValue = (point: DataPoint, data: PlcDataResponse | undefined): React.ReactNode => {
    if (!data) return "N/A";
    if (data.error) return `Error: ${data.error}`;

    if (point.type === "bool") {
      return String(data.value);
    } else if (point.type === "number" && Array.isArray(data.value)) {
      return (
        <div className="value-array">
          {data.value.map((val, idx) => (
            <span key={idx} className="value-item" data-index={`+${idx}:`}>
              {val}
            </span>
          ))}
        </div>
      );
    } else {
      return String(data.value);
    }
  };

  const formatTimestamp = (date: Date | undefined): string => {
    if (!date) return "N/A";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const milliseconds = String(d.getMilliseconds()).padStart(3, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  return (
    <div className="page monitor-page">
      <h1 className="page-title">PLC I/F Test Screen</h1>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="alert-close" aria-label="Close">
            ×
          </button>
        </div>
      )}

      {/* Polling Controls */}
      <div className="card polling-controls">
        <div className="status-info">
          <span className={`status-indicator ${pollingStatus.isPolling ? "active" : "inactive"}`}>
            {pollingStatus.isPolling ? "● Polling Active" : "○ Polling Inactive"}
          </span>
          <span className="status-subtext">Data Points: {dataPoints.length}</span>
          {pollingStatus.isPolling && (
            <>
              <span className="metrics-divider">|</span>
              <span className="metrics-item">{metrics.readCount} reads</span>
              <span className="metrics-item">{metrics.readsPerSecond} reads/sec</span>
              <span className="metrics-item">{metrics.elapsedSeconds}s elapsed</span>
            </>
          )}
        </div>

        <div className="control-buttons">
          <label className="control-label">UI Refresh</label>
          <select
            onChange={(e) => handleSetFrontendInterval(parseInt(e.target.value, 10))}
            value={frontendPollingInterval}
            className="form-select interval-select"
          >
            <option value={100}>100ms</option>
            <option value={500}>500ms</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
          </select>
          <button onClick={handleStartPolling} disabled={pollingStatus.isPolling} className="btn btn-success">
            Start
          </button>
          <button onClick={handleStopPolling} disabled={!pollingStatus.isPolling} className="btn btn-danger">
            Stop
          </button>
          <button onClick={loadCachedData} className="btn btn-neutral">
            Refresh
          </button>
        </div>
      </div>

      {/* Data Points Table */}
      <div className="card data-table-container">
        {dataPoints.length === 0 ? (
          <div className="empty-state">No data points registered. Go to Register page to add data points.</div>
        ) : (
          <table className="table data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Description</th>
                <th>Address</th>
                <th>Type</th>
                <th>Polling (ms)</th>
                <th>Value</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dataPoints.map((point) => {
                const cachedData = dataCache[point.key];
                const isEditing = editingKey === point.key;

                return (
                  <tr key={point.key} className={cachedData?.error ? "error-row" : ""}>
                    <td className="key-cell">{point.key}</td>
                    <td>{point.description}</td>
                    <td>
                      {point.addressType}
                      {point.address}
                      {point.bit !== undefined && `.${point.bit}`}
                    </td>
                    <td>
                      <span className={`badge badge-${point.type}`}>{point.type}</span>
                    </td>
                    <td className="polling-cell">{point.pollingInterval}</td>
                    <td className="value-cell">
                      {isEditing ? (
                        point.type === "number" && editArrayValues.length > 0 ? (
                          <div className="edit-array">
                            {editArrayValues.map((val, idx) => (
                              <div key={idx} className="edit-array-item">
                                <label>+{idx}:</label>
                                <input
                                  type="number"
                                  value={val}
                                  onChange={(e) => handleArrayValueChange(idx, e.target.value)}
                                  className="array-input"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="value-input"
                            placeholder={point.type === "bool" ? "true or false" : "Enter value"}
                          />
                        )
                      ) : (
                        <span className="value-display">{formatValue(point, cachedData)}</span>
                      )}
                    </td>
                    <td className="timestamp-cell">{formatTimestamp(cachedData?.timestamp)}</td>
                    <td className="actions-cell">
                      {isEditing ? (
                        <>
                          <button onClick={() => handleSaveEdit(point)} className="btn btn-success btn-small">
                            Save
                          </button>
                          <button onClick={handleCancelEdit} className="btn btn-neutral btn-small">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(point)} className="btn btn-primary btn-small">
                            Write
                          </button>
                          <button onClick={() => handleDelete(point.key)} className="btn btn-danger btn-small">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MonitorPage;
