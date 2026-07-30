"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// With reduced motion the content must simply be there — not slide in faster.
// A CSS-only override can't achieve that, since these transforms come from JS.
const staticContainer: Variants = { hidden: {}, show: {} };
const staticItem: Variants = { hidden: { opacity: 1 }, show: { opacity: 1 } };

type Props = { children: React.ReactNode; className?: string; id?: string };

/** Scroll-reveal wrapper for a landing section. Wrap direct children in
 * <RevealItem> to stagger them individually; otherwise the whole block
 * fades/slides in together. */
export function Reveal({ children, className, id }: Props) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      id={id}
      className={className}
      initial={reduced ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={reduced ? staticContainer : container}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, id }: Props) {
  const reduced = useReducedMotion();
  return (
    <motion.div id={id} className={className} variants={reduced ? staticItem : item}>
      {children}
    </motion.div>
  );
}
