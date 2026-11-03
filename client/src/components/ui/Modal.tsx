import { useRef, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

type Props = {
  title: string;
  triggerLabel: string;
  variant?: ComponentProps<typeof Button>["variant"];
  children: ReactNode;
};

export function Modal({
  title,
  triggerLabel,
  variant = "secondary",
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </Button>
      {createPortal(
        <dialog
          ref={dialogRef}
          aria-label={title}
          className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-md border border-line bg-surface p-5 text-sm text-body shadow-xl backdrop:bg-black/70"
          onClose={() => triggerRef.current?.focus()}
        >
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              autoFocus
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </Button>
          </div>
          {children}
        </dialog>,
        document.body,
      )}
    </>
  );
}
