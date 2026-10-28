// Lightweight, accessible toast notifications for save / submit / grade / account feedback.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string; detail?: string }

interface ToastApi {
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const styles: Record<ToastKind, { box: string; icon: React.ReactNode }> = {
  success: { box: 'border-emerald-200 bg-white', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
  error: { box: 'border-rose-200 bg-white', icon: <AlertCircle className="h-5 w-5 text-rose-600" /> },
  info: { box: 'border-navy-100 bg-white', icon: <Info className="h-5 w-5 text-navy-600" /> }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems(current => current.filter(item => item.id !== id)), []);

  const push = useCallback((kind: ToastKind, message: string, detail?: string) => {
    const id = nextId.current++;
    setItems(current => [...current.slice(-3), { id, kind, message, detail }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (message, detail) => push('success', message, detail),
    error: (message, detail) => push('error', message, detail),
    info: (message, detail) => push('info', message, detail)
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite" aria-atomic="false">
        {items.map(item => (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-premium-lg ${styles[item.kind].box}`}
          >
            <span className="mt-0.5 shrink-0">{styles[item.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-900">{item.message}</p>
              {item.detail && <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>}
            </div>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const errorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') =>
  error instanceof Error && error.message ? error.message : fallback;
