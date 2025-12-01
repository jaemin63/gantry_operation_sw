import React, { useEffect, useState, useCallback } from "react";
import { getDataSets, getDataSetValues, startDataSetPolling, stopDataSetPolling, writeDataSetValues } from "../services/tagApi";
import { DataSet, DataSetValues } from "../types";
import "./DataSetCachePage.css";

const DataSetCachePage: React.FC = () => {
  const [dataSets, setDataSets] = useState<DataSet[]>([]);
  const [values, setValues] = useState<DataSetValues[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pollInterval, setPollInterval] = useState<number>(1000);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadDataSets = useCallback(async () => {
    try {
      const list = await getDataSets();
      setDataSets(list);
    } catch (error) {
      console.error("Failed to load datasets", error);
    }
  }, []);

  const loadValues = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const v = await getDataSetValues();
      setValues(v);
    } catch (error) {
      console.error("Failed to load dataset values", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataSets();
    loadValues(true);
  }, [loadDataSets, loadValues]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      loadValues(true);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [isPolling, pollInterval, loadValues]);

  const handleStartPolling = async () => {
    try {
      await startDataSetPolling();
      setIsPolling(true);
      setMessage({ type: "success", text: "DataSet polling started" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to start polling" });
    }
  };

  const handleStopPolling = async () => {
    try {
      await stopDataSetPolling();
      setIsPolling(false);
      setMessage({ type: "success", text: "DataSet polling stopped" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to stop polling" });
    }
  };

  const handleWriteValues = async (ds: DataSet, current: DataSetValues | undefined) => {
    try {
      // 간단히 현재 값 그대로 재기입 (프론트에서 직접 수정 UI는 생략)
      const payload = current?.values ?? Array(ds.length).fill(0);
      await writeDataSetValues(ds.id, payload);
      setMessage({ type: "success", text: `DataSet ${ds.id} values written` });
      await loadValues();
    } catch (error) {
      setMessage({ type: "error", text: `Failed to write DataSet ${ds.id}` });
    }
  };

  const renderValuesPreview = (val: number[]) => {
    if (!val || val.length === 0) return "-";
    const slice = val.slice(0, 10).join(", ");
    return val.length > 10 ? `${slice} ... (${val.length} words)` : slice;
  };

  const formatTimestamp = (ts?: Date | string) => {
    if (!ts) return "-";
    const d = new Date(ts);
    const base = d.toLocaleTimeString([], { hour12: false });
    return `${base}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  };

  return (
    <div className="dataset-cache-page">
      <header className="dsp-header">
        <div>
          <h1>DataSet Cache</h1>
          <p className="dsp-subtitle">데이터셋 단위 값 조회/쓰기 & 폴링 제어</p>
        </div>
        <div className="dsp-actions">
          <div className="dsp-poll-controls">
            <label>
              Refresh (ms):
              <input
                type="number"
                min={200}
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value) || 1000)}
              />
            </label>
            <button className="btn primary" onClick={handleStartPolling} disabled={isPolling}>
              Start Polling
            </button>
            <button className="btn secondary" onClick={handleStopPolling} disabled={!isPolling}>
              Stop Polling
            </button>
            <button className="btn" onClick={() => loadValues(false)} disabled={isLoading}>
              Manual Refresh
            </button>
          </div>
          {message && <div className={`toast ${message.type}`}>{message.text}</div>}
        </div>
      </header>

      <section className="dsp-grid">
        {dataSets.map((ds) => {
          const val = values.find((v) => v.dataSetId === ds.id);
          return (
            <div key={ds.id} className="dsp-card">
              <div className="dsp-card-header">
                <div>
                  <h3>{ds.name}</h3>
                  <p className="muted">
                    {ds.addressType}{ds.startAddress} ~ {ds.addressType}{ds.startAddress + ds.length - 1} ({ds.length} words)
                  </p>
                </div>
                <span className={`badge ${ds.enabled ? "badge-yes" : "badge-no"}`}>{ds.enabled ? "ENABLED" : "DISABLED"}</span>
              </div>
              <div className="dsp-meta">
                <div>
                  <span className="label">Polling</span>
                  <strong>{ds.pollingInterval} ms</strong>
                </div>
                <div>
                  <span className="label">Updated</span>
                  <strong>{formatTimestamp(val?.timestamp)}</strong>
                </div>
                <div>
                  <span className="label">Error</span>
                  <strong className={val?.error ? "text-error" : "text-ok"}>{val?.error || "OK"}</strong>
                </div>
              </div>
              <div className="dsp-values">
                <div className="label">Values (preview)</div>
                <div className="values-preview">{renderValuesPreview(val?.values || [])}</div>
              </div>
              <div className="dsp-footer">
                <button className="btn secondary" onClick={() => handleWriteValues(ds, val)}>
                  Write Current Values
                </button>
                <button className="btn ghost" onClick={() => val && alert(JSON.stringify(val.values, null, 2))} disabled={!val}>
                  Show Full JSON
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default DataSetCachePage;
