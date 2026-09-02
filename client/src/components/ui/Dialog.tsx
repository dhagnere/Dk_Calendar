import { type ReactNode, useEffect } from 'react';

export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <h3 className="font-semibold capitalize text-slate-800">{title}</h3>
      <button className="text-xl leading-none text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Fermer">
        ×
      </button>
    </div>
  );
}

export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="overflow-y-auto p-4">{children}</div>;
}
