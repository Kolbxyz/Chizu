// Applies the saved theme before first paint (external file: the CSP forbids inline scripts).
try {
  const theme = localStorage.getItem("chizu.theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  // Storage can be unavailable (private mode); the system theme applies.
}
