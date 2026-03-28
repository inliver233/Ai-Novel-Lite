import type * as React from "react";

export type BaseComponentProps = {
  className?: string;
  children?: React.ReactNode;
};

export type ModalLikeProps = BaseComponentProps & {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export type OverlayProps = BaseComponentProps & {
  visible: boolean;
  onClick?: () => void;
};

export type DialogA11yProps = {
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

export type ToastSeverity = "success" | "warning" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

