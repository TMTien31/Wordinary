const ISLE_XP_PER_LEVEL = 100;
const ISLE_MAX_LEVEL = 5;

function getIsleLevel(xp = state.xp) {
  return Math.max(0, Math.min(ISLE_MAX_LEVEL, Math.floor(Number(xp || 0) / ISLE_XP_PER_LEVEL)));
}

function getIsleProgress(xp = state.xp) {
  const totalXp = Number(xp) || 0;
  const level = getIsleLevel(xp);
  const rawLevel = Math.max(0, Math.floor(totalXp / ISLE_XP_PER_LEVEL));
  const currentXp = level >= ISLE_MAX_LEVEL
    ? ISLE_XP_PER_LEVEL
    : Math.max(0, totalXp - rawLevel * ISLE_XP_PER_LEVEL);
  return {
    xp: totalXp,
    level,
    currentXp,
    nextXp: ISLE_XP_PER_LEVEL,
    percent: Math.min(100, currentXp),
    maxLevel: ISLE_MAX_LEVEL,
  };
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
  root.dataset.isleLevel = String(progress.level);
  root.dataset.isleXp = String(Number(state.xp) || 0);
  window.__wordinaryIsleProgress = progress;
  window.dispatchEvent(new CustomEvent("wordinary:isle-progress", { detail: progress }));

  const navLevel = $("#navIsleLevel");
  if (navLevel) navLevel.textContent = progress.level;
}
