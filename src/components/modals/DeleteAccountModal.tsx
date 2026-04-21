'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useLangStore } from '@/stores/langStore';

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ open, onClose }: Props) {
  const { lang }   = useLangStore();
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const CONFIRM_PHRASE = 'DELETE';

  async function handleDelete() {
    if (confirm !== CONFIRM_PHRASE) return;
    setLoading(true);
    setError(null);
    try {
      await api.delete('/users/me');
      // Clear cookies → server handles it. Redirect to home.
      window.location.href = '/';
    } catch {
      setError(lang === 'hi' ? 'Account delete नहीं हुआ — retry करें' : 'Delete failed — please retry');
      setLoading(false);
    }
  }

  function handleClose() { if (!loading) { setConfirm(''); setError(null); onClose(); } }

  return (
    <Dialog.Root open={open} onOpenChange={o => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">

          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-error" />
            </div>
            <button onClick={handleClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
          </div>

          <Dialog.Title className="text-h5 font-bold text-[var(--color-text)] mb-1">
            {lang === 'hi' ? 'Account permanently delete करें?' : 'Delete account permanently?'}
          </Dialog.Title>
          <Dialog.Description className="text-body-sm text-muted-DEFAULT dark:text-muted-dark mb-5 leading-relaxed">
            {lang === 'hi'
              ? 'यह action undo नहीं होगी। आपका store, products, और orders history permanently हट जाएगी।'
              : 'This cannot be undone. Your store, products, and order history will be permanently removed.'}
          </Dialog.Description>

          <div className="mb-4">
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-2">
              {lang === 'hi' ? `Confirm करने के लिए "${CONFIRM_PHRASE}" type करें:` : `Type "${CONFIRM_PHRASE}" to confirm:`}
            </p>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="w-full px-3 py-2.5 border border-border-DEFAULT dark:border-border-dark rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-error focus:ring-2 focus:ring-error/20 transition-all font-mono tracking-widest"
            />
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error">{error}</div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button
              type="button" variant="danger" size="lg" className="flex-1"
              disabled={confirm !== CONFIRM_PHRASE || loading}
              loading={loading}
              onClick={handleDelete}
            >
              {lang === 'hi' ? 'Delete करें' : 'Delete Account'}
            </Button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
