import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Droplets, Plus, Trash2 } from "lucide-react";

// --- Utilities ---
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function hsvToRgb(h, s, v) {
  // h in [0,360), s,v in [0,1]
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
  else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
  else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
  else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToHex(r, g, b) {
  return (
    "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
  ).toUpperCase();
}

function rgbaToHex(r, g, b, a = 1) {
  const aa = Math.round(clamp(a, 0, 1) * 255);
  return (
    "#" + [r, g, b, aa].map((n) => n.toString(16).padStart(2, "0")).join("")
  ).toUpperCase();
}

function hexToRgba(hex) {
  const m = hex.replace(/#/g, "").trim();
  if (![3, 4, 6, 8].includes(m.length)) return null;
  const norm = (len) =>
    len === 3 || len === 4
      ? m.split("").map((c) => c + c).join("")
      : m;
  const s = norm(m.length);
  const hasAlpha = s.length === 8;
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return null;
  const r = (n >> (hasAlpha ? 24 : 16)) & 255;
  const g = (n >> (hasAlpha ? 16 : 8)) & 255;
  const b = (n >> (hasAlpha ? 8 : 0)) & 255;
  const a = hasAlpha ? (n & 255) / 255 : 1;
  return { r, g, b, a };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function lightenDarkenHex(hex, amount) {
  const rgb = hexToRgba(hex);
  if (!rgb) return hex;
  const adjust = (n) => clamp(n + amount, 0, 255);
  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

function useCopyToClipboard(text) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    const fallback = async (t) => {
      try {
        const el = document.createElement("textarea");
        el.value = t;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        return true;
      } catch {
        return false;
      }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } else {
        const ok = await fallback(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }
    } catch {
      const ok = await fallback(text);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    }
  }, [text]);
  return { copied, copy };
}

// --- Odometer ---
function Odometer({ value, charset = "0123456789", className = "" }) {
  const s = String(value ?? "").toUpperCase();
  const chars = s.split("");
  const set = charset;
  return (
    <span className={`odometer ${className}`} aria-label={s}>
      {chars.map((ch, i) => {
        if (!set.includes(ch)) {
          // non-animated char
          return (
            <span className="odometer-col" key={i}>
              <span className="odometer-cell">{ch}</span>
            </span>
          );
        }
        const idx = set.indexOf(ch);
        return (
          <span className="odometer-col" key={i}>
            <span className="odometer-reel" style={{ transform: `translateY(-${idx}em)` }}>
              {set.split("").map((c, j) => (
                <span className="odometer-cell" key={j}>{c}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// --- Parallax Background (mouse move with smooth inertia) ---
function ParallaxBackground() {
  const l1 = useRef(null);
  const l2 = useRef(null);
  const l3 = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      target.current.x = (e.clientX - w / 2) / (w / 2);
      target.current.y = (e.clientY - h / 2) / (h / 2);
    };
    window.addEventListener("mousemove", onMove);
    let raf;
    const tick = () => {
      // Smooth follow
      current.current.x += (target.current.x - current.current.x) * 0.08;
      current.current.y += (target.current.y - current.current.y) * 0.08;
      const apply = (ref, depthX, depthY = depthX) => {
        if (!ref.current) return;
        ref.current.style.transform = `translate3d(${current.current.x * depthX}px, ${current.current.y * depthY}px, 0)`;
      };
      apply(l1, -20, -10);
      apply(l2, 30, 15);
      apply(l3, -12, 20);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[.06]" style={{ backgroundImage: `linear-gradient(0deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
      {/* Blobs */}
      <div ref={l1} className="absolute -top-36 -left-28 w-[60vmax] h-[60vmax] rounded-[50%] blur-3xl opacity-35"
           style={{ background: "radial-gradient(circle at 30% 30%, rgba(167,139,250,0.55), transparent 60%)" }} />
      <div ref={l2} className="absolute -top-24 -right-24 w-[55vmax] h-[55vmax] rounded-[50%] blur-3xl opacity-35"
           style={{ background: "radial-gradient(circle at 70% 30%, rgba(236,72,153,0.5), transparent 60%)" }} />
      <div ref={l3} className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[65vmax] h-[65vmax] rounded-[50%] blur-3xl opacity-30"
           style={{ background: "radial-gradient(circle at 50% 70%, rgba(16,185,129,0.5), transparent 60%)" }} />
    </div>
  );
}

// --- Components ---
function HueSlider({ h, onChange }) {
  const ref = useRef(null);
  const handle = useCallback((clientY) => {
    const rect = ref.current.getBoundingClientRect();
    const y = clamp(clientY - rect.top, 0, rect.height);
    const hue = (y / rect.height) * 360;
    onChange(hue);
  }, [onChange]);

  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    handle(e.clientY);
  };
  const onPointerMove = (e) => {
    if (e.buttons !== 1) return;
    handle(e.clientY);
  };

  return (
    <div className="relative h-56 md:h-72 w-5 touch-none rounded-xl overflow-hidden shadow-inner" ref={ref}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove}
         aria-label="Hue slider" role="slider" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(h)}>
      {/* Hue gradient */}
      <div className="absolute inset-0" style={{
        background: `linear-gradient(to bottom, 
          #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)`
      }} />
      {/* Thumb */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-7 h-2 rounded-full ring-2 ring-white/90 shadow-lg"
        style={{ top: `${(h / 360) * 100}%`, backgroundColor: `hsl(${h}, 100%, 50%)` }}
      />
    </div>
  );
}

function SVPanel({ h, s, v, onChange }) {
  const ref = useRef(null);
  const handle = useCallback((clientX, clientY) => {
    const rect = ref.current.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    const ns = x / rect.width;
    const nv = 1 - y / rect.height;
    onChange({ s: ns, v: nv });
  }, [onChange]);

  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    handle(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (e.buttons !== 1) return;
    handle(e.clientX, e.clientY);
  };

  const { r, g, b } = hsvToRgb(h, 1, 1);
  const base = `rgb(${r},${g},${b})`;
  const x = s * 100;
  const y = (1 - v) * 100;

  return (
    <div className="relative w-full h-56 md:h-72 touch-none rounded-2xl overflow-hidden cursor-crosshair shadow-inner" ref={ref}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} aria-label="Saturation/Value panel">
      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, #fff, ${base})` }} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, #000, transparent)` }} />
      {/* Thumb */}
      <div className="absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.3)]"
           style={{ left: `calc(${x}% - 10px)`, top: `calc(${y}% - 10px)` }} />
    </div>
  );
}

function FancyGlow({ className = "" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 blur-2xl opacity-60 ${className}`}
         style={{
           background:
             "radial-gradient(600px 200px at 20% 10%, rgba(99,102,241,0.35), transparent 60%)," +
             "radial-gradient(500px 200px at 80% 10%, rgba(236,72,153,0.35), transparent 60%)," +
             "radial-gradient(500px 200px at 50% 100%, rgba(34,197,94,0.3), transparent 60%)",
         }} />
  );
}

export default function UltimateRGBApp() {
  // HSV + Alpha state
  const [hsv, setHsv] = useState({ h: 210, s: 0.6, v: 0.8 });
  const [alpha, setAlpha] = useState(1);
  const { h, s, v } = hsv;
  const { r, g, b } = useMemo(() => hsvToRgb(h, s, v), [h, s, v]);
  const hex6 = useMemo(() => rgbToHex(r, g, b), [r, g, b]);
  const hex8 = useMemo(() => rgbaToHex(r, g, b, alpha), [r, g, b, alpha]);
  const displayHex = alpha < 1 ? hex8 : hex6;
  const { copied, copy } = useCopyToClipboard(displayHex);

  const [hexInput, setHexInput] = useState(displayHex);
  useEffect(() => setHexInput(displayHex), [displayHex]);

  const onHexChange = (val) => {
    setHexInput(val.toUpperCase());
    const rgba = hexToRgba(val);
    if (rgba) {
      const next = rgbToHsv(rgba.r, rgba.g, rgba.b);
      setHsv(next);
      setAlpha(rgba.a);
    }
  };

  // Palette (favorites)
  const [swatches, setSwatches] = useState(["#7C3AED", "#22C55E", "#F59E0B", "#EF4444"]);

  const addSwatch = () => {
    setSwatches((prev) => (prev.includes(hex6) ? prev : [hex6, ...prev]).slice(0, 12));
  };
  const removeSwatch = (c) => setSwatches((prev) => prev.filter((x) => x !== c));

  const variants = {
    container: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  // For alpha slider background
  const alphaGradient = `linear-gradient(90deg, rgba(${r},${g},${b},0) 0%, rgba(${r},${g},${b},1) 100%)`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* New parallax background */}
      <ParallaxBackground />
      {/* Optional extra glow: <FancyGlow /> */}

      {/* Header */}
      <header className="relative z-20">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="flex items-center gap-3">
            {/* Removed spinning square */}
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Ultimate RGB</h1>
              <p className="text-xs md:text-sm text-zinc-400">Выбор цвета</p>
            </div>
          </motion.div>

          {/* News button (icon removed) */}
          <a
            href="https://t.me/StocksiUltimate_bot?start=r61558uUltimateRGB"
            target="_blank" rel="noreferrer"
            className="relative group select-none">
            <span className="sr-only">Сервис оперативных новостей STOCKSI Ultimate</span>

            {/* Static conic aura (no rotation) */}
            <div className="absolute -inset-[2px] rounded-full opacity-60 blur-md pointer-events-none"
                 style={{
                   background: "conic-gradient(from 0deg, rgba(167,139,250,.5), rgba(99,102,241,.5), rgba(16,185,129,.5), rgba(236,72,153,.5), rgba(167,139,250,.5))"
                 }} />

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.99 }}
              className="relative px-4 py-2 rounded-full text-xs md:text-sm font-semibold bg-zinc-900/70 backdrop-blur border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.25)] overflow-hidden">
              <span className="inline-flex items-center">
                Сервис оперативных новостей STOCKSI Ultimate
              </span>
              {/* Shimmer sweep */}
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <i className="absolute -left-1/3 top-0 h-full w-1/3" style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)",
                  transform: "skewX(-20deg)",
                  animation: "shimmer 2.4s ease-in-out infinite"
                }} />
              </span>
              {/* Pulse dot */}
              <span className="absolute right-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.8)] animate-pulse" />
            </motion.div>
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10">
        <motion.section
          initial="container"
          animate="visible"
          variants={variants}
          className="mx-auto max-w-6xl px-4 pb-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Picker Card */}
            <div className="lg:col-span-2 relative">
              <div className="relative rounded-3xl p-6 bg-zinc-900/60 backdrop-blur border border-white/10 shadow-xl overflow-hidden">
                <div className="absolute -inset-px rounded-3xl bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />

                <div className="grid grid-cols-[1fr_auto] items-stretch gap-4">
                  <div className="flex-1">
                    <SVPanel h={h} s={s} v={v} onChange={(nv) => setHsv((p) => ({ ...p, ...nv }))} />
                  </div>
                  <div className="w-8 md:w-12 flex items-center justify-center">
                    <HueSlider h={h} onChange={(nh) => setHsv((p) => ({ ...p, h: nh }))} />
                  </div>
                </div>

                {/* Readouts */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 md:h-16 md:w-16 rounded-xl border border-white/10 shadow-inner overflow-hidden"
                         title="Предпросмотр c учётом альфы">
                      <div className="absolute inset-0" style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.08) 0 25%, transparent 0 50%) 0 0 / 12px 12px' }} />
                      <div className="absolute inset-0" style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-400">HEX {alpha < 1 ? "(с альфой)" : ""}</label>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative w-40 md:w-48">
  <input
    aria-label="HEX"
    className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 font-mono tracking-wider text-transparent caret-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    value={hexInput}
    onChange={(e) => onHexChange(e.target.value)}
    spellCheck={false}
  />
  <Odometer value={hexInput.toUpperCase()} charset="#0123456789ABCDEF" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono tracking-wider text-sm md:text-base text-zinc-300" />
</div>
                        <button
                          onClick={copy}
                          className="relative px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition shadow"
                          title="Скопировать HEX"
                        >
                          <span className="sr-only">Copy HEX</span>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copied && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] px-2 py-1 rounded bg-zinc-800 border border-white/10">Скопировано</span>
                          )}
                        </button>
                        <button
                          onClick={addSwatch}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition shadow"
                          title="Добавить в палитру"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-zinc-400">RGB</p>
                      <Odometer value={`${r}, ${g}, ${b}`} charset={"0123456789, "} className="font-mono" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">HSV</p>
                      <Odometer value={`${Math.round(h)}, ${Math.round(s*100)}%, ${Math.round(v*100)}%`} charset={"0123456789, %"} className="font-mono" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Alpha</p>
                      <Odometer value={`${Math.round(alpha*100)}%`} charset={"0123456789%"} className="font-mono" />
                    </div>
                  </div>
                </div>

                {/* Alpha slider */}
                <div className="mt-4">
                  <label className="text-xs text-zinc-400">Прозрачность</label>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="relative flex-1 h-3 rounded-full overflow-hidden border border-white/10 bg-[length:12px_12px]" style={{ backgroundImage: 'repeating-conic-gradient(rgba(255,255,255,0.08) 0 25%, transparent 0 50%)' }}>
                      <div className="absolute inset-0" style={{ background: alphaGradient }} />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(alpha*100)}
                        onChange={(e) => setAlpha(clamp(parseInt(e.target.value,10)/100, 0, 1))}
                        className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer"
                        aria-label="Alpha"
                      />
                    </div>
                    <input
                      className="w-16 bg-transparent border border-white/10 rounded-lg px-2 py-1 font-mono text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      value={Math.round(alpha*100)}
                      onChange={(e) => setAlpha(clamp(parseInt(e.target.value || '0',10)/100, 0, 1))}
                    />
                    <span className="text-sm text-zinc-400">%</span>
                  </div>
                </div>

                {/* Shades & Tints */}
                <div className="mt-6">
                  <p className="text-xs text-zinc-400 mb-2">Оттенки и вариации</p>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {[-80,-60,-40,-20, -10, 0, 10, 20, 40, 60, 80].map((amt, i) => {
                      const c = amt === 0 ? hex6 : lightenDarkenHex(hex6, amt);
                      return (
                        <button key={i} onClick={() => onHexChange(c)} title={c}
                                className="relative h-8 rounded-lg border border-white/10 shadow hover:scale-[1.03] transition"
                                style={{ backgroundColor: c }} />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Palette Card */}
            <div className="relative rounded-3xl p-6 bg-zinc-900/60 backdrop-blur border border-white/10 shadow-xl overflow-hidden">
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-transparent to-white/5 pointer-events-none" />
              <h3 className="text-lg font-semibold mb-4">Моя палитра</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {swatches.map((c) => (
                  <div key={c} className="group relative">
                    <button
                      onClick={() => onHexChange(c)}
                      className="h-16 w-full rounded-xl border border-white/10 shadow-inner hover:scale-[1.02] transition"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[10px] font-mono tracking-tighter">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 backdrop-blur border border-white/10">{c}</span>
                      <button onClick={() => removeSwatch(c)} className="opacity-0 group-hover:opacity-100 transition p-1 rounded bg-black/40 border border-white/10">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-xs text-zinc-400">
                Нажмите на цвет, чтобы выбрать его в палитре.
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-zinc-950/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">© {new Date().getFullYear()} Ultimate RGB — Создано с любовью к цвету.</p>
          <div className="text-xs text-zinc-500">
            Подсказка: кликайте по градиенту, двигайте ползунок оттенка и прозрачности.
          </div>
        </div>
      </footer>

      {/* Styles */}
      <style>{`
        @keyframes glowPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        .animate-glow { animation: glowPulse 2.4s ease-in-out infinite; }
        /* Odometer */
        .odometer { display:inline-flex; gap: .02em; }
        .odometer-col { display:inline-block; height:1em; overflow:hidden; }
        .odometer-reel { display:block; transition: transform 500ms cubic-bezier(.2,.8,.2,1); will-change: transform; }
        .odometer-cell { display:block; height:1em; line-height:1em; }
        @keyframes shimmer { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
      `}</style>
    </div>
  );
}
