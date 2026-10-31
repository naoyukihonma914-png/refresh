"""段階1のブラウザ確認。事前に game をビルドし、Pages と同じ配置で配信する。

python tools/check_foundation.py --base-url http://127.0.0.1:4173
Python の playwright と Chromium が必要。ブラウザの追加ダウンロードは行わない。
画面画像と確認結果は game/artifacts/stage1/ に保存する。
"""

import argparse
import json
import shutil
from pathlib import Path

from playwright.sync_api import Error, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "game/artifacts/stage1"


def ready(page):
    page.locator(".intro-note, .foundation").first.wait_for()
    if page.locator(".intro-note").count():
        page.locator(".intro-note button").click()
    page.locator(".foundation").wait_for()
    page.evaluate("async () => { await document.fonts.ready; }")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:4173")
    parser.add_argument("--chromium", default=shutil.which("chromium"))
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    url = args.base_url.rstrip("/") + "/play/"
    checks = []
    errors = []
    limitations = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, args=["--no-sandbox"])
        context = browser.new_context(locale="ja-JP", timezone_id="Asia/Tokyo", viewport={"width": 1920, "height": 1080})
        context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
        page = context.new_page()
        response = page.goto(url)
        assert response.status == 200
        ready(page)
        assert page.locator(".debug-panel").count() == 0
        assert page.locator(".generate-button").count() == 1
        assert page.get_by_text("ピクセル: 0", exact=True).count() == 1

        for width, height in [(1920, 1080), (1366, 768), (2560, 1440), (1080, 1920)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_function("([w,h]) => innerWidth === w && innerHeight === h", arg=[width, height])
            page.wait_for_timeout(100)
            bounds = page.locator(".stage").bounding_box()
            assert bounds["x"] >= -0.01 and bounds["y"] >= -0.01
            assert bounds["x"] + bounds["width"] <= width + 0.01
            assert bounds["y"] + bounds["height"] <= height + 0.01
            assert abs(bounds["width"] / bounds["height"] - 1920 / 1080) < 0.001
            assert page.locator(".screen-notice").count() == (1 if height > width else 0)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            lines = page.locator(".foundation p").all()
            line_bounds = [line.bounding_box() for line in lines]
            for previous, current in zip(line_bounds, line_bounds[1:]):
                assert previous["y"] + previous["height"] <= current["y"]
            page.screenshot(path=str(ARTIFACTS / f"foundation-{width}x{height}.png"))
        checks.append("4画面サイズで等倍率・中央配置・重なり・横スクロールを確認")

        page.set_viewport_size({"width": 1920, "height": 1080})
        page.goto(url + "?debug=1")
        ready(page)
        page.get_by_role("button", name="ピクセルを足す", exact=True).click()
        assert page.evaluate("localStorage.getItem('refresh.save')") is None
        page.reload()
        ready(page)
        assert page.get_by_text("ピクセル: 0", exact=True).count() == 1
        page.get_by_role("button", name="保存済みの状態を試す", exact=True).click()
        page.get_by_role("button", name="ピクセルを足す", exact=True).click()
        saved = page.evaluate("JSON.parse(localStorage.getItem('refresh.save'))")
        assert saved["resources"]["pixels"] >= 1000
        page.reload()
        ready(page)
        assert page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels") >= 1000
        checks.append("保存解禁前は保存しない・解禁直後の保存・再読み込みによる復元")

        second = context.new_page()
        second.goto(url + "?debug=1")
        second.get_by_text("別のタブで開いています", exact=True).wait_for()
        assert second.locator(".debug-panel").count() == 0
        page.close()
        second.get_by_role("button", name="読み込み直す", exact=True).click()
        ready(second)
        page = second
        checks.append("後から開いたタブの操作停止・先のタブを閉じて再読み込みで再開")

        with page.expect_download() as download:
            page.get_by_role("button", name="データをエクスポート", exact=True).click()
        exported = Path(download.value.path()).read_bytes()
        assert json.loads(exported)["schemaVersion"] == 8

        page.add_init_script("""
          const corruption = sessionStorage.getItem('test-corruption');
          if (corruption) {
            localStorage.setItem('refresh.save', '壊れた主データ');
            if (corruption === 'both') localStorage.setItem('refresh.save.backup', '壊れた予備');
            sessionStorage.removeItem('test-corruption');
          }
        """)
        page.evaluate("sessionStorage.setItem('test-corruption', 'primary')")
        page.reload()
        ready(page)
        page.get_by_text("予備の保存データから復元しました。", exact=True).wait_for()
        page.evaluate("sessionStorage.setItem('test-corruption', 'both')")
        page.reload()
        page.get_by_role("button", name="新しく始める", exact=True).wait_for()
        assert page.locator(".foundation").count() == 0
        assert page.evaluate("localStorage.getItem('refresh.save')") == "壊れた主データ"
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_role("button", name="新しく始める", exact=True).click()
        assert page.evaluate("localStorage.getItem('refresh.save')") == "壊れた主データ"
        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="新しく始める", exact=True).click()
        ready(page)
        assert page.evaluate("localStorage.getItem('refresh.save')") is None
        checks.append("予備からの復元・両方破損時の停止・確認の取消と承認")

        page.once("dialog", lambda dialog: dialog.accept())
        with page.expect_file_chooser() as chooser:
            page.get_by_role("button", name="データを読み込む", exact=True).click()
        chooser.value.set_files({"name": "不正.json", "mimeType": "application/json", "buffer": b"{"})
        page.get_by_text("このファイルは読み込めませんでした。いまのデータは変更していません。", exact=True).wait_for()
        assert page.get_by_text("ピクセル: 0", exact=True).count() == 1
        page.once("dialog", lambda dialog: dialog.accept())
        with page.expect_file_chooser() as chooser:
            page.get_by_role("button", name="データを読み込む", exact=True).click()
        chooser.value.set_files({"name": "保存.json", "mimeType": "application/json", "buffer": exported})
        page.wait_for_function("localStorage.getItem('refresh.save') !== null")
        checks.append("JSONファイルの書き出し・読み込み・不正ファイルの拒否")

        page.evaluate("""() => {
          const state = JSON.parse(localStorage.getItem('refresh.save'));
          state.resources.pixels = 0;
          state.run.totalPixelsGenerated = 0;
          state.createdAt = state.lastTickAt = state.lastSavedAt = Date.now() - 3 * 3600000;
          localStorage.setItem('refresh.save', JSON.stringify(state));
        }""")
        # 現在の画面を閉じる保存で、上の検証用データを上書きしないよう別のタブで復元する。
        # ページの再読み込み前に pagehide も発火するため、このケースは新しい文脈で検査する。
        offline_state = page.evaluate("localStorage.getItem('refresh.save')")
        offline_context = browser.new_context(locale="ja-JP", timezone_id="Asia/Tokyo")
        offline_context.add_init_script("localStorage.setItem('refresh.save', " + json.dumps(offline_state) + ")")
        offline_page = offline_context.new_page()
        offline_page.goto(url)
        ready(offline_page)
        value = offline_page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
        assert 7200 <= value < 7201
        offline_page.get_by_text("留守の間に 2時間ぶん作業しました", exact=False).wait_for()
        offline_page.screenshot(path=str(ARTIFACTS / "offline-capped.png"))
        offline_context.close()
        checks.append("3時間の不在から2時間分（7,200ピクセル）だけ加算")
        context.close()

        fixture_context = browser.new_context(locale="ja-JP", timezone_id="Asia/Tokyo", viewport={"width": 1920, "height": 1080})
        fixture_page = fixture_context.new_page()
        fixture_page.goto(url + "?state=foundation-saved&debug=1")
        ready(fixture_page)
        fixture_page.get_by_role("button", name="ピクセルを足す", exact=True).click()
        assert fixture_page.evaluate("localStorage.getItem('refresh.save')") is None
        fixture_page.screenshot(path=str(ARTIFACTS / "debug.png"))
        fixture_context.close()
        checks.append("固定状態と実セーブの隔離・開発用小窓")

        file_context = browser.new_context(locale="ja-JP", timezone_id="Asia/Tokyo", offline=True, viewport={"width": 1920, "height": 1080})
        file_page = file_context.new_page()
        file_page.on("pageerror", lambda error: errors.append(str(error)))
        requests = []
        file_page.on("request", lambda request: requests.append(request.url))
        try:
            file_page.goto((ROOT / "game/dist/index.html").as_uri())
            ready(file_page)
            assert all(request.startswith("file:") for request in requests)
            file_page.screenshot(path=str(ARTIFACTS / "file-offline.png"))
            checks.append("通信なしの file:// 起動・単一HTML")
        except Error as error:
            if "ERR_BLOCKED_BY_ADMINISTRATOR" not in str(error):
                raise
            limitations.append("この環境の file:// はブラウザポリシーで拒否。ダブルクリック起動はユーザー側で検証成功済み（2026-10-31）")
        file_context.close()

        disconnected = browser.new_context(locale="ja-JP", timezone_id="Asia/Tokyo")
        disconnected_page = disconnected.new_page()
        disconnected_page.on("pageerror", lambda error: errors.append(str(error)))
        disconnected_page.goto(url + "?debug=1")
        ready(disconnected_page)
        disconnected.set_offline(True)
        disconnected_page.get_by_role("button", name="保存済みの状態を試す", exact=True).click()
        disconnected_page.get_by_role("button", name="ピクセルを足す", exact=True).click()
        assert disconnected_page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels") >= 1000
        disconnected.close()
        checks.append("HTTP読み込み後に通信を切り、生成・保存が動くことを確認")

        mockup_context = browser.new_context(locale="ja-JP", timezone_id="Asia/Tokyo", viewport={"width": 1920, "height": 1080})
        mockup_context.route("https://**/*", lambda route: route.abort())
        mockup_page = mockup_context.new_page()
        mockup_page.goto(args.base_url.rstrip("/") + "/01-seed.html")
        mockup_page.screenshot(path=str(ARTIFACTS / "mockup-01.png"))
        mockup_context.close()
        checks.append("見本01を同じブラウザ・1920×1080で撮影")
        browser.close()

    assert not errors, errors
    report = {"checks": checks, "pageErrors": errors, "limitations": limitations}
    (ARTIFACTS / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
