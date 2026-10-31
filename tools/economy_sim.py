"""REFRESH 経済の仮値シミュレーション（世界1〜3、チュートリアル v0.1 と v1）

ゲームのコードではなく、仮の数値が目標時間に合うかを確かめるための道具。
数値はすべて仮値。docs/経済の仮値.md の表と同じものを CONFIG に置く。

使い方: python3 tools/economy_sim.py
"""

import math

# ---------------------------------------------------------------- 仮値
CONFIG = {
    # 遊ぶ人の想定
    "player": {
        "clicks_per_sec": 2.5,        # 素の画面で押し続ける速さ
        "dots_per_sec": 1.5,          # 組木で下絵のマスにドットを置く速さ
        "decide_sec": 4,              # 何かを作るたびに迷う時間
        "read_sec": 15,               # ガイドの言葉1回を読む時間
        "desktop_active_ratio": 0.5,  # デスクトップで手を動かしている割合（残りは眺めているだけ）
    },
    # 素の画面
    "w1": {
        "items": [  # 名前, ピクセル
            ("枠線", 10),
            ("保存", 40),
            ("色", 200),
            ("書体", 700),
            ("配置", 2_000),
            ("動き", 4_500),
            ("組木を作る", 12_000),
        ],
        "cursor_unlock_after": "保存",  # 自動カーソルは保存の次から買える
        "cursor_cost": 15, "cursor_growth": 1.15,
        "cursor_press_per_sec": 0.5,     # 30Hzのとき、1台が1秒に押す回数
        "momentum": 1.3,                 # 「動き」の勢い（連打中の平均倍率）
    },
    # 組木
    "w2": {
        "items": [
            ("選択ツール", 4_000),
            ("ボタン", 9_000),
            ("拡張機能", 15_000),
            ("スイッチ", 20_000),
            ("スライダー", 32_000),
            ("入力欄", 45_000),
            ("窓の枠", 65_000),
            ("タスクバー", 90_000),
            ("デスクトップとして組み立てる", 200_000),
        ],
        "dot_value": 10,              # 下絵のマス1つのピクセル
        "focus_mult": 2.0,            # 集中モード中のドットの倍率（自動生成は止まる）
        "icon_cells": 150,            # 16×16 の下絵で塗るマス
        "icons_main": 6,              # フォルダ・ごみ箱・時計・メール・写真・設定
        "icons_extra": 99,            # 練習用の下絵（ピクセルだけ。トークンは出ない）
        "button_cursor_mult": 1.5,    # 部品「ボタン」：押し先が増える
        "slider_mult": 1.2,           # 部品「スライダー」：長い間隔でまとめて
    },
    # デスクトップ
    "w3": {
        "items": [
            ("ファイル", 300_000),
            ("ファイル：並べ替え", 380_000),
            ("メール", 470_000),
            ("メール：返信の下書き", 590_000),
            ("持ち場", 730_000),
            ("タスクマネージャー", 920_000),
            ("ファイル：検索", 1_500_000),
            ("ファイル：大きいアイコン表示", 2_400_000),
            ("写真", 4_000_000),
            ("写真：切り抜き", 6_500_000),
            ("写真：比べて見る", 11_000_000),
            ("ごみ箱", 17_000_000),
            ("ごみ箱：元に戻す", 28_000_000),
            ("メール：フォルダ分け", 46_000_000),
            ("時計", 75_000_000),
            ("時計：タイマー", 120_000_000),
            ("時計：カレンダー", 200_000_000),
            ("テーマ", 320_000_000),
            ("テーマ：壁紙のスライドショー", 530_000_000),
            ("テーマ：アイコンの大きさ", 860_000_000),
            ("ターミナル", 1_400_000_000),
        ],
        # アプリの小さな機能：画面に写る部品が増える。持ち場になるアプリなら、その窓の働きも上がる
        "feature_parts": 2,
        "feature_post_mult": 1.25,
        # 持ち場にできるアプリ：(名前, 解放する作るもの, カーソル1台の毎秒, カーソル初値)
        "posts": [
            ("組木", "持ち場", 40, 30_000),
            ("ファイル", "持ち場", 150, 150_000),
            ("写真", "写真", 700, 1_500_000),
            ("ターミナル", "ターミナル", 6_000, 40_000_000),
        ],
        "post_cursor_growth": 1.15,
        "update_cost_mult": 15,        # アプリの更新：初回はカーソル初値×15
        "update_cost_growth": 6,       # 更新ごとに値段×6
        "update_mult": 2.0,            # 更新ごとに毎秒×2
        "shot_cooldown": 30,           # 画面を撮る：待ち時間（描画性能で縮む）
        "shot_sec_per_part": 0.5,      # 写っている部品1つにつき、毎秒生成の何秒分
        "mail_interval": 240, "mail_tokens": 2,
        "recycle_mult": 1.05,
    },
    # スペック（1周目の初期値 → 段階）
    "spec": {
        "color_mult": {"16色": 1.0, "256色": 1.5, "フルカラー": 2.5, "HDR": 4.0},
        "posts_by_memory": {"4GB": 3, "8GB": 4, "16GB": 5, "32GB": 6, "64GB": 8},
    },
    # リリース
    "release": {"base": 25, "exp": 0.4, "per_element": 0.05},
    # 長く遊べる仕組み（2026-10-31）
    "longplay": {
        "achievement_bonus": 0.01,   # 実績1つごとに全生成 +1%（足し算）
        "icon_synergy": 0.005,        # デスクトップのジョブ：エクスポートしたアイコン1つごとに +1%（上限50）
        "icon_synergy_cap": 50,
        "cursor_synergy": 0.001,     # デスクトップのジョブ：素の画面のオートカーソル1台ごとに +0.2%
    },
}


def fmt_t(sec):
    m = int(sec // 60)
    return f"{m // 60}時間{m % 60:02d}分" if m >= 60 else f"{m}分"


class Run:
    def __init__(self, cfg, spec, tokens, tree, label):
        self.c, self.spec, self.tokens, self.tree = cfg, spec, tokens, set(tree)
        self.label = label
        self.t = 0.0
        self.px = 0.0
        self.total_px = 0.0
        self.owned = []
        self.cursors = 0
        self.icons_done = 0
        self.icon_progress = 0
        self.parts_exported = 0
        self.mails = 0
        self.log = []
        self.posts = {}     # アプリ名 -> [台数, 更新回数]
        self.shot_timer = 0.0
        self.mail_timer = 0.0

    # ---- 倍率
    def color(self):
        # 色深度の倍率に、実績のボーナスをまとめて掛ける（全生成に効く）
        return self.c["spec"]["color_mult"][self.spec["color"]] * (1 + self.c["longplay"]["achievement_bonus"] * self.achievements())

    def achievements(self):
        """この区間で取れる実績の数（おおよそ）。素の画面・Tessera・リリース・デスクトップ"""
        a = sum(1 for x in ("保存", "組木を作る", "タスクバー", "ファイル", "写真", "ターミナル") if self.has(x))
        a += (self.cursors >= 10) + (self.cursors >= 50)
        a += (self.icons_done >= 1) + (self.icons_done >= 6) + (self.icons_done >= 16)
        a += (self.mails >= 10) + (self.mails >= 50)
        a += 2 if self.label != "v0.1" else 0
        return a

    def hz(self):
        return self.spec["hz"] / 30

    def has(self, name):
        return name in self.owned

    def click_value(self):
        v = 1 + (1 if self.has("枠線") else 0)
        if self.has("書体"):
            v *= 2
        return v * self.color()

    def home_rate(self):
        w1 = self.c["w1"]
        r = self.cursors * w1["cursor_press_per_sec"] * self.click_value() * self.hz()
        if self.has("色"):
            r *= 1.5
        if self.has("ボタン"):
            r *= self.c["w2"]["button_cursor_mult"]
        if self.has("スライダー"):
            r *= self.c["w2"]["slider_mult"]
        return r

    def posts_rate(self):
        r = 0.0
        for name, unlock, base, cost0 in self.c["w3"]["posts"]:
            if name in self.posts:
                n, lv = self.posts[name]
                f = sum(1 for x in self.owned if x.startswith(name + "："))
                r += n * base * (self.c["w3"]["update_mult"] ** lv) * self.c["w3"]["feature_post_mult"] ** f
        r *= self.color() * self.hz()
        lp = self.c["longplay"]
        r *= (1 + lp["icon_synergy"] * min(self.icons_done, lp["icon_synergy_cap"])) * (1 + lp["cursor_synergy"] * self.cursors)
        if self.has("ごみ箱"):
            r *= self.c["w3"]["recycle_mult"]
        return r

    def passive_rate(self):
        return self.home_rate() + self.posts_rate()

    # ---- 進める
    def earn(self, v):
        self.px += v
        self.total_px += v

    def step(self, sec, active_rate):
        self.earn((self.passive_rate() + active_rate) * sec)
        self.t += sec

    def buy(self, name, cost, world):
        self.px -= cost
        self.owned.append(name)
        self.log.append((self.t, world, name))
        self.t += self.c["player"]["decide_sec"]

    def cursor_cost(self):
        w1 = self.c["w1"]
        return math.ceil(w1["cursor_cost"] * w1["cursor_growth"] ** self.cursors)

    def maybe_cursors(self, next_cost):
        bought = 0
        while self.has(self.c["w1"]["cursor_unlock_after"]) and \
                self.cursor_cost() <= max(self.px - next_cost * 0.0, 0) and \
                self.cursor_cost() < next_cost * 0.35:
            self.px -= self.cursor_cost()
            self.cursors += 1
            bought += 1
        return bought

    # ---- 世界1
    def world1(self):
        p = self.c["player"]
        for name, cost in self.c["w1"]["items"]:
            if self.tree_has("構成を引き継ぐ") and name in ("枠線", "保存", "色"):
                self.owned.append(name)
                continue
            while self.px < cost:
                self.maybe_cursors(cost)
                mom = self.c["w1"]["momentum"] if self.has("動き") else 1
                self.step(1, p["clicks_per_sec"] * self.click_value() * mom)
            self.buy(name, cost, "素の画面")
            if name == "色" and self.label == "v0.1":
                self.t += p["read_sec"] * 2  # 初めての連絡
            if name == "動き" and self.label == "v0.1":
                self.t += p["read_sec"]

    def tree_has(self, n):
        return n in self.tree

    # ---- 世界2
    def dot_rate(self):
        w2, p = self.c["w2"], self.c["player"]
        if self.icons_done >= self.icons_available():
            return 0, 0
        speed = p["dots_per_sec"]
        if self.tree_has("左右対称"):
            speed *= 1.8
        if self.tree_has("塗りつぶし"):
            speed *= 1.4
        return speed, w2["dot_value"] * self.color()

    # 名前つきの下絵は、組木の進み具合に合わせて1つずつ届く
    ICON_AFTER = [None, "ボタン", "スイッチ", "スライダー", "入力欄", "窓の枠"]

    def icons_available(self):
        n = sum(1 for k in self.ICON_AFTER if k is None or self.has(k))
        if self.has("窓の枠"):
            n += self.c["w2"]["icons_extra"]  # 練習用の下絵が開く
        return n

    def draw(self, sec):
        """sec 秒だけ描く。集中モードは得な方を選ぶ"""
        w2 = self.c["w2"]
        speed, val = self.dot_rate()
        if speed == 0:
            self.step(sec, 0)
            return
        dot_income = speed * val
        if self.has("スイッチ") and dot_income * w2["focus_mult"] > dot_income + self.home_rate():
            self.earn(dot_income * w2["focus_mult"] * sec)
            self.t += sec
        else:
            self.step(sec, dot_income)
        self.icon_progress += speed * sec
        cells = w2["icon_cells"] * self.spec["res_cells"]
        while self.icon_progress >= cells:
            self.icon_progress -= cells
            self.icons_done += 1
            if self.icons_done <= self.c["w2"]["icons_main"]:
                self.tokens += self.spec["res_tokens"]
            self.t += 2  # 書き出す

    def world2(self, stop_at_gate):
        p = self.c["player"]
        if self.label == "v0.1":
            self.t += p["read_sec"] * 2
        for name, cost in self.c["w2"]["items"]:
            if name == "デスクトップとして組み立てる" and stop_at_gate:
                self.log.append((self.t, "組木", "256色が必要で止まる → v0.1 の準備"))
                self.t += p["read_sec"] * 2
                return
            while self.px < cost:
                self.maybe_cursors(cost)
                self.draw(1)
                self.spend_tokens()
            self.buy(name, cost, "組木")
            if name in ("ボタン", "スイッチ", "スライダー", "入力欄", "窓の枠", "タスクバー"):
                self.tokens += 1
                self.parts_exported += 1
                self.t += 2

    # ---- トークンの使い道（1周目帯を順に）
    TREE_ORDER = [("塗りつぶし", 2), ("左右対称", 3), ("レイヤー一覧", 1),
                  ("キーボードで押す", 1), ("更新履歴", 1), ("スポイト", 1),
                  ("窓を半分に並べる", 2), ("通知から直す", 2), ("スクショの連写", 4),
                  ("構成を引き継ぐ", 12), ("持ち場を増やす", 15)]

    def spend_tokens(self):
        for n, c in self.TREE_ORDER:
            if n in self.tree:
                continue
            if self.tokens >= c:
                self.tokens -= c
                self.tree.add(n)
                self.log.append((self.t, "拡張", f"{n}（トークン{c}）"))
            return

    # ---- 世界3
    def post_cursor_cost(self, name):
        for n, u, base, cost0 in self.c["w3"]["posts"]:
            if n == name:
                return cost0 * self.c["w3"]["post_cursor_growth"] ** self.posts[name][0]

    def update_cost(self, name):
        for n, u, base, cost0 in self.c["w3"]["posts"]:
            if n == name:
                w3 = self.c["w3"]
                return cost0 * w3["update_cost_mult"] * w3["update_cost_growth"] ** self.posts[name][1]

    def post_limit(self):
        lim = self.c["spec"]["posts_by_memory"][self.spec["memory"]]
        return lim + (1 if self.tree_has("持ち場を増やす") else 0)

    def open_posts(self):
        for n, unlock, base, cost0 in self.c["w3"]["posts"]:
            if self.has(unlock) and n not in self.posts and len(self.posts) < self.post_limit():
                self.posts[n] = [0, 0]
            elif self.has(unlock) and n not in self.posts:
                # 持ち場がいっぱい：一番弱いところと入れ替える（選択の場面）
                weakest = min(self.posts, key=lambda k: self.posts[k][0] * 1)
                del self.posts[weakest]
                self.posts[n] = [0, 0]
                self.log.append((self.t, "デスクトップ", f"持ち場の入れ替え：{weakest} → {n}"))

    def invest(self, next_cost):
        # 次の作るものの 35% 未満なら、カーソルと更新を買う（効率のよい順）
        while True:
            best = None
            for n in self.posts:
                base = [b for (k, u, b, c0) in self.c["w3"]["posts"] if k == n][0]
                lv = self.posts[n][1]
                cc = self.post_cursor_cost(n)
                gain = base * self.c["w3"]["update_mult"] ** lv
                cand = (gain / cc, cc, n, "cursor")
                if best is None or cand[0] > best[0]:
                    best = cand
                uc = self.update_cost(n)
                ugain = self.posts[n][0] * base * self.c["w3"]["update_mult"] ** lv
                if ugain > 0:
                    cand = (ugain / uc, uc, n, "update")
                    if cand[0] > best[0]:
                        best = cand
            if best is None or best[1] > self.px or best[1] > next_cost * 0.35:
                return
            self.px -= best[1]
            if best[3] == "cursor":
                self.posts[best[2]][0] += 1
            else:
                self.posts[best[2]][1] += 1

    def parts_on_screen(self):
        w3 = self.c["w3"]
        made = [x for x in self.owned if x in dict(w3["items"])]
        apps = [x for x in made if "：" not in x]
        feats = [x for x in made if "：" in x]
        return 10 + 3 * len(apps) + w3["feature_parts"] * len(feats) + self.icons_done

    def world3(self):
        p, w3 = self.c["player"], self.c["w3"]
        self.log.append((self.t, "デスクトップ", "到着"))
        self.rate_in = self.passive_rate()
        items = w3["items"]
        for name, cost in items:
            while self.px < cost:
                self.open_posts()
                self.invest(cost)
                self.maybe_cursors(cost)
                sec = 5
                self.step(sec, 0)
                active = p["desktop_active_ratio"]
                # 画面を撮る
                self.shot_timer += sec
                cd = w3["shot_cooldown"] / (1.5 if self.tree_has("スクショの連写") else 1)
                while self.shot_timer >= cd:
                    self.shot_timer -= cd
                    shot = self.passive_rate() * self.parts_on_screen() * w3["shot_sec_per_part"]
                    if self.has("ターミナル"):
                        self.earn(shot)              # 自動化：毎回撮る
                    elif self.has("時計"):
                        self.earn(shot * max(active, 0.5))  # 予約で半分以上
                    else:
                        self.earn(shot * active)
                # 要望メール
                if self.has("メール") or True:
                    self.mail_timer += sec
                    while self.mail_timer >= w3["mail_interval"]:
                        self.mail_timer -= w3["mail_interval"]
                        self.mails += active  # 半分は気づかず溜まる→平均
                        self.tokens += w3["mail_tokens"] * active
                self.spend_tokens()
            self.buy(name, cost, "デスクトップ")
        self.open_posts()
        self.log.append((self.t, "デスクトップ", f"v1.0 の条件がそろう（要望 {int(self.mails)} 件）"))
        self.rate_out = self.passive_rate()

    def sales(self):
        r = self.c["release"]
        elements = len(self.owned) + self.icons_done
        return int(r["base"] * (self.total_px / 1e4) ** r["exp"] * (1 + r["per_element"] * elements))


def show(run):
    print(f"\n=== {run.label} ===")
    for t, w, n in run.log:
        print(f"{fmt_t(t):>10}  {w:<6} {n}")
    print(f"所要 {fmt_t(run.t)} / 累計ピクセル {run.total_px:,.0f} / 自動カーソル {run.cursors} 台"
          f" / アイコン {run.icons_done} / トークン残 {run.tokens:.0f} / 拡張 {len(run.tree)}")
    if run.posts:
        print("持ち場:", {k: f"{v[0]}台・更新{v[1]}" for k, v in run.posts.items()})
    print(f"リリースの売上 ${run.sales():,}")


def main():
    spec = {"color": "16色", "hz": 30, "memory": "4GB", "res_cells": 1, "res_tokens": 1}
    r0 = Run(CONFIG, dict(spec), 0, [], "v0.1")
    r0.world1()
    r0.world2(stop_at_gate=True)
    # v0.1 の条件（アイコン2つ）をそろえる
    while r0.icons_done < 2:
        r0.draw(1)
    r0.log.append((r0.t, "リリース", "試作版 v0.1"))
    r0.t += 5 * 60  # 出荷の画面と性能の購入
    show(r0)
    dollars = r0.sales()

    spec["color"] = "256色"
    dollars -= 200  # 256色
    r1 = Run(CONFIG, dict(spec), r0.tokens, r0.tree, "v1")
    r1.world1()
    r1.world2(stop_at_gate=False)
    r1.world3()
    show(r1)
    print(f"\nチュートリアル（v0.1 リリース後に素の画面を作り直して組木に入るまで）: "
          f"{fmt_t(r0.t + [t for t, w, n in r1.log if n == '組木を作る'][0])}")
    print(f"デスクトップの毎秒: 入口 {r1.rate_in:,.0f} → 出口 {r1.rate_out:,.0f}（{r1.rate_out / r1.rate_in:,.0f}倍）/ v1 の累計ピクセル {r1.total_px:,.0f}")
    print(f"v1 の合計: {fmt_t(r1.t)} / 手元のドル（256色を買った残り）${dollars} + v1.0 の売上 ${r1.sales():,}")


if __name__ == "__main__":
    main()
