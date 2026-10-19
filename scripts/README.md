# Release and browser checks

Packaging and public byte verification use Python 3.10+ and its standard library.
The browser runner additionally uses Python Playwright and Chromium (this cloud
environment has `/usr/bin/chromium`). Commands run from the repository root.

```sh
python scripts/release_site.py stage --out /workspace/combat-fx-work/release-1.13
python scripts/release_site.py verify-stage --stage /workspace/combat-fx-work/release-1.13
```

The output contains `site/` with exactly 45 runtime files, `Borderlands-Site.zip`
with those same files, and `Siam-Arun-1.13.zip` with allowlisted authored source,
tests, documentation and scripts from Git's tracked/untracked file inventory.
It excludes Git history, credentials, saves, generated screenshots and third-party
artwork. Each ZIP has sorted entries and fixed metadata, and is read back to
check CRCs and exact bytes. JSON manifests and `SHA256SUMS` record SHA-256 digests.
Repeated builds of identical source produce identical ZIPs. Use an output
directory outside the checkout; rerun staging after source changes.
Both verification commands accept `--stage` pointing to the release output root
or its `site/` subdirectory.

Publish the **contents** of `site/` to the Pages branch using the repository's
authorized release process. These scripts make no remote writes. After the Pages
build finishes, verify every public content file:

```sh
python scripts/release_site.py verify-public \
  --stage /workspace/combat-fx-work/release-1.13 \
  --out /workspace/combat-fx-work/public-1.13
```

This fetches 44 content files (`.nojekyll` is a deployment marker), with normal
TLS certificate/hostname verification, two workers and at most three retries
only for HTTP 429/502/503/504. Every response must match staged bytes before the
cache manifest is written. `--base URL` selects a different HTTPS deployment;
HTTP is accepted only for loopback fixture checks.

For local acceptance, first run `python -m http.server 8765 --bind 127.0.0.1` in
the checkout or the staged `site/` directory, then run:

```sh
python scripts/test_browser.py --url http://127.0.0.1:8765/ \
  --artifacts /workspace/combat-fx-work/browser-local
python scripts/test_browser.py \
  --public-cache /workspace/combat-fx-work/public-1.13 \
  --artifacts /workspace/combat-fx-work/browser-public
```

The runner imports `run_checks(page)` from every `tests/*_ui.py` and, when
present, `tests/gameplay_regression.py`. It supports sync and async Playwright
suites, runs them sequentially, and closes each browser/context before the next.
Use `--suite skill_tree_ui` (repeatable) to select suites. Every suite starts with
fresh storage. Reports capture page errors, failed requests, HTTP failures and
failure screenshots, and retain suite-produced artifacts. Any suite or resource
failure makes the command fail. `--base-url` is an alias for `--url`.

Public acceptance checks cache integrity again, then fulfills requests with the
exact verified public bytes while preserving the original Pages URL and origin.
It blocks any request absent from that cache and never disables HTTPS checking.
This replay is evidence for the bytes already fetched with TLS; it does not
replace the preceding live public verification step.
