/**
 * Sets (or, given null, removes) search parameters in the page's address in place, without a new history entry, so the
 * view it describes can be linked to. Next's `useSearchParams` follows the change.
 */
export function setAddressParams(values: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(values)) {
        if (value === null) url.searchParams.delete(name);
        else url.searchParams.set(name, value);
    }
    window.history.replaceState(null, "", url);
}
