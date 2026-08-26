function sendWodyMessage(payload) {
  return apiRequest("/wody/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
