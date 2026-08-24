import React, { useState, useRef } from "react";
import { UploadCloud, FileCode2, CheckCircle2, AlertCircle, Loader2, PlayCircle, Download } from "lucide-react";
import { calculateDiff } from "./lib/diff";
import { cn } from "./lib/utils";

export default function App() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalInputRef = useRef<HTMLInputElement>(null);
  const modifiedInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "original" | "modified"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".prw") && !file.name.endsWith(".tlpp")) {
      setError("Formato inválido. Utilize apenas .prw ou .tlpp");
      return;
    }
    setError(null);

    if (type === "original") {
      setOriginalFile(file);
    } else {
      setModifiedFile(file);
    }
  };

  const readAndAnalyze = async () => {
    if (!originalFile || !modifiedFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const originalCode = await originalFile.text();
      const modifiedCode = await modifiedFile.text();

      if (!originalCode.trim() || !modifiedCode.trim()) {
        throw new Error("Arquivo vazio detectado.");
      }

      // Generate limited diff locally
      const diffText = calculateDiff(originalCode, modifiedCode);

      if (!diffText || diffText.includes("no changes")) {
         // Even if there are no changes, we might want to alert the user, 
         // but let's just pass it to the API or fail fast.
         if (diffText.trim().length === 0) {
            throw new Error("Nenhuma alteração detectada entre os arquivos.");
         }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout (3 minutes)

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffText }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = "Falha ao gerar relatório técnico.";
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errorMsg);
      }

      const htmlContent = await response.text();

      if (!htmlContent || !htmlContent.includes("<html")) {
        throw new Error("O relatório gerado pela IA é inválido.");
      }

      // Create blob and download 
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio_analise_advpl.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Tempo limite excedido durante a análise.");
      } else {
        setError(err.message || "Erro desconhecido durante a análise.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 flex flex-col items-center justify-center font-sans tracking-wide">
      {/* Background decorations */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <section className="glass-panel w-full max-w-5xl p-8 md:p-12 relative z-10 flex flex-col items-center border-t border-t-white/20">
        
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-white/10 border border-white/5 text-xs text-cyan-300 uppercase tracking-widest font-semibold backdrop-blur-md">
             <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
             Gemini 3.0 Analysis Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-300 text-glow">
            ADVPL Turbo Reviewer AI
          </h1>
          <p className="text-slate-400 font-medium">
            Powered by Ramon Cintas Gomes
          </p>
        </header>

        {/* Upload Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-10">
          
          {/* File 1: Original */}
          <div className="flex flex-col gap-3">
            <label className="text-sm text-slate-300 font-medium ml-2">Código Original (.prw / .tlpp)</label>
            <button 
              id="upload-original"
              onClick={() => originalInputRef.current?.click()}
              className={cn(
                "glass-inner p-8 flex flex-col items-center justify-center gap-4 border-dashed border-2 transition-all group",
                originalFile ? "border-cyan-500/50 hover:bg-cyan-900/20" : "border-slate-600/50 hover:border-slate-400/50 hover:bg-white/5"
              )}
            >
              <input 
                ref={originalInputRef}
                type="file" 
                accept=".prw,.tlpp" 
                onChange={(e) => handleFileChange(e, "original")}
                className="hidden" 
              />
              {originalFile ? (
                <>
                  <FileCode2 className="w-10 h-10 text-cyan-400 mb-2" />
                  <span className="text-cyan-100 font-medium">{originalFile.name}</span>
                  <span className="text-xs text-slate-400">{(originalFile.size / 1024).toFixed(2)} KB</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors">Clique para selecionar</span>
                </>
              )}
            </button>
          </div>

          {/* File 2: Modified */}
          <div className="flex flex-col gap-3">
            <label className="text-sm text-slate-300 font-medium ml-2">Código Modificado (.prw / .tlpp)</label>
            <button 
              id="upload-modified"
              onClick={() => modifiedInputRef.current?.click()}
              className={cn(
                "glass-inner p-8 flex flex-col items-center justify-center gap-4 border-dashed border-2 transition-all group",
                modifiedFile ? "border-indigo-500/50 hover:bg-indigo-900/20" : "border-slate-600/50 hover:border-slate-400/50 hover:bg-white/5"
              )}
            >
              <input 
                ref={modifiedInputRef}
                type="file" 
                accept=".prw,.tlpp" 
                onChange={(e) => handleFileChange(e, "modified")}
                className="hidden" 
              />
              {modifiedFile ? (
                <>
                  <FileCode2 className="w-10 h-10 text-indigo-400 mb-2" />
                  <span className="text-indigo-100 font-medium">{modifiedFile.name}</span>
                  <span className="text-xs text-slate-400">{(modifiedFile.size / 1024).toFixed(2)} KB</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors">Clique para selecionar</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Global Error message */}
        {error && (
          <div className="w-full flex items-center gap-3 p-4 mb-8 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          id="analyze-btn"
          onClick={readAndAnalyze}
          disabled={!originalFile || !modifiedFile || isAnalyzing}
          className="relative group disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden rounded-full p-[1px]"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="relative px-8 py-4 bg-slate-900/90 rounded-full flex items-center gap-3 backdrop-blur-md transition-all group-hover:bg-slate-900/50">
             <PlayCircle className="w-5 h-5 text-cyan-400" />
             <span className="font-semibold text-white tracking-wide">
                Analisar e Baixar Relatório
             </span>
          </div>
        </button>

      </section>

      {/* Fullscreen Loading Overlay */}
      {isAnalyzing && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/80 backdrop-blur-xl transition-all">
            <div className="flex flex-col items-center gap-8 max-w-lg text-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                 <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse" />
                 <Loader2 className="w-12 h-12 text-cyan-400 animate-spin relative z-10" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-indigo-300 mb-3 text-glow">
                  Auditoria em Andamento
                </h3>
                <p className="text-slate-300 text-lg font-light leading-relaxed">
                  Gemini analisando performance, arquitetura e regras de negócio...
                </p>
              </div>
            </div>
         </div>
      )}

    </main>
  );
}
