import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Plus, Droplet, Palette, ArrowUpRight } from "lucide-react";

// ---- Document head: title, meta, icons (as early as possible) ----
if (typeof document !== "undefined") {
  try {
    document.title = "Ultimate RGB";

    const ensure = (selector, create) => {
      let el = document.querySelector(selector);
      if (!el) { el = create(); document.head.appendChild(el); }
      return el;
    };

    // Description
    const metaDesc = ensure('meta[name="description"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      return m;
    });
    metaDesc.setAttribute('content', 'Ultimate RGB — онлайн-подбор цветов с HEX, RGBA, прозрачностью (Alpha), оттенками и личной палитрой.');

    // Open Graph / Twitter
    const setProp = (prop, content) => {
      const el = ensure(`meta[property="${prop}"]`, () => { const m = document.createElement('meta'); m.setAttribute('property', prop); return m; });
      el.setAttribute('content', content);
    };
    const setName = (name, content) => {
      const el = ensure(`meta[name="${name}"]`, () => { const m = document.createElement('meta'); m.setAttribute('name', name); return m; });
      el.setAttribute('content', content);
    };

    setProp('og:title', 'Ultimate RGB');
    setProp('og:description', 'Онлайн-подбор цветов с HEX, RGBA и Alpha.');
    setName('twitter:card', 'summary');
    setName('twitter:title', 'Ultimate RGB');
    setName('twitter:description', 'Онлайн-подбор цветов с HEX, RGBA и Alpha.');

    // Small inline SVG logo as data URL for icons / previews
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#ff316b'/><stop offset='1' stop-color='#6a00ff'/></linearGradient></defs><path d='M16 10 v26 a16 16 0 0 0 32 0 V10' fill='none' stroke='url(#g)' stroke-width='16' stroke-linecap='round'/></svg>`;
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

    setProp('og:image', dataUrl);
    setName('twitter:image', dataUrl);

    const linkIcon = ensure('link[rel="icon"]', () => { const l = document.createElement('link'); l.setAttribute('rel','icon'); return l; });
    linkIcon.setAttribute('href', dataUrl);

    const appleIcon = ensure('link[rel="apple-touch-icon"]', () => { const l = document.createElement('link'); l.setAttribute('rel','apple-touch-icon'); return l; });
    appleIcon.setAttribute('href', dataUrl);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }
}

// ---------- Цветовые утилиты ----------
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function hsvToRgb(h, s, v) {
  s = clamp(s, 0, 1);
  v = clamp(v, 0, 1);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1, g1, b1;
  if (h >= 0 && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h >= 60 && h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h >= 120 && h < 180) [r1, g1, b1] = [0, c, x];
  else if (h >= 180 && h < 240) [r1, g1, b1] = [0, x, c];
  else if (h >= 240 && h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * (((b - r) / d) + 2);
  else h = 60 * (((r - g) / d) + 4);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function rgbToHex(r, g, b) {
  return [r, g, b]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function hexToRgba(hex) {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length === 6) h = h + "FF"; // непрозрачный по умолчанию
  if (h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = parseInt(h.slice(6, 8), 16) / 255;
  return { r, g, b, a };
}

function rgbaToCss({ r, g, b, a }) {
  return `rgba(${r}, ${g}, ${b}, ${clamp(a, 0, 1).toFixed(3)})`;
}

function withAlphaToHex8(r, g, b, a) {
  const rgb = rgbToHex(r, g, b);
  const alpha = Math.round(clamp(a, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return rgb + alpha;
}

// Карточка с шахматной подложкой для прозрачности
function Checkerboard({ className = "", children, dark = false }) {
  const tile = dark ? "#2c2c2c" : "#e5e7eb";
  const style = {
    background:
      "conic-gradient(" + tile + " 25%,transparent 0 50%," + tile + " 0 75%,transparent 0) 0 0/16px 16px",
  };
  return (
    <div className={"rounded-2xl " + className} style={style}>
      {children}
    </div>
  );
}


// Оdometer-анимация для меняющихся строк/чисел (медленнее)
function OdometerText({ value, className = "", duration = 0.5 }) {
  const text = String(value);
  const chars = text.split("");
  return (
    <span className={`font-mono tracking-wider inline-flex ${className}`}>
      {chars.map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden w-[1ch] h-[1em] align-baseline">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${i}-${ch}`}
              initial={{ y: "1em", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-1em", opacity: 0 }}
              transition={{ duration, ease: "easeOut" }}
              className="absolute inset-0 leading-none"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

// Фоновая анимация — «Aurora» на основе текущего цвета
function BackgroundFX({ h, s, v, a }) {
  // Надёжная версия: частицы-орбиты на чистом CSS (без зависимостей от runtime)
  // Три кольца, цвета завязаны на текущий Hue
  const colA = `hsla(${h}, 85%, 60%, 0.24)`;
  const colB = `hsla(${(h + 60) % 360}, 80%, 58%, 0.20)`;
  const colC = `hsla(${(h + 300) % 360}, 72%, 55%, 0.18)`;

  const rings = [
    { count: 18, radius: '18vmax', color: colA, dur: '80s', reverse: false, sizeBase: 9 },
    { count: 24, radius: '28vmax', color: colB, dur: '110s', reverse: true,  sizeBase: 8 },
    { count: 30, radius: '38vmax', color: colC, dur: '140s', reverse: false, sizeBase: 7 },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {/* Встраиваем keyframes один раз */}
      <style>{`
        @keyframes orbit360 { to { transform: rotate(360deg); } }
        .orbital-ring { position:absolute; will-change: transform; }
        .orbital-anim { animation: orbit360 var(--dur) linear infinite; }
        .orbital-anim.reverse { animation-direction: reverse; }
      `}</style>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {rings.map((ring, ri) => (
          <div
            key={ri}
            className={`orbital-ring orbital-anim ${ring.reverse ? 'reverse' : ''}`}
            style={{ ['--dur']: ring.dur }}
          >
            {Array.from({ length: ring.count }).map((_, i) => {
              const angle = (360 / ring.count) * i;
              const size = ring.sizeBase + (i % 6);
              return (
                <span
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    top: 0,
                    left: 0,
                    transform: `rotate(${angle}deg) translateX(${ring.radius})`,
                    width: size,
                    height: size,
                    background: `radial-gradient(circle at 50% 50%, ${ring.color} 0%, transparent 70%)`,
                    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.12))',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Основной компонент ----------
export default function UltimateRGB() {
  // Только тёмная тема
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("dark");
    }
  }, []);
  const isDark = true;

  // HSV + A — базовая модель состояния
  const [h, setH] = useState(210); // 0..360
  const [s, setS] = useState(0.6); // 0..1
  const [v, setV] = useState(0.8); // 0..1
  const [a, setA] = useState(1); // 0..1

  const [hexInput, setHexInput] = useState("");
  const [hexError, setHexError] = useState("");
  const [hexFocused, setHexFocused] = useState(false);

  const [copied, setCopied] = useState(""); // "hex" | "rgba" | "cssvar" | "error"
  const [palette, setPalette] = useState(() => {
    try {
      const saved = localStorage.getItem("ultimatergb_palette");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      "#FF6B6B",
      "#FFD166",
      "#06D6A0",
      "#118AB2",
      "#8A5CF6",
      "#F72585",
      "#3A0CA3",
      "#4CC9F0",
      "#2A9D8F",
      "#E76F51",
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem("ultimatergb_palette", JSON.stringify(palette));
    } catch {}
  }, [palette]);

  const rgb = useMemo(() => hsvToRgb(h, s, v), [h, s, v]);
  const rgba = useMemo(() => ({ ...rgb, a }), [rgb, a]);
  const css = useMemo(() => rgbaToCss(rgba), [rgba]);
  const hex6 = useMemo(() => rgbToHex(rgb.r, rgb.g, rgb.b), [rgb]);
  const hex8 = useMemo(() => withAlphaToHex8(rgb.r, rgb.g, rgb.b, a), [rgb, a]);

  // синхронизируем поле HEX при изменении цвета (если пользователь не редактирует)
  useEffect(() => {
    if (!hexFocused) {
      setHexInput("#" + hex8);
      setHexError("");
    }
  }, [hex8, hexFocused]);

  // обработка вставки HEX
  function onHexChange(val) {
    setHexInput(val);
    const rgbaParsed = hexToRgba(val);
    if (!rgbaParsed) {
      setHexError("Неверный HEX (используйте #RRGGBB или #RRGGBBAA)");
      return;
    }
    setHexError("");
    const { r, g, b, a: aa } = rgbaParsed;
    const { h: hh, s: ss, v: vv } = rgbToHsv(r, g, b);
    setH(hh);
    setS(ss);
    setV(vv);
    setA(aa);
  }

  // Копирование в буфер (надёжный вариант + fallback)
  async function copy(text, type) {
    let ok = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        throw new Error("clipboard api unavailable");
      }
    } catch (e1) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const res = document.execCommand("copy");
        document.body.removeChild(ta);
        ok = !!res;
      } catch (e2) {
        ok = false;
      }
    }
    setCopied(ok ? type : "error");
    setTimeout(() => setCopied(""), 1400);
  }

  // ---------- UI-хелперы ----------
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const alphaRef = useRef(null);

  function handlePointer(containerRef, e, onUpdate) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    onUpdate(x, y);
  }

  // Перетаскивание по SV-полю
  function onSvPointerDown(e) {
    e.preventDefault();
    handlePointer(svRef, e, (x, y) => {
      setS(x);
      setV(1 - y);
    });
    const move = (ev) => handlePointer(svRef, ev, (x, y) => {
      setS(x);
      setV(1 - y);
    });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onHuePointerDown(e) {
    e.preventDefault();
    handlePointer(hueRef, e, (x) => setH(Math.round(x * 360)));
    const move = (ev) => handlePointer(hueRef, ev, (x) => setH(Math.round(x * 360)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onAlphaPointerDown(e) {
    e.preventDefault();
    handlePointer(alphaRef, e, (x) => setA(x));
    const move = (ev) => handlePointer(alphaRef, ev, (x) => setA(x));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const hueGradient = {
    background:
      "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
  };

  const alphaGradient = {
    background: `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b},0) 0%, rgba(${rgb.r},${rgb.g},${rgb.b},1) 100%)`,
  };

  const svBg = {
    background: `hsl(${h} 100% 50%)`,
  };

  const svPointer = {
    left: `${s * 100}%`,
    top: `${(1 - v) * 100}%`,
  };

  const huePointer = {
    left: `${(h / 360) * 100}%`,
  };

  const alphaPointer = {
    left: `${a * 100}%`,
  };

  function addToPalette() {
    const value = "#" + hex8;
    if (palette.includes(value)) return;
    setPalette([value, ...palette].slice(0, 18));
  }

  function useSwatch(hex) {
    const rgbaParsed = hexToRgba(hex);
    if (!rgbaParsed) return;
    const { r, g, b, a: aa } = rgbaParsed;
    const { h: hh, s: ss, v: vv } = rgbToHsv(r, g, b);
    setH(hh);
    setS(ss);
    setV(vv);
    setA(aa);
  }

  const shades = useMemo(() => {
    // 5 осветлений и 5 затемнений от базового
    const list = [];
    for (let i = 4; i >= 1; i--) list.push({ t: `${i * 10}%`, c: hsvToRgb(h, s, clamp(v + (1 - v) * (i / 6), 0, 1)) });
    list.push({ t: "База", c: rgb });
    for (let i = 1; i <= 4; i++) list.push({ t: `${i * 10}%−`, c: hsvToRgb(h, s, clamp(v * (1 - i / 6), 0, 1)) });
    return list;
  }, [h, s, v]);

  return (
    <div className={"relative dark min-h-screen w-full bg-[#232323] text-zinc-100 selection:bg-zinc-100 selection:text-zinc-900"}>
      <BackgroundFX h={h} s={s} v={v} a={a} />
      {/* Шапка */}
      <motion.header className="relative z-30 sticky top-0 backdrop-blur border-b border-zinc-800/60 bg-[#232323]/80"
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">              <h1 className="text-xl font-semibold tracking-tight">Ultimate RGB</h1>
              <span className="text-zinc-400 hidden sm:inline">— HEX + Прозрачность</span>
            </div>
          </div>
          <a
            href="https://t.me/StocksiUltimate_bot?start=r61558uUltimateRGB"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm text-zinc-300 hover:underline inline-flex items-center gap-1"
          >
            Сервис моментальных новостей <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </motion.header>

      {/* Контент */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Левая колонка: выбор цвета */}
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)]">
            {/* SV-поле */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-zinc-300">Палитра (насыщенность × яркость)</div>
              <div
                ref={svRef}
                onPointerDown={onSvPointerDown}
                className="relative h-72 w-full rounded-2xl overflow-hidden cursor-crosshair shadow-sm"
                style={svBg}
              >
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, rgba(255,255,255,0))" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #000, rgba(0,0,0,0))" }} />
                <div className="absolute h-5 w-5 -ml-2.5 -mt-2.5 rounded-full ring-2 ring-white shadow-md" style={{ ...svPointer, background: css }} />
              </div>
            </div>

            {/* Слайдеры H и A */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-300">Оттенок (Hue)</span>
                  <OdometerText value={`${h}°`} className="tabular-nums text-zinc-400" />
                </div>
                <div
                  className="relative h-4 rounded-full shadow-inner overflow-hidden cursor-ew-resize"
                  ref={hueRef}
                  onPointerDown={onHuePointerDown}
                  style={hueGradient}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 h-6 w-6 -ml-3 rounded-full ring-2 ring-white shadow" style={{ left: huePointer.left, background: `hsl(${h} 100% 50%)` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-300">Прозрачность (Alpha)</span>
                  <OdometerText value={`${Math.round(a * 100)}%`} className="tabular-nums text-zinc-400" />
                </div>
                <Checkerboard dark={isDark} className="relative h-4 rounded-full overflow-hidden cursor-ew-resize shadow-inner">
                  <div ref={alphaRef} onPointerDown={onAlphaPointerDown} className="absolute inset-0" style={alphaGradient} />
                  <div className="absolute top-1/2 -translate-y-1/2 h-6 w-6 -ml-3 rounded-full ring-2 ring-white shadow" style={{ left: alphaPointer.left, background: css }} />
                </Checkerboard>
              </div>
            </div>
          </div>

          {/* Быстрые оттенки */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Droplet className="h-4 w-4" /> Тоны и оттенки
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {shades.map(({ t, c }, i) => {
                const hex = "#" + rgbToHex(c.r, c.g, c.b);
                return (
                  <button
                    key={i}
                    className="group relative h-8 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    style={{ background: hex }}
                    onClick={() => useSwatch(hex)}
                    title={t}
                  >
                    <span className="sr-only">{t}</span>
                    <span className="absolute inset-x-0 -bottom-6 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* Правая колонка: предпросмотр и коды */}
        <motion.aside initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Предпросмотр */}
          <div className="grid gap-4">
            <div className="text-sm font-medium text-zinc-300">Предпросмотр</div>
            <div className="grid grid-cols-2 gap-4">
              <Checkerboard dark={isDark} className="h-28 w-full p-2">
                <div className="h-full w-full rounded-xl shadow-inner" style={{ background: css }} />
              </Checkerboard>
              <div className="h-28 w-full rounded-2xl shadow-inner" style={{ background: `linear-gradient(135deg, ${css}, ${css} 60%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.05) 61%, transparent 61%)` }} />
            </div>
          </div>

          {/* Поля кода */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">HEX</span>
              <motion.div
                key={hex8}
                initial={{ scale: 0.995 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="mt-1 flex items-center rounded-xl border border-zinc-800 bg-[#1f1f1f] focus-within:ring-2 focus-within:ring-zinc-600"
              >
                <input
                  value={hexInput}
                  onChange={(e) => onHexChange(e.target.value)}
                  onFocus={() => setHexFocused(true)}
                  onBlur={() => setHexFocused(false)}
                  className={`w-full rounded-xl bg-transparent px-3 py-2 outline-none font-mono text-sm tracking-wider ${hexError ? "text-rose-600" : ""}`}
                  placeholder="#RRGGBB или #RRGGBBAA"
                />
                <button
                  onClick={() => copy("#" + hex8, "hex")}
                  className="px-3 py-2 text-zinc-300 hover:text-white transition-colors"
                  title="Скопировать HEX (8 знаков)"
                >
                  {copied === "hex" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </motion.div>
              {hexError && <div className="mt-1 text-xs text-rose-600">{hexError}</div>}
            </label>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#1f1f1f] px-3 py-2">
                <OdometerText value={`rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${a.toFixed(3)})`} className="font-mono text-sm" />
                <button onClick={() => copy(css, "rgba")} className="text-zinc-300 hover:text-white" title="Скопировать RGBA">
                  {copied === "rgba" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#1f1f1f] px-3 py-2">
                <OdometerText value={`--color: #${hex6}; --alpha: ${Math.round(a * 100)}%;`} className="font-mono text-sm" />
                <button onClick={() => copy(`--color: #${hex6}; --alpha: ${Math.round(a * 100)}%;`, "cssvar")} className="text-zinc-300 hover:text-white" title="Скопировать CSS-переменные">
                  {copied === "cssvar" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Палитра */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Palette className="h-4 w-4" /> Моя палитра
              </div>
              <button onClick={addToPalette} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 text-white px-3 py-2 text-sm hover:brightness-110 active:scale-[.99] transition-all shadow">
                <Plus className="h-4 w-4" /> Добавить
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
              {palette.map((p, i) => (
                <button
                  key={i}
                  onClick={() => useSwatch(p)}
                  className="group relative h-9 rounded-xl shadow focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  style={{ background: p }}
                  title={p}
                >
                  <span className="absolute inset-0 rounded-xl ring-1 ring-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          {/* footer заметка */}
          <div className="text-xs text-zinc-400">
            Поддерживаются HEX форматы: <code className="font-mono">#RGB</code>, <code className="font-mono">#RRGGBB</code>, <code className="font-mono">#RRGGBBAA</code>. Точность alpha — до тысячных.
          </div>
          
        </motion.aside>
      </main>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 text-white px-4 py-2 shadow-lg"
          >
            {copied === "error" ? "Не удалось скопировать" : "Скопировано!"}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} Ultimate RGB
      </footer>
    </div>
  );
}

// --- lightweight runtime tests (dev only) ---
if (typeof window !== "undefined" && !window.__ultimate_rgb_tests) {
  window.__ultimate_rgb_tests = true;
  console.assert(rgbToHex(255, 0, 0) === "FF0000", "rgbToHex red");
  console.assert(rgbToHex(0, 255, 0) === "00FF00", "rgbToHex green");
  console.assert(rgbToHex(0, 0, 255) === "0000FF", "rgbToHex blue");
  const p = hexToRgba("#00000080");
  console.assert(p && Math.abs(p.a - 0.5) < 0.02, "hexToRgba alpha ~0.5");
  console.assert(withAlphaToHex8(0, 0, 0, 0.5).endsWith("80"), "alpha to hex8 0.5 => 0x80");
}
