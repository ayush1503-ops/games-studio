import React, { useEffect } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';

/**
 * Studio OS design kit.
 *
 * Deliberately hand-built for this game studio: chunky ink borders, sticker
 * shadows, Bricolage display type and the same palette as the public site — so
 * the console reads as part of the studio rather than a generic dashboard.
 */

export const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

/* --------------------------------- surfaces -------------------------------- */

export const Panel: React.FC<{ children: React.ReactNode; className?: string; tone?: 'cream' | 'sand' | 'ink' }> = ({
  children,
  className,
  tone = 'cream',
}) => (
  <section
    className={cx(
      'rounded-3xl border-2 border-ink shadow-sticker-sm',
      tone === 'cream' && 'bg-cream',
      tone === 'sand' && 'bg-sand',
      tone === 'ink' && 'bg-ink text-paper',
      className
    )}
  >
    {children}
  </section>
);

export const PageHeader: React.FC<{
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <header className="mb-8 flex flex-col gap-5 border-b-2 border-ink/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-grape">
        <span className="h-1.5 w-1.5 rounded-full bg-coral" />
        {eyebrow}
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      {description && <p className="mt-2 max-w-2xl text-sm font-medium text-inksoft">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink/10 px-5 py-3.5">
    <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-ink">{children}</h2>
    {hint && <span className="text-[11px] font-bold uppercase tracking-wider text-inksoft">{hint}</span>}
  </div>
);

/* --------------------------------- controls -------------------------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cx(
      'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 font-extrabold uppercase tracking-wider transition-all cursor-pointer',
      'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:translate-y-0',
      size === 'sm' ? 'px-3.5 py-2 text-[11px]' : 'px-5 py-2.5 text-xs',
      variant === 'primary' &&
        'border-ink bg-grape text-white shadow-sticker-sm hover:-translate-y-0.5 hover:bg-grapedeep',
      variant === 'secondary' && 'border-ink bg-cream text-ink shadow-sticker-sm hover:-translate-y-0.5 hover:bg-sun',
      variant === 'sun' && 'border-ink bg-sun text-ink shadow-sticker-sm hover:-translate-y-0.5 hover:bg-lime',
      variant === 'danger' && 'border-ink bg-coral text-white shadow-sticker-sm hover:-translate-y-0.5 hover:bg-coraldeep',
      variant === 'ghost' && 'border-transparent bg-transparent text-inksoft hover:border-ink/20 hover:text-ink',
      className
    )}
  >
    {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
    {children}
  </button>
);

export const Field: React.FC<{ label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }> = ({
  label,
  hint,
  error,
  children,
  className,
}) => (
  <label className={cx('block', className)}>
    <span className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-inksoft">{label}</span>
      {hint && <span className="text-[10px] font-semibold text-inksoft/80">{hint}</span>}
    </span>
    {children}
    {error && <span className="mt-1 block text-[11px] font-bold text-coraldeep">{error}</span>}
  </label>
);

const controlClass =
  'w-full rounded-xl border-2 border-ink/20 bg-cream px-3.5 py-2.5 text-sm font-semibold text-ink placeholder:text-inksoft/60 outline-none transition-colors focus:border-grape focus:bg-white';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...rest }) => (
  <input {...rest} className={cx(controlClass, className)} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cx(controlClass, 'min-h-28 leading-relaxed', className)} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <select {...rest} className={cx(controlClass, 'cursor-pointer appearance-none pr-8', className)}>
    {children}
  </select>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label?: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={cx(
      'inline-flex items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 text-xs font-extrabold uppercase tracking-wider shadow-sticker-sm transition-colors cursor-pointer',
      checked ? 'bg-lime text-ink' : 'bg-sand text-inksoft'
    )}
    aria-pressed={checked}
  >
    <span className={cx('grid h-5 w-9 place-items-center rounded-full border-2 border-ink', checked ? 'bg-ink' : 'bg-cream')}>
      <span className={cx('h-3 w-3 rounded-full transition-transform', checked ? 'translate-x-2 bg-lime' : '-translate-x-2 bg-ink/40')} />
    </span>
    {label}
  </button>
);

export const SearchInput: React.FC<{ value: string; onChange: (value: string) => void; placeholder?: string; className?: string }> = ({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}) => (
  <div className={cx('relative', className)}>
    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-inksoft" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cx(controlClass, 'pl-9 pr-9')}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-inksoft hover:text-ink cursor-pointer"
        aria-label="Clear search"
      >
        <X size={13} />
      </button>
    )}
  </div>
);

/* ---------------------------------- badges --------------------------------- */

const TONES = {
  grape: 'bg-grape text-white',
  coral: 'bg-coral text-white',
  sun: 'bg-sun text-ink',
  lime: 'bg-lime text-ink',
  sky: 'bg-sky text-ink',
  ink: 'bg-ink text-paper',
  muted: 'bg-sand text-inksoft',
} as const;

export type Tone = keyof typeof TONES;

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'muted',
  children,
  className,
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider',
      TONES[tone],
      className
    )}
  >
    {children}
  </span>
);

export const statusTone = (status: string): Tone => {
  const value = status.toLowerCase();
  if (['published', 'open', 'active', 'available now', 'replied'].some((key) => value.includes(key))) return 'lime';
  if (['draft', 'closed', 'unsubscribed', 'archived', 'in development'].some((key) => value.includes(key)))
    return 'muted';
  if (['unread', 'banned', 'spam', 'wishlist now'].some((key) => value.includes(key))) return 'coral';
  if (['reviewed', 'early access', 'press', 'moderator'].some((key) => value.includes(key))) return 'sky';
  if (['featured', 'sale'].some((key) => value.includes(key))) return 'sun';
  return 'grape';
};

export const Dot: React.FC<{ tone?: Tone; className?: string }> = ({ tone = 'coral', className }) => (
  <span className={cx('inline-block h-2 w-2 rounded-full border border-ink/20', TONES[tone].split(' ')[0], className)} />
);

/* ---------------------------------- tables --------------------------------- */

export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; className?: string }> = ({
  head,
  children,
  className,
}) => (
  <div className={cx('overflow-x-auto', className)}>
    <table className="w-full min-w-[720px] border-collapse text-left">
      <thead>
        <tr className="border-b-2 border-ink/15 bg-sand/70">
          {head.map((cell, index) => (
            <th key={index} className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-inksoft">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y-2 divide-ink/5">{children}</tbody>
    </table>
  </div>
);

export const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <tr className={cx('bg-cream transition-colors hover:bg-sand/60', className)}>{children}</tr>
);

export const Cell: React.FC<{ children: React.ReactNode; className?: string; label?: string }> = ({
  children,
  className,
  label,
}) => (
  <td data-label={label} className={cx('px-4 py-3.5 align-middle text-sm font-semibold text-ink', className)}>
    {children}
  </td>
);

export const Pagination: React.FC<{
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}> = ({ page, pages, total, onPage }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/10 px-5 py-3.5">
    <span className="text-[11px] font-bold uppercase tracking-wider text-inksoft">
      Page {page} of {Math.max(1, pages)} · {total} record{total === 1 ? '' : 's'}
    </span>
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" icon={<ChevronLeft size={13} />} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next <ChevronRight size={13} />
      </Button>
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
    <div className="grid h-14 w-14 rotate-3 place-items-center rounded-2xl border-2 border-ink bg-sun shadow-sticker-sm">
      <AlertTriangle size={22} className="text-ink" />
    </div>
    <h3 className="font-display text-lg font-extrabold uppercase text-ink">{title}</h3>
    {description && <p className="max-w-md text-sm font-medium text-inksoft">{description}</p>}
    {action}
  </div>
);

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading studio data…' }) => (
  <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-bold uppercase tracking-wider text-inksoft">
    <Loader2 size={16} className="animate-spin" />
    {label}
  </div>
);

export const Alert: React.FC<{ tone?: 'error' | 'success' | 'info'; children: React.ReactNode; className?: string }> = ({
  tone = 'info',
  children,
  className,
}) => (
  <div
    className={cx(
      'flex items-start gap-2 rounded-2xl border-2 border-ink px-4 py-3 text-xs font-bold shadow-sticker-sm',
      tone === 'error' && 'bg-coral text-white',
      tone === 'success' && 'bg-lime text-ink',
      tone === 'info' && 'bg-sky/30 text-ink',
      className
    )}
  >
    {tone === 'success' ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
    <div className="space-y-1">{children}</div>
  </div>
);

/* ---------------------------------- modals --------------------------------- */

export const Modal: React.FC<{
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}> = ({ open, title, eyebrow, onClose, children, footer, width = 'lg' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'w-full animate-pop rounded-[26px] border-2 border-ink bg-paper shadow-lift',
          width === 'md' && 'max-w-lg',
          width === 'lg' && 'max-w-3xl',
          width === 'xl' && 'max-w-5xl'
        )}
      >
        <div className="flex items-start justify-between gap-4 rounded-t-[24px] border-b-2 border-ink bg-ink px-5 py-4 text-paper">
          <div>
            {eyebrow && <div className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-sun">{eyebrow}</div>}
            <h2 className="font-display text-xl font-extrabold uppercase leading-tight">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border-2 border-paper/25 p-1.5 text-paper/80 transition-colors hover:border-sun hover:text-sun cursor-pointer"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t-2 border-ink/10 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  tone?: 'danger' | 'primary';
}> = ({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, loading, tone = 'danger' }) => (
  <Modal
    open={open}
    title={title}
    eyebrow="Confirm"
    onClose={onClose}
    width="md"
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="space-y-3 text-sm font-semibold text-inksoft">{message}</div>
  </Modal>
);

/* ------------------------------- data helpers ------------------------------ */

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'grape', icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={cx(
      'relative overflow-hidden rounded-3xl border-2 border-ink bg-cream p-5 text-left shadow-sticker-sm transition-all',
      onClick ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
    )}
  >
    <span className={cx('absolute -right-6 -top-6 h-20 w-20 rotate-12 rounded-2xl border-2 border-ink', TONES[tone].split(' ')[0])} />
    <span className="relative flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-inksoft">
      {icon}
      {label}
    </span>
    <div className="relative mt-3 font-display text-3xl font-extrabold leading-none text-ink">{value}</div>
    {hint && <div className="relative mt-2 text-[11px] font-bold uppercase tracking-wider text-inksoft">{hint}</div>}
  </button>
);

export const formatDate = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const relativeTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '—';
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
};

/** Small dependency-free confirmation prompt used for typed confirmations. */
export const TypeToConfirm: React.FC<{
  value: string;
  onChange: (value: string) => void;
  expected: string;
  label?: string;
}> = ({ value, onChange, expected, label }) => (
  <Field label={label ?? `Type “${expected}” to confirm`} hint="required">
    <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={expected} autoComplete="off" />
  </Field>
);
