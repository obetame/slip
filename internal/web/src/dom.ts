// The two element helpers every part of the client uses. They build
// nodes with textContent, never with innerHTML, so a slip that happens
// to contain markup is still shown as text.

export function el(tag: string, cls?: string | null, text?: string | null): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export function btn(label: string, fn: () => void, cls?: string | null): HTMLButtonElement {
  const b = document.createElement("button") as HTMLButtonElement;
  if (cls) b.className = cls;
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", function () {
    fn();
  });
  return b;
}

export function clear(node: Element): void {
  node.textContent = "";
}
