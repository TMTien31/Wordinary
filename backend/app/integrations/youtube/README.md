# YouTube Integration

Owns provider-specific YouTube access: yt-dlp options, URL validation, metadata
fetching, subtitle track selection, and subtitle format parsing.

It should expose small provider-facing functions to backend modules. It should
not know about Wordinary database models, saved-card workflows, review logic, or
HTTP route concerns.
