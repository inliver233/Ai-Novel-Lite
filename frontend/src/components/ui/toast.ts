import { createContext, useContext } from "react";

import type { ToastAction } from "./types";

export type ToastApi = {
  toastSuccess: (message: string, requestId?: string, action?: ToastAction) => void;
  toastWarning: (message: string, requestId?: string, action?: ToastAction) => void;
  toastError: (message: string, requestId?: string, action?: ToastAction) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
