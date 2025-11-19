import React, { useState } from "react";
import "./MainPage.css";

const MainPage: React.FC = () => {
  const [panel, setPanel] = useState<number>(1);

  // 축 타입 명시
  const axisData = {
    X: { pos: 123.456, ref: true, load: 40 },
    Y: { pos: 50.123, ref: false, load: 70 },
    Z: { pos: -10.555, ref: true, load: 20 },
    C: { pos: 5.0, ref: false, load: 55 },
  };

  // ★ TS 오류 해결: 축 타입 배열
  const axes: Array<keyof typeof axisData> = ["X", "Y", "Z", "C"];

  const feedrate = 1200;

  const grippers = [
    { name: "A", state: true },
    { name: "B", state: false },
  ];

  const connectionStatus = "Not Connected";

  return (
    <div className="mainA-container">
      {/* LEFT */}
      <div className="mainA-left">
        {/* STATUS BOX */}
        <div className="mainA-status-box">
          <h3>Status</h3>
          <div className="mainA-status-center-box">
            <div
              className={`mainA-status ${
                connectionStatus === "Not Connected" ? "red" : "black"
              }`}
            >
              {connectionStatus}
            </div>
          </div>
        </div>

        {/* GANTRY BOX */}
        <div className="mainA-gantry-box">
          <h3>Gantry Status</h3>

          {/* Position */}
          <div className="sub-box">
            <div className="section-title">Position</div>

            {axes.map((axis) => (
              <div className="axis-row" key={axis}>
                <span className="axis-name">{axis}</span>

                <span className="axis-pos-box">
                  {axisData[axis].pos.toFixed(3)}
                </span>

                <span
                  className={`axis-ref ${axisData[axis].ref ? "on" : ""}`}
                ></span>
              </div>
            ))}
          </div>

          {/* Feedrate */}
          <div className="sub-box">
            <div className="section-title">Feedrate</div>
            <div className="feedrate-box">{feedrate} mm/min</div>
          </div>

          {/* Loadmeter */}
          <div className="sub-box">
            <div className="section-title">Loadmeter</div>

            {axes.map((axis) => (
              <div key={axis} className="loadmeter-block">
                <div className="loadmeter-label">{axis}</div>

                <div className="loadmeter-row">
                  <div className="loadmeter-bar">
                    <div
                      className="loadmeter-fill"
                      style={{ width: `${axisData[axis].load}%` }}
                    ></div>
                  </div>

                  <span className="loadmeter-value">
                    {axisData[axis].load}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRIPPERS BOX */}
        <div className="mainA-gripper-box">
          <h3>Grippers</h3>

          {grippers.map((g) => (
            <div key={g.name} className="gripper-row">
              <span className="gripper-name">{g.name}</span>
              <span className={g.state ? "status-green" : "status-red"}>
                {g.state ? "Clamp" : "Unclamp"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="mainA-right">
        <div className="mainA-right-panel">
          <div className="panel-buttons">
            <button
              className={`panel-btn ${panel === 1 ? "selected" : ""}`}
              onClick={() => setPanel(1)}
            >
              A
            </button>
            <button
              className={`panel-btn ${panel === 2 ? "selected" : ""}`}
              onClick={() => setPanel(2)}
            >
              B
            </button>
            <button
              className={`panel-btn ${panel === 3 ? "selected" : ""}`}
              onClick={() => setPanel(3)}
            >
              C
            </button>
          </div>

          <div className="panel-body">
            <div className="placeholder-text">Panel {panel} 화면</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
