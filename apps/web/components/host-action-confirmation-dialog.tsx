'use client';

import { AlertTriangle, X } from 'lucide-react';

type ConfirmationCheckbox = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  helpText?: string;
  onChange: (checked: boolean) => void;
};

export function HostActionConfirmationDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  variant,
  busy,
  checkbox,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  variant: 'warning' | 'danger';
  busy: boolean;
  checkbox?: ConfirmationCheckbox;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const accent =
    variant === 'danger'
      ? 'border-red-400/30 bg-red-500/15 text-red-100'
      : 'border-amber-400/30 bg-amber-500/15 text-amber-100';

  const confirmStyle =
    variant === 'danger' ? 'bg-red-700 hover:bg-red-600' : 'bg-amber-600 hover:bg-amber-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-slate-900 shadow-2xl"
      >
        <button
          type="button"
          title={closeLabel}
          aria-label={closeLabel}
          disabled={busy}
          onClick={onCancel}
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-slate-950/80 disabled:opacity-50"
        >
          <X aria-hidden size={19} />
        </button>

        <div className="p-6 sm:p-7">
          <div className={`flex size-12 items-center justify-center rounded-2xl border ${accent}`}>
            <AlertTriangle aria-hidden size={24} />
          </div>

          <h2 className="mt-5 pr-10 text-2xl font-black">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>

          {checkbox ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checkbox.checked}
                  disabled={checkbox.disabled || busy}
                  onChange={(event) => checkbox.onChange(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-violet-500"
                />
                <span>
                  <strong className="block text-sm text-white">{checkbox.label}</strong>
                  {checkbox.helpText ? (
                    <span className="mt-1 block text-xs text-slate-400">{checkbox.helpText}</span>
                  ) : null}
                </span>
              </label>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="min-h-11 rounded-xl bg-slate-700 px-5 py-2.5 font-bold hover:bg-slate-600 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`min-h-11 rounded-xl px-5 py-2.5 font-bold disabled:cursor-wait disabled:opacity-60 ${confirmStyle}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
