'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { RecentActivity } from '@/lib/types';
import { Camera, Check, X, UserPlus, Clock, Sparkles } from 'lucide-react';

interface RecentActivityListProps {
  activities: RecentActivity[];
}

export const RecentActivityList: React.FC<RecentActivityListProps> = ({ activities }) => {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Recent Attendance Activity
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">Live Feed</span>
      </div>

      <div className="space-y-3">
        {activities.slice(0, 5).map((act) => {
          let icon = <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
          let iconBg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';

          if (act.type === 'classroom_scan') {
            icon = <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
            iconBg = 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800';
          } else if (act.status === 'absent') {
            icon = <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
            iconBg = 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
          } else if (act.type === 'student_added') {
            icon = <UserPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
            iconBg = 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
          }

          return (
            <div
              key={act.id}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${iconBg}`}>{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  {act.message}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                  <span>{act.time}</span>
                  {act.className && <span>• {act.className}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {activities.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">No recent activity logged yet.</p>
        )}
      </div>
    </Card>
  );
};
