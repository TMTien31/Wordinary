function sendWodyMessage(payload) {
  return apiRequest("/wody/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function executeWodyAction(action) {
  return apiRequest("/wody/actions/execute", {
    method: "POST",
    body: JSON.stringify({ action })
  });
}
