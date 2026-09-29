import { PermanentPostingError, TransientPostingError } from "../postings/posting-errors";

/**
 * GET a JSON resource from another module. Network errors and 5xx are
 * transient (retry later); 404 is permanent (the record doesn't exist).
 */
export async function getJson<T>(url: string, what: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new TransientPostingError(`${what}: service unreachable (${(error as Error).message})`);
  }
  if (response.status === 404) throw new PermanentPostingError(`${what}: not found`);
  if (!response.ok) throw new TransientPostingError(`${what}: service returned ${response.status}`);
  return (await response.json()) as T;
}
