
import React, { useState, useRef, useCallback } from 'react';
import { Detection, AppState } from './types';
import { analyzeImageForPII } from './services/gemini';
import { ShieldCheck, Upload, Trash2, Download, AlertCircle, Eye, EyeOff, ScanLine, Layers, Palette, Sliders } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    image: null,
    fileName: null,
    isAnalyzing: false,
    detections: [],
    error: null,
  });
  
  const [redactionColor, setRedactionColor] = useState('#000000');
  const [redactionOpacity, setRedactionOpacity] = useState(1.0);
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setState({
        image: event.target?.result as string,
        fileName: file.name,
        isAnalyzing: false,
        detections: [],
        error: null,
      });
      setShowOriginal(false);
    };
    reader.onerror = () => {
      setState(prev => ({ ...prev, error: "Failed to read image file." }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!state.image) return;

    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    try {
      const results = await analyzeImageForPII(state.image);
      setState(prev => ({ 
        ...prev, 
        detections: results, 
        isAnalyzing: false 
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false, 
        error: "Failed to analyze image. Please check your connection and API key." 
      }));
    }
  };

  const toggleDetection = (id: string) => {
    setState(prev => ({
      ...prev,
      detections: prev.detections.map(d => d.id === id ? { ...d, selected: !d.selected } : d)
    }));
  };

  const removeImage = () => {
    setState({
      image: null,
      fileName: null,
      isAnalyzing: false,
      detections: [],
      error: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadRedacted = useCallback(() => {
    if (!state.image) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Apply redactions
      state.detections.filter(d => d.selected).forEach(d => {
        const [ymin, xmin, ymax, xmax] = d.box_2d;
        const left = (xmin / 1000) * img.width;
        const top = (ymin / 1000) * img.height;
        const width = ((xmax - xmin) / 1000) * img.width;
        const height = ((ymax - ymin) / 1000) * img.height;

        ctx.save();
        ctx.globalAlpha = redactionOpacity;
        ctx.fillStyle = redactionColor;
        ctx.fillRect(left, top, width, height);
        ctx.restore();
      });

      // Download
      const link = document.createElement('a');
      link.download = `redacted-${state.fileName}`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = state.image;
  }, [state, redactionColor, redactionOpacity]);

  // Convert hex to RGBA for the UI preview
  const getRGBA = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              GuardVision <span className="text-sm font-medium text-slate-500 ml-1">v1.0</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {state.image && !state.isAnalyzing && (
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showOriginal ? "Show Redacted" : "Show Original"}
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Canvas */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {!state.image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/40 rounded-3xl aspect-[16/9] flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
            >
              <div className="p-6 bg-slate-900 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-lg font-medium text-slate-300">Upload image for scanning</p>
              <p className="text-sm text-slate-500 mt-1">PNG, JPG, HEIC up to 10MB</p>
            </div>
          ) : (
            <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center p-4 min-h-[400px]">
              <div className="relative group w-full h-full flex items-center justify-center">
                <img 
                  src={state.image} 
                  alt="Source" 
                  className="max-w-full max-h-[70vh] rounded-lg shadow-xl"
                />
                
                {/* Overlays */}
                {!showOriginal && state.detections.map(d => {
                  const [ymin, xmin, ymax, xmax] = d.box_2d;
                  const style = {
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                  };
                  return (
                    <div
                      key={d.id}
                      style={style}
                      className={`absolute border-2 transition-all duration-200 cursor-pointer ${
                        d.selected 
                          ? 'ring-2 ring-indigo-500' 
                          : 'border-indigo-400/50 bg-indigo-500/10 hover:bg-indigo-500/20'
                      }`}
                      onClick={() => toggleDetection(d.id)}
                    >
                      {d.selected && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white uppercase tracking-tighter overflow-hidden pointer-events-none"
                          style={{ backgroundColor: getRGBA(redactionColor, redactionOpacity), border: `1px solid ${redactionColor}` }}
                        >
                          <span className="bg-black/20 px-1 rounded">REDACTED</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {state.isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                      <ScanLine className="absolute inset-0 m-auto w-10 h-10 text-indigo-400 animate-pulse" />
                    </div>
                    <p className="text-xl font-semibold text-white">AI is scanning for PII...</p>
                    <p className="text-slate-400 mt-2 text-sm max-w-xs text-center">Identifying faces, names, and sensitive document details</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {state.error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{state.error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Controls & List */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6 shadow-xl sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
            
            {/* Redaction Style Settings */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2 text-slate-300">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  Redaction Style
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Color</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={redactionColor}
                      onChange={(e) => setRedactionColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-xs font-mono text-slate-400 uppercase">{redactionColor}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Opacity ({Math.round(redactionOpacity * 100)}%)</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={redactionOpacity}
                    onChange={(e) => setRedactionOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-300">
                <Layers className="w-4 h-4 text-indigo-400" />
                Detection Layers
              </h2>
              {state.detections.length > 0 && (
                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase">
                  {state.detections.length} Detected
                </span>
              )}
            </div>

            {!state.image ? (
              <div className="py-12 flex flex-col items-center text-center opacity-50">
                <ScanLine className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-500 text-sm">Upload an image to start the analysis process.</p>
              </div>
            ) : (
              <>
                {state.detections.length === 0 ? (
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={handleAnalyze}
                      disabled={state.isAnalyzing}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-white transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                      {state.isAnalyzing ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Analyzing...
                        </span>
                      ) : "Run AI Scan"}
                    </button>
                    <button
                      onClick={removeImage}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-semibold text-slate-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Image
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="flex flex-col gap-2">
                        {state.detections.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => toggleDetection(d.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                              d.selected 
                                ? 'bg-indigo-500/10 border-indigo-500/50' 
                                : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full transition-colors ${d.selected ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-600'}`}></div>
                              <div>
                                <p className={`text-sm font-bold capitalize ${d.selected ? 'text-indigo-200' : 'text-slate-400'}`}>{d.label}</p>
                                <p className="text-[10px] text-slate-500">Confidence: {(d.confidence * 100).toFixed(0)}%</p>
                              </div>
                            </div>
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${d.selected ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                              {d.selected ? "MASKED" : "SKIP"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                      <button
                        onClick={downloadRedacted}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-white transition-all transform active:scale-95 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download Redacted
                      </button>
                      <button
                        onClick={removeImage}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-semibold text-slate-300 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div className="bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/10">
              <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Privacy Note</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Images are processed directly via Gemini Pro Vision API. Redaction is performed client-side on a local canvas.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <p>© 2024 GuardVision AI. Secure Redaction Tool.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Encrypted Processing</span>
            <span className="flex items-center gap-1"><ScanLine className="w-3 h-3" /> Gemini 3 Pro Powered</span>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;
