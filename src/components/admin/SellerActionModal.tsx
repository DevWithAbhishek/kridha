// src/components/admin/SellerActionModal.tsx
// Confirmation modal for VERIFY / REJECT / SUSPEND actions.
// Note field is optional for VERIFY/REJECT, required (min 10 chars) for SUSPEND.

'use client';

import { useState } from 'react';
import type { AdminAction } from '@/types/admin';

interface Props {
  action:    AdminAction;
  storeName: string;
  loading:   boolean;
  onConfirm: (note?: string) => void;
  onCancel:  () => void;
}

const CONFIG: Record<AdminAction, {
  label:      string;
  desc:       string;
  btnClass:   string;
  noteLabel:  string;
  noteReq:    boolean;
}> = {
  VERIFY: {
    label:     'Verify Seller',
    desc:      'Seller will be marked VERIFIED and KYC approved. They can now list products and receive payouts.',
    btnClass:  'bg-green-600 hover:bg-green-500',
    noteLabel: 'Note for audit log (optional)',
    noteReq:   false,
  },
  REJECT: {
    label:     'Reject Seller',
    desc:      'Seller will be marked DEACTIVATED and KYC rejected. They will need to re-apply.',
    btnClass:  'bg-red-600 hover:bg-red-500',
    noteLabel: 'Reason for rejection (optional)',
    noteReq:   false,
  },
  SUSPEND: {
    label:     'Suspend Seller',
    desc:      'Seller account will be deactivated. Existing orders are not affected. SUPER_ADMIN only.',
    btnClass:  'bg-red-700 hover:bg-red-600',
    noteLabel: 'Reason for suspension (required — min 10 chars)',
    noteReq:   true,
  },
};

export function SellerActionModal({ action, storeName, loading, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState('');
  const cfg = CONFIG[action];
  const canSubmit = !cfg.noteReq || note.trim().length >= 10;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 animate-scale-in">

        {/* Header */}
        <h2 className="text-lg font-bold text-white mb-1">{cfg.label}</h2>
        <p className="text-gray-400 text-sm mb-1">
          <span className="text-white font-medium">{storeName}</span>
        </p>
        <p className="text-gray-400 text-sm mb-5">{cfg.desc}</p>

        {/* Note field */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-300 block mb-1.5">
            {cfg.noteLabel}
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={cfg.noteReq ? 'Minimum 10 characters required...' : 'Optional...'}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-500 outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 resize-none transition-all"
          />
          {cfg.noteReq && note.trim().length > 0 && note.trim().length < 10 && (
            <p className="text-xs text-red-400 mt-1">{10 - note.trim().length} more characters needed</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-700 rounded-xl text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim() || undefined)}
            disabled={loading || !canSubmit}
            className={`flex-1 py-2.5 rounded-xl text-sm text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cfg.btnClass}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : cfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}
