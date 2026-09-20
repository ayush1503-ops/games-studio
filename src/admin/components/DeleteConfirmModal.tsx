import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete Permanently',
  onConfirm,
  onClose,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md rounded-[24px] border-2 border-ink bg-cream p-6 shadow-lift"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-inksoft hover:text-ink cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 text-coral mb-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-ink bg-coral/10">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-ink uppercase tracking-tight">{title}</h3>
              <p className="text-xs font-semibold text-coral">Destructive Action Confirmation</p>
            </div>
          </div>

          <p className="text-sm font-medium text-inksoft mb-6 leading-relaxed">
            {message}
          </p>

          <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-ink/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border-2 border-ink/20 bg-cream px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink hover:bg-sand cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="rounded-xl border-2 border-ink bg-coral px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker-sm hover:bg-coraldeep cursor-pointer"
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
