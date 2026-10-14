import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export const Button = ({
  children,
  disabled = false,
  type = "button",
  variant = "primary",
  ...props
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly type?: "button" | "submit";
  readonly variant?: "danger" | "ghost" | "primary";
}): ReactNode => (
  <button className={`button ${variant}`} disabled={disabled} type={type} {...props}>
    {children}
  </button>
);

export const Field = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}): ReactNode => (
  // biome-ignore lint/a11y/noLabelWithoutControl: the control is supplied by the caller
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

export const Badge = ({ children }: { readonly children: ReactNode }): ReactNode => (
  <span className="badge">{children}</span>
);

export const ConfirmDialog = ({
  confirmLabel,
  description,
  onConfirm,
  open,
  setOpen,
  title,
}: {
  readonly confirmLabel: string;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly title: string;
}): ReactNode => (
  <Dialog.Root onOpenChange={setOpen} open={open}>
    <Dialog.Portal>
      <Dialog.Overlay className="overlay" />
      <Dialog.Content className="dialog">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
        <div className="actions">
          <Dialog.Close asChild>
            <button className="button ghost" type="button">
              Cancel
            </button>
          </Dialog.Close>
          <button className="button danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
