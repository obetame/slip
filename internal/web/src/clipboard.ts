// clipboard.ts copies text. The async Clipboard API is the normal
// path; Safari 12 only has execCommand, so that stays as the fallback.

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea") as HTMLTextAreaElement;
  ta.value = text;
  ta.setAttribute("readonly", "readonly");
  ta.className = "copy-buffer";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    ta.setSelectionRange(0, ta.value.length);
  } catch (e) {
    // Older engines throw on some selections. The existing one stands.
  }
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e2) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function copyText(text: string): Promise<boolean> {
  return new Promise(function (resolve) {
    const nav = navigator as any;
    if (nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(text).then(
        function () {
          resolve(true);
        },
        function () {
          resolve(legacyCopy(text));
        }
      );
      return;
    }
    resolve(legacyCopy(text));
  });
}
