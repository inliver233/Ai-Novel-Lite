import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "./Modal";
import { ConfirmContext } from "./confirm";
import type { ChooseOptions, ConfirmApi, ConfirmChoice, ConfirmOptions } from "./confirm";

type PendingRequest =
  | { kind: "confirm"; resolve: (value: boolean) => void }
  | { kind: "choose"; resolve: (value: ConfirmChoice) => void };

export function ConfirmProvider(props: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"confirm" | "choose">("confirm");
  const [options, setOptions] = useState<ConfirmOptions | ChooseOptions | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const clearOptionsTimerRef = useRef<number | null>(null);

  const clearOptionsTimer = useCallback(() => {
    if (clearOptionsTimerRef.current !== null) {
      window.clearTimeout(clearOptionsTimerRef.current);
      clearOptionsTimerRef.current = null;
    }
  }, []);

  const resolvePendingAsDismissed = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (pending.kind === "choose") {
      pending.resolve("cancel");
      return;
    }
    pending.resolve(false);
  }, []);

  useEffect(() => {
    return () => {
      clearOptionsTimer();
      resolvePendingAsDismissed();
    };
  }, [clearOptionsTimer, resolvePendingAsDismissed]);

  const prepareOpen = useCallback(() => {
    clearOptionsTimer();
    resolvePendingAsDismissed();
  }, [clearOptionsTimer, resolvePendingAsDismissed]);

  const confirm = useCallback((opts: ConfirmOptions) => {
    prepareOpen();
    setVariant("confirm");
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      pendingRef.current = { kind: "confirm", resolve };
    });
  }, [prepareOpen]);

  const choose = useCallback((opts: ChooseOptions) => {
    prepareOpen();
    setVariant("choose");
    setOptions(opts);
    setOpen(true);
    return new Promise<ConfirmChoice>((resolve) => {
      pendingRef.current = { kind: "choose", resolve };
    });
  }, [prepareOpen]);

  const close = useCallback((value: boolean | ConfirmChoice) => {
    setOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending?.kind === "choose") {
      pending.resolve(value === "confirm" || value === "secondary" || value === "cancel" ? value : "cancel");
    } else if (pending?.kind === "confirm") {
      pending.resolve(value === true);
    }
    clearOptionsTimer();
    clearOptionsTimerRef.current = window.setTimeout(() => {
      setOptions(null);
      clearOptionsTimerRef.current = null;
    }, 400);
  }, [clearOptionsTimer]);

  const api = useMemo<ConfirmApi>(() => ({ confirm, choose }), [choose, confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {props.children}
      <Modal
        open={open && Boolean(options)}
        onClose={() => close(variant === "choose" ? ("cancel" satisfies ConfirmChoice) : false)}
        panelClassName="surface w-full sm:max-w-md p-4 sm:p-5"
        ariaLabel={options?.title ?? "确认"}
      >
        {options ? (
          <>
            <div className="font-content text-xl text-ink">{options.title}</div>
            {options.description ? <div className="mt-2 text-sm text-subtext">{options.description}</div> : null}
            <div className="mt-5 flex justify-end flex-col-reverse sm:flex-row gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => close(variant === "choose" ? ("cancel" satisfies ConfirmChoice) : false)}
                type="button"
              >
                {options.cancelText ?? "取消"}
              </button>
              {variant === "choose" ? (
                <button
                  className={(options as ChooseOptions).secondaryDanger ? "btn btn-danger" : "btn btn-secondary"}
                  onClick={() => close("secondary" satisfies ConfirmChoice)}
                  type="button"
                >
                  {(options as ChooseOptions).secondaryText}
                </button>
              ) : null}
              <button
                className={options.danger ? "btn btn-danger" : "btn btn-primary"}
                onClick={() => close(variant === "choose" ? ("confirm" satisfies ConfirmChoice) : true)}
                type="button"
              >
                {options.confirmText ?? "确认"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  );
}
