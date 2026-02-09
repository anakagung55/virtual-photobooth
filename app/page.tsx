"use client";

import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { 
  Download, Move, RefreshCw, ArrowRight, 
  Grid3X3, RectangleVertical, LayoutGrid, User, 
  Sparkles, Camera, Image as ImageIcon, Clock, Type, Sun 
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- CONFIGURATION ---

// 1. FILTERS (Mapping CSS Class untuk Preview & Canvas String untuk Download)
const FILTERS = [
  { name: "Normal", class: "", ctx: "none" },
  { name: "B&W", class: "grayscale contrast-125", ctx: "grayscale(100%) contrast(125%)" },
  { name: "Sepia", class: "sepia contrast-110", ctx: "sepia(100%) contrast(110%)" },
  { name: "Warm", class: "sepia-[.3] contrast-100 brightness-110 saturate-150", ctx: "sepia(30%) contrast(100%) brightness(110%) saturate(150%)" },
  { name: "Cool", class: "hue-rotate-180 sepia-[.2] opacity-90", ctx: "hue-rotate(180deg) sepia(20%) opacity(90%)" },
  { name: "Vintage", class: "contrast-125 sepia-[.4] brightness-90 hue-rotate-[-10deg]", ctx: "contrast(125%) sepia(40%) brightness(90%) hue-rotate(-10deg)" },
];

// 2. LAYOUTS
const LAYOUTS = [
  { 
    id: "strip-4", name: "Classic Strip", slots: 4, cols: 1, 
    slotAspect: "aspect-[4/3]", gridClass: "grid-cols-1 gap-4", widthClass: "w-[300px]", 
    icon: <RectangleVertical /> 
  },
  { 
    id: "wide-3", name: "Wide Trio", slots: 3, cols: 1, 
    slotAspect: "aspect-video", gridClass: "grid-cols-1 gap-4", widthClass: "w-[500px]", 
    icon: <ImageIcon />
  },
  { 
    id: "grid-4", name: "Quad Grid", slots: 4, cols: 2, 
    slotAspect: "aspect-[4/3]", gridClass: "grid-cols-2 gap-4", widthClass: "w-[500px]", 
    icon: <LayoutGrid />
  },
  { 
    id: "grid-6", name: "Six Pack", slots: 6, cols: 2, 
    slotAspect: "aspect-square", gridClass: "grid-cols-2 gap-3", widthClass: "w-[480px]", 
    icon: <Grid3X3 />
  },
  { 
    id: "solo", name: "Solo Portrait", slots: 1, cols: 1, 
    slotAspect: "aspect-[3/4]", gridClass: "grid-cols-1", widthClass: "w-[360px]", 
    icon: <User />
  },
];

// 3. FRAMES
const FRAMES = [
  { id: "white", hex: "#ffffff", textHex: "#000000", borderHex: "#e4e4e7" },
  { id: "black", hex: "#000000", textHex: "#ffffff", borderHex: "#27272a" },
  { id: "cream", hex: "#F5F5DC", textHex: "#5C4033", borderHex: "#E8E8C8" },
  { id: "pink", hex: "#fbcfe8", textHex: "#831843", borderHex: "#f9a8d4" },
  { id: "blue", hex: "#bfdbfe", textHex: "#1e3a8a", borderHex: "#93c5fd" },
  { id: "gradient", bgStyle: "linear-gradient(to bottom right, #8b5cf6, #d946ef)", hex: "#8b5cf6", textHex: "#ffffff", borderHex: "rgba(255,255,255,0.2)" },
];

const TIMERS = [3, 5, 10];

// --- HELPER: Draw Image with Object-Fit Cover ---
// Ini algoritma matematika biar gambar ga gepeng pas di-canvas
function drawImageProp(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, offsetX = 0.5, offsetY = 0.5) {
  if (arguments.length === 2) {
      x = y = 0;
      w = ctx.canvas.width;
      h = ctx.canvas.height;
  }

  // Keep bounds [0.0, 1.0]
  if (offsetX < 0) offsetX = 0;
  if (offsetY < 0) offsetY = 0;
  if (offsetX > 1) offsetX = 1;
  if (offsetY > 1) offsetY = 1;

  var iw = img.width,
      ih = img.height,
      r = Math.min(w / iw, h / ih),
      nw = iw * r,   // new prop. width
      nh = ih * r,   // new prop. height
      cx, cy, cw, ch, ar = 1;

  // Decide which gap to fill    
  if (nw < w) ar = w / nw;                             
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
  nw *= ar;
  nh *= ar;

  // Calc source rectangle
  cw = iw / (nw / w);
  ch = ih / (nh / h);
  cx = (iw - cw) * offsetX;
  cy = (ih - ch) * offsetY;

  // Make sure source rectangle is valid
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}

// --- COMPONENT: Video Mirror ---
const VideoMirror = ({ stream, style }: { stream: MediaStream | null, style?: React.CSSProperties }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" style={style} />;
};

export default function Photobooth() {
  const [phase, setPhase] = useState<"SETUP" | "CAPTURE" | "EDIT">("SETUP");
  const webcamRef = useRef<Webcam>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // State Config
  const [selectedLayout, setSelectedLayout] = useState(LAYOUTS[2]); 
  const [selectedFrame, setSelectedFrame] = useState(FRAMES[0]); 
  const [timerDuration, setTimerDuration] = useState(3); 
  const [caption, setCaption] = useState(""); 
  const [brightness, setBrightness] = useState(100); 

  // State Data
  const [photos, setPhotos] = useState<string[]>([]);
  const [globalFilter, setGlobalFilter] = useState(FILTERS[0]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [globalStream, setGlobalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const enableStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 960 }, 
          audio: false 
        });
        setGlobalStream(stream);
      } catch (err) {
        console.error("Gagal akses kamera:", err);
      }
    };
    enableStream();
    return () => {
      if (globalStream) globalStream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startSession = () => {
    setPhotos([]); 
    setPhase("CAPTURE");
    startCaptureSequence();
  };

  const startCaptureSequence = async () => {
    await new Promise(r => setTimeout(r, 800));
    for (let i = 0; i < selectedLayout.slots; i++) {
      for (let c = timerDuration; c > 0; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(null);
      const flash = document.getElementById("flash-overlay");
      if(flash) {
        flash.style.opacity = "1";
        setTimeout(() => flash.style.opacity = "0", 150);
      }
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) setPhotos((prev) => [...prev, imageSrc]); 
      if (i < selectedLayout.slots - 1) await new Promise((r) => setTimeout(r, 1500)); 
    }
    setPhase("EDIT");
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    const newPhotos = [...photos];
    const temp = newPhotos[draggedIdx];
    newPhotos[draggedIdx] = newPhotos[dropIndex];
    newPhotos[dropIndex] = temp;
    setPhotos(newPhotos);
    setDraggedIdx(null);
  };

  // --- MANUAL CANVAS RENDERER (THE FIX) ---
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await new Promise(r => setTimeout(r, 100)); // UI Feedback delay

      // 1. Setup Canvas Ukuran HD
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Konfigurasi Ukuran (Scale up biar HD)
      const scale = 2; 
      const padding = 24 * scale;
      const gap = 16 * scale;
      const headerHeight = 60 * scale;
      const footerHeight = 80 * scale;
      
      // Lebar total canvas berdasarkan layout
      const baseWidth = selectedLayout.id.includes("strip") ? 300 : selectedLayout.id.includes("solo") ? 360 : 500;
      canvas.width = baseWidth * scale;

      // Hitung Grid
      const cols = selectedLayout.cols;
      const rows = Math.ceil(selectedLayout.slots / cols);
      
      // Hitung Ukuran Slot Foto
      const slotWidth = (canvas.width - (padding * 2) - ((cols - 1) * gap)) / cols;
      let slotHeight = slotWidth * 0.75; // Default 4:3
      if (selectedLayout.slotAspect.includes("square")) slotHeight = slotWidth;
      if (selectedLayout.slotAspect.includes("video")) slotHeight = slotWidth * (9/16);
      if (selectedLayout.slotAspect.includes("aspect-[3/4]")) slotHeight = slotWidth * (4/3);

      // Tinggi total canvas
      const contentHeight = (rows * slotHeight) + ((rows - 1) * gap);
      canvas.height = padding + headerHeight + contentHeight + footerHeight;

      // 2. Draw Background
      ctx.fillStyle = selectedFrame.hex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Handle Gradient khusus
      if(selectedFrame.id === 'gradient') {
        const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grd.addColorStop(0, "#8b5cf6");
        grd.addColorStop(1, "#d946ef");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 3. Draw Header Text
      if (caption) {
        ctx.fillStyle = selectedFrame.textHex;
        ctx.font = `bold ${18 * scale}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(caption.toUpperCase(), canvas.width / 2, padding + (headerHeight/2));
      }

      // 4. Draw Photos
      // Load semua gambar dulu
      const loadedImages = await Promise.all(photos.map(src => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      }));

      // Apply Filter & Brightness
      ctx.filter = `${globalFilter.ctx} brightness(${brightness}%)`;

      // Loop gambar dan gambar ke canvas
      loadedImages.forEach((img, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        
        const x = padding + (col * (slotWidth + gap));
        const y = padding + headerHeight + (row * (slotHeight + gap));

        // Draw background slot (putih/abu)
        ctx.fillStyle = "#f4f4f5";
        ctx.fillRect(x, y, slotWidth, slotHeight);

        // Draw Image dengan proporsi cover (biar ga gepeng)
        drawImageProp(ctx, img, x, y, slotWidth, slotHeight);
      });

      // Reset filter buat text footer
      ctx.filter = "none";

      // 5. Draw Footer
      const footerY = canvas.height - (padding);
      ctx.fillStyle = selectedFrame.textHex;
      ctx.globalAlpha = 0.6;
      ctx.font = `${10 * scale}px monospace`;
      ctx.textAlign = "left";
      
      // Date
      const dateStr = new Date().toLocaleDateString();
      const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      ctx.fillText("SNAP.BOOTH", padding, footerY - (15 * scale));
      ctx.fillText(`${dateStr} • ${timeStr}`, padding, footerY);

      // ID
      ctx.textAlign = "right";
      const idStr = "#" + Math.random().toString(36).substr(2, 4).toUpperCase();
      ctx.fillText(idStr, canvas.width - padding, footerY);

      // 6. Save File
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `snapbooth-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

    } catch (err) {
      console.error("Canvas error:", err);
      alert("Gagal render canvas.");
    } finally {
      setIsDownloading(false);
    }
  };

  // --- RENDER HELPERS ---
  const ResultFrame = ({ isPreview = false }) => (
    <div 
      style={{
        backgroundColor: selectedFrame.hex,
        backgroundImage: selectedFrame.bgStyle || "none",
        color: selectedFrame.textHex,
        borderColor: selectedFrame.borderHex
      }}
      className={cn(
        "relative p-6 flex flex-col gap-4 mx-auto border-[12px] h-fit shadow-2xl transition-all", 
        selectedLayout.widthClass,
        isPreview ? "scale-90 origin-top" : "scale-100"
      )}
    >
      <div className="text-center min-h-[24px] flex items-end justify-center">
          {caption && (
            <h3 className="font-bold text-xl tracking-tight uppercase opacity-90 break-words leading-tight font-mono">
              {caption}
            </h3>
          )}
      </div>

      <div className={cn("grid", selectedLayout.gridClass)}>
        {Array.from({ length: selectedLayout.slots }).map((_, idx) => {
          const src = photos[idx]; 
          return (
            <div
              key={idx}
              draggable={!isPreview} 
              onDragStart={(e) => !isPreview && handleDragStart(e, idx)}
              onDrop={(e) => !isPreview && handleDrop(e, idx)}
              onDragOver={(e) => !isPreview && e.preventDefault()}
              style={{ backgroundColor: '#f4f4f5' }}
              className={cn(
                "relative overflow-hidden flex items-center justify-center shadow-sm group rounded-sm",
                selectedLayout.slotAspect
              )}
            >
              {src ? (
                <>
                  <img 
                    src={src} 
                    style={{ filter: `brightness(${brightness}%)` }}
                    className={cn("w-full h-full object-cover pointer-events-none", globalFilter.class)} 
                    alt={`snap-${idx}`}
                  />
                  {!isPreview && (
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Move size={24} className="drop-shadow-lg"/>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: '#d4d4d8' }} className="text-xs font-mono">WAITING...</div>
              )}
            </div>
          );
        })}
      </div>

      <div 
        className="mt-auto pt-4 flex justify-between items-end opacity-60 border-t"
        style={{ borderColor: selectedFrame.borderHex }}
      >
        <div className="text-[10px] font-mono tracking-widest uppercase leading-tight">
          <span className="font-bold">SNAP.BOOTH</span> <br/>
          {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
        <div className="text-right">
           <Sparkles size={16} />
           <p className="text-[8px] font-mono">#{Math.random().toString(36).substr(2, 4).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-pink-500 selection:text-white">
      
      <header className="fixed top-0 w-full p-6 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2 text-white drop-shadow-lg">
          <Camera className="text-pink-500" /> SNAP.BOOTH
        </h1>
        {phase !== "SETUP" && phase !== "CAPTURE" && (
           <button onClick={() => setPhase("SETUP")} className="pointer-events-auto text-xs font-bold bg-white/10 hover:bg-white/20 backdrop-blur px-4 py-2 rounded-full transition">
             RESTART
           </button>
        )}
      </header>

      <main className="flex flex-col items-center justify-center min-h-screen p-4 pt-20">
        
        {/* === PHASE 1: SETUP === */}
        {phase === "SETUP" && (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-in fade-in duration-700">
            <div className="space-y-8 order-2 lg:order-1">
              <div className="space-y-2">
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  Atur <span className="text-pink-500">Gaya</span> <br/> & Cahaya.
                </h2>
                <p className="text-zinc-400 text-lg">Sesuaikan brightness kamera agar hasil maksimal.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLayout(l)}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all",
                      selectedLayout.id === l.id 
                        ? "border-pink-500 bg-zinc-900" 
                        : "border-zinc-800 bg-black/40 hover:bg-zinc-900"
                    )}
                  >
                    <div className="mb-2 text-zinc-400">{l.icon}</div>
                    <p className="font-bold text-sm">{l.name}</p>
                    <p className="text-xs text-zinc-500">{l.slots} Pose</p>
                  </button>
                ))}
              </div>

              <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 space-y-3">
                 <div className="flex justify-between items-center text-sm font-bold text-zinc-400 uppercase tracking-wider">
                    <span className="flex items-center gap-2"><Sun size={16} /> Brightness</span>
                    <span>{brightness}%</span>
                 </div>
                 <input 
                   type="range" 
                   min="50" 
                   max="150" 
                   value={brightness} 
                   onChange={(e) => setBrightness(Number(e.target.value))}
                   className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                 />
              </div>

              <div className="flex gap-3">
                 {TIMERS.map(t => (
                   <button key={t} onClick={() => setTimerDuration(t)} className={cn("flex-1 py-3 rounded-xl border-2 font-bold", timerDuration === t ? "border-pink-500 text-pink-500" : "border-zinc-800 text-zinc-500")}>
                     {t}s
                   </button>
                 ))}
              </div>

              <button onClick={startSession} className="w-full py-5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full font-bold text-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition">
                Mulai Foto <ArrowRight />
              </button>
            </div>

            <div className="order-1 lg:order-2 flex justify-center items-center h-[500px]">
               <div className="relative w-full max-w-[640px] aspect-[4/3] rounded-2xl overflow-hidden border-4 border-zinc-800 bg-black shadow-2xl">
                 {globalStream ? (
                   <VideoMirror 
                     stream={globalStream} 
                     style={{ filter: `brightness(${brightness}%)` }} 
                   />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-zinc-600">Loading...</div>
                 )}
                 <div className="absolute bottom-4 left-0 right-0 text-center">
                   <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-mono">Live Preview</span>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* === PHASE 2: CAPTURE === */}
        {phase === "CAPTURE" && (
          <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 items-center">
            <div className="relative w-full h-full max-h-[80vh] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center">
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                screenshotFormat="image/jpeg"
                videoConstraints={{ aspectRatio: 1.33333, facingMode: "user" }}
                style={{ filter: `brightness(${brightness}%)` }} 
                className={cn("w-full h-full object-cover", globalFilter.class)}
              />
              {countdown && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-40">
                  <span className="text-[12rem] font-black text-white drop-shadow-lg animate-in zoom-in duration-300">
                    {countdown}
                  </span>
                </div>
              )}
              <div id="flash-overlay" className="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-100 z-50" />
            </div>

            <div className="hidden lg:flex flex-col items-center justify-center h-full max-h-[80vh] bg-zinc-900/50 rounded-3xl border border-white/5 p-4 overflow-hidden">
               <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-4 animate-pulse">
                 Processing Shot {photos.length + 1} / {selectedLayout.slots}...
               </h3>
               <ResultFrame isPreview={true} />
            </div>
          </div>
        )}

        {/* === PHASE 3: EDIT === */}
        {phase === "EDIT" && (
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 animate-in slide-in-from-bottom-10 duration-700">
            <div className="lg:col-span-1 space-y-6 bg-white/5 p-6 rounded-3xl border border-white/10 h-fit sticky top-24">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2"><Type size={14}/> Custom Caption</label>
                <input 
                  type="text" 
                  placeholder="Tulis judul acara..." 
                  maxLength={25}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition"
                />
              </div>

              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4"><Sparkles className="text-yellow-500" /> Filters</h3>
                <div className="grid grid-cols-3 gap-2">
                  {FILTERS.map((f) => (
                    <button key={f.name} onClick={() => setGlobalFilter(f)} className={cn("py-3 text-xs font-bold rounded-xl border transition-all", globalFilter.name === f.name ? "bg-white text-black" : "bg-black/40 text-zinc-400 border-transparent")}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-4">Frame Color</h3>
                <div className="flex flex-wrap gap-3">
                  {FRAMES.map((f) => (
                    <button 
                      key={f.id} 
                      onClick={() => setSelectedFrame(f)} 
                      className={cn("w-10 h-10 rounded-full border-2 transition-transform shadow-sm", selectedFrame.id === f.id ? "border-white scale-110 ring-2 ring-pink-500" : "border-transparent opacity-70")} 
                      style={{ background: f.bgStyle || f.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-3">
                <button 
                  onClick={handleDownload} 
                  disabled={isDownloading}
                  className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />} 
                  {isDownloading ? "Saving..." : "Download HD"}
                </button>
                <button onClick={() => setPhase("SETUP")} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  <RefreshCw size={18} /> Take Again
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 flex justify-center items-start min-h-[600px] bg-zinc-900/50 rounded-3xl border border-white/5 p-8 overflow-auto">
               <ResultFrame />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}