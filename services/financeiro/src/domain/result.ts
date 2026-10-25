/** Outcome of an operation that can fail in an expected way: a value or an error, never thrown. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Successful {@link Result}. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/** Failed {@link Result}. */
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });
