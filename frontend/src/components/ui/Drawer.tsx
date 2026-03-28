import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";

import { transition } from "../../lib/motion";
import { Overlay } from "./Overlay";
import type { DialogA11yProps, ModalLikeProps } from "./types";

type Side = "right" | "left" | "bottom";

type DrawerProps = ModalLikeProps &
  DialogA11yProps & {
    side?: Side;
    overlayClassName?: string;
    panelClassName?: string;
    children: React.ReactNode;
  };

export function Drawer(props: DrawerProps) {
  const reduceMotion = useReducedMotion();
  const side: Side = props.side ?? "right";

  const panelMotion =
    side === "bottom"
      ? {
          initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
          animate: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
          exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
        }
      : side === "left"
        ? {
            initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 },
            animate: reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 },
            exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 },
          }
        : {
            initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 },
            animate: reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 },
            exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 },
          };

  return (
    <Overlay
      visible={props.open}
      onClick={props.onClose}
      className={clsx(
        "flex",
        side === "bottom"
          ? "items-end justify-center"
          : side === "left"
            ? "items-stretch justify-start"
            : "items-stretch justify-end",
        props.overlayClassName,
      )}
    >
      <motion.div
        className={clsx(
          "overflow-y-auto",
          side === "bottom" && "rounded-t-atelier max-h-[85dvh]",
          props.panelClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={props.ariaLabelledBy ? undefined : props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        initial={panelMotion.initial}
        animate={panelMotion.animate}
        exit={panelMotion.exit}
        transition={reduceMotion ? { duration: 0.01 } : transition.slow}
      >
        {side === "bottom" ? (
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>
        ) : null}
        {props.children}
      </motion.div>
    </Overlay>
  );
}
