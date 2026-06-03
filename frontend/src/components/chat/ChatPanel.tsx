import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  User,
  Compass,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  BrainCircuit,
  Terminal,
  HelpCircle
} from 'lucide-react';
import { ChatMessage } from '../../lib/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
}

const PRESET_BADGES = [
  "What is the main coverage of this policy?",
  "Does this policy cover motorcycle accidents?",
  "What exclusions apply to vehicle accidents?",
  "Which clauses support your answer?",
  "Show me the reasoning path in the graph."
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleBadgeClick = (question: string) => {
    if (isLoading) return;
    onSendMessage(question);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold tracking-tight text-slate-200">
            AI Copilot & Reasoning
          </h2>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
          Powered by ZeRAG & Neo4j
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/5">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-200">Start an Insurance Inquiry</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask anything about the active policies, coverage clauses, or exclusions. The AI will query the 3D Knowledge Graph and retrieve grounded citations.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isLoading && <LoadingSkeleton />}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Controls / Input */}
      <div className="p-4 border-t border-slate-900 bg-slate-900/30">
        {/* Preset Badges */}
        <div className="mb-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            Insurance Domain Preset Inquiries (Click to run)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_BADGES.map((badge, idx) => (
              <button
                key={idx}
                onClick={() => handleBadgeClick(badge)}
                disabled={isLoading}
                className="text-[11px] font-medium bg-slate-900/80 hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/40 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-full transition duration-150 cursor-pointer disabled:opacity-50 disabled:hover:bg-slate-900/80 disabled:hover:text-slate-400 disabled:hover:border-slate-800 disabled:cursor-not-allowed"
              >
                {badge}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <input
            type="text"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Type your question (e.g. Does John Doe cover motorcycles?)..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm placeholder-slate-600 outline-none text-slate-100 disabled:opacity-60 transition"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-slate-950 font-bold px-4 rounded-xl flex items-center justify-center transition duration-150 shadow-lg shadow-indigo-500/15 cursor-pointer h-[44px] w-[44px]"
          >
            <Send className="w-4 h-4 text-slate-100" />
          </button>
        </form>
      </div>
    </div>
  );
};

/* Individual Message Bubble Helper with expandable Steps */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isAssistant = message.role === 'assistant';
  const [stepsExpanded, setStepsExpanded] = useState(false);

  return (
    <div className={`flex gap-3.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      {isAssistant && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-500 p-[1px] flex-shrink-0">
          <div className="w-full h-full rounded-[7px] bg-slate-950 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
        </div>
      )}

      <div className={`max-w-[85%] flex flex-col gap-2.5`}>
        {/* Actual Content Bubble */}
        <div
          className={`p-3.5 rounded-2xl text-sm leading-relaxed border ${
            isAssistant
              ? 'bg-slate-900 border-slate-800 text-slate-100'
              : 'bg-indigo-600 border-indigo-500/30 text-white font-medium rounded-tr-none shadow-lg shadow-indigo-600/10'
          }`}
        >
          {message.content}
        </div>

        {/* Collapsible Retrieval steps (Assistant only) */}
        {isAssistant && message.retrieval_steps && message.retrieval_steps.length > 0 && (
          <div className="border border-slate-800 bg-slate-950/40 rounded-xl overflow-hidden">
            <button
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition bg-slate-900/20"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                Retrieval & Reasoning Steps ({message.retrieval_steps.length})
              </span>
              {stepsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {stepsExpanded && (
              <div className="p-3 border-t border-slate-900 space-y-2 text-xs font-mono text-slate-400 bg-slate-950/80">
                {message.retrieval_steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold select-none">{`>`}</span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Citation Cards (Assistant only) */}
        {isAssistant && message.citations && message.citations.length > 0 && (
          <div className="space-y-1.5 mt-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-emerald-500" />
              Grounded Citations
            </div>
            <div className="grid grid-cols-1 gap-2">
              {message.citations.map((cite, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-xl hover:border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1 truncate">
                      {cite.title}
                    </span>
                    <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900 font-semibold flex-shrink-0">
                      Score: {Math.round(cite.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed italic">
                    "{cite.text}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300 flex-shrink-0">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

/* Chat Skeletons */
const LoadingSkeleton = () => {
  return (
    <div className="flex gap-3.5 justify-start">
      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
        <Sparkles className="w-4.5 h-4.5 animate-pulse" />
      </div>
      <div className="max-w-[70%] w-full flex flex-col gap-2">
        <div className="p-3.5 bg-slate-900 border border-slate-800/60 rounded-2xl space-y-2.5 animate-pulse">
          <div className="h-3 bg-slate-800 rounded w-[95%]"></div>
          <div className="h-3 bg-slate-800 rounded w-[85%]"></div>
          <div className="h-3 bg-slate-800 rounded w-[50%]"></div>
        </div>
      </div>
    </div>
  );
};
