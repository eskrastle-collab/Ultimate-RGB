import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Plus, Droplet, Palette, ArrowUpRight } from "lucide-react";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
function hsvToRgb(h, s, v) {
  s = clamp(s, 0, 1); v = clamp(v, 0, 1);
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r1,g1,b1;
  if (h >= 0 && h < 60) [r1,g1,b1] = [c,x,0];
  else if (h < 120) [r1,g1,b1] = [x,c,0];
  else if (h < 180) [r1,g1,b1] = [0,c,x];
  else if (h < 240) [r1,g1,b1] = [0,x,c];
  else if (h < 300) [r1,g1,b1] = [x,0,c];
  else [r1,g1,b1] = [c,0,x];
  return { r: Math.round((r1+m)*255), g: Math.round((g1+m)*255), b: Math.round((b1+m)*255) };
}
function rgbToHsv(r, g, b) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = 60 * (((g-b)/d) % 6);
  else if (max === g) h = 60 * (((b-r)/d) + 2);
  else h = 60 * (((r-g)/d) + 4);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}
const rgbToHex = (r,g,b) => [r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
function hexToRgba(hex) {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/,"");
  if (h.length === 3) h = h.split("").map(c=>c+c).join("");
  if (h.length === 6) h = h + "FF";
  if (h.length !== 8) return null;
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16), a = parseInt(h.slice(6,8),16)/255;
  return { r,g,b,a };
}
const rgbaToCss = ({r,g,b,a}) => `rgba(${r}, ${g}, ${b}, ${clamp(a,0,1).toFixed(3)})`;
function withAlphaToHex8(r,g,b,a){ const rgb = rgbToHex(r,g,b); const alpha = Math.round(clamp(a,0,1)*255).toString(16).padStart(2,"0").toUpperCase(); return rgb+alpha; }

function Checkerboard({ className = "", children, dark = false }) {
  const tile = dark ? "#2c2c2c" : "#e5e7eb";
  const style = { background: `conic-gradient(${tile} 25%,transparent 0 50%,${tile} 0 75%,transparent 0) 0 0/16px 16px` };
  return <div className={"rounded-2xl " + className} style={style}>{children}</div>;
}

function OdometerText({ value, className = "", duration = 0.5 }) {
  const text = String(value), chars = text.split("");
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
            >{ch}</motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function BackgroundFX({ h, s, v, a }) {
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
      <style>{`@keyframes orbit360 { to { transform: rotate(360deg); } } .orbital-ring{position:absolute;will-change:transform;} .orbital-anim{animation:orbit360 var(--dur) linear infinite;} .orbital-anim.reverse{animation-direction:reverse;}`}</style>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {rings.map((ring, ri) => (
          <div key={ri} className={'orbital-ring orbital-anim ' + (ring.reverse ? 'reverse' : '')} style={{ ['--dur']: ring.dur }}>
            {Array.from({ length: ring.count }).map((_, i) => {
              const angle = (360 / ring.count) * i;
              const size = ring.sizeBase + (i % 6);
              return (
                <span key={i} className="absolute rounded-full" style={{
                  top: 0, left: 0, transform: `rotate(${angle}deg) translateX(${ring.radius})`, width: size, height: size,
                  background: `radial-gradient(circle at 50% 50%, ${ring.color} 0%, transparent 70%)`,
                  filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.12))',
                }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  const [h, setH] = useState(210), [s, setS] = useState(0.6), [v, setV] = useState(0.8), [a, setA] = useState(1);
  const [hexInput, setHexInput] = useState(""), [hexError, setHexError] = useState(""), [hexFocused, setHexFocused] = useState(false);
  const [copied, setCopied] = useState("");
  const [palette, setPalette] = useState(() => {
    try { const saved = localStorage.getItem("ultimatergb_palette"); if (saved) return JSON.parse(saved); } catch {}
    return ["#FF6B6B","#FFD166","#06D6A0","#118AB2","#8A5CF6","#F72585","#3A0CA3","#4CC9F0","#2A9D8F","#E76F51"];
  });

  useEffect(() => { try { localStorage.setItem("ultimatergb_palette", JSON.stringify(palette)); } catch {} }, [palette]);

  const rgb = useMemo(() => hsvToRgb(h, s, v), [h, s, v]);
  const rgba = useMemo(() => ({ ...rgb, a }), [rgb, a]);
  const css = useMemo(() => rgbaToCss(rgba), [rgba]);
  const hex6 = useMemo(() => rgbToHex(rgb.r, rgb.g, rgb.b), [rgb]);
  const hex8 = useMemo(() => withAlphaToHex8(rgb.r, rgb.g, rgb.b, a), [rgb, a]);

  useEffect(() => { if (!hexFocused) { setHexInput("#" + hex8); setHexError(""); } }, [hex8, hexFocused]);

  function onHexChange(val) {
    setHexInput(val);
    const p = hexToRgba(val);
    if (!p) { setHexError("Неверный HEX (используйте #RRGGBB или #RRGGBBAA)"); return; }
    setHexError("");
    const { r, g, b, a: aa } = p; const { h: hh, s: ss, v: vv } = rgbToHsv(r, g, b);
    setH(hh); setS(ss); setV(vv); setA(aa);
  }

  async function copy(text, type) {
    let ok = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") { await navigator.clipboard.writeText(text); ok = true; }
      else { throw new Error("clipboard api unavailable"); }
    } catch (e1) {
      try {
        const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly","");
        ta.style.position="fixed"; ta.style.top="-1000px"; ta.style.opacity="0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        const res = document.execCommand("copy"); document.body.removeChild(ta); ok = !!res;
      } catch (e2) { ok = false; }
    }
    setCopied(ok ? type : "error"); setTimeout(() => setCopied(""), 1400);
  }

  const svRef = useRef(null), hueRef = useRef(null), alphaRef = useRef(null);
  function handlePointer(ref, e, onUpdate) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onUpdate(x, y);
  }
  function onSvPointerDown(e){ e.preventDefault(); handlePointer(svRef, e, (x,y)=>{ setS(x); setV(1-y); });
    const move = ev => handlePointer(svRef, ev, (x,y)=>{ setS(x); setV(1-y); });
    const up = ()=>{ window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function onHuePointerDown(e){ e.preventDefault(); handlePointer(hueRef, e, x=> setH(Math.round(x*360)));
    const move = ev => handlePointer(hueRef, ev, x=> setH(Math.round(x*360)));
    const up = ()=>{ window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function onAlphaPointerDown(e){ e.preventDefault(); handlePointer(alphaRef, e, x=> setA(x));
    const move = ev => handlePointer(alphaRef, ev, x=> setA(x));
    const up = ()=>{ window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  const hueGradient = { background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)" };
  const alphaGradient = { background: `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b},0) 0%, rgba(${rgb.r},${rgb.g},${rgb.b},1) 100%)` };
  const svBg = { background: `hsl(${h} 100% 50%)` };
  const svPointer = { left: `${s*100}%`, top: `${(1-v)*100}%` };
  const huePointer = { left: `${(h/360)*100}%` };
  const alphaPointer = { left: `${a*100}%` };

  function addToPalette(){ const value = "#" + hex8; if (palette.includes(value)) return; setPalette([value, ...palette].slice(0, 18)); }
  function useSwatch(hex){ const p = hexToRgba(hex); if (!p) return; const { r,g,b, a:aa } = p; const { h:hh, s:ss, v:vv } = rgbToHsv(r,g,b); setH(hh); setS(ss); setV(vv); setA(aa); }

  const shades = useMemo(()=>{ const list=[]; for(let i=4;i>=1;i--) list.push({t:`${i*10}%`, c:hsvToRgb(h,s, Math.min(1, Math.max(0, v+(1-v)*(i/6))))}); list.push({t:"База", c:rgb}); for(let i=1;i<=4;i++) list.push({t:`${i*10}%−`, c:hsvToRgb(h,s, Math.min(1, Math.max(0, v*(1-i/6))))}); return list; },[h,s,v]);

  return (
    <div className={"relative dark min-h-screen w-full bg-[#232323] text-zinc-100 selection:bg-zinc-100 selection:text-zinc-900"}>
      <BackgroundFX h={h} s={s} v={v} a={a} />
      <motion.header className="relative z-30 sticky top-0 backdrop-blur border-b border-zinc-800/60 bg-[#232323]/80">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Ultimate RGB</h1>
              <span className="text-zinc-400 hidden sm:inline">— HEX + Прозрачность</span>
            </div>
          </div>
          <a href="https://t.me/StocksiUltimate_bot?start=r61558uUltimateRGB" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-zinc-300 hover:underline inline-flex items-center gap-1">
            Сервис моментальных новостей <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </motion.header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="text-sm font-medium text-zinc-300">Палитра (насыщенность × яркость)</div>
              <div ref={svRef} onPointerDown={onSvPointerDown} className="relative h-72 w-full rounded-2xl overflow-hidden cursor-crosshair shadow-sm" style={svBg}>
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, rgba(255,255,255,0))" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #000, rgba(0,0,0,0))" }} />
                <div className="absolute h-5 w-5 -ml-2.5 -mt-2.5 rounded-full ring-2 ring-white shadow-md" style={{ ...svPointer, background: css }} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-300">Оттенок (Hue)</span>
                  <OdometerText value={`${h}°`} className="tabular-nums text-zinc-400" />
                </div>
                <div className="relative h-4 rounded-full shadow-inner overflow-hidden cursor-ew-resize" ref={hueRef} onPointerDown={onHuePointerDown} style={hueGradient}>
                  <div className="absolute top-1/2 -translate-y-1/2 h-6 w-6 -ml-3 rounded-full ring-2 ring-white shadow" style={{ left: huePointer.left, background: `hsl(${h} 100% 50%)` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-300">Прозрачность (Alpha)</span>
                  <OdometerText value={`${Math.round(a * 100)}%`} className="tabular-nums text-zinc-400" />
                </div>
                <Checkerboard dark={true} className="relative h-4 rounded-full overflow-hidden cursor-ew-resize shadow-inner">
                  <div ref={alphaRef} onPointerDown={onAlphaPointerDown} className="absolute inset-0" style={alphaGradient} />
                  <div className="absolute top-1/2 -translate-y-1/2 h-6 w-6 -ml-3 rounded-full ring-2 ring-white shadow" style={{ left: alphaPointer.left, background: css }} />
                </Checkerboard>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Droplet className="h-4 w-4" /> Тоны и оттенки
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {/* Shades list would render here; simplified for the template */}
              <button className="h-8 rounded-xl bg-zinc-500/30" />
              <button className="h-8 rounded-xl bg-zinc-500/40" />
              <button className="h-8 rounded-xl bg-zinc-500/50" />
              <button className="h-8 rounded-xl bg-zinc-500/60" />
              <button className="h-8 rounded-xl bg-zinc-500/70" />
            </div>
          </div>
        </motion.section>

        <motion.aside initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid gap-4">
            <div className="text-sm font-medium text-zinc-300">Предпросмотр</div>
            <div className="grid grid-cols-2 gap-4">
              <Checkerboard dark={true} className="h-28 w-full p-2">
                <div className="h-full w-full rounded-xl shadow-inner" style={{ background: css }} />
              </Checkerboard>
              <div className="h-28 w-full rounded-2xl shadow-inner" style={{ background: `linear-gradient(135deg, ${css}, ${css} 60%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.05) 61%, transparent 61%)` }} />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">HEX</span>
              <motion.div initial={{ scale: 0.995 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="mt-1 flex items-center rounded-xl border border-zinc-800 bg-[#1f1f1f]">
                <input value="#000000FF" readOnly className="w-full rounded-xl bg-transparent px-3 py-2 outline-none font-mono text-sm tracking-wider" />
                <button className="px-3 py-2 text-zinc-300 hover:text-white transition-colors" title="Скопировать HEX">
                  <Copy className="h-4 w-4" />
                </button>
              </motion.div>
            </label>
          </div>
        </motion.aside>
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} Ultimate RGB
      </footer>
    </div>
  );
}
