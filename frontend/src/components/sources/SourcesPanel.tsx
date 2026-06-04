import React, { useState } from "react";
import {
  Link2,
  FileText,
  UploadCloud,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Globe,
  Database,
  Layers,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { SourceListItem, Notebook, PipelineJobResponse } from "../../lib/types";

interface SourcesPanelProps {
  notebook: Notebook;
  sources: SourceListItem[];
  loading: boolean;
  pipelineJob: PipelineJobResponse | null;
  onAddUrl: (url: string) => Promise<void>;
  onAddText: (text: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onLoadExample: () => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onBackToDashboard: () => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  notebook,
  sources,
  loading,
  pipelineJob,
  onAddUrl,
  onAddText,
  onUploadFile,
  onLoadExample,
  onDeleteSource,
  onBackToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<"url" | "text" | "file">("file");

  // Tab states
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddUrl(urlInput.trim());
      setUrlInput("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    setIsSubmitting(true);
    try {
      const content = noteTitle.trim()
        ? `Title: ${noteTitle.trim()}\n\n${textInput.trim()}`
        : textInput.trim();
      await onAddText(content);
      setTextInput("");
      setNoteTitle("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsSubmitting(true);
      try {
        await onUploadFile(e.target.files[0]);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setIsSubmitting(true);
      try {
        await onUploadFile(e.dataTransfer.files[0]);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const triggerLoadExample = async () => {
    setIsSubmitting(true);
    try {
      await onLoadExample();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Title Header with Dashboard back button */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBackToDashboard}
            title="Back to Notebooks"
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition duration-150 flex-shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Active Notebook
            </h1>
            <h2
              className="text-sm font-extrabold text-slate-200 truncate"
              title={notebook.name}
            >
              {notebook.name}
            </h2>
          </div>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold border border-slate-700 flex-shrink-0 flex items-center gap-1">
          <Layers className="w-3 h-3 text-emerald-500" />
          Sources ({sources.length})
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab("file")}
          className={`flex items-center justify-center gap-1 py-2.5 border-b-2 transition-all ${
            activeTab === "file"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          File
        </button>
        <button
          onClick={() => setActiveTab("url")}
          className={`flex items-center justify-center gap-1 py-2.5 border-b-2 transition-all ${
            activeTab === "url"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          Add URL
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={`flex items-center justify-center gap-1 py-2.5 border-b-2 transition-all ${
            activeTab === "text"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Note
        </button>
      </div>

      {/* Inputs Area */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-800">
        {activeTab === "file" && (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={triggerLoadExample}
              disabled={isSubmitting || notebook.status === "processing"}
              className="w-full bg-slate-950 hover:bg-emerald-950/25 border border-emerald-900/40 hover:border-emerald-500/40 text-emerald-400 font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/10"
            >
              <FileText className="w-4 h-4" />
              Load example/Resume.pdf
            </button>
            <div className="text-[9px] text-slate-700 text-center font-bold tracking-widest uppercase">
              OR
            </div>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
                dragActive
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-slate-850 hover:border-slate-700 bg-slate-950/10 hover:bg-slate-950/30"
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                disabled={isSubmitting || notebook.status === "processing"}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center gap-1 text-center cursor-pointer w-full h-full"
              >
                {isSubmitting ? (
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-slate-500" />
                )}
                <div className="text-[11px] font-semibold text-slate-350">
                  {isSubmitting ? "Uploading..." : "Upload custom PDF / TXT"}
                </div>
                <p className="text-[9px] text-slate-500">
                  Click or drag & drop
                </p>
              </label>
            </div>
          </div>
        )}

        {activeTab === "url" && (
          <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2.5">
            <div className="relative">
              <Globe className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="url"
                required
                placeholder="https://example.com/terms"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isSubmitting || notebook.status === "processing"}
                className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg pl-8.5 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={
                isSubmitting || !urlInput || notebook.status === "processing"
              }
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-slate-950 font-bold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add Web Source
            </button>
          </form>
        )}

        {activeTab === "text" && (
          <form onSubmit={handleTextSubmit} className="flex flex-col gap-2.5">
            <input
              type="text"
              placeholder="Note Title (Optional)"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              disabled={isSubmitting || notebook.status === "processing"}
              className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition"
            />
            <textarea
              required
              rows={3}
              placeholder="Paste raw text details here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isSubmitting || notebook.status === "processing"}
              className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition resize-none"
            />
            <button
              type="submit"
              disabled={
                isSubmitting || !textInput || notebook.status === "processing"
              }
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-slate-950 font-bold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Save Text Note
            </button>
          </form>
        )}
      </div>

      {/* Progressive Pipeline Status Panel */}
      {pipelineJob && (
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-400 animate-pulse" />
              GraphRAG Pipeline Status
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase ${
                pipelineJob.status === "ready"
                  ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
                  : "bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 animate-pulse"
              }`}
            >
              {pipelineJob.status}
            </span>
          </div>
          <div className="space-y-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-850">
            {pipelineJob.steps.map((step) => (
              <div
                key={step.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="capitalize text-slate-450">
                  {step.name.replace(/_/g, " ")}
                </span>
                <span className="font-bold">
                  {step.status === "done" && (
                    <span className="text-emerald-500">✓ Completed</span>
                  )}
                  {step.status === "failed_fallback_used" && (
                    <span className="text-amber-500">⚠ Fallback Active</span>
                  )}
                  {step.status === "processing" && (
                    <span className="text-indigo-400 animate-pulse">
                      ● Running...
                    </span>
                  )}
                  {step.status === "pending" && (
                    <span className="text-slate-650">○ Pending</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          Ingested Documents
        </h3>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-xs">Loading sources...</span>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No sources ingested yet. Add one above!
          </div>
        ) : (
          sources.map((src) => (
            <div
              key={src.id}
              className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg hover:border-slate-700/80 transition-colors duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4
                    className="text-sm font-semibold truncate text-slate-200"
                    title={src.name}
                  >
                    {src.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold border border-slate-700/50">
                      {src.type}
                    </span>
                    {src.status === "ready" || src.status === "active" ? (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                      </span>
                    ) : src.status === "failed" ? (
                      <span className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Indexing
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteSource(src.id)}
                  title="Delete Document"
                  className="p-1 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded transition duration-150 cursor-pointer flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stats like entity count if active */}
              {(src.entity_count !== undefined ||
                src.chunk_count !== undefined) && (
                <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-slate-900/60 text-[10px] text-slate-400">
                  {src.entity_count !== undefined && (
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {src.entity_count} entities
                    </span>
                  )}
                  {src.chunk_count !== undefined && (
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      {src.chunk_count} chunks
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
