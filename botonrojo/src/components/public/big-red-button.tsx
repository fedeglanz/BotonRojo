"use client";

import { motion } from "framer-motion";
import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
};

export function BigRedButton({ href, children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex justify-center"
    >
      <Link href={href} className="big-red-button" prefetch={false}>
        <span className="relative z-10 flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"
          />
          {children}
        </span>
      </Link>
    </motion.div>
  );
}
