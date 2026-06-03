import React, { useState } from 'react';
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
  Layers
} from 'lucide-react';
import { SourceListItem } from '../../lib/types';

interface SourcesPanelProps {
  sources: SourceListItem[];
  loading: boolean;
  onAddUrl: (url: string) => Promise<void>;
  onAddText: (text: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  loading,
  onAddUrl,
  onAddText,
  onUploadFile,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'text' | 'file'>('url');

  // Tab states
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddUrl(urlInput.trim());
      setUrlInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    setIsSubmitting(true);
    try {
      // Combining title and content or just passing text
      const content = noteTitle.trim()
        ? `Title: ${noteTitle.trim()}\n\n${textInput.trim()}`
        : textInput.trim();
      await onAddText(content);
      setTextInput('');
      setNoteTitle('');
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

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Title Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-500 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
            InsightNote
          </h1>
        </div>
        <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-semibold border border-slate-700 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-500" />
          Sources ({sources.length})
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-slate-800 text-sm">
        <button
          onClick={() => setActiveTab('url')}
          className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition-all ${
            activeTab === 'url'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Link2 className="w-4 h-4" />
          Add URL
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition-all ${
            activeTab === 'text'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Note
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition-all ${
            activeTab === 'file'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          File
        </button>
      </div>

      {/* Inputs Area */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-800">
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2.5">
            <div className="relative">
              <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="url"
                required
                placeholder="https://example.com/policy-terms"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !urlInput}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-slate-950 font-semibold text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Web Source
            </button>
          </form>
        )}

        {activeTab === 'text' && (
          <form onSubmit={handleTextSubmit} className="flex flex-col gap-2.5">
            <input
              type="text"
              placeholder="Note Title (Optional)"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition"
            />
            <textarea
              required
              rows={3}
              placeholder="Paste raw text details here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition resize-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !textInput}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-slate-950 font-semibold text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Save Text Note
            </button>
          </form>
        )}

        {activeTab === 'file' && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
              dragActive
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/40'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="hidden"
            />
            <label htmlFor="file-upload" className="flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer w-full h-full">
              {isSubmitting ? (
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8 text-slate-400" />
              )}
              <div className="text-xs font-semibold text-slate-300">
                {isSubmitting ? 'Uploading...' : 'Click to upload or drag & drop'}
              </div>
              <p className="text-[10px] text-slate-500">PDF or TXT (up to 10MB)</p>
            </label>
          </div>
        )}
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Ingested Documents
        </h3>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
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
                  <h4 className="text-sm font-semibold truncate text-slate-200" title={src.name}>
                    {src.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold border border-slate-700/50">
                      {src.type}
                    </span>
                    {src.status === 'ready' || src.status === 'active' ? (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                      </span>
                    ) : src.status === 'failed' ? (
                      <span className="text-[10px] text-red-500 flex items-center gap-1 font-medium">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Indexing
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats like entity count if active */}
              {(src.entity_count !== undefined || src.chunk_count !== undefined) && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                  {src.entity_count !== undefined && (
                    <span className="flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {src.entity_count} entities
                    </span>
                  )}
                  {src.chunk_count !== undefined && (
                    <span className="flex items-center gap-1 font-semibold">
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
