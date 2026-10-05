"""Real Hugo output + actual SW in a VM: feedback updates bypass old asset keys.

No browser/module-cache, live service, CSS rendering or already-open-tab upgrade
is simulated. The warm-cache case starts from a newly fetched enabled page.
"""

import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
from urllib.parse import urlsplit

from test_service_worker_reliability import HARNESS, NODE

ROOT = Path(__file__).resolve().parents[2]
HUGO = os.environ.get("HUGO_BIN") or shutil.which("hugo")
ROUTES = ("/p/20260803/", "/en/p/20260803/", "/works/mantou-checklist-pwa/")
LOADER_SOURCE = "static/js/reader-feedback.js"
CLIENT_SOURCE = "static/lib/waline/3.15.2/waline.js"
LEGACY_URLS = {"loader": "/js/reader-feedback.js", "client": "/lib/waline/3.15.2/waline.js"}


class FeedbackReferences(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.loader = None
        self.client = None
        self.discussion = None
        self.feed(html)

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == "script" and "reader-feedback" in attrs.get("src", ""):
            self.loader = attrs["src"]
        if "data-feedback-server" in attrs:
            self.client = attrs.get("data-feedback-client")
            self.discussion = attrs.get("data-feedback-path")


def read_assets(public, route=ROUTES[0]):
    html = (public / route.lstrip("/") / "index.html").read_text(encoding="utf-8")
    refs = FeedbackReferences(html)
    if not refs.loader:
        raise AssertionError("Enabled page must reference its feedback loader")
    loader = (public / refs.loader.lstrip("/")).read_bytes()
    # The fallback lets the regression reach the original fixed-URL cache bug,
    # rather than fail early simply because the new template attribute is absent.
    client = refs.client
    if not client:
        fixed_import = re.search(rb"import\(['\"]([^'\"]+)['\"]\)", loader)
        if not fixed_import:
            raise AssertionError("Cannot locate the client URL used by the loader")
        client = fixed_import[1].decode("utf-8")
    return {
        "html": html,
        "refs": refs,
        "urls": {"loader": refs.loader, "client": client},
        "bytes": {"loader": loader, "client": (public / client.lstrip("/")).read_bytes()},
    }


@unittest.skipUnless(HUGO and NODE, "Hugo and Node.js are required for feedback asset regression")
class ReaderFeedbackAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        temporary = tempfile.TemporaryDirectory(prefix="mantou-feedback-assets-")
        cls.addClassCleanup(temporary.cleanup)
        cls.root = Path(temporary.name)
        # Isolated sources let us change each asset without editing repository
        # files, invoking the patcher, or making network requests.
        for directory in ("assets", "static", "themes", "layouts", "data", "i18n", "content", "content_en"):
            shutil.copytree(ROOT / directory, cls.root / directory,
                            ignore=shutil.ignore_patterns("node_modules", ".git", "exampleSite"))
        shutil.copyfile(ROOT / "hugo.toml", cls.root / "hugo.toml")
        shutil.copyfile(ROOT / "tests/fixtures/feedback.toml", cls.root / "feedback.toml")
        cls.original = cls.build("original")
        cls.source_bytes = {"loader": (cls.root / LOADER_SOURCE).read_bytes(),
                            "client": (cls.root / CLIENT_SOURCE).read_bytes()}
        with (cls.root / LOADER_SOURCE).open("ab") as source:
            source.write(b"\n// Feedback loader content-addressing test revision.\n")
        cls.loader_changed = cls.build("loader-changed")
        with (cls.root / CLIENT_SOURCE).open("ab") as source:
            source.write(b"\n// Waline client content-addressing test revision.\n")
        cls.client_changed = cls.build("client-changed")

    @classmethod
    def build(cls, name):
        public = cls.root / name
        result = subprocess.run(
            [HUGO, "--source", str(cls.root), "--config", "hugo.toml,feedback.toml",
             "--destination", str(public), "--cacheDir", str(cls.root / "cache"),
             "--minify", "--panicOnWarning"],
            text=True, capture_output=True, timeout=120,
        )
        if result.returncode:
            raise AssertionError(result.stdout + result.stderr)
        return public

    def run_worker(self, scenario):
        result = subprocess.run(
            [NODE, "-"], input=HARNESS + "\n(async () => {\n" + scenario +
            "\n})().then(() => console.log('FEEDBACK_ASSET_TEST_COMPLETE'))"
            ".catch(error => { console.error(error); process.exitCode = 1; });",
            cwd=ROOT, text=True, capture_output=True, timeout=15,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("FEEDBACK_ASSET_TEST_COMPLETE", result.stdout,
                      "An unresolved promise must not silently pass")

    def test_build_references_exact_same_origin_content_for_both_languages(self):
        original = read_assets(self.original)
        for route in ROUTES:
            with self.subTest(route=route):
                assets = read_assets(self.original, route)
                self.assertEqual(assets["urls"], original["urls"])
                self.assertEqual(assets["refs"].client, assets["urls"]["client"])
                for kind, source in self.source_bytes.items():
                    url = assets["urls"][kind]
                    parsed = urlsplit(url)
                    self.assertTrue(url.startswith("/") and not url.startswith("//"), url)
                    self.assertFalse(parsed.scheme or parsed.netloc or parsed.query or parsed.fragment, url)
                    self.assertEqual(assets["bytes"][kind], source, "Serve the exact local asset bytes")
                    digest = hashlib.sha256(source).hexdigest()
                    self.assertIn("." + digest + ".js", url, "URL must derive from the served content")
        self.assertEqual(read_assets(self.original, ROUTES[0])["refs"].discussion,
                         read_assets(self.original, ROUTES[1])["refs"].discussion)

    def test_changing_each_source_changes_only_its_content_address(self):
        original = read_assets(self.original)
        loader_changed = read_assets(self.loader_changed)
        client_changed = read_assets(self.client_changed)
        self.assertNotEqual(original["urls"]["loader"], loader_changed["urls"]["loader"])
        self.assertEqual(original["urls"]["client"], loader_changed["urls"]["client"])
        self.assertEqual(loader_changed["urls"]["loader"], client_changed["urls"]["loader"])
        self.assertNotEqual(loader_changed["urls"]["client"], client_changed["urls"]["client"])
        for assets in (original, loader_changed, client_changed):
            for kind in ("loader", "client"):
                self.assertIn(hashlib.sha256(assets["bytes"][kind]).hexdigest(), assets["urls"][kind])

    def test_first_current_page_asset_requests_bypass_warm_legacy_and_prior_build_cache(self):
        # A new published page is received by the existing unchanged worker.
        # Fixed legacy URLs and prior content-addressed generations stay warm.
        original = read_assets(self.original)
        current = read_assets(self.client_changed)
        fixture = {
            "page": ROUTES[0], "html": current["html"],
            "urls": current["urls"], "previous": original["urls"], "legacy": LEGACY_URLS,
            "bytes": {kind: content.decode("utf-8") for kind, content in current["bytes"].items()},
        }
        self.run_worker("const fixture = " + json.dumps(fixture) + r""";
          await seed(fixture.page, '<h1>Previously cached article</h1>');
          for (const kind of ['loader', 'client']) {
            await seed(fixture.legacy[kind], `OLD legacy ${kind}`);
            await seed(fixture.previous[kind], `OLD previous ${kind}`);
          }
          state.fetch = async request => {
            const path = new URL(request.url).pathname;
            if (path === fixture.page) return new Response(fixture.html);
            const kind = Object.keys(fixture.urls).find(kind => fixture.urls[kind] === path);
            assert.ok(kind, `Unexpected request: ${path}`);
            return new Response(fixture.bytes[kind]);
          };
          const navigation = dispatch(fixture.page);
          assert.equal(await (await navigation.response).text(), fixture.html,
            'New online navigation receives the current published page');
          await settle(navigation);
          for (const kind of ['loader', 'client']) {
            const asset = dispatch(fixture.urls[kind], { mode: 'cors' });
            assert.ok(await (await asset.response).text() === fixture.bytes[kind],
              `The FIRST ${kind} response must contain current bytes, not a warm old asset`);
            await settle(asset);
            assert.equal(await (await cached(fixture.urls[kind])).text(), fixture.bytes[kind]);
          }
          assert.equal(state.fetches.length, 3, 'One navigation and one request per new asset');
          assert.equal(timers.size, 0);
        """)

    def test_characterization_unchanged_static_key_still_returns_old_bytes_then_revalidates(self):
        # This behavior already worked and remains deliberately unchanged.
        self.run_worker(r"""
          await seed('/js/reader-feedback.js', 'previous bytes');
          const refresh = deferred();
          state.fetch = () => refresh.promise;
          const request = dispatch('/js/reader-feedback.js', { mode: 'cors' });
          assert.equal(await (await request.response).text(), 'previous bytes');
          refresh.resolve(new Response('current bytes'));
          await settle(request);
          assert.equal(await (await cached('/js/reader-feedback.js')).text(), 'current bytes');
        """)


if __name__ == "__main__":
    unittest.main()
