// Event times on Blackrod Now are UK wall-clock strings ("2026-07-05T10:00:00").
// Never convert them through the browser timezone or toISOString() — that caused
// the BST one-hour drift bug. Build and read the literal digits instead.

const pad2 = (n) => String(n).padStart(2, "0");

// Format a Date object's LOCAL fields as a naive ISO string (no Z, no offset).
export const localIso = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
        d.getHours()
    )}:${pad2(d.getMinutes())}:00`;
