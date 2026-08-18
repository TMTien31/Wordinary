function registerUser(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function loginUser(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function fetchCurrentUser() {
  return apiRequest("/users/me");
}

function fetchLearningProfile() {
  return apiRequest("/users/me/profile");
}
