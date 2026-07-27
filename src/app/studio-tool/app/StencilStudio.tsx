"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SIDE = 1100;
const PAPER = { r: 246, g: 243, b: 238 };
const INKS = {
  violet: { r: 76, g: 29, b: 149, label: "Thermal violet" },
  black: { r: 20, g: 18, b: 16, label: "Ink black" },
} as const;

type Mode = "lines" | "ink";
type InkColor = keyof typeof INKS;

// ─── IMAGE PIPELINE (all client-side, nothing leaves the browser) ────────────

function toGray(img: ImageData): Float32Array {
  const { data, width, height } = img;
  const g = new Float32Array(width * height);
  for (let i = 0; i < g.length; i++) {
    const o = i * 4;
    g[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return g;
}

function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

function sobel(gray: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(gray.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1], t = gray[i - w], tr = gray[i - w + 1];
      const l = gray[i - 1], r = gray[i + 1];
      const bl = gray[i + w - 1], b = gray[i + w], br = gray[i + w + 1];
      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

function dilate(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (
        mask[i] ||
        (x > 0 && mask[i - 1]) ||
        (x < w - 1 && mask[i + 1]) ||
        (y > 0 && mask[i - w]) ||
        (y < h - 1 && mask[i + w])
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

function buildStencil(
  source: ImageData,
  mode: Mode,
  detail: number, // 0..100 — higher keeps more detail
  weight: number, // 0..3 dilation passes
  ink: InkColor
): ImageData {
  const { width: w, height: h } = source;
  const gray = boxBlur(toGray(source), w, h);
  let mask: Uint8Array = new Uint8Array(w * h);

  if (mode === "lines") {
    const mag = sobel(gray, w, h);
    // detail 0..100 → threshold ~220..30 (lower threshold keeps more edges)
    const thr = 220 - (detail / 100) * 190;
    for (let i = 0; i < mask.length; i++) mask[i] = mag[i] > thr ? 1 : 0;
  } else {
    // ink mode: dark regions become solid ink
    const thr = 30 + (detail / 100) * 170;
    for (let i = 0; i < mask.length; i++) mask[i] = gray[i] < thr ? 1 : 0;
  }

  for (let k = 0; k < weight; k++) mask = dilate(mask, w, h);

  const out = new ImageData(w, h);
  const c = INKS[ink];
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    if (mask[i]) {
      out.data[o] = c.r;
      out.data[o + 1] = c.g;
      out.data[o + 2] = c.b;
    } else {
      out.data[o] = PAPER.r;
      out.data[o + 1] = PAPER.g;
      out.data[o + 2] = PAPER.b;
    }
    out.data[o + 3] = 255;
  }
  return out;
}

// ─── UI ──────────────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  hintLow,
  hintHigh,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hintLow: string;
  hintHigh: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-stone-200">{label}</span>
        <span className="tabular-nums text-stone-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-500"
      />
      <div className="mt-1 flex justify-between text-[11px] text-stone-600">
        <span>{hintLow}</span>
        <span>{hintHigh}</span>
      </div>
    </label>
  );
}

export default function StencilStudio() {
  const [sourceData, setSourceData] = useState<ImageData | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("stencil");
  const [mode, setMode] = useState<Mode>("lines");
  const [detail, setDetail] = useState(60);
  const [weight, setWeight] = useState(1);
  const [ink, setInk] = useState<InkColor>("violet");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setFileName(file.name.replace(/\.[^.]+$/, "") || "stencil");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      setSourceData(ctx.getImageData(0, 0, w, h));
      setSourceUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    };
    img.src = url;
  }, []);

  // re-render stencil whenever inputs change
  useEffect(() => {
    if (!sourceData || !canvasRef.current) return;
    setBusy(true);
    const id = window.setTimeout(() => {
      const result = buildStencil(sourceData, mode, detail, weight, ink);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = result.width;
        canvas.height = result.height;
        canvas.getContext("2d")!.putImageData(result, 0, 0);
      }
      setBusy(false);
    }, 30);
    return () => window.clearTimeout(id);
  }, [sourceData, mode, detail, weight, ink]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${fileName}-stencil.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [fileName]);

  return (
    <div dir="ltr" className="min-h-screen bg-stone-950 font-sans text-stone-200">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-stone-950/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="/studio-tool" className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
              <rect x="1" y="1" width="30" height="30" rx="8" className="fill-violet-600" />
              <path d="M8 9l8 15 8-15" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-stone-100">
              Vain&rsquo;s Studio Tool
            </span>
          </a>
          <a href="/studio-tool" className="text-sm text-stone-400 transition-colors hover:text-stone-100">
            ← Back to site
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">
            Stencil Studio
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium text-stone-50 sm:text-4xl">
            Make your stencil
          </h1>
          <p className="mt-3 text-stone-400">
            Upload a design, tune the detail and line weight, download the stencil. Everything
            runs in your browser — the image never leaves your device.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* controls */}
          <aside className="space-y-7 rounded-2xl border border-white/5 bg-white/[0.03] p-6 self-start">
            <div>
              <span className="mb-2 block text-sm font-medium text-stone-200">Extraction mode</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["lines", "Lines", "Edge outline — best for photos & color art"],
                    ["ink", "Ink", "Solid dark areas — best for blackwork & sketches"],
                  ] as const
                ).map(([key, label, hint]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    title={hint}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      mode === key
                        ? "border-violet-500/60 bg-violet-600/20 text-violet-200"
                        : "border-white/10 text-stone-400 hover:border-white/20 hover:text-stone-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-stone-600">
                {mode === "lines"
                  ? "Traces edges — best for photos and full-color references."
                  : "Keeps solid dark areas — best for blackwork and pencil sketches."}
              </p>
            </div>

            <Slider
              label="Detail"
              value={detail}
              min={0}
              max={100}
              onChange={setDetail}
              hintLow="loose guide"
              hintHigh="every whisker"
            />
            <Slider
              label="Line weight"
              value={weight}
              min={0}
              max={3}
              onChange={setWeight}
              hintLow="hairline"
              hintHigh="bold"
            />

            <div>
              <span className="mb-2 block text-sm font-medium text-stone-200">Stencil ink</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(INKS) as InkColor[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setInk(key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      ink === key
                        ? "border-violet-500/60 bg-violet-600/20 text-violet-200"
                        : "border-white/10 text-stone-400 hover:border-white/20 hover:text-stone-200"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ background: `rgb(${INKS[key].r},${INKS[key].g},${INKS[key].b})` }}
                    />
                    {INKS[key].label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={download}
              disabled={!sourceData}
              className="w-full rounded-full bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download stencil PNG
            </button>
            {sourceData && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-stone-300 transition-colors hover:border-violet-500/40 hover:text-white"
              >
                Upload a different design
              </button>
            )}
          </aside>

          {/* workspace */}
          <section>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
            {!sourceData ? (
              <button
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) loadFile(f);
                }}
                className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-colors ${
                  dragOver
                    ? "border-violet-500/70 bg-violet-600/10"
                    : "border-white/10 bg-white/[0.02] hover:border-violet-500/40"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-10 w-10 text-violet-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
                </svg>
                <span className="font-medium text-stone-200">
                  Drop a design here, or click to browse
                </span>
                <span className="text-sm text-stone-500">
                  JPG, PNG, HEIC — photos of paper sketches work fine
                </span>
              </button>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <figure>
                  <figcaption className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
                    Design
                  </figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceUrl!}
                    alt="Uploaded design"
                    className="w-full rounded-2xl border border-white/10"
                  />
                </figure>
                <figure>
                  <figcaption className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-400">
                    Stencil
                    {busy && (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                    )}
                  </figcaption>
                  <canvas
                    ref={canvasRef}
                    className="w-full rounded-2xl border border-stone-300/30 bg-[#f6f3ee]"
                  />
                </figure>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
