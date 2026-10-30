"use client";

import { useId } from "react";
import { useFieldError } from "./ActionForm";

/**
 * Labelled control for <ActionForm> (Visual Design §6: label above the
 * control, never a placeholder standing in for it). Errors come from the
 * action's fieldErrors, matched by `name`.
 */

type Common = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string | number | null;
};

type InputProps = Common & {
  as?: "input";
  type?: "text" | "email" | "password" | "tel" | "url" | "number" | "date" | "datetime-local" | "search";
  autoComplete?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
};
type TextareaProps = Common & { as: "textarea"; rows?: number; maxLength?: number };
type SelectProps = Common & {
  as: "select";
  options: (string | { value: string; label: string })[];
  emptyLabel?: string;
};

export default function Field(props: InputProps | TextareaProps | SelectProps) {
  const id = useId();
  const error = useFieldError(props.name);
  const describedBy = [props.hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: props.name,
    required: props.required,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
  };
  const dv = props.defaultValue === null || props.defaultValue === undefined ? undefined : String(props.defaultValue);

  let control: React.ReactNode;
  if (props.as === "textarea") {
    control = <textarea {...common} rows={props.rows ?? 4} maxLength={props.maxLength} defaultValue={dv} />;
  } else if (props.as === "select") {
    control = (
      <select {...common} defaultValue={dv ?? ""}>
        {props.emptyLabel !== undefined ? <option value="">{props.emptyLabel}</option> : null}
        {props.options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          ),
        )}
      </select>
    );
  } else {
    control = (
      <input
        {...common}
        type={props.type ?? "text"}
        defaultValue={dv}
        autoComplete={props.autoComplete}
        maxLength={props.maxLength}
        min={props.min}
        max={props.max}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
      />
    );
  }

  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>
        {props.label}
        {props.required ? <span className="required" aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {props.hint ? <p className="field-hint" id={`${id}-h`}>{props.hint}</p> : null}
      {error ? <p className="field-error" id={`${id}-e`}>{error}</p> : null}
    </div>
  );
}

/** Checkbox with label to the right; errors by name like <Field>. */
export function Check({ name, label, defaultChecked, hint }: { name: string; label: React.ReactNode; defaultChecked?: boolean; hint?: string }) {
  const error = useFieldError(name);
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label className="check-row">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} aria-invalid={error ? true : undefined} />
        <span>{label}</span>
      </label>
      {hint ? <p className="field-hint">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
