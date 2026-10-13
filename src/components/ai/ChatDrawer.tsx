'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Bot, Send, Sparkles, User, HelpCircle, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
}

export const ChatDrawer: React.FC = () => {
  const { students, classes, threshold, dashboardMetrics, getStudentStats } = useAttendance();

  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      sender: 'assistant',
      text: `👋 Hi! I am **ATTENDER AI**, your intelligent attendance assistant.\n\nYou can ask me natural-language questions about attendance rates, at-risk students, or monthly summaries!`,
      time: 'Just now',
    },
  ]);

  const quickQuestions = [
    'Who has attendance below 75%?',
    'Who has the best attendance?',
    'How many students were absent today?',
    'Which student has missed the most classes?',
    'Summarize October attendance.',
    'Which students are at risk of falling below 75%?',
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isLoading) return;

    setInputQuestion('');

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: q,
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Assemble structured data context
      const studentStats = students
        .map((s) => getStudentStats(s.id))
        .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          context: {
            students,
            classes,
            studentStats,
            metrics: dashboardMetrics,
            threshold,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process AI question.');
      }

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'I could not generate an answer right now.',
        time: 'Just now',
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'assistant',
        text: err?.message || 'Sorry, I encountered an issue analyzing the attendance database. Please try again.',
        time: 'Just now',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="none" className="flex flex-col h-[650px] shadow-lg border-indigo-100 dark:border-indigo-950/60 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              ATTENDER AI
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/20 text-white">
                Gemini Powered
              </span>
            </h3>
            <p className="text-[11px] text-white/80">Natural-language attendance query agent</p>
          </div>
        </div>

        <Sparkles className="w-4 h-4 text-amber-300" />
      </div>

      {/* Suggested Questions Pills */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 overflow-x-auto flex gap-2 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1 shrink-0 flex items-center gap-1">
          <HelpCircle className="w-3 h-3" /> Quick:
        </span>
        {quickQuestions.map((qq) => (
          <button
            key={qq}
            onClick={() => handleSend(qq)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            {qq}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                m.sender === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-indigo-600 text-white shadow-sm'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              <span
                className={`block text-[9px] mt-1.5 ${
                  m.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                }`}
              >
                {m.time}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-tl-none flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Analyzing attendance records...</span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            placeholder="Ask anything (e.g. 'Who missed the most classes?')..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!inputQuestion.trim() || isLoading}
            isLoading={isLoading}
            className="px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};
