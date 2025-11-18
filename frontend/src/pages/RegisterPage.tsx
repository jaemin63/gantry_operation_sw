// src/pages/RegisterPage.tsx
import React, { useState } from "react";
import { registerDataPoint } from "../services/api";
import { DataPoint } from "../types";
import "./RegisterPage.css";

type MessageState = { type: "success" | "error"; text: string } | null;

// 숫자 필드 목록 (가독성용)
const NUMERIC_FIELDS = ["address", "length", "bit", "pollingInterval"] as const;

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState<Partial<DataPoint>>({
    key: "",
    description: "",
    addressType: "D",
    address: 0,
    length: 1,
    type: "number",
    pollingInterval: 1000, // 기본값 1초
  });

  const [message, setMessage] = useState<MessageState>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      // 숫자 필드 처리
      if (NUMERIC_FIELDS.includes(name as (typeof NUMERIC_FIELDS)[number])) {
        const num = parseInt(value, 10);
        return {
          ...prev,
          [name]: isNaN(num) ? 0 : num,
        };
      }

      // 문자열 필드
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      // 기본 Validation
      if (!formData.key || !formData.description) {
        throw new Error("Key and description are required");
      }

      if (formData.type === "bool" && (formData.bit === undefined || formData.bit === null)) {
        throw new Error("Bit position is required for bool type");
      }

      await registerDataPoint(formData as DataPoint);

      setMessage({
        type: "success",
        text: `Data point "${formData.key}" registered successfully!`,
      });

      // 폼 리셋
      setFormData({
        key: "",
        description: "",
        addressType: "D",
        address: 0,
        length: 1,
        type: "number",
        pollingInterval: 1000,
      });
    } catch (err: unknown) {
      const error = err as any;
      setMessage({
        type: "error",
        text: error?.response?.data?.message || error?.message || "Failed to register data point",
      });
    }
  };

  return (
    <div className="page register-page">
      <h1 className="page-title">Register Data Point</h1>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button className="alert-close" onClick={() => setMessage(null)} aria-label="Close">
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card register-form">
        {/* Key / Description */}
        <div className="form-group">
          <label htmlFor="key" className="form-label">
            Key *
          </label>
          <input
            type="text"
            id="key"
            name="key"
            className="form-input"
            value={formData.key ?? ""}
            onChange={handleInputChange}
            required
            placeholder="e.g., motor_speed"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description *
          </label>
          <input
            type="text"
            id="description"
            name="description"
            className="form-input"
            value={formData.description ?? ""}
            onChange={handleInputChange}
            required
            placeholder="e.g., Motor speed sensor"
          />
        </div>

        {/* Address Type / Address */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="addressType" className="form-label">
              Address Type *
            </label>
            <select
              id="addressType"
              name="addressType"
              className="form-select"
              value={formData.addressType ?? "D"}
              onChange={handleInputChange}
              required
            >
              <option value="D">D - Data Register</option>
              <option value="R">R - File Register</option>
              <option value="M">M - Internal Relay</option>
              <option value="X">X - Input</option>
              <option value="Y">Y - Output</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="address" className="form-label">
              Address *
            </label>
            <input
              type="number"
              id="address"
              name="address"
              className="form-input"
              value={formData.address ?? 0}
              onChange={handleInputChange}
              required
              min={0}
            />
          </div>
        </div>

        {/* Data Type / Length */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="type" className="form-label">
              Data Type *
            </label>
            <select id="type" name="type" className="form-select" value={formData.type ?? "number"} onChange={handleInputChange} required>
              <option value="number">Number (Word Array)</option>
              <option value="string">String</option>
              <option value="bool">Boolean (Bit)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="length" className="form-label">
              Length * {formData.type === "number" && "(words)"}
              {formData.type === "string" && "(chars)"}
            </label>
            <input
              type="number"
              id="length"
              name="length"
              className="form-input"
              value={formData.length ?? 1}
              onChange={handleInputChange}
              required
              min={1}
            />
          </div>
        </div>

        {/* Bit (bool only) */}
        {formData.type === "bool" && (
          <div className="form-group">
            <label htmlFor="bit" className="form-label">
              Bit Position * (0–15)
            </label>
            <input
              type="number"
              id="bit"
              name="bit"
              className="form-input"
              value={formData.bit ?? 0}
              onChange={handleInputChange}
              required
              min={0}
              max={15}
            />
          </div>
        )}

        {/* Polling Interval */}
        <div className="form-group">
          <label htmlFor="pollingInterval" className="form-label">
            Polling Interval * (ms)
          </label>
          <input
            type="number"
            id="pollingInterval"
            name="pollingInterval"
            className="form-input"
            value={formData.pollingInterval ?? 1000}
            onChange={handleInputChange}
            required
            min={100}
            step={100}
            placeholder="e.g., 1000 (1 second)"
          />
          <small className="form-help">How often to read this data point (minimum 100ms)</small>
        </div>

        <button type="submit" className="btn btn-primary btn-full">
          Register Data Point
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
