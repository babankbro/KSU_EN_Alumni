/** Return shape of every server action used with <ActionForm>. */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: string;
}
