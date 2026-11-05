#!/usr/bin/env python3
"""Optional Chromium viewport audit. Requires: pip install -r requirements-audit.txt; playwright install chromium."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = [
    ("mobile-320", 320, 720),
    ("mobile-360", 360, 800),
    ("mobile-390", 390, 844),
    ("mobile-430", 430, 932),
    ("tablet-768", 768, 1024),
    ("laptop-1280", 1280, 800),
    ("desktop-1440", 1440, 900),
]


def inline_sources() -> tuple[str, str]:
    landing = (ROOT / "index.html").read_text(encoding="utf-8")
    landing_css = (ROOT / "site/styles.css").read_text(encoding="utf-8")
    landing_js = (ROOT / "site/main.js").read_text(encoding="utf-8")
    landing = landing.replace(
        '<link rel="stylesheet" href="./site/styles.css">',
        f"<style>{landing_css}</style>",
    )
    landing = landing.replace(
        '<script type="module" src="./site/main.js"></script>',
        f"<script>{landing_js}</script>",
    )

    app = (ROOT / "app/index.html").read_text(encoding="utf-8")
    domain = (ROOT / "app/src/domain.js").read_text(encoding="utf-8")
    domain = re.sub(r"^export\s+", "", domain, flags=re.MULTILINE)
    app = app.replace(
        'import { calculateUnitCost, calculateTotal, validateBackup } from "./src/domain.js";',
        domain,
    )
    app = re.sub(
        r'<link rel="(?:manifest|icon|apple-touch-icon)"[^>]*>', "", app
    )
    app = re.sub(r'<script>if \("serviceWorker"[\s\S]*?</script>', "", app)
    return landing, app


def main() -> int:
    parser = argparse.ArgumentParser(description="Check layout and core interactions at common viewport sizes.")
    parser.add_argument("--screenshots", action="store_true", help="Save full-page screenshots under docs/audit/generated/")
    args = parser.parse_args()
    landing_html, app_html = inline_sources()
    screenshot_dir = ROOT / "docs/audit/generated"
    if args.screenshots:
        screenshot_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    failures: list[str] = []
    with sync_playwright() as playwright:
        executable = os.environ.get("CHROMIUM_EXECUTABLE_PATH") or shutil.which("chromium") or shutil.which("chromium-browser")
        browser = playwright.chromium.launch(executable_path=executable) if executable else playwright.chromium.launch()
        for surface, html in (("landing", landing_html), ("app", app_html)):
            for label, width, height in VIEWPORTS:
                page = browser.new_page(viewport={"width": width, "height": height}, has_touch=width <= 768)
                errors: list[str] = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.set_content(html, wait_until="load")
                metrics = page.evaluate(
                    """() => ({
                      viewport: window.innerWidth,
                      documentWidth: document.documentElement.scrollWidth,
                      bodyWidth: document.body.scrollWidth
                    })"""
                )
                result = {
                    "surface": surface,
                    "viewport": label,
                    "width": width,
                    "horizontalOverflow": metrics["documentWidth"] > metrics["viewport"],
                    "runtimeErrors": errors,
                }
                if surface == "landing":
                    if width <= 680:
                        menu = page.locator(".menu")
                        menu.click()
                        result["menuOpens"] = menu.get_attribute("aria-expanded") == "true"
                        page.keyboard.press("Escape")
                        result["menuClosesOnEscape"] = menu.get_attribute("aria-expanded") == "false"
                    first_input = page.locator("#demoRows input").first
                    first_input.fill("200")
                    result["demoRecalculates"] = page.locator("#demoTotal").inner_text().strip() != "7,17 BYN"
                else:
                    card = page.locator(".calc-card").first
                    card.click()
                    result["calculatorOpens"] = page.locator("#calcOverlay").evaluate("element => element.classList.contains('open')")
                    modal = page.locator("#calcOverlay .modal").bounding_box()
                    result["modalFitsViewport"] = bool(modal and modal["width"] <= width + 1 and modal["height"] <= height + 1)

                if args.screenshots:
                    page.screenshot(path=str(screenshot_dir / f"{surface}-{width}.png"), full_page=True)
                if result["horizontalOverflow"]:
                    failures.append(f"{surface}/{label}: horizontal overflow")
                if errors:
                    failures.append(f"{surface}/{label}: JavaScript runtime error")
                if surface == "landing" and width <= 680 and not (result.get("menuOpens") and result.get("menuClosesOnEscape")):
                    failures.append(f"{surface}/{label}: mobile navigation failed")
                if surface == "app" and not (result.get("calculatorOpens") and result.get("modalFitsViewport")):
                    failures.append(f"{surface}/{label}: calculator modal failed")
                results.append(result)
                page.close()
        browser.close()

    print(json.dumps({"results": results, "failures": failures}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
