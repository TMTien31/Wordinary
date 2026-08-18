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
