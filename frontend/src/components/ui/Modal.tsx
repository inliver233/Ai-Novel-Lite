import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";

import { transition } from "../../lib/motion";
import { Overlay } from "./Overlay";
import type { DialogA11yProps, ModalLikeProps } from "./types";

type ModalProps = ModalLikeProps &
  DialogA11yProps & {
    panelClassName?: string;
    children: React.ReactNode;
  };

export function Modal(props: ModalProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Overlay
      visible={props.open}
      onClick={props.onClose}
      className={clsx("flex items-end sm:items-center justify-center p-0 sm:p-4", props.className)}
    >
      <motion.div
        className={clsx(
          "w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-none sm:rounded-atelier",
          props.panelClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={props.ariaLabelledBy ? undefined : props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
        transition={reduceMotion ? { duration: 0.01 } : transition.slow}
      >
        <button
          type="button"
          className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-surface/90 px-4 py-2 backdrop-blur sm:hidden"
          onClick={props.onClose}
          aria-label="关闭"
        >
          <span className="text-sm font-medium text-ink">返回</span>
          <span className="text-lg text-subtext">&times;</span>
        </button>
        {props.children}
      </motion.div>
    </Overlay>
  );
}
