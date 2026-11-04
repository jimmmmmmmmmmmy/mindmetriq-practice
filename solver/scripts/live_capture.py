#!/usr/bin/env python3
"""Capture a live game screen and solve it as it stands.

Playwright only, and deliberately outside the package: practice_solver itself
still imports no browser and touches no network. This script reads the page's
accessibility overlay, takes one screenshot of the canvas, hands both to
practice_solver.ingest, and prints the answer. Each capture is also written to
disk as `<name>.html` + `<name>.png`, so the same item can be re-ingested
offline later.

    python solver/scripts/live_capture.py --url <page> --count 3
    python solver/scripts/live_capture.py --cdp http://localhost:9222 --count 3

The second form attaches to a browser you already have open and logged in, so
no credentials pass through this script: start Chrome with
`--remote-debugging-port=9222` and open the item yourself.

Only use this on your own practice or demo session. Running it during a real
assessment would defeat the assessment and would breach the publisher's terms.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from practice_solver.exact import solve  # noqa: E402
from practice_solver.ingest import record_from_snapshot  # noqa: E402

OVERLAY = """(text) => {
  let box = document.getElementById('hermes-answer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'hermes-answer';
    Object.assign(box.style, {
      position: 'fixed', right: '10px', top: '10px', zIndex: 2147483647,
      background: 'rgba(10,10,10,0.82)', color: '#6ef2c0', padding: '8px 12px',
      borderRadius: '8px', font: '600 15px/1.35 ui-monospace, monospace',
      pointerEvents: 'none', whiteSpace: 'pre'
    });
    document.body.appendChild(box);
  }
  box.textContent = text;
}"""


def grab(page, out: Path, index: int) -> tuple[Path, Path | None, tuple[float, float] | None]:
    """Write the DOM and a canvas screenshot; return both paths and the canvas box."""
    html = page.evaluate("document.documentElement.outerHTML")
    snapshot = out / f"page-{index:04d}.html"
    snapshot.write_text(html, encoding="utf-8")
    canvas = page.query_selector("canvas")
    if canvas is None:
        return snapshot, None, None
    box = canvas.bounding_box()
    image = snapshot.with_suffix(".png")
    canvas.screenshot(path=str(image))
    return snapshot, image, (box["width"], box["height"]) if box else None


def describe(record: dict, answer: dict) -> str:
    if record["game"] == "racer":
        caught = " + ".join(str(record["puzzle"]["nums"][i]) for i in answer["indices"])
        return f"catch {answer['indices']}  ({caught} = {record['puzzle']['target']})"
    if record["game"] == "net":
        return f"net to ({answer['x']},{answer['y']})  sum {answer['sum']}"
    return json.dumps(answer)


def attach(playwright, args):
    browser = playwright.chromium.connect_over_cdp(args.cdp)
    context = browser.contexts[0]
    pages = context.pages
    page = next((candidate for candidate in pages if args.match in candidate.url), pages[0] if pages else None)
    if page is None:
        raise SystemExit("No open tab to attach to; open the item first")
    print(f"attached to {page.url}", file=sys.stderr)
    return browser, page


def one_round(page, args, options: dict, index: int, wait: bool = False) -> dict | None:
    """Capture the current screen, solve it, and print. Returns the record."""
    if wait:
        page.wait_for_selector(".mindmetriq-accessibility", timeout=args.timeout * 1000)
    started = time.perf_counter()
    snapshot, image, canvas = grab(page, args.out, index)
    capture_ms = (time.perf_counter() - started) * 1000
    record, notes = record_from_snapshot(
        snapshot,
        args.game or None,
        args.level,
        {**options, **({"image": image} if image else {}), **({"canvas": canvas} if canvas else {})},
    )
    answer = solve(record)
    total_ms = (time.perf_counter() - started) * 1000
    text = describe(record, answer)
    print(f"[{index}] {record['game']}: {text}   capture {capture_ms:.0f} ms, total {total_ms:.0f} ms", flush=True)
    for note in notes:
        print(f"      note: {note}", file=sys.stderr)
    if args.json:
        print(json.dumps(record), flush=True)
    if args.overlay:
        page.evaluate(OVERLAY, f"{record['game']}\n{text}")
    return record


def watch(page, args, options: dict) -> None:
    """Poll a page you are playing, solving each distinct item once."""
    deadline = time.time() + args.watch
    seen: set[str] = set()
    index = 0
    while time.time() < deadline:
        try:
            snapshot, image, canvas = grab(page, args.out, index)
            record, _notes = record_from_snapshot(
                snapshot,
                args.game or None,
                args.level,
                {**options, **({"image": image} if image else {}), **({"canvas": canvas} if canvas else {})},
            )
            answer = solve(record)
        except Exception:
            # Instruction screens, transitions, half-drawn frames: just look again.
            time.sleep(args.interval)
            continue
        signature = json.dumps([record["game"], record["puzzle"], answer], sort_keys=True)
        if signature not in seen:
            seen.add(signature)
            text = describe(record, answer)
            print(f"[{len(seen)}] {record['game']}: {text}", flush=True)
            if args.json:
                print(json.dumps(record), flush=True)
            if args.overlay:
                page.evaluate(OVERLAY, f"{record['game']}\n{text}")
        index += 1
        time.sleep(args.interval)
    print(f"watched {args.watch:.0f} s, solved {len(seen)} item(s)", file=sys.stderr)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="Page to open in a fresh browser")
    source.add_argument("--cdp", help="Attach to a running browser, e.g. http://localhost:9222")
    parser.add_argument("--match", default="tptests.com", help="Tab URL fragment to pick when attaching")
    parser.add_argument("--count", type=int, default=1, help="How many captures to take")
    parser.add_argument("--interval", type=float, default=1.0, help="Seconds between captures")
    parser.add_argument("--watch", type=float, default=0.0, help="Poll for this many seconds, solving each new item")
    parser.add_argument("--headless", action="store_true", help="Run --url without a window (you cannot click through guides)")
    parser.add_argument("--keep-open", action="store_true", help="Leave the browser open until you press Enter")
    parser.add_argument("--timeout", type=float, default=20.0, help="Seconds to wait for the overlay")
    parser.add_argument("--width", type=int, default=412, help="Window width; 412 makes the demo canvas 372 wide")
    parser.add_argument("--height", type=int, default=900, help="Window height")
    parser.add_argument("--out", type=Path, default=Path("captures"), help="Where to keep snapshots")
    parser.add_argument("--game", default="", help="Force an adapter instead of detecting one")
    parser.add_argument("--level", default="unknown", help="Level label stored with every record")
    parser.add_argument("--net-box", action="store_true", help="Accept the net's box as its shape")
    parser.add_argument("--overlay", action="store_true", help="Show the answer on the page itself")
    parser.add_argument("--json", action="store_true", help="Print each record as JSON")
    args = parser.parse_args(argv)

    from playwright.sync_api import sync_playwright

    options = {"net_box": True} if args.net_box else {}
    args.out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        if args.cdp:
            browser, page = attach(playwright, args)
        else:
            browser = playwright.chromium.launch(headless=args.headless)
            page = browser.new_context(viewport={"width": args.width, "height": args.height}).new_page()
            page.goto(args.url, wait_until="domcontentloaded")
        try:
            if args.watch:
                watch(page, args, options)
            else:
                one_round(page, args, options, 0, wait=True)
        finally:
            if args.keep_open:
                print("browser left open; press Enter to close", file=sys.stderr)
                try:
                    input()
                except EOFError:
                    pass
            browser.close()


if __name__ == "__main__":
    main()
