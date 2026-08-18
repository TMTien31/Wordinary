function initializeAuthUi() {
  const authScreen = $("#authScreen");
  const appShell = $("#appShell");
  if (!authScreen || !appShell) return;

  $("#authLoginForm").addEventListener("submit", event => handleAuthSubmit(event, "login"));
  $("#authSignupForm").addEventListener("submit", event => handleAuthSubmit(event, "signup"));
  $("#showSignup").addEventListener("click", () => setAuthMode("signup"));
  $("#showLogin").addEventListener("click", () => setAuthMode("login"));
  $("#logoutButton").addEventListener("click", logoutUser);

  const token = getAuthToken();
  if (!token) {
    showAuthScreen();
    return;
  }

  setAuthStatus("Restoring your session...");
  fetchCurrentUser()
    .then(user => completeAuth(user))
    .catch(() => {
      clearAuthToken();
      showAuthScreen();
      setAuthStatus("Your session expired. Please sign in again.");
    });
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  $("#authLoginPanel").classList.toggle("is-hidden", isSignup);
  $("#authSignupPanel").classList.toggle("is-hidden", !isSignup);
  $("#authStatus").textContent = "";
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = mode === "signup" ? "Creating..." : "Signing in...";
  setAuthStatus("");

  try {
    const formData = new FormData(form);
    const payload = mode === "signup"
      ? {
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
          displayName: String(formData.get("displayName") || "")
        }
      : {
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || "")
        };
    const result = mode === "signup"
      ? await registerUser(payload)
      : await loginUser(payload);
    setAuthToken(result.accessToken);
    completeAuth(result.user);
    form.reset();
  } catch (error) {
    setAuthStatus(error.message || "Could not sign in right now.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function completeAuth(user) {
  state.currentUser = user;
  $("#authScreen").classList.add("is-hidden");
  $("#appShell").classList.remove("auth-locked");
  renderCurrentUser();
  hydrateAccountData();
}

async function hydrateAccountData() {
  clearApiLibraryCache();
  const results = await Promise.allSettled([
    refreshLearningProfile(),
    refreshAndRenderLibrary(),
    refreshVocabularyFromApi()
  ]);
  const failed = results.find(result => result.status === "rejected");
  if (failed) {
    console.warn("Could not hydrate account data", failed.reason);
    showToast("Account sync incomplete", failed.reason?.message || "Please try again.", "!");
  }
  updateStats();
  renderLibraryOverview();
  setView("isleView");
}

function showAuthScreen() {
  state.currentUser = null;
  clearApiLibraryCache();
  clearVocabularyCache();
  $("#appShell").classList.add("auth-locked");
  $("#authScreen").classList.remove("is-hidden");
  renderCurrentUser();
  saveState();
}

function logoutUser() {
  clearAuthToken();
  showAuthScreen();
  setAuthMode("login");
  setAuthStatus("You signed out.");
}

function renderCurrentUser() {
  const user = state.currentUser;
  const name = user?.displayName || "Signed out";
  const email = user?.email || "";
  $("#currentUserName").textContent = name;
  $("#currentUserEmail").textContent = email;
  renderSettingsProfile();
}

function setAuthStatus(message) {
  $("#authStatus").textContent = message;
}

function formatProfileDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(state.language === "en" ? "en-US" : "vi-VN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderSettingsProfile() {
  if (!$("#settingsProfileName")) return;
  const user = state.currentUser;
  const name = user?.displayName || "Signed out";
  const email = user?.email || "-";
  const initial = (name.trim()[0] || "W").toUpperCase();
  $("#settingsProfileInitial").textContent = initial;
  $("#settingsProfileName").textContent = name;
  $("#settingsProfileEmail").textContent = email;
  $("#settingsProfileStatus").textContent = user?.status || "signed out";
  $("#settingsProfileId").textContent = user?.id || "-";
  $("#settingsProfileCreated").textContent = formatProfileDate(user?.createdAt);
  $("#settingsProfileUpdated").textContent = user?.updatedAt ? formatProfileDate(user.updatedAt) : "-";
}
