# Borderlands Classic Offline

Private repository for the offline, single-player Borderlands Classic project.

**Master prepared:** v1.5b (base v1.4.2 + v1.5 Novice + v1.5 Swordman + v1.5a + v1.5b). Source code and artwork have **not yet been uploaded to this repository**; this first commit establishes the repository instructions only.

The prepared master is available in two packages in the originating ChatGPT conversation:
- `Borderlands_Master_v1_5b_PERSONAL_OFFLINE.zip`: personal-use game package that contains user-provided Ragnarok/Phieti-derived graphics. Keep local; do not publish without permission.
- `Borderlands_Master_v1_5b_GITHUB_SAFE.zip`: source and runnable game with replacement character artwork and CSS-based skin, intended for upload to this repository.

After downloading and extracting the **GITHUB_SAFE** package, clone this repository, copy the extracted files into your clone, review the changes, commit, and push. Do not upload the personal-use ZIP itself. The game is launched with `START.bat` on Windows or `index.html`; gameplay does not require Python or a server. Opening `file://` on a real Windows machine still needs user-side verification.

**Security:** Do not commit API keys, environment files, individual save files, or unlicensed third-party sprites. Rotate any credentials previously shared in chat. A private repository does not grant a license to distribute third-party art.
