"use client";

import { useTransition } from "react";

/**
 * onSubmit handler that dispatches a useActionState action without React 19's
 * automatic form reset, so a rejected submission keeps what the user typed.
 * Pair it with the form's `action=` prop, which still handles no-JS submits.
 */
export function useKeepValues(dispatch: (fd: FormData) => void) {
  const [, startTransition] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
}
