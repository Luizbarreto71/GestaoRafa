import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-navy-900 text-white hover:bg-navy-800 focus-visible:ring-navy-900 dark:bg-accent dark:hover:bg-accent-soft',
  secondary:
    'bg-slate-100 text-navy-900 hover:bg-slate-200 dark:bg-navy-700 dark:text-slate-100 dark:hover:bg-navy-600',
  success: 'bg-success text-white hover:bg-success-soft focus-visible:ring-success',
  danger: 'bg-danger text-white hover:bg-danger-soft focus-visible:ring-danger',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-navy-900 dark:text-slate-400 dark:hover:bg-navy-700 dark:hover:text-slate-100',
  outline:
    'border border-slate-300 bg-transparent text-navy-900 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-100 dark:hover:bg-navy-800',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
  icon: 'h-9 w-9 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-900',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
