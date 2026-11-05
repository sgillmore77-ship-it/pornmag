/**
 * The publication a request is for. Every query against publisher data takes
 * a `Site` and filters on its id, so one publication can never read another's
 * rows. Pass it explicitly; never read publicationId from user input.
 */
export type Site = {
  readonly publicationId: string;
};

export function site(publicationId: string): Site {
  if (!publicationId) throw new Error("A publication id is required");
  return Object.freeze({ publicationId });
}
