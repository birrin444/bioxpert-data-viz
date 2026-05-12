import React, { useCallback, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function SvgIcon({ children, className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function UploadCloud({ className }) {
  return (
    <SvgIcon className={className}>
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
    </SvgIcon>
  );
}

function FileText({ className }) {
  return (
    <SvgIcon className={className}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </SvgIcon>
  );
}

function SlidersHorizontal({ className }) {
  return (
    <SvgIcon className={className}>
      <path d="M21 4h-7" />
      <path d="M10 4H3" />
      <path d="M21 12h-9" />
      <path d="M8 12H3" />
      <path d="M21 20h-5" />
      <path d="M12 20H3" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="20" r="2" />
    </SvgIcon>
  );
}

function Download({ className }) {
  return (
    <SvgIcon className={className}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </SvgIcon>
  );
}

function RotateCcw({ className }) {
  return (
    <SvgIcon className={className}>
      <path d="M3 2v6h6" />
      <path d="M3 13a9 9 0 103-6.7L3 8" />
    </SvgIcon>
  );
}

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#4f46e5",
  "#65a30d",
  "#0f766e",
  "#7c2d12",
  "#334155",
];

function Hint({ text }) {
  return (
    <span
      title={text}
      className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600"
    >
      ?
    </span>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <span className="mb-1 flex items-center text-sm font-medium text-slate-700" title={hint}>
      {children}
      {hint && <Hint text={hint} />}
    </span>
  );
}

function trimOuterQuotes(value) {
  const text = String(value).trim();
  if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
    return text.slice(1, -1);
  }
  return text;
}

function parseElapsedHours(value) {
  if (value == null) return null;
  const parts = trimOuterQuotes(value).split(":").map(Number);
  if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) return null;
  const [hours, minutes, seconds = 0] = parts;
  return hours + minutes / 60 + seconds / 3600;
}

function formatDuration(hours) {
  if (!Number.isFinite(hours)) return "";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function coerceNumber(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim().replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function extractUnit(label) {
  const text = String(label || "").trim();
  const start = text.lastIndexOf("(");
  const end = text.lastIndexOf(")");
  if (start >= 0 && end > start) return text.slice(start + 1, end).trim();
  return "";
}

function cleanChannelName(label) {
  const text = String(label || "").trim();
  const start = text.lastIndexOf("(");
  const end = text.lastIndexOf(")");
  if (start > 0 && end === text.length - 1) return text.slice(0, start).trim();
  return text;
}

function baseFileName(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function niceNumber(value, digits = 3) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function roundToFive(value) {
  return Math.round(Number(value) / 5) * 5;
}

function floorToFive(value) {
  return Math.floor(Number(value) / 5) * 5;
}

function ceilToFive(value) {
  return Math.ceil(Number(value) / 5) * 5;
}

function buildFiveHourTicks(start, end) {
  const first = floorToFive(start);
  const last = ceilToFive(end);
  const ticks = [];
  for (let value = first; value <= last; value += 5) ticks.push(value);
  return ticks;
}

function movingAverage(values, windowSize, key) {
  if (windowSize <= 1) return values;
  const half = Math.floor(windowSize / 2);
  return values.map((row, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j += 1) {
      const v = values[j][key];
      if (Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    return count ? sum / count : row[key];
  });
}

function downsampleRows(rows, maxPoints) {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < rows.length; i += step) sampled.push(rows[i]);
  if (sampled[sampled.length - 1] !== rows[rows.length - 1]) sampled.push(rows[rows.length - 1]);
  return sampled;
}

function getStats(rows, key) {
  const values = rows.map((r) => r[key]).filter(Number.isFinite);
  if (!values.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / values.length, count: values.length };
}

function isPreferredChannel(column) {
  const text = `${column.displayName} ${column.originalName}`.toLowerCase();
  return ["ph", "temp", "do", "oxygen", "o2"].some((term) => text.includes(term));
}

function parseTrendCsv(text, fileName) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim().replace("�", "°"),
  });

  if (parsed.errors?.length && !parsed.data?.length) {
    throw new Error(parsed.errors[0].message || "Could not parse CSV");
  }

  const headers = parsed.meta.fields || [];
  const timeHeader =
    headers.find((h) => h.toLowerCase().includes("time")) ||
    headers.find((h) => h.toLowerCase().includes("hh:mm:ss")) ||
    headers[0];

  const numericHeaders = headers.filter((h) => h !== timeHeader);
  const columns = numericHeaders
    .map((originalName, index) => ({
      originalName,
      displayName: cleanChannelName(originalName),
      key: `v${index}`,
      unit: extractUnit(originalName),
      color: COLORS[index % COLORS.length],
      yMin: "",
      yMax: "",
    }))
    .filter((column) => parsed.data.some((row) => coerceNumber(row[column.originalName]) != null));

  const rows = parsed.data
    .map((row) => {
      const elapsedHours = parseElapsedHours(row[timeHeader]);
      if (!Number.isFinite(elapsedHours)) return null;
      const output = {
        __elapsedHours: elapsedHours,
        __timeLabel: formatDuration(elapsedHours),
      };
      for (const column of columns) output[column.key] = coerceNumber(row[column.originalName]);
      return output;
    })
    .filter(Boolean)
    .sort((a, b) => a.__elapsedHours - b.__elapsedHours);

  if (!rows.length || !columns.length) {
    throw new Error("No usable time-series data found. Expected one time column and at least one numeric channel.");
  }

  return {
    fileName,
    rows,
    columns,
    timeHeader,
    maxHours: rows[rows.length - 1].__elapsedHours,
  };
}

function CustomTooltip({ active, payload, label, columnsByKey }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <div className="mb-2 text-sm font-semibold text-slate-900">Elapsed time: {niceNumber(label, 2)} h</div>
      <div className="space-y-1">
        {payload.map((item) => {
          const column = columnsByKey[item.dataKey];
          return (
            <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {column?.displayName || item.dataKey}
              </span>
              <span className="font-mono font-medium text-slate-900">
                {niceNumber(item.value)}{column?.unit ? ` ${column.unit}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BioreactorTrendViewer() {
  const [trend, setTrend] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [smoothWindow, setSmoothWindow] = useState(1);
  const [maxPoints, setMaxPoints] = useState(1500);
  const [xEnd, setXEnd] = useState(0);
  const [axisLabelFontSize, setAxisLabelFontSize] = useState(12);
  const [axisNumberFontSize, setAxisNumberFontSize] = useState(11);
  const [graphTitle, setGraphTitle] = useState("Bioreactor Process Trends");
  const [graphTitleFontSize, setGraphTitleFontSize] = useState(24);
  const [showDots, setShowDots] = useState(false);
  const [draggedChannelKey, setDraggedChannelKey] = useState(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const chartExportRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseTrendCsv(String(reader.result || ""), file.name);
        const preferred = result.columns.filter(isPreferredChannel).map((c) => c.key);
        const fallback = result.columns.slice(0, Math.min(5, result.columns.length)).map((c) => c.key);
        setTrend(result);
        setSelectedKeys(preferred.length ? preferred : fallback);
        setXEnd(result.maxHours);
        setSmoothWindow(1);
      } catch (err) {
        setError(err.message || "Unable to load this file.");
      }
    };
    reader.onerror = () => setError("Could not read the selected file.");
    reader.readAsText(file, "ISO-8859-1");
  }, []);

  const columnsByKey = useMemo(() => {
    return Object.fromEntries((trend?.columns || []).map((c) => [c.key, c]));
  }, [trend]);

  const maxHours = trend?.maxHours || 0;
  const xAxisMax = maxHours;
  const xStartNumber = 0;
  const xEndNumber = Math.max(0, Math.min(Number(xEnd), maxHours));
  const xTicks = useMemo(() => buildFiveHourTicks(xStartNumber, xEndNumber), [xStartNumber, xEndNumber]);

  const visibleRows = useMemo(() => {
    if (!trend) return [];
    return trend.rows.filter((row) => row.__elapsedHours >= xStartNumber && row.__elapsedHours <= xEndNumber);
  }, [trend, xStartNumber, xEndNumber]);

  const statsByKey = useMemo(() => {
    return Object.fromEntries(selectedKeys.map((key) => [key, getStats(visibleRows, key)]));
  }, [selectedKeys, visibleRows]);

  const chartRows = useMemo(() => {
    if (!trend || !selectedKeys.length) return [];
    let rows = visibleRows.map((row) => ({
      __elapsedHours: Number(row.__elapsedHours.toFixed(3)),
      __timeLabel: row.__timeLabel,
      ...Object.fromEntries(selectedKeys.map((key) => [key, row[key]])),
    }));

    if (smoothWindow > 1) {
      const smoothed = rows.map((row) => ({ ...row }));
      for (const key of selectedKeys) {
        const values = movingAverage(rows, smoothWindow, key);
        values.forEach((value, index) => {
          smoothed[index][key] = value;
        });
      }
      rows = smoothed;
    }

    return downsampleRows(rows, Number(maxPoints));
  }, [trend, visibleRows, selectedKeys, smoothWindow, maxPoints]);

  const selectedColumns = (trend?.columns || []).filter((column) => selectedKeys.includes(column.key));
  const axisWidth = 56;
  const plotMinWidth = 1500;
  const axisRailWidth = Math.max(64, selectedColumns.length * axisWidth);
  const chartMinWidth = plotMinWidth + axisRailWidth + 24;
  const chartContentWidth = selectedColumns.length >= 5 ? `${chartMinWidth}px` : "100%";
  const chartMargin = {
    top: Math.max(80, axisLabelFontSize * 4.5, graphTitleFontSize + 54),
    right: 20,
    left: 4,
    bottom: 72,
  };

  function hasManualAxisDomain(column) {
    return column.yMin !== "" || column.yMax !== "";
  }

  function getAxisBounds(column) {
    const stats = statsByKey[column.key];
    const rawMin = stats?.min ?? 0;
    const rawMax = stats?.max ?? 1;
    const span = rawMax === rawMin ? 2 : rawMax - rawMin;
    const autoMin = rawMax === rawMin ? rawMin - 1 : rawMin - span * 0.08;
    const autoMax = rawMax === rawMin ? rawMax + 1 : rawMax + span * 0.08;
    const min = column.yMin === "" ? autoMin : Number(column.yMin);
    const max = column.yMax === "" ? autoMax : Number(column.yMax);
    const safeMin = Number.isFinite(min) ? min : autoMin;
    const safeMax = Number.isFinite(max) ? max : autoMax;
    return { min: safeMin, max: safeMax, mid: (safeMin + safeMax) / 2 };
  }

  function getAxisDomain(column) {
    const bounds = getAxisBounds(column);
    return [bounds.min, bounds.max];
  }

  const boundsByKey = Object.fromEntries(selectedColumns.map((column) => [column.key, getAxisBounds(column)]));

  function clampEndHour(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n >= maxHours - 2.5) return maxHours;
    return roundToFive(Math.max(0, Math.min(maxHours, n)));
  }

  function setTimeEnd(value) {
    setXEnd(clampEndHour(value));
  }

  function toggleChannel(key) {
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function updateColumn(key, patch) {
    setTrend((current) => {
      if (!current) return current;
      return {
        ...current,
        columns: current.columns.map((column) =>
          column.key === key ? { ...column, ...patch } : column
        ),
      };
    });
  }

  function reorderChannel(dragKey, targetKey) {
    if (!dragKey || !targetKey || dragKey === targetKey) return;
    setTrend((current) => {
      if (!current) return current;
      const columns = [...current.columns];
      const fromIndex = columns.findIndex((column) => column.key === dragKey);
      const toIndex = columns.findIndex((column) => column.key === targetKey);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = columns.splice(fromIndex, 1);
      columns.splice(toIndex, 0, moved);
      return { ...current, columns };
    });
  }

  function resetView() {
    if (!trend) return;
    setXEnd(trend.maxHours);
    setSmoothWindow(1);
    setMaxPoints(1500);
    setAxisLabelFontSize(12);
    setAxisNumberFontSize(11);
    setGraphTitleFontSize(24);
    setShowDots(false);
    setTrend((current) => {
      if (!current) return current;
      return {
        ...current,
        columns: current.columns.map((column) => ({ ...column, yMin: "", yMax: "" })),
      };
    });
  }

  function exportGraphImage() {
    const chartNode = chartExportRef.current;
    const svg = chartNode?.querySelector("svg.recharts-surface") || chartNode?.querySelector("svg");
    if (!svg || !trend) return;

    const svgRect = svg.getBoundingClientRect();
    const widthAttr = Number(svg.getAttribute("width"));
    const heightAttr = Number(svg.getAttribute("height"));
    const width = Math.max(
      1,
      Math.ceil(widthAttr || svgRect.width || chartNode.scrollWidth || chartNode.clientWidth)
    );
    const height = Math.max(
      1,
      Math.ceil(heightAttr || svgRect.height || chartNode.scrollHeight || chartNode.clientHeight)
    );

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));

    if (!clone.getAttribute("viewBox")) {
      clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    clone.querySelectorAll("*").forEach((node) => {
      const computed = window.getComputedStyle(node);
      const fontFamily = computed.fontFamily;
      const fontSize = computed.fontSize;
      const fontWeight = computed.fontWeight;
      if (fontFamily) node.setAttribute("font-family", fontFamily);
      if (fontSize) node.setAttribute("font-size", fontSize);
      if (fontWeight) node.setAttribute("font-weight", fontWeight);
    });

    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", "white");
    clone.insertBefore(background, clone.firstChild);

    const svgText = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${baseFileName(trend.fileName)}_trend_graph.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };

    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              <FileText className="h-4 w-4" /> Bioreactor process trend viewer
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">CSV trend visualization</h1>
            <p className="mt-2 max-w-4xl text-slate-600">
              Load controller exports with elapsed time in <span className="font-mono">hh:mm:ss</span> format and numeric trend columns. The graph is shown first at full page width, with controls below it.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-medium text-white shadow-sm transition hover:bg-slate-800" title="Open a controller trend CSV file from your computer.">
            <UploadCloud className="h-5 w-5" />
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => loadFile(event.target.files?.[0])}
            />
          </label>
        </header>

        {!trend && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              loadFile(event.dataTransfer.files?.[0]);
            }}
            className={`rounded-3xl border-2 border-dashed p-12 text-center transition ${
              isDragging ? "border-slate-900 bg-white" : "border-slate-300 bg-white/70"
            }`}
            title="Drag and drop a CSV trend export here."
          >
            <UploadCloud className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h2 className="text-xl font-semibold text-slate-950">Drop a bioreactor CSV here</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-600">
              This parser is tuned for exports like: Time, pH, stirrer rpm, air flow, O₂ flow, base addition, temperature, and dissolved oxygen.
            </p>
            {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          </div>
        )}

        {trend && (
          <div className="flex flex-col gap-6">
            <aside className="order-2 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-4 text-lg font-semibold">File summary</h2>
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <div className="font-medium text-slate-950">{trend.fileName}</div>
                    <div>{trend.rows.length.toLocaleString()} rows · {trend.columns.length} channels · {niceNumber(trend.maxHours, 1)} h total duration</div>
                    <div className="mt-1">Displayed window: 0 to {niceNumber(xEndNumber, 2)} h</div>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 font-medium text-slate-600">
                    Showing {visibleRows.length.toLocaleString()} rows / plotting {chartRows.length.toLocaleString()} points
                  </div>
                  <button
                    onClick={exportGraphImage}
                    title="Download a PNG image of the currently displayed graph, including the visible time window, selected channels, axes, colors, and smoothing settings."
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" /> Export graph image
                  </button>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <SlidersHorizontal className="h-5 w-5" /> Display controls
                  </h2>
                  <button
                    onClick={resetView}
                    title="Reset time range, smoothing, axis label font size, plotted point limit, point markers, and channel y-axis limits."
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset
                  </button>
                </div>

                <div className="grid gap-4">
                  <label>
                    <FieldLabel hint="Average neighboring points to reduce visual noise. Larger windows smooth more but can hide sharp process events.">Smoothing window</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        title="Moving-average window size in plotted data points. This does not change the selected time range."
                        type="range"
                        min="1"
                        max="61"
                        step="2"
                        value={smoothWindow}
                        onChange={(event) => setSmoothWindow(Number(event.target.value))}
                        className="w-full"
                      />
                      <span className="w-16 rounded-xl bg-slate-100 px-2 py-1 text-center font-mono text-sm">{smoothWindow} pts</span>
                    </div>
                  </label>

                  <label>
                    <FieldLabel hint="Caps the number of points sent to the chart for performance. This does not change the selected time range or total duration.">Max plotted points</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        title="Increase for finer visual detail; decrease if the graph feels slow. The displayed end hour is preserved."
                        type="range"
                        min="250"
                        max="5000"
                        step="250"
                        value={maxPoints}
                        onChange={(event) => setMaxPoints(Number(event.target.value))}
                        className="w-full"
                      />
                      <span className="w-20 rounded-xl bg-slate-100 px-2 py-1 text-center font-mono text-sm">{maxPoints}</span>
                    </div>
                  </label>

                  <label>
                    <FieldLabel hint="Font size for the bold x-axis label and vertical y-axis labels.">Axis label font size</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        title="Adjust the font size of bold axis labels."
                        type="range"
                        min="9"
                        max="22"
                        step="1"
                        value={axisLabelFontSize}
                        onChange={(event) => setAxisLabelFontSize(Number(event.target.value))}
                        className="w-full"
                      />
                      <span className="w-14 rounded-xl bg-slate-100 px-2 py-1 text-center font-mono text-sm">{axisLabelFontSize}px</span>
                    </div>
                  </label>

                  <label>
                    <FieldLabel hint="Title shown centered above the graph and included in exported images.">Graph title</FieldLabel>
                    <input
                      title="Edit the graph title displayed at the top center of the chart."
                      value={graphTitle}
                      onChange={(event) => setGraphTitle(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Graph title"
                    />
                  </label>

                  <label>
                    <FieldLabel hint="Font size for the centered graph title.">Graph title font size</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        title="Adjust the font size of the centered graph title."
                        type="range"
                        min="12"
                        max="42"
                        step="1"
                        value={graphTitleFontSize}
                        onChange={(event) => setGraphTitleFontSize(Number(event.target.value))}
                        className="w-full"
                      />
                      <span className="w-14 rounded-xl bg-slate-100 px-2 py-1 text-center font-mono text-sm">{graphTitleFontSize}px</span>
                    </div>
                  </label>

                  <label>
                    <FieldLabel hint="Font size for the numeric tick values on the X and Y axes.">Axis number font size</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        title="Adjust the font size of X-axis and Y-axis numbers."
                        type="range"
                        min="8"
                        max="22"
                        step="1"
                        value={axisNumberFontSize}
                        onChange={(event) => setAxisNumberFontSize(Number(event.target.value))}
                        className="w-full"
                      />
                      <span className="w-14 rounded-xl bg-slate-100 px-2 py-1 text-center font-mono text-sm">{axisNumberFontSize}px</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 text-sm font-medium text-slate-700" title="Show a marker at each plotted sample. Useful for sparse data, but can clutter dense process records.">
                    <input
                      type="checkbox"
                      checked={showDots}
                      onChange={(event) => setShowDots(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Show point markers
                    <Hint text="Adds visible point markers to each trace." />
                  </label>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-4 text-lg font-semibold">Time window</h2>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                    <span>Displayed range</span>
                    <span className="font-mono font-medium text-slate-900">0 to {niceNumber(xEndNumber, 2)} h</span>
                  </div>

                  <label>
                    <FieldLabel hint="Controls the displayed endpoint. The graph always starts at 0 hours. The slider advances in 5-hour increments and ends at the last time in the CSV.">Time range slider</FieldLabel>
                    <input
                      type="range"
                      min="0"
                      max={xAxisMax}
                      step="5"
                      value={xEndNumber}
                      onChange={(event) => setTimeEnd(event.target.value)}
                      className="w-full"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2 2xl:col-span-4">
                <div className="mb-4 flex items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Channels</h2>
                    <p className="text-sm text-slate-600">Select channels, drag to reorder draw order, and edit names, units, colors, and y-axis limits. Lower channels draw on top.</p>
                  </div>
                  <div className="text-sm font-medium text-slate-500">{selectedKeys.length} selected</div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {trend.columns.map((column) => {
                    const selected = selectedKeys.includes(column.key);
                    return (
                      <div
                        key={column.key}
                        draggable
                        onDragStart={() => setDraggedChannelKey(column.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          reorderChannel(draggedChannelKey, column.key);
                          setDraggedChannelKey(null);
                        }}
                        onDragEnd={() => setDraggedChannelKey(null)}
                        title="Drag this channel card to reorder the graph draw order. Channels lower in the list are drawn later and appear on top."
                        className={`cursor-grab rounded-2xl border p-3 active:cursor-grabbing ${selected ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"} ${draggedChannelKey === column.key ? "opacity-60 ring-2 ring-slate-300" : ""}`}
                      >
                        <label className="mb-3 flex cursor-pointer items-center gap-3" title="Toggle whether this channel is displayed on the graph and included in the visible statistics.">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleChannel(column.key)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: column.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{column.displayName}</span>
                        </label>

                        <div className="grid gap-2">
                          <div className="grid grid-cols-[1fr_0.42fr] gap-2">
                            <label>
                              <FieldLabel hint="Display name used in the legend, tooltip, statistics cards, and graph export.">Name</FieldLabel>
                              <input
                                title={`Original header: ${column.originalName}`}
                                value={column.displayName}
                                onChange={(event) => updateColumn(column.key, { displayName: event.target.value })}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                            </label>
                            <label>
                              <FieldLabel hint="Engineering unit shown on this channel's y-axis and in tooltips.">Unit</FieldLabel>
                              <input
                                title="Examples: pH, rpm, L/min, %, °C, mL. Leave blank for unitless signals."
                                value={column.unit}
                                onChange={(event) => updateColumn(column.key, { unit: event.target.value })}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-[0.36fr_1fr_1fr] gap-2">
                            <label>
                              <FieldLabel hint="Trace and y-axis color for this channel.">Color</FieldLabel>
                              <input
                                title="Choose the color used for this channel's line, axis ticks, and labels."
                                type="color"
                                value={column.color}
                                onChange={(event) => updateColumn(column.key, { color: event.target.value })}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2"
                              />
                            </label>
                            <label>
                              <FieldLabel hint="Optional lower limit for this channel's y-axis. Leave blank for automatic scaling.">Y min</FieldLabel>
                              <input
                                title="Only applies to this channel. Leave blank for automatic scaling."
                                type="number"
                                value={column.yMin}
                                onChange={(event) => updateColumn(column.key, { yMin: event.target.value })}
                                placeholder="auto"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                              />
                            </label>
                            <label>
                              <FieldLabel hint="Optional upper limit for this channel's y-axis. Leave blank for automatic scaling.">Y max</FieldLabel>
                              <input
                                title="Only applies to this channel. Leave blank for automatic scaling."
                                type="number"
                                value={column.yMax}
                                onChange={(event) => updateColumn(column.key, { yMax: event.target.value })}
                                placeholder="auto"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>

            <main className="order-1 min-w-0 space-y-4">
              <section className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
                <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Trend graph</h2>
                    <p className="text-sm text-slate-600">
                      Each selected trace is bound to its own left-side y-axis. The plot keeps a minimum width so added axes do not compress the trend area.
                    </p>
                  </div>
                </div>

                {selectedKeys.length === 0 ? (
                  <div className="grid h-[620px] place-items-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-500">
                    Select at least one channel.
                  </div>
                ) : (
                  <div ref={chartExportRef} className="h-[min(78vh,900px)] min-h-[720px] w-full overflow-x-auto rounded-2xl bg-white pt-1">
                    <div className="h-full" style={{ width: chartContentWidth, minWidth: "100%" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartRows} margin={chartMargin}>
                        {graphTitle.trim() && (
                          <text
                            x="50%"
                            y={Math.max(28, graphTitleFontSize + 4)}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={graphTitleFontSize}
                            fontWeight={700}
                            fill="#0f172a"
                          >
                            {graphTitle}
                          </text>
                        )}
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="__elapsedHours"
                          type="number"
                          domain={[xStartNumber, xEndNumber]}
                          ticks={xTicks}
                          interval={0}
                          tick={{ fontSize: axisNumberFontSize, fill: "#475569" }}
                          tickFormatter={(value) => value % 10 === 0 ? niceNumber(value, 0) : ""}
                          label={{
                            value: "Elapsed time (h)",
                            position: "insideBottom",
                            offset: -18,
                            fontSize: axisLabelFontSize,
                            fontWeight: 700,
                            fill: "#0f172a",
                          }}
                        />
                        {selectedColumns.map((column, index) => (
                          <YAxis
                            key={column.key}
                            yAxisId={column.key}
                            orientation="left"
                            domain={getAxisDomain(column)}
                            tickFormatter={(value) => niceNumber(value, 2)}
                            tick={{ fill: column.color, fontSize: axisNumberFontSize }}
                            axisLine={{ stroke: column.color }}
                            tickLine={{ stroke: column.color }}
                            width={axisWidth}
                            allowDataOverflow={hasManualAxisDomain(column)}
                            label={{
                              value: `${column.displayName}${column.unit ? ` (${column.unit})` : ""}`,
                              angle: -90,
                              position: "top",
                              fontSize: axisLabelFontSize,
                              fontWeight: 700,
                              fill: column.color,
                              offset: 12,
                              dx: -14,
                              dy: 18,
                            }}
                          />
                        ))}
                        <Tooltip
                          content={<CustomTooltip columnsByKey={columnsByKey} />}
                          labelFormatter={(value) => niceNumber(value, 2)}
                        />
                        {selectedColumns.map((column) => (
                          <Line
                            key={column.key}
                            yAxisId={column.key}
                            type="monotone"
                            dataKey={column.key}
                            name={`${column.displayName}${column.unit ? ` (${column.unit})` : ""}`}
                            stroke={column.color}
                            strokeWidth={2}
                            dot={showDots ? { r: 2 } : false}
                            activeDot={{ r: 5 }}
                            connectNulls
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </section>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
