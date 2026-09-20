import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StarSticker } from './Bits';
import { useStudio } from '../../context/StudioContext';

/** Small playful notification, bottom-right. */
export const Toast: React.FC = () => {
  const { toast } = useStudio();
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-2">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-ink px-5 py-3.5 text-paper shadow-lift"
          >
            <StarSticker className="w-6 shrink-0 animate-wiggle" />
            <span className="text-sm font-semibold">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
