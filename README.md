# Borderlands Classic Offline

Private repository for the offline, single-player Borderlands Classic project.

**Master prepared:** v1.5b (base v1.4.2 + v1.5 Novice + v1.5 Swordman + v1.5a + v1.5b).

**Upload status:** the source tree is now in this repository - `js/`, `css/`, `data/`, `tests/`, `tools/`, `docs/`, plus the project's own monster sprites, item icons and weapon art. **Character artwork is not here yet.** The head/body atlases (`assets/sprites/hair_00..18.png`, `body_novice.png`, `body_swordman.png`) and the Phieti window skin (`assets/phieti/`) are derived from user-provided Ragnarok Online material and stay out of this repository until independently drawn replacements exist. `.gitignore` blocks them by name.

Because of that, the game runs but draws no player character, and 4 of the 12 Node tests fail on missing sprite files: `layered_sprite_v15b`, `sprite_runtime_v15`, `swordman_ro_sprite_v15` and `user_sprite_v15`. The other 8 pass. This is expected until replacement art lands.

The prepared master is available in two packages in the originating ChatGPT conversation:
- `Borderlands_Master_v1_5b_PERSONAL_OFFLINE.zip`: personal-use game package that contains user-provided Ragnarok/Phieti-derived graphics. Keep local; do not publish without permission.
- `Borderlands_Master_v1_5b_GITHUB_SAFE.zip`: source and runnable game with replacement character artwork and CSS-based skin, intended for upload to this repository.

After downloading and extracting the **GITHUB_SAFE** package, clone this repository, copy the extracted files into your clone, review the changes, commit, and push. Do not upload the personal-use ZIP itself. The game is launched with `START.bat` on Windows or `index.html`; gameplay does not require Python or a server. Opening `file://` on a real Windows machine still needs user-side verification.

## Running the tests

Node tests need no setup: `for f in tests/*.test.js tests/offline_check.js; do node "$f"; done`

The Playwright tests pick a browser in this order: `$CHROMIUM_PATH`, then `/usr/bin/chromium`, then Playwright's own bundled Chromium. Set `CHROMIUM_PATH` when your Chromium lives somewhere else:

```
CHROMIUM_PATH=/opt/chromium/chrome python3 tests/layered_browser_v15b.py
```

Four Playwright tests are known to fail and are not regressions. `browser_smoke.py` asserts the canvas is 960px wide, but `resizeScene()` has made it responsive since v1.4. `file_launch_smoke.py` clicks a menu tab without first opening the menu dock that v1.4 introduced. `sprite_scale_browser_v15a.py` and `user_sprite_browser_v15.py` patch `game.js` for the pre-baked `novice_ro_hair_*` sprites that v1.5b replaced with layered head/body atlases; `layered_browser_v15b.py` covers that ground instead.

**Security:** Do not commit API keys, environment files, individual save files, or unlicensed third-party sprites. Rotate any credentials previously shared in chat. A private repository does not grant a license to distribute third-party art.
