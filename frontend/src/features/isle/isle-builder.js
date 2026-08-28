import { mountIsleBuilder } from './builder/main.js';

function start() {
  const host = document.getElementById("isleBuilderHost");
  if (!host) return;
  mountIsleBuilder(host);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
