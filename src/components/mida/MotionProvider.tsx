"use client";

import { MotionConfig } from "motion/react";

/**
 * The CSS reduced-motion rule cannot reach motion/react animations — they
 * are driven by JS. This makes the library honour the OS setting too, so
 * slides, crossfades and reveals stop for users who asked them to.
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
