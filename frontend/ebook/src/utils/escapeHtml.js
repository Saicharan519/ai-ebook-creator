// Escape user/AI text before it is turned into HTML, so content like
// <img src=x onerror=...> is shown as text instead of being executed.
export const escapeHtml = (text = "") =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
