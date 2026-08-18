function reviewApiCreateSession(payload = {}) {
  return apiRequest("/reviews/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function reviewApiAnswer(sessionId, payload) {
  return apiRequest(`/reviews/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function reviewApiFinishSession(sessionId) {
  return apiRequest(`/reviews/sessions/${encodeURIComponent(sessionId)}/finish`, {
    method: "POST"
  });
}
