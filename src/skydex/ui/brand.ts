/**
 * The site's display name, and the only place it lives.
 *
 * Change this one string and the site is renamed everywhere it is shown to a
 * person: the nav wordmark, the wordmark's aria-label, and every document
 * title. Two spots cannot import from here because they are static HTML, and
 * both are commented in place as manual: the `<title>` and the no-JS `<h1>` in
 * index.html.
 *
 * NEVER use this to build a localStorage key. Storage keys are hardcoded
 * literals on purpose and the `wizardsky.*` and `skyindex.*` prefixes are
 * permanent no matter what the site ends up being called. A key that is
 * derived from the display name would silently orphan every saved planner,
 * target list, profile and island snapshot the moment the name changed. This
 * project has already lost real user work to one storage mistake; the name and
 * the storage layer stay unconnected. Renaming to Skydex changed neither
 * prefix, for exactly that reason.
 */
export const SITE_NAME = "Skydex";

/**
 * Where the wordmark's accent half begins, as an index into `SITE_NAME`.
 *
 * The wordmark is two-tone: the head sits in the base colour and the tail
 * takes the accent, which is what makes it read as a set wordmark rather than
 * a link. It used to find that split by looking for the name's last interior
 * capital, which worked while the name was "SkyIndex" (SKY + INDEX) and
 * silently produced a single-colour wordmark the moment the name became
 * "Skydex", which has no interior capital at all.
 *
 * So the split is stated rather than inferred. 3 puts it after "Sky", giving
 * SKY + DEX, which is the same shape the name had before. Set it to 0 (or past
 * the end) for a name that should render whole in the base colour; the nav
 * falls back to the interior-capital rule when this is left undefined.
 */
export const SITE_NAME_ACCENT_AT = 3;
