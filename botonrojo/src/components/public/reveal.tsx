"use client";

import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

type Props = { children: React.ReactNode; className?: string; id?: string };

/** Scroll-reveal wrapper for a landing section. Wrap direct children in
 * <RevealItem> to stagger them individually; otherwise the whole block
 * fades/slides in together. */
export function Reveal({ children, className, id }: Props) {
  return (
    <motion.div
      id={id}
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, id }: Props) {
  return (
    <motion.div id={id} className={className} variants={item}>
      {children}
    </motion.div>
  );
}
