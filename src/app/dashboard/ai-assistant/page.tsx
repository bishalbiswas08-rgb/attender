'use client';

import React from 'react';
import { ChatDrawer } from '@/components/ai/ChatDrawer';
import { Bot, Sparkles, ShieldCheck, Database } from 'lucide-react';

export default function AIAssistantPage() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bot className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            ATTENDER AI
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
            Gemini Assistant
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ask questions in plain English to uncover attendance anomalies, summarize months, and identify students at risk.
        </p>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ChatDrawer />
        </div>

        {/* Info & Security Column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              What can you ask?
            </h4>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-disc list-inside">
              <li>&ldquo;Who has attendance below 75%?&rdquo;</li>
              <li>&ldquo;Who has the best attendance in the class?&rdquo;</li>
              <li>&ldquo;How many students were absent today?&rdquo;</li>
              <li>&ldquo;Which student has missed the most classes?&rdquo;</li>
              <li>&ldquo;Summarize October attendance.&rdquo;</li>
              <li>&ldquo;Which students are at risk of falling behind?&rdquo;</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/50 space-y-2">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Controlled Data Access Architecture
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              ATTENDER operates under strict security guidelines. Gemini never executes arbitrary SQL or touches raw database credentials. The backend safely aggregates only necessary summary data before providing it to the AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
