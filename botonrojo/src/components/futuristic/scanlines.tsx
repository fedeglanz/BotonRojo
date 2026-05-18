"use client";

import { motion } from "framer-motion";

export function Scanlines() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 opacity-[0.04]"
      style={{
        background:
          "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
      }}
      animate={{ y: [0, 3, 0] }}
      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
    />
  );
}
