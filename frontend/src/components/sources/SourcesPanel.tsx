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
  pipelineJobs: Record<string, PipelineJobResponse>;
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
  pipelineJobs,
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
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [fileSubmitting, setFileSubmitting] = useState(false);
  const [exampleSubmitting, setExampleSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const stepLabels: Record<string, string> = {
    load_file: "Source File Ingestion",
    mineru_parse: "Layout-Aware PDF Extraction",
    document_understanding: "Layout-Aware PDF Extraction",
    multi_modal_processing: "Layout-Aware PDF Extraction",
    multi_modal_enrichment: "Deep Layout Analysis & OCR",
    vector_graph_sync: "Vector & Graph Sync Orchestration",
    graph_rag_indexing: "Vector & Graph Sync Orchestration",
    chunking: "Hierarchical Parent-Child Chunking",
    entity_extraction: "Semantic Entity Extraction",
    relationship_extraction: "Meticulous Relation Mapping",
    neo4j_write: "ZeRAG Knowledge Graph Sync",
    vector_index: "Qdrant Dense Vector Indexing",
  };

  const toggleJobExpanded = (srcId: string) => {
    setExpandedJobs((prev) => ({ ...prev, [srcId]: !prev[srcId] }));
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    setUrlInput("");
    // Process concurrently in background
    void onAddUrl(url);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const title = noteTitle.trim();
    const content = title
      ? `Title: ${title}\n\n${textInput.trim()}`
      : textInput.trim();
    setTextInput("");
    setNoteTitle("");
    // Process concurrently in background
    void onAddText(content);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      e.target.value = ""; // Clear file input instantly for next selection
      // Process concurrently in background
      filesArray.forEach((file) => {
        void onUploadFile(file);
      });
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
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      // Process concurrently in background
      filesArray.forEach((file) => {
        void onUploadFile(file);
      });
    }
  };

  const triggerLoadExample = async () => {
    setExampleSubmitting(true);
    try {
      await onLoadExample();
    } finally {
      setExampleSubmitting(false);
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
                accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center gap-1 text-center cursor-pointer w-full h-full"
              >
                <UploadCloud className="w-6 h-6 text-slate-500" />
                <div className="text-[11px] font-semibold text-slate-350">
                  {fileSubmitting
                    ? "Enqueuing files..."
                    : "Upload PDF / TXT / Office"}
                </div>
                <p className="text-[9px] text-slate-500">
                  Click or drag & drop multiple files
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
                className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg pl-8.5 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-slate-950 font-bold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
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
              className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition"
            />
            <textarea
              required
              rows={3}
              placeholder="Paste raw text details here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition resize-none"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-slate-950 font-bold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Text Note
            </button>
          </form>
        )}
      </div>

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
          sources.map((src) => {
            const job =
              pipelineJobs[src.id] ||
              (src.pipeline_job_id
                ? pipelineJobs[src.pipeline_job_id]
                : undefined);
            const jobTerminal =
              !!job &&
              (job.status === "ready" ||
                job.status === "failed" ||
                (job.steps.length > 0 &&
                  job.steps.every(
                    (step) =>
                      step.status === "done" ||
                      step.status === "failed_fallback_used",
                  )) ||
                (job.percent ?? job.progress_percentage ?? 0) >= 100);
            const isProcessing =
              !jobTerminal &&
              src.status !== "ready" &&
              src.status !== "failed" &&
              src.status !== "active";
            const isExpanded = expandedJobs[src.id] ?? false;

            // Calculate progress percentage
            let progressPct = 0;
            if (job && job.percent !== undefined) {
              progressPct = job.percent;
            } else if (job && job.progress_percentage !== undefined) {
              progressPct = job.progress_percentage;
            } else if (job && job.steps) {
              const doneCount = job.steps.filter(
                (s) => s.status === "done",
              ).length;
              progressPct = Math.round((doneCount / job.steps.length) * 100);
            } else if (isProcessing) {
              progressPct = 15; // default starting point
            }

            return (
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
                      {src.status === "ready" ||
                      src.status === "active" ||
                      jobTerminal ? (
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
                        <button
                          onClick={() => toggleJobExpanded(src.id)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer outline-none border-none bg-transparent"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Indexing ({progressPct}%)
                        </button>
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

                {/* Individual Progress bar for active indexing jobs */}
                {isProcessing && (
                  <div className="mt-2.5">
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-950/40">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                    {job && (job.message || job.latest_message) && (
                      <div className="mt-1 text-[10px] font-bold text-violet-400/90 truncate animate-pulse">
                        {job.message || job.latest_message}
                      </div>
                    )}
                    <button
                      onClick={() => toggleJobExpanded(src.id)}
                      className="mt-1.5 text-[9px] font-bold text-slate-500 hover:text-slate-350 tracking-wider uppercase flex items-center gap-1 cursor-pointer border-none bg-transparent"
                    >
                      {isExpanded
                        ? "Hide Pipeline Status"
                        : "View Pipeline Status"}
                    </button>
                  </div>
                )}

                {/* Collapsible Pipeline steps for this specific card */}
                {isProcessing && isExpanded && job && (
                  <div className="mt-2.5 space-y-1.5 bg-slate-950 p-2.5 rounded border border-transparent text-[10px] font-mono leading-normal">
                    {job.steps.map((step) => (
                      <div
                        key={step.name}
                        className="flex items-center justify-between"
                      >
                        <span className="capitalize text-slate-500">
                          {stepLabels[step.name] ||
                            step.name.replace(/_/g, " ")}
                        </span>
                        <span className="font-bold">
                          {step.status === "done" && (
                            <span className="text-emerald-500">✓ Done</span>
                          )}
                          {step.status === "failed_fallback_used" && (
                            <span className="text-rose-500">⚠ Fallback</span>
                          )}
                          {step.status === "processing" && (
                            <span className="text-indigo-400 animate-pulse">
                              ● Run...
                            </span>
                          )}
                          {step.status === "pending" && (
                            <span className="text-slate-700">○ Pend</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats like entity count if active */}
                {((src.entity_count || 0) > 0 ||
                  (src.chunk_count || 0) > 0) && (
                  <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-slate-900/60 text-[10px] text-slate-400">
                    {(src.entity_count || 0) > 0 && (
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {src.entity_count} entities
                      </span>
                    )}
                    {(src.chunk_count || 0) > 0 && (
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        {src.chunk_count} chunks
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
