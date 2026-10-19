#!/usr/bin/env python3
"""Run browser acceptance suites locally or replay TLS-verified public bytes."""
from __future__ import annotations

import argparse
import asyncio
import importlib.util
import inspect
import json
import mimetypes
from pathlib import Path
import sys
import traceback
from urllib.parse import unquote, urlsplit

from release_site import CONTENT, RELEASE, inventory, normalize_base, read_safe, require


REPO = Path(__file__).resolve().parents[1]


def load_public_cache(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "public-manifest.json").read_text())
    require(manifest.get("release") == RELEASE and manifest.get("file_count") == 44, "Invalid public cache release/count")
    base = normalize_base(manifest["base_url"])
    require(urlsplit(base).scheme != "https" or manifest.get("tls_verified") is True, "HTTPS cache was not TLS verified")
    require(set(manifest.get("files", {})) == set(CONTENT), "Public cache must describe exactly 44 content files")
    root = directory / "files"
    names = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file() or path.is_symlink()}
    require(names == set(CONTENT), "Public cache files must be exactly the verified 44 files")
    files = {name: read_safe(root, name) for name in CONTENT}
    actual = inventory(files)
    require(manifest.get("stage_files") == actual, "Cached bytes differ from staged SHA-256 manifest")
    require(all({key: manifest["files"][name].get(key) for key in ("sha256", "size")} == details for name, details in actual.items()),
            "Cached bytes differ from public fetch SHA-256 manifest")
    return base, files


def cache_response(url, base, files):
    requested, origin = urlsplit(url), urlsplit(base)
    require((requested.scheme, requested.netloc) == (origin.scheme, origin.netloc), f"Request outside verified origin: {url}")
    require(requested.path.startswith(origin.path), f"Request outside verified base path: {url}")
    name = unquote(requested.path[len(origin.path):]) or "index.html"
    require(name in files, f"Request not present in verified public cache: {url}")
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if name.endswith(".js"):
        content_type = "text/javascript"
    return {"status": 200, "body": files[name], "content_type": content_type,
            "headers": {"Cache-Control": "no-store", "X-Siam-Verified-Cache": RELEASE}}


def load_suite(path):
    spec = importlib.util.spec_from_file_location("siam_acceptance_" + path.stem, path)
    require(spec is not None and spec.loader is not None, f"Cannot import suite: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    require(callable(getattr(module, "run_checks", None)), f"Suite does not expose run_checks(page): {path}")
    return module


def suite_kwargs(function, artifacts):
    parameters = inspect.signature(function).parameters
    if "artifacts" in parameters:
        return {"artifacts": str(artifacts)}
    if "output_dir" in parameters:
        return {"output_dir": str(artifacts)}
    return {}


def diagnostics():
    return {"pageerrors": [], "failed_requests": [], "http_errors": [], "cache_errors": [], "cache_requests": []}


def observe(page, evidence):
    page.on("pageerror", lambda error: evidence["pageerrors"].append(str(error)))
    page.on("requestfailed", lambda request: evidence["failed_requests"].append({"url": request.url, "failure": request.failure}))
    page.on("response", lambda response: evidence["http_errors"].append({"url": response.url, "status": response.status}) if response.status >= 400 else None)


def check_diagnostics(evidence):
    failures = {key: evidence[key] for key in ("pageerrors", "failed_requests", "http_errors", "cache_errors") if evidence[key]}
    require(not failures, "Browser resource/runtime errors: " + json.dumps(failures, ensure_ascii=False))


def launch_options(args):
    options = {"headless": True, "args": ["--no-sandbox"]}
    if args.chromium:
        options["executable_path"] = args.chromium
    return options


def run_sync(module, args, url, cache, output, evidence):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch_options(args))
        try:
            # TLS verification remains enabled; every suite receives clean storage.
            context = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
            context.set_default_timeout(args.timeout * 1000)
            if cache is not None:
                def route_handler(route):
                    try:
                        response = cache_response(route.request.url, url, cache)
                        evidence["cache_requests"].append(route.request.url)
                        route.fulfill(**response)
                    except ValueError as error:
                        evidence["cache_errors"].append(str(error))
                        route.abort("blockedbyclient")
                context.route("**/*", route_handler)
            page = context.new_page()
            observe(page, evidence)
            try:
                page.goto(url, wait_until="load")
                page.wait_for_function("window.BCGame && window.BCCore && window.BCData && window.BCRender && BCRender.assets.ready")
                result = module.run_checks(page, **suite_kwargs(module.run_checks, output))
                check_diagnostics(evidence)
                return result
            except Exception:
                try:
                    page.screenshot(path=str(output / "failure.png"), full_page=True, timeout=5000)
                except Exception:
                    pass
                raise
            finally:
                context.close()
        finally:
            browser.close()


async def run_async(module, args, url, cache, output, evidence):
    from playwright.async_api import async_playwright
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(**launch_options(args))
        try:
            context = await browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
            context.set_default_timeout(args.timeout * 1000)
            if cache is not None:
                async def route_handler(route):
                    try:
                        response = cache_response(route.request.url, url, cache)
                        evidence["cache_requests"].append(route.request.url)
                        await route.fulfill(**response)
                    except ValueError as error:
                        evidence["cache_errors"].append(str(error))
                        await route.abort("blockedbyclient")
                await context.route("**/*", route_handler)
            page = await context.new_page()
            observe(page, evidence)
            try:
                await page.goto(url, wait_until="load")
                await page.wait_for_function("window.BCGame && window.BCCore && window.BCData && window.BCRender && BCRender.assets.ready")
                result = await module.run_checks(page, **suite_kwargs(module.run_checks, output))
                check_diagnostics(evidence)
                return result
            except Exception:
                try:
                    await page.screenshot(path=str(output / "failure.png"), full_page=True, timeout=5000)
                except Exception:
                    pass
                raise
            finally:
                await context.close()
        finally:
            await browser.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", "--base-url", dest="url", help="Local application URL; with --public-cache must match its original Pages URL")
    parser.add_argument("--public-cache", help="Cache from release_site.py verify-public; replay exact bytes at the original URL")
    parser.add_argument("--artifacts", default=str(REPO.parent / "combat-fx-work/browser"))
    parser.add_argument("--suite", action="append", help="Suite stem under tests/; repeat to select suites (default: *_ui.py and gameplay_regression.py)")
    parser.add_argument("--chromium", default="/usr/bin/chromium", help="Chromium executable; empty string uses Playwright's installed browser")
    parser.add_argument("--timeout", type=float, default=30, help="Timeout per Playwright operation in seconds")
    args = parser.parse_args()
    output = Path(args.artifacts).resolve()
    output.mkdir(parents=True, exist_ok=True)
    try:
        cache = None
        if args.public_cache:
            url, cache = load_public_cache(args.public_cache)
            require(args.url is None or normalize_base(args.url) == url, "--url must match the verified cache's original base URL")
        else:
            url = args.url or "http://127.0.0.1:8765/"
        if args.suite:
            suites = [REPO / "tests" / (name.removesuffix(".py") + ".py") for name in args.suite]
            require(all(path.resolve().parent == REPO / "tests" and path.is_file() for path in suites), "Suites must be existing Python files directly under tests/")
        else:
            suites = sorted((REPO / "tests").glob("*_ui.py"))
            regression = REPO / "tests/gameplay_regression.py"
            if regression.is_file():
                suites.append(regression)
        require(bool(suites), "No browser acceptance suites found")
        results = []
        for path in suites:
            suite_output = output / path.stem
            suite_output.mkdir(parents=True, exist_ok=True)
            evidence = diagnostics()
            record = {"suite": path.name, "url": url, "verified_cache_replay": cache is not None, "diagnostics": evidence}
            print(f"RUN {path.name} ({'verified public cache' if cache is not None else url})", flush=True)
            try:
                module = load_suite(path)
                if inspect.iscoroutinefunction(module.run_checks):
                    record["result"] = asyncio.run(run_async(module, args, url, cache, suite_output, evidence))
                else:
                    record["result"] = run_sync(module, args, url, cache, suite_output, evidence)
                record["status"] = "passed"
                print(f"PASS {path.name}", flush=True)
            except Exception as error:
                record.update(status="failed", error=str(error), traceback=traceback.format_exc())
                print(f"FAIL {path.name}: {error}", file=sys.stderr, flush=True)
            (suite_output / "runner-result.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
            results.append(record)
        summary = {"url": url, "verified_cache_replay": cache is not None, "passed": sum(item["status"] == "passed" for item in results),
                   "failed": sum(item["status"] == "failed" for item in results), "suites": results}
        (output / "browser-results.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({key: summary[key] for key in ("url", "verified_cache_replay", "passed", "failed")}, ensure_ascii=False))
        return 1 if summary["failed"] else 0
    except (ValueError, OSError) as error:
        print(f"Browser acceptance setup failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
