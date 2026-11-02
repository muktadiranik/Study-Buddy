import { useEffect, useRef, useState } from "react";
import { fullPhoto, type Corners } from "../lib/pdf";
const names = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];

export function PageCrop({
  file,
  points,
  onChange,
  disabled,
}: {
  file: File;
  points: Corners;
  onChange: (points: Corners) => void;
  disabled: boolean;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    if (image.current) image.current.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file]);
  function move(x: number, y: number) {
    const next = points.map((point) => [...point] as [number, number]);
    next[selected] = [
      Math.max(0, Math.min(100, x)),
      Math.max(0, Math.min(100, y)),
    ];
    onChange(next);
  }
  return (
    <div
      className="page-crop"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement)
          e.preventDefault();
      }}
    >
      <p className="small muted" id="crop-help">
        Select a corner, then tap its position on one written page. Work
        clockwise: top-left, top-right, bottom-right, bottom-left. The X/Y
        fields also work with the keyboard. Only this area will be read.
      </p>
      <div className="crop-tools">
        <label>
          Selected corner
          <select
            aria-label="Selected page corner"
            value={selected}
            disabled={disabled}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {names.map((name, index) => (
              <option value={index} key={name}>
                {index + 1}. {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          X (%)
          <input
            aria-label="Corner X percent"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={points[selected][0]}
            disabled={disabled}
            onChange={(e) => move(Number(e.target.value), points[selected][1])}
          />
        </label>
        <label>
          Y (%)
          <input
            aria-label="Corner Y percent"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={points[selected][1]}
            disabled={disabled}
            onChange={(e) => move(points[selected][0], Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="button secondary compact"
          disabled={disabled}
          onClick={() =>
            onChange(fullPhoto.map((p) => [...p] as [number, number]))
          }
        >
          Reset corners
        </button>
      </div>
      <div
        className="crop-photo"
        onClick={(e) => {
          if (disabled) return;
          const rect = e.currentTarget.getBoundingClientRect();
          move(
            Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
            Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
          );
        }}
      >
        <img ref={image} alt="Selected study photo for page corner placement" />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points={points.map((p) => p.join(",")).join(" ")} />
          {points.map(([x, y], index) => (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r={2.2}
                className={index === selected ? "active" : ""}
              />
              <text
                x={Math.max(3, Math.min(94, x))}
                y={Math.max(5, Math.min(95, y))}
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
