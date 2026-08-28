const FALLBACK_ICON_DATA = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#e3f3e9"/><path d="M47 15C32 16 20 23 18 38c8 3 17 1 23-6 5-6 6-12 6-17Z" fill="#2a8b60"/><path d="M16 49c6-12 14-19 28-28" fill="none" stroke="#176443" stroke-width="4" stroke-linecap="round"/></svg>`)}`;

function iconUrl(icon) {
  if (!icon) return FALLBACK_ICON_DATA;
  if (/^(data:image\/|blob:|https?:\/\/)/i.test(icon)) return icon;
  if (!icon.includes(":")) return FALLBACK_ICON_DATA;
  const [prefix, ...nameParts] = icon.split(":");
  return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(nameParts.join(":"))}.svg`;
}

function handleIconError(img) {
  if (!img || img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = "1";
  img.src = FALLBACK_ICON_DATA;
}

function showToast(title, message, icon = "✨") {
  const toast = document.createElement("div");
  toast.className = "toast";
  const localizedTitle = translateUiString(title);
  const localizedMessage = translateUiString(message);
  toast.innerHTML = `<div class="toast-icon">${icon}</div><div><b>${escapeHtml(localizedTitle)}</b><p>${escapeHtml(localizedMessage)}</p></div>`;
  $("#toastStack").appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(20px)"; }, 3400);
  setTimeout(() => toast.remove(), 3800);
}

function localizeDialogText(value = "") {
  return typeof translateUiString === "function" ? translateUiString(value) : value;
}

function ensureAppDialog() {
  let root = $("#appDialog");
  if (root) return root;
  root = document.createElement("div");
  root.id = "appDialog";
  root.className = "app-dialog-backdrop";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <form class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">
      <div class="app-dialog-icon" id="appDialogIcon" aria-hidden="true">?</div>
      <div class="app-dialog-body">
        <h2 id="appDialogTitle"></h2>
        <p id="appDialogMessage"></p>
        <input id="appDialogInput" class="app-dialog-input" />
        <div class="app-dialog-actions">
          <button id="appDialogCancel" class="cancel-btn" type="button">Cancel</button>
          <button id="appDialogConfirm" class="import-btn" type="submit">OK</button>
        </div>
      </div>
    </form>
  `;
  document.body.appendChild(root);
  return root;
}

function showAppDialog(options = {}) {
  const settings = typeof options === "string" ? { message: options } : options;
  const type = settings.type || "alert";
  const root = ensureAppDialog();
  const dialog = $(".app-dialog", root);
  const title = $("#appDialogTitle", root);
  const message = $("#appDialogMessage", root);
  const icon = $("#appDialogIcon", root);
  const input = $("#appDialogInput", root);
  const cancel = $("#appDialogCancel", root);
  const confirm = $("#appDialogConfirm", root);
  const hasInput = type === "prompt";

  title.textContent = localizeDialogText(settings.title || (type === "confirm" ? "Confirm action" : "Notice"));
  message.textContent = localizeDialogText(settings.message || "");
  icon.textContent = settings.icon || (settings.danger ? "!" : "?");
  input.value = settings.defaultValue ?? "";
  input.placeholder = settings.placeholder || "";
  input.hidden = !hasInput;
  input.disabled = !hasInput;
  cancel.hidden = type === "alert";
  cancel.textContent = localizeDialogText(settings.cancelLabel || "Cancel");
  confirm.textContent = localizeDialogText(settings.confirmLabel || (type === "prompt" ? "Create" : "OK"));
  confirm.classList.toggle("danger", settings.danger === true);
  dialog.classList.toggle("is-danger", settings.danger === true);

  root.classList.add("show");
  root.setAttribute("aria-hidden", "false");
  setTimeout(() => (hasInput ? input : confirm).focus(), 0);

  return new Promise(resolve => {
    const cleanup = result => {
      root.classList.remove("show");
      root.setAttribute("aria-hidden", "true");
      dialog.removeEventListener("submit", onSubmit);
      cancel.removeEventListener("click", onCancel);
      root.removeEventListener("mousedown", onBackdrop);
      document.removeEventListener("keydown", onKeyDown);
      resolve(result);
    };
    const onSubmit = event => {
      event.preventDefault();
      cleanup(hasInput ? input.value : true);
    };
    const onCancel = () => cleanup(hasInput ? null : false);
    const onBackdrop = event => {
      if (event.target === root) onCancel();
    };
    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    dialog.addEventListener("submit", onSubmit);
    cancel.addEventListener("click", onCancel);
    root.addEventListener("mousedown", onBackdrop);
    document.addEventListener("keydown", onKeyDown);
  });
}

function appConfirm(options = {}) {
  return showAppDialog({ ...(typeof options === "string" ? { message: options } : options), type: "confirm" });
}

function appPrompt(options = {}, defaultValue = "") {
  const settings = typeof options === "string" ? { title: options, defaultValue } : options;
  return showAppDialog({ ...settings, type: "prompt" });
}

function appAlert(options = {}) {
  return showAppDialog({ ...(typeof options === "string" ? { message: options } : options), type: "alert" });
}

window.appConfirm = appConfirm;
window.appPrompt = appPrompt;
window.appAlert = appAlert;

function updateStats() {
  $("#navCardCount").textContent = state.cards.length;
  $("#navArticleCount").textContent = state.libraryItems.length;
  const due = state.cards.filter(c => !c.nextReview || c.nextReview <= Date.now()).length;
  $("#navDueCount").textContent = due;
  if ($("#navIsleLevel") && typeof getIsleLevel === "function") $("#navIsleLevel").textContent = getIsleLevel();
  $("#xpCount").textContent = `${state.xp} XP`;
  $("#streakCount").textContent = `${state.streak} days`;
  $("#sessionWords").textContent = state.sessionSaved;
  $("#sessionXp").textContent = state.sessionXp;
  const dailyGoal = Number(state.dailyGoal) || 8;
  $("#goalText").textContent = `${Math.min(state.daily, dailyGoal)}/${dailyGoal}`;
  $("#goalFill").style.width = `${Math.min(state.daily / dailyGoal * 100, 100)}%`;
  renderSavedPreview();
  if (typeof renderYourIsle === "function") renderYourIsle();
  if (typeof renderReaderArticleWords === "function") renderReaderArticleWords();
}
