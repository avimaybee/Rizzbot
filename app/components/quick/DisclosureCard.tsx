import type React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";

interface DisclosureCardProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function DisclosureCard({ title, open, onToggle, children }: DisclosureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: 0.28 }}
      className="mt-3"
      style={{ backgroundColor: "#FDFAF5", borderRadius: 16, overflow: "hidden" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between cursor-pointer"
        style={{ minHeight: 44, padding: "12px 14px", background: "none", border: "none" }}
        aria-expanded={open}
      >
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>
          {title}
        </span>
        <ChevronRight size={18} strokeWidth={2} color={open ? "#C8522A" : "rgba(26,18,8,0.4)"} style={{ transition: "transform 0.2s ease", transform: open ? "rotate(90deg)" : "none" }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="context"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
