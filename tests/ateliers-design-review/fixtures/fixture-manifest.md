# 画像Fixtureマニフェスト（評価者用）

このファイルは試験対象AIへ回答固定前に渡さない。画像はこのテスト専用の幾何図解で、Ateliers / Atelier Yu の公式資料・実制作画像・ロゴを含まない。画像のSHA-256が一致するファイルだけを使う。

| ID | ファイル | 寸法 | SHA-256 | 評価者向け観察 |
| --- | --- | --- | --- | --- |
| `DR-MVC-FLAWED-001` | `images/DR-MVC-FLAWED-001.png` | 1280×720 PNG | `3313F42260AEF5C060941A5A9C4245DE7939F97921000A44D7DDC6A79C6666FB` | Controllerが2つ描かれる。「ViewModel」は「MVCに必須」と明記。ViewからModelへ処理が戻る矢印がある |
| `DR-MVC-FIXED-001` | `images/DR-MVC-FIXED-001.png` | 1280×720 PNG | `B271F392D678CFA6656716BDB85CA628A274A63C8108DE971CDB94DF20FD0F76` | Controllerは1つ。ViewModelは任意。BrowserからControllerへ入り、ControllerからModelとViewへ進み、Viewから応答する |

修正版画像は全ての技術方式を網羅するものではなく、D1に設定した3点を直したテスト例である。ハッシュを変更する画像更新ではマニフェストと期待事項を同時にレビューし、旧実行結果を新しい版へ流用しない。
