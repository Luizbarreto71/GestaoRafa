import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type Tone = 'navy' | 'success' | 'danger' | 'warning' | 'accent' | 'purple';

const TONES: Record<Tone, { icon: string; ring: string }> = {
  navy: { icon: 'bg-navy-900 text-white dark:bg-navy-700', ring: 'ring-navy-900/10' },
  success: { icon: 'bg-success-bg text-success dark:bg-success/20 dark:text-success-soft', ring: 'ring-success/10' },
  danger: { icon: 'bg-danger-bg text-danger dark:bg-danger/20 dark:text-danger-soft', ring: 'ring-danger/10' },
  warning: { icon: 'bg-warning-bg text-warning dark:bg-warning/20 dark:text-warning-soft', ring: 'ring-warning/10' },
  accent: { icon: 'bg-blue-100 text-accent dark:bg-accent/20 dark:text-accent-soft', ring: 'ring-accent/10' },
  purple: { icon: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', ring: 'ring-purple-500/10' },
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: { value: number; label?: string };
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'navy', trend, loading, onClick }: StatCardProps) {
  if (loading) {
    return (
      <div className="card p-5">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-3 h-8 w-32" />
        <div className="skeleton mt-3 h-3 w-20" />
      </div>
    );
  }

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'card group p-5 text-left transition',
        onClick && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            {value}
          </p>
        </div>

        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONES[tone].icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {(hint || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold',
                trend.value >= 0
                  ? 'bg-success-bg text-success dark:bg-success/15 dark:text-success-soft'
                  : 'bg-danger-bg text-danger dark:bg-danger/15 dark:text-danger-soft',
              )}
            >
              {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend.value).toFixed(0)}%
            </span>
          )}
          {hint && <span className="truncate text-slate-500 dark:text-slate-400">{hint}</span>}
        </div>
      )}
    </Wrapper>
  );
}
