#!/usr/bin/env python3
"""Build deterministic 1.21 release archives and verify deployed bytes (stdlib only)."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import parse_qs, quote, urljoin, urlsplit
from urllib.request import Request, urlopen
import zipfile


RELEASE = "1.21"
REPO = Path(__file__).resolve().parents[1]
DEFAULT_BASE = "https://suwitchabuppapan-boop.github.io/Borderlands-Classic-Offline/"
SCRIPTS = tuple("js/" + name + ".js" for name in (
    "classic-data", "sword-rules", "skill-rules", "sword-save", "item-rules", "stat-rules", "combat-feedback", "class-combat",
    "auto-quest", "core", "character", "siam-art", "school-art", "vfx-painter",
    "vfx-weapons", "effect-parts", "vfx-skills", "combat-effects",
    "skill-tree", "damage-text", "render", "simulation-clock", "game",
))
ART = tuple("assets/art/" + name + ".webp" for name in (
    "cavern", "class-acolyte", "class-archer", "class-claw", "class-mage",
    "class-magic-bow", "class-orb", "class-scout", "class-shield", "class-swordsman",
    "class-villager", "class-weapons", "item-catalog", "meadow", "school-book",
    "school-bow", "school-dagger", "school-dual-sword", "school-knuckle", "school-staff",
    "siam-equipment", "siam-headgear", "siam-weapons", "sprites", "townsfolk",
    "weapon-upgrades-v2", "woodland",
))
RUNTIME = tuple(sorted(("index.html", "css/style.css", "LICENSE-GPL-3.0.txt", ".nojekyll") + SCRIPTS + ART))
CONTENT = tuple(path for path in RUNTIME if path != ".nojekyll")
RETRY_STATUSES = {429, 502, 503, 504}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def inventory(files):
    return {name: {"sha256": sha(data), "size": len(data)} for name, data in sorted(files.items())}


def read_safe(root, name):
    path = root / name
    require(not any(item.is_symlink() for item in (path, *path.parents) if item != root.parent),
            f"Refusing symlink: {path}")
    require(path.is_file(), f"Missing required file: {path}")
    return path.read_bytes()


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            self.scripts.append(attrs.get("src", ""))
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.styles.append(attrs.get("href", ""))


def validate_runtime(files):
    require(set(files) == set(RUNTIME) and len(files) == 54, "Runtime must contain exactly the specified 54 files")
    parser = References()
    html = files["index.html"].decode("utf-8")
    parser.feed(html)
    for refs, expected in ((parser.scripts, SCRIPTS), (parser.styles, ("css/style.css",))):
        require(len(refs) == len(expected), f"Wrong number of HTML references: {refs}")
        for reference, name in zip(refs, expected):
            url = urlsplit(reference)
            require(not url.scheme and not url.netloc and not url.fragment and url.path == name
                    and parse_qs(url.query) == {"v": [RELEASE]}, f"Wrong release/order reference: {reference}; expected {name}?v={RELEASE}")
    require(re.search(r'id=[\"\']release-label[\"\'][^>]*>[^<]*\b1\.21\b', html), "HTML release label must be 1.21")
    require(re.search(r'\brelease\s*:\s*[\"\']1\.21[\"\']', files["js/classic-data.js"].decode("utf-8")), "BCData release must be 1.21")
    require(files[".nojekyll"] == b"", ".nojekyll must be empty")
    for name in ART:
        data = files[name]
        require(data[:4] == b"RIFF" and data[8:12] == b"WEBP", f"Invalid WebP file: {name}")


def write_files(root, files):
    require(not any(item.is_symlink() for item in (root, *root.parents)), f"Refusing symlink output directory: {root}")
    root.mkdir(parents=True, exist_ok=True)
    for name, data in sorted(files.items()):
        destination = root / name
        require(not any(item.is_symlink() for item in destination.parents), f"Refusing symlink output parent: {destination}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        require(not destination.is_symlink(), f"Refusing symlink: {destination}")
        destination.write_bytes(data)


def zip_files(destination, files):
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    verify_zip(destination, files)


def verify_zip(path, files):
    with zipfile.ZipFile(path) as archive:
        require(archive.namelist() == sorted(files), f"Unexpected ZIP paths/order: {path}")
        require(archive.testzip() is None, f"ZIP CRC failure: {path}")
        for name, data in files.items():
            require(archive.read(name) == data, f"ZIP byte mismatch: {path}:{name}")


def source_allowed(name):
    path = PurePosixPath(name)
    parts = path.parts
    if not parts or path.is_absolute() or ".." in parts:
        return False
    lower = name.lower()
    if any(word in lower for word in ("secret", "credential", ".save.", "savestate", "node_modules", "__pycache__")):
        return False
    if name in RUNTIME or name in {".gitignore", "START.bat", "ASSET_PROVENANCE.md", "TEST_RESULTS.md"}:
        return True
    if len(parts) == 1:
        return bool(re.fullmatch(r"README[^/]*\.md", name))
    if any(part.startswith(".") for part in parts):
        return False
    allowed = {"docs": {".md", ".txt"}, "tests": {".js", ".py"}, "scripts": {".py", ".md", ".sh"}}
    return parts[0] in allowed and path.suffix in allowed[parts[0]]


def source_files(repo):
    output = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=repo)
    names = sorted({name.decode("utf-8") for name in output.split(b"\0") if name})
    return {name: read_safe(repo, name) for name in names if source_allowed(name)}


def resolve_stage(path):
    path = Path(path).resolve()
    return path / "site" if (path / "runtime-manifest.json").is_file() else path


def load_stage(path):
    stage = resolve_stage(path)
    manifest_path = stage.parent / "runtime-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    require(manifest.get("release") == RELEASE and manifest.get("file_count") == 54, "Invalid runtime manifest release/count")
    require(manifest.get("script_order") == list(SCRIPTS), "Invalid runtime manifest script order")
    names = {item.relative_to(stage).as_posix() for item in stage.rglob("*") if item.is_file() or item.is_symlink()}
    require(names == set(RUNTIME), f"Staged file inventory differs: extra={sorted(names-set(RUNTIME))}, missing={sorted(set(RUNTIME)-names)}")
    files = {name: read_safe(stage, name) for name in RUNTIME}
    validate_runtime(files)
    require(manifest.get("files") == inventory(files), "Staged bytes do not match SHA-256 manifest")
    return stage, files, manifest


def stage_release(args):
    repo = Path(args.repo).resolve()
    out = Path(args.out).resolve()
    require(out != repo and repo not in out.parents, "Use an output directory outside the source checkout")
    files = {name: read_safe(repo, name) for name in RUNTIME}
    require({p.name for p in (repo / "assets/art").glob("*.webp")} == {PurePosixPath(p).name for p in ART}, "Source art inventory must be exactly 27 WebP files")
    require({p.name for p in (repo / "js").glob("*.js")} == {PurePosixPath(p).name for p in SCRIPTS}, "Source JS inventory must be exactly 23 modules")
    validate_runtime(files)
    source = source_files(repo)
    require(all(source.get(name) == data for name, data in files.items()), "Source archive must contain every runtime file unchanged")
    write_files(out / "site", files)
    runtime_manifest = {"release": RELEASE, "file_count": 54, "script_order": list(SCRIPTS), "files": inventory(files)}
    (out / "runtime-manifest.json").write_bytes(json_bytes(runtime_manifest))
    (out / "source-manifest.json").write_bytes(json_bytes({"release": RELEASE, "file_count": len(source), "files": inventory(source)}))
    zip_files(out / "Borderlands-Site.zip", files)
    zip_files(out / "Siam-Arun-1.21.zip", source)
    sums = {name: sha((out / name).read_bytes()) for name in (
        "Borderlands-Site.zip", "Siam-Arun-1.21.zip", "runtime-manifest.json", "source-manifest.json")}
    sums.update({"site/" + name: sha(data) for name, data in files.items()})
    (out / "SHA256SUMS").write_text("".join(f"{digest}  {name}\n" for name, digest in sorted(sums.items())), encoding="utf-8")
    load_stage(out)
    print(json.dumps({"release": RELEASE, "runtime_files": len(files), "source_files": len(source), "stage": str(out / "site"), "archives": {name: sums[name] for name in ("Borderlands-Site.zip", "Siam-Arun-1.21.zip")}}, indent=2))


def normalize_base(base):
    url = urlsplit(base)
    require(url.scheme == "https" or (url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost", "::1"}), "Public base requires HTTPS (HTTP allowed only on loopback for tooling tests)")
    require(url.netloc and not url.username and not url.password and not url.query and not url.fragment, "Base URL must have a host and no credentials/query/fragment")
    return base.rstrip("/") + "/"


def fetch_file(base, name, expected, timeout):
    url = urljoin(base, quote(name))
    for attempt in range(4):
        try:
            request = Request(url, headers={"User-Agent": "Siam-Arun-release-verifier/1.21", "Cache-Control": "no-cache", "Accept-Encoding": "identity"})
            # urlopen's default context verifies HTTPS certificates and hostnames.
            with urlopen(request, timeout=timeout) as response:
                require(response.status == 200, f"Unexpected HTTP status for {url}: {response.status}")
                final = urlsplit(response.url)
                initial = urlsplit(url)
                require(final.scheme == initial.scheme and final.netloc == initial.netloc, f"Cross-origin or TLS downgrade redirect: {url} -> {response.url}")
                data = response.read(len(expected) + 1)
                require(data == expected, f"Public byte mismatch: {name}; expected {sha(expected)}, received {sha(data)} ({len(data)} bytes)")
                return name, data, {"url": response.url, "status": response.status, "sha256": sha(data), "size": len(data)}
        except HTTPError as error:
            if error.code not in RETRY_STATUSES or attempt == 3:
                raise
            time.sleep(0.5 * (2 ** attempt))
    raise AssertionError("unreachable")


def verify_public(args):
    _, staged, _ = load_stage(args.stage)
    base = normalize_base(args.base)
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    require(out != resolve_stage(args.stage), "Public cache must be separate from the runtime stage")
    with ThreadPoolExecutor(max_workers=2) as pool:
        fetched = list(pool.map(lambda name: fetch_file(base, name, staged[name], args.timeout), CONTENT))
    files = {name: data for name, data, _ in fetched}
    write_files(out / "files", files)
    manifest = {"release": RELEASE, "base_url": base, "file_count": 53, "tls_verified": urlsplit(base).scheme == "https",
                "stage_files": inventory({name: staged[name] for name in CONTENT}),
                "files": {name: metadata for name, _, metadata in fetched}}
    (out / "public-manifest.json").write_bytes(json_bytes(manifest))
    print(json.dumps({"release": RELEASE, "verified_content_files": 53, "base_url": base, "tls_verified": manifest["tls_verified"], "cache": str(out)}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    stage = commands.add_parser("stage", help="Create site/, deterministic archives, and SHA-256 manifests")
    stage.add_argument("--repo", default=str(REPO))
    stage.add_argument("--out", required=True)
    stage.set_defaults(action=stage_release)
    verify = commands.add_parser("verify-stage", help="Check the staged 54-file inventory and SHA-256 manifest")
    verify.add_argument("--stage", required=True)
    verify.set_defaults(action=lambda args: print(json.dumps({"verified_runtime_files": len(load_stage(args.stage)[1])})))
    public = commands.add_parser("verify-public", help="Fetch and compare all 53 deployed content files; cache exact bytes")
    public.add_argument("--stage", required=True)
    public.add_argument("--out", required=True)
    public.add_argument("--base", default=DEFAULT_BASE)
    public.add_argument("--timeout", type=float, default=30)
    public.set_defaults(action=verify_public)
    args = parser.parse_args()
    try:
        args.action(args)
    except (ValueError, OSError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        print(f"release verification failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
