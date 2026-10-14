import type { ReactNode } from "react";

export const LoadingState = ({ label }: { readonly label: string }): ReactNode => (
  <output aria-busy="true" className="state">
    <span className="skeleton" />
    <p>{label}</p>
  </output>
);

export const EmptyState = ({
  action,
  description,
  title,
}: {
  readonly action?: ReactNode;
  readonly description: string;
  readonly title: string;
}): ReactNode => (
  <section className="state">
    <h2>{title}</h2>
    <p>{description}</p>
    {action}
  </section>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => void;
}): ReactNode => (
  <section className="state error" role="alert">
    <h2>Something went wrong</h2>
    <p>{message}</p>
    {onRetry === undefined ? null : (
      <button className="button" onClick={onRetry} type="button">
        Try again
      </button>
    )}
  </section>
);

export const ForbiddenState = (): ReactNode => (
  <section className="state">
    <h2>Access denied</h2>
    <p>Your role does not include this area. The server enforces the same restriction.</p>
  </section>
);
