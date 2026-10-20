// boot.ts runs before the page is painted. It applies the saved theme
// and language so the first frame is not the wrong colour, and it is
// intentionally tiny because it blocks rendering.

(function () {
  let theme = "light";
  let lang = "zh";
  try {
    const savedTheme = localStorage.getItem("slip.theme");
    const savedLang = localStorage.getItem("slip.lang");
    if (savedTheme === "dark") theme = "dark";
    if (savedLang === "en") lang = "en";
  } catch (e) {
    // No storage. The defaults above are fine.
  }
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-lang", lang);
  root.lang = lang === "en" ? "en" : "zh-CN";
  document.title = lang === "en" ? "Slip" : "纸条";
  const meta = document.getElementById("theme-color");
  if (meta) meta.setAttribute("content", theme === "dark" ? "#1a1816" : "#f3efe6");
})();
