"""REFRESH 最後のフェーズ（v5 / 世界7）までの大まかな見通し

tools/economy_sim.py は世界1〜3（v0.1・v1）を細かく計算する。
世界4〜7の中身はまだ決まっていないので、ここでは
「どの世界も、入ったときの毎秒を基準にした同じ形の値段の並び（世界3と同じ形）」
と仮定して、売上・スペックの値段・数の大きさ・時間の見通しを出す。
数値はすべて仮。世界4〜7の中身を決めたら、世界ごとの計算に置き換える。

使い方: python3 tools/economy_macro.py
"""

import math

# 世界3（v1）の計算結果から取った形（tools/economy_sim.py の出力）
W3 = {
    "rate_in": 544,          # デスクトップに入ったときの毎秒
    "growth": 1316,          # 出るまでに毎秒が何倍になったか
    "hours": 6.0,            # 新しい世界にかかった時間
    "total_px": 8.35e9,      # v1 の累計ピクセル
    "sales": 25_996,         # v1.0 の売上
}

# 版ごとの計画（企画メモ：合計約50時間）
PLAN = [
    # 版, 新しい世界, 作り直しの時間, 新しい世界の時間, 作ったものの数（売上の完成度）
    ("v2", "4 配信スタジオ", 1.5, 7.5, 100),
    ("v3", "5 ウェブ", 2.0, 8.0, 125),
    ("v4", "6 映像スタジオ", 2.0, 9.0, 150),
    ("v5", "7 ゲームスタジオ", 2.5, 10.5, 175),
]
SPEC_GAIN = 3.0      # リリースで性能を買うと、作り直した後の毎秒がおよそ何倍になるか（仮）
WORLD_GROWTH = 1000  # 新しい世界1つで毎秒が何倍になるか（世界3の約1,300倍より少し控えめ）
TAU = 0.5            # 累計ピクセル ≒ 出口の毎秒 × 新しい世界の秒数 × TAU（世界3では約0.53）
RELEASE = {"base": 25, "exp": 0.4, "per_element": 0.05}


def sales(total_px, elements):
    return RELEASE["base"] * (total_px / 1e4) ** RELEASE["exp"] * (1 + RELEASE["per_element"] * elements)


def fmt(x):
    units = [(1e24, "𥝱"), (1e20, "垓"), (1e16, "京"), (1e12, "兆"), (1e8, "億"), (1e4, "万")]
    for v, u in units:
        if x >= v:
            return f"{x / v:,.1f}{u}"
    return f"{x:,.0f}"


def main():
    rate_out = W3["rate_in"] * W3["growth"]
    rows = [("v0.1", "1〜2", 0.9, "―", "約300", "―"),
            ("v1", "3 デスクトップ", 6.7, fmt(rate_out), f"{W3['sales']:,}", fmt(W3["total_px"]))]
    total_h = 0.9 + 6.7
    for ver, world, rebuild, new_h, elements in PLAN:
        rate_in = rate_out * SPEC_GAIN
        rate_out = rate_in * WORLD_GROWTH
        total_px = rate_out * new_h * 3600 * TAU
        s = sales(total_px, elements)
        total_h += rebuild + new_h
        rows.append((ver, world, rebuild + new_h, fmt(rate_out), f"{s:,.0f}", fmt(total_px)))
    print(f"{'版':<5}{'新しい世界':<12}{'時間':>6}  {'出口の毎秒':>10}  {'売上（ドル）':>16}  {'累計ピクセル':>10}")
    for r in rows:
        print(f"{r[0]:<5}{r[1]:<12}{r[2]:>5}h  {r[3]:>10}  {r[4]:>16}  {r[5]:>10}")
    print(f"合計 約{total_h:.0f}時間")


if __name__ == "__main__":
    main()
