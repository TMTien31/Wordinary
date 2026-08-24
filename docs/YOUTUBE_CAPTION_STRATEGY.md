# YouTube Caption Reliability Strategy

YouTube cookies are an operational fallback, not a stable product foundation.

## Target Strategy

1. Prefer unauthenticated/public caption extraction where possible.
2. Add a yt-dlp PO Token Provider for videos where YouTube enforces Proof of Origin tokens.
3. Keep cookies only for content that genuinely requires an account, such as age-restricted or account-gated videos.
4. Automate cookie delivery through CI/server config instead of SSH editing.
5. Expose caption runtime health in the app so failures are visible before users hit them.

## Recommended Implementation Order

### Phase 1: No More SSH Cookie Editing

Store the cookie file as a private GitHub Actions secret, for example `YOUTUBE_COOKIES_TXT_B64`, and have deployment write it to:

```text
~/Wordinary/youtube-cookies/cookies.txt
```

This still requires cookie rotation, but it removes manual server file editing.

### Phase 2: PO Token Provider

Test a PO token provider on the ARM64 production host. The preferred shape is:

- install the yt-dlp provider plugin in the backend image;
- run the provider as a sidecar service;
- configure yt-dlp through extractor args, usually with the `mweb` client;
- keep cookies optional.

Use this only after validating the provider image/package on the Oracle ARM64 server.

### Phase 3: Product-Level Fallback

If YouTube rejects automatic captions:

- show a clear runtime reason from `/api/v1/captions/health`;
- let the user upload VTT/SRT or paste transcript;
- keep saved videos usable even without auto-fetched captions;
- notify the operator when caption health changes from good to failing.

## Operator Checks

Inside the API container:

```bash
which deno
deno --version
python -m yt_dlp --version
test -s "$WORDINARY_COOKIES_FILE"
```

From the frontend/API origin:

```bash
curl --fail http://127.0.0.1:5500/api/v1/captions/health
```

## References

- yt-dlp PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- yt-dlp YouTube extractor notes: https://github.com/yt-dlp/yt-dlp/wiki/Extractors
- bgutil yt-dlp PO token provider: https://github.com/Brainicism/bgutil-ytdlp-pot-provider
