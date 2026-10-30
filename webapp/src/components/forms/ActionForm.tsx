"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import type { FormState } from "@/lib/form-state";

/**
 * A form bound to a server action, with one place for the things every form
 * needs: a pending state, an error summary, a success message, and per-field
 * errors that <Field> picks up by name. Works without JavaScript too — the
 * action still runs, only the inline messages need the client.
 */

const ErrorsContext = createContext<Record<string, string>>({});

export function useFieldError(name: string): string | undefined {
  return useContext(ErrorsContext)[name];
}

export default function ActionForm({
  action,
  children,
  submitLabel = "บันทึก",
  pendingLabel = "กำลังบันทึก…",
  className = "admin-card",
  resetOnSuccess = false,
  submitClassName = "btn btn-primary",
  secondary,
  encType,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  submitClassName?: string;
  secondary?: React.ReactNode;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) summaryRef.current?.focus();
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <ErrorsContext.Provider value={state.fieldErrors ?? {}}>
      <form
        ref={formRef}
        // Kept so the form still works with JavaScript disabled.
        action={formAction}
        // React 19 clears every field after an `action=` submission, even when
        // the server rejected the input — a typo in one field would wipe the
        // whole form. Dispatching from onSubmit skips that automatic reset;
        // successful forms that should clear use resetOnSuccess instead.
        onSubmit={(e) => {
          e.preventDefault();
          // Pass the clicked button so name/value pairs such as intent=draft survive.
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          startTransition(() => formAction(fd));
        }}
        className={className}
        noValidate
        encType={encType}
      >
        {state.error ? (
          <p className="flash flash-error" role="alert" tabIndex={-1} ref={summaryRef}>
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="flash flash-ok" role="status">
            {state.ok}
          </p>
        ) : null}
        <div className="settings-fields">{children}</div>
        <div className="form-actions-inline">
          {secondary}
          <button type="submit" className={submitClassName} disabled={pending} aria-busy={pending}>
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </form>
    </ErrorsContext.Provider>
  );
}
