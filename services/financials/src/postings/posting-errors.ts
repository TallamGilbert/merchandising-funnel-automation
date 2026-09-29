/**
 * Posting failures come in two kinds, and the inbox treats them differently:
 * a transient one (a service is down) is retried with backoff; a permanent
 * one (the PO doesn't exist, the currency isn't KES) can't fix itself, so the
 * event is flagged for a person in the Finance Portal.
 */
export class TransientPostingError extends Error {}

export class PermanentPostingError extends Error {}
