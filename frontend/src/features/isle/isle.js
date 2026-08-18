const ISLE_UNLOCKS = [
  { level: 1, key: "brook", title: "Quiet Brook", description: "A small stream starts running through your isle." },
  { level: 2, key: "stones", title: "Mossy Stones", description: "Soft cliffs and stones give the land a calm shape." },
  { level: 3, key: "grove", title: "Little Grove", description: "Trees take root near the shore." },
  { level: 4, key: "camp", title: "Reading Camp", description: "A cozy tent appears for long reading sessions." },
  { level: 5, key: "fire", title: "Evening Fire", description: "Your streak keeps a warm light on the isle." },
  { level: 6, key: "wildlife", title: "Wildlife Meadow", description: "Gentle animals visit as your vocabulary blooms." },
  { level: 7, key: "canoe", title: "Canoe Landing", description: "A gentle canoe opens the way to new material." }
];

function getIsleLevel(xp = state.xp) {
  return Math.max(0, Math.floor(Number(xp || 0) / 100));
}

function getIsleProgress(xp = state.xp) {
  const level = getIsleLevel(xp);
  const currentXp = Math.max(0, Number(xp || 0) - level * 100);
  return { level, currentXp, nextXp: 100, percent: Math.min(100, currentXp) };
}

function applyLearningProfile(profile = {}) {
  state.xp = Number(profile.xp) || 0;
  state.streak = Number(profile.streak) || 0;
  state.longestStreak = Number(profile.longestStreak) || 0;
  state.daily = Number(profile.dailyActivity) || 0;
  state.dailyGoal = Number(profile.dailyGoal) || 8;
  state.dailyXp = Number(profile.dailyXp) || 0;
  saveState();
  updateStats();
  renderYourIsle();
}

async function refreshLearningProfile() {
  if (!state.currentUser || !getAuthToken() || typeof fetchLearningProfile !== "function") return null;
  const profile = await fetchLearningProfile();
  applyLearningProfile(profile);
  return profile;
}

function renderYourIsle() {
  const root = $("#isleView");
  if (!root) return;
  const progress = getIsleProgress();
  const unlocked = ISLE_UNLOCKS.filter(item => item.level <= progress.level);
  const next = ISLE_UNLOCKS.find(item => item.level > progress.level);
  root.dataset.isleLevel = String(progress.level);
  $("#isleLevel").textContent = `Level ${progress.level}`;
  $("#isleXp").textContent = `${state.xp} XP`;
  $("#isleNextUnlock").textContent = next ? `Next: ${next.title}` : "All current isle features unlocked";
  $("#isleProgressLabel").textContent = `${progress.currentXp}/${progress.nextXp} XP`;
  $("#isleProgressFill").style.width = `${progress.percent}%`;
  $("#isleDaily").textContent = `${Math.min(state.daily, state.dailyGoal)}/${state.dailyGoal}`;
  $("#isleStreak").textContent = `${state.streak} days`;
  $("#isleDailyXp").textContent = `${state.dailyXp} XP`;
  $$(".isle-piece", root).forEach(piece => {
    const level = Number(piece.dataset.unlockLevel) || 0;
    piece.classList.toggle("is-unlocked", level <= progress.level);
  });
  $("#isleUnlockList").innerHTML = ISLE_UNLOCKS.map(item => {
    const active = item.level <= progress.level;
    return `<article class="isle-unlock ${active ? "is-active" : ""}"><span>${active ? "✓" : item.level}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></div></article>`;
  }).join("");
  $("#isleEmptyNote").classList.toggle("is-hidden", progress.level > 0);
  $("#isleUnlockedCount").textContent = unlocked.length;
}
