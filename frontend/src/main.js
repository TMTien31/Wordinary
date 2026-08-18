"use strict";

try {
  init();
} catch (error) {
  console.error("[Wordinary] Initialization failed:", error);
  const root = document.getElementById("toastStack");
  if (root) {
    root.innerHTML = `<div class="toast"><div class="toast-icon">⚠️</div><div><b>Wordinary failed to start</b><small>${String(error?.message || error)}</small></div></div>`;
  }
}
