import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  getDataSets,
  getDataSetValues,
  startDataSetPolling,
  stopDataSetPolling,
  writeDataSetValues,
  getTags,
  writeTagValue,
} from "../services/tagApi";
import { DataSet, DataSetValues, Tag } from "../types";
import "./DataSetCachePage.css";

const DataSetCachePage: React.FC = () => {
  const [dataSets, setDataSets] = useState<DataSet[]>([]);
  const [values, setValues] = useState<DataSetValues[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pollInterval, setPollInterval] = useState<number>(1000);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

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
    (async () => {
      try {
        const t = await getTags();
        setTags(t);
      } catch (error) {
        console.error("Failed to load tags", error);
      }
    })();
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

  const formatTimestamp = (ts?: Date | string) => {
    if (!ts) return "-";
    const d = new Date(ts);
    const base = d.toLocaleTimeString([], { hour12: false });
    return `${base}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  };

  const tagsByDataSet = useMemo(() => {
    const map: Record<number, Tag[]> = {};
    for (const t of tags) {
      if (!map[t.dataSetId]) map[t.dataSetId] = [];
      map[t.dataSetId].push(t);
    }
    // optional: sort by offset then bit
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.offset - b.offset || (a.bitPosition ?? 0) - (b.bitPosition ?? 0)));
    return map;
  }, [tags]);

  const renderTagValue = (tag: Tag, dsValues?: number[]) => {
    if (!dsValues || dsValues.length === 0) return "-";
    const { offset, dataType, wordLength = 1, bitPosition = 0 } = tag;
    const safe = (idx: number) => (idx >= 0 && idx < dsValues.length ? dsValues[idx] : undefined);

    try {
      switch (dataType) {
        case "int16": {
          const w = safe(offset);
          if (w === undefined) return "N/A";
          return w > 32767 ? w - 65536 : w;
        }
        case "int32": {
          const lo = safe(offset);
          const hi = safe(offset + 1);
          if (lo === undefined || hi === undefined) return "N/A";
          let val = (hi << 16) | lo;
          if (val > 2147483647) val -= 4294967296;
          return val;
        }
        case "real": {
          const lo = safe(offset);
          const hi = safe(offset + 1);
          if (lo === undefined || hi === undefined) return "N/A";
          const buf = new ArrayBuffer(4);
          const view = new DataView(buf);
          view.setUint16(0, lo, true); // little-endian
          view.setUint16(2, hi, true);
          return Number(view.getFloat32(0, true).toFixed(4));
        }
        case "bool": {
          const w = safe(offset);
          if (w === undefined) return "N/A";
          return ((w >> bitPosition) & 1) === 1 ? "ON" : "OFF";
        }
        case "string": {
          const words = [];
          for (let i = 0; i < wordLength; i++) {
            const w = safe(offset + i);
            if (w === undefined) break;
            words.push(w);
          }
          if (!words.length) return "N/A";
          const bytes: number[] = [];
          for (const w of words) {
            const lo = w & 0xff;
            const hi = (w >> 8) & 0xff;
            if (lo === 0) break;
            bytes.push(lo);
            if (hi === 0) break;
            bytes.push(hi);
          }
          const decoder = new TextDecoder("ascii");
          return decoder.decode(new Uint8Array(bytes));
        }
        default:
          return "N/A";
      }
    } catch (err) {
      return "ERR";
    }
  };

  const startEditTag = (tag: Tag, dsValues?: number[]) => {
    const current = renderTagValue(tag, dsValues);
    setEditingKey(tag.key);
    setEditValue(current === "N/A" || current === "ERR" ? "" : String(current));
  };

  const writeTag = async (tag: Tag) => {
    try {
      let value: number | string | boolean;
      if (tag.dataType === "int16" || tag.dataType === "int32" || tag.dataType === "real") {
        value = parseFloat(editValue);
        if (isNaN(value)) throw new Error("Invalid number");
      } else if (tag.dataType === "bool") {
        value = editValue.toLowerCase() === "true" || editValue === "1" || editValue.toLowerCase() === "on";
      } else {
        value = editValue;
      }
      await writeTagValue(tag.key, value);
      setMessage({ type: "success", text: `Written ${tag.key}` });
      setEditingKey(null);
      setEditValue("");
      await loadValues(true);
    } catch (error) {
      console.error("Failed to write tag", error);
      setMessage({ type: "error", text: `Failed to write ${tag.key}` });
    }
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
          const tagList = tagsByDataSet[ds.id] || [];
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
              <div className="dsp-tags">
                <div className="dsp-tags-header">
                  <span className="label">Tags</span>
                  <span className="label">{tagList.length} items</span>
                </div>
                <div className="dsp-tags-table">
                  {tagList.map((t) => (
                    <div className="dsp-tag-row" key={t.key}>
                      <div className="dsp-tag-key">{t.key}</div>
                      <div className="dsp-tag-meta">
                        <span>{t.dataType}</span>
                        <span>
                          {ds.addressType}
                          {ds.startAddress + t.offset}
                          {t.dataType === "bool" && t.bitPosition !== undefined ? `.${t.bitPosition}` : ""}
                        </span>
                      </div>
                      <div className="dsp-tag-actions">
                        {editingKey === t.key ? (
                          <>
                            <input
                              className="tag-input"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="value"
                            />
                            <button className="btn primary small" onClick={() => writeTag(t)}>
                              Write
                            </button>
                            <button className="btn ghost small" onClick={() => setEditingKey(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="dsp-tag-value">{renderTagValue(t, val?.values)}</span>
                            <button className="btn secondary small" onClick={() => startEditTag(t, val?.values)}>
                              Write
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default DataSetCachePage;
