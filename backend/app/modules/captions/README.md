# Captions Module

Owns Wordinary caption use cases: request/response contracts, saved caption records,
normalization rules, and application-level policies.

It should call integrations such as `app/integrations/youtube` for external
fetching or parsing details. It should not embed yt-dlp, HTTP scraping, or
provider-specific quirks directly in route handlers.
