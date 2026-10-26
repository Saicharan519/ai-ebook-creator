/**
 * Normalises a name for matching: case, accents, punctuation, and a leading
 * "the" don't matter ("The Black Tooth" matches "black tooth").
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Attribute names are compared loosely so "Eye Color" and "eye colour" are the same detail. */
export function normalizeAttribute(attribute: string): string {
  return attribute
    .toLowerCase()
    .replace(/\bcolor\b/g, "colour")
    .replace(/\s+/g, " ")
    .trim();
}

/** Values that differ only in case, punctuation, or articles aren't a contradiction. */
export function normalizeValue(value: string): string {
  return normalizeName(value).replace(/\b(a|an)\s+/g, "");
}

interface NamedEntity {
  name: string;
  aliases: string[];
  kind?: string;
}

const TITLES = new Set([
  "mr",
  "mrs",
  "miss",
  "ms",
  "dr",
  "captain",
  "old",
  "young",
  "lady",
  "lord",
  "sir",
]);

/** "Miss Gunn" -> "gunn", "Old Callum" -> "callum"; null if the name is more than one word. */
function singleName(name: string): string | null {
  const words = normalizeName(name)
    .split(" ")
    .filter((word) => word && !TITLES.has(word));
  return words.length === 1 ? words[0]! : null;
}

/**
 * Finds the existing entity an extracted one refers to.
 *   1. Exact match on any name or alias ("The Black Tooth" = "black tooth").
 *   2. Otherwise, a lone first or last name ("Elspeth", "Miss Gunn") matches a
 *      full name ("Elspeth Gunn") of the same kind, but only if exactly one
 *      entity fits. With two Johns, "John" stays ambiguous and isn't merged.
 */
export function findMatchingEntity<T extends NamedEntity>(
  entities: T[],
  candidate: NamedEntity,
): T | undefined {
  const names = new Set(
    [candidate.name, ...candidate.aliases].filter((name) => !isPronoun(name)).map(normalizeName),
  );
  names.delete("");
  const exact = entities.find((entity) =>
    [entity.name, ...entity.aliases].some((name) => names.has(normalizeName(name))),
  );
  if (exact) return exact;

  const singles = [candidate.name, ...candidate.aliases]
    .map(singleName)
    .filter((name): name is string => name !== null);
  if (singles.length === 0) return undefined;

  const fits = entities.filter((entity) => {
    if (candidate.kind && entity.kind && candidate.kind !== entity.kind) return false;
    const words = normalizeName(entity.name).split(" ");
    if (words.length < 2) return false;
    return singles.some((name) => name === words[0] || name === words.at(-1));
  });
  return fits.length === 1 ? fits[0] : undefined;
}

const PRONOUNS = new Set(
  "i me my mine we us our you your he him his she her hers they them their it its".split(" "),
);

/**
 * Pronouns aren't names. Stored as aliases ("He" for Dr Munro) they would hide
 * gender contradictions and could merge different characters.
 */
export function isPronoun(name: string): boolean {
  return PRONOUNS.has(normalizeName(name));
}

/** Words too generic to show two detail labels are about the same thing. */
const GENERIC_WORDS = new Set(["colour", "color", "name", "type", "kind", "number", "of", "the"]);

/**
 * Whether two detail labels likely describe the same thing, even when worded
 * differently: "injury" and "injured hand", "location" and "located". They
 * share a meaningful word stem. "eye colour" and "hair colour" don't:
 * "colour" is too generic.
 */
export function attributesRelated(a: string, b: string): boolean {
  if (a === b) return true;
  const stems = (attribute: string) =>
    new Set(
      attribute
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word))
        .map((word) => word.slice(0, 5)),
    );
  const first = stems(a);
  return [...stems(b)].some((stem) => first.has(stem));
}
