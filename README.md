# archive-3dmodels

# GitHub Pages 3Dモデル配布サイト 仕様書 v0.3

## 1. 概要

GitHub Pages上に、3Dモデルを配布する静的サイトを構築する。

ユーザーは `_inbox/{slug}/` に画像やSTLなどのファイルを入れるだけで、公開モデルページを生成できる。
必要に応じてMarkdownファイルのパラメーターを編集し、非公開にしたい場合は `status: draft` に変更する。

サイトは静的サイトとして生成する。
GitHub Pages上でサーバー処理は行わない。

## 2. 基本思想

本システムの思想は以下。

```text
人間は雑に投入する
機械が整理する
原本は勝手に壊さない
公開は明示操作にする
```

特に以下を重視する。

* テンプレートコピー作業を減らす
* ファイル名の手作業整理を減らす
* フォルダ名とMarkdown名を一致させる
* Markdownのパラメーターからカテゴリ・タグ・ライセンス等を動作させる
* 後からパラメーターが増えても破綻しない
* `_inbox` に雑投入しても正式構成へ変換できる
* 配布ファイルは非圧縮で管理し、ダウンロード時はzipとして提供する
* 既存ファイルは自動処理で勝手に上書きしない
* セキュリティ上危険なファイルやMarkdownは拒否または無害化する

## 3. リポジトリ構成

ホームページ本体とは分離する。

```text
xenoah.github.io/      本体HP・ポートフォリオ
models/                3Dモデル配布サイト
```

公開URL例。

```text
https://xenoah.github.io/
https://xenoah.github.io/models/
```

3Dモデル配布サイトは、GitHub Pagesのプロジェクトサイトとして運用する。

## 4. 推奨技術構成

```text
Astro
Node.js
GitHub Actions
GitHub Pages
model-viewer
Markdown + Front Matter
```

役割。

| 要素              | 役割                                   |
| --------------- | ------------------------------------ |
| Astro           | 静的サイト生成                              |
| Node.js scripts | import, normalize, manifest生成, zip生成 |
| GitHub Actions  | 検証、ビルド、デプロイ                          |
| GitHub Pages    | 静的公開                                 |
| model-viewer    | GLBプレビュー                             |
| Markdown        | モデル説明文                               |
| Front Matter    | メタデータ管理                              |

## 5. ディレクトリ構成

```text
/
├─ _inbox/
│  └─ {slug}/
│     ├─ *.jpg
│     ├─ *.png
│     ├─ *.stl
│     ├─ *.step
│     └─ *.md
│
├─ content/
│  └─ models/
│     └─ {slug}/
│        ├─ {slug}.md
│        ├─ cover.jpg
│        ├─ model.glb
│        ├─ photos/
│        │  ├─ photo-001.jpg
│        │  └─ photo-002.jpg
│        └─ source/
│           ├─ *.stl
│           ├─ *.step
│           ├─ *.3mf
│           └─ *.txt
│
├─ templates/
│  ├─ model.md
│  ├─ readme-for-zip.md
│  └─ license/
│
├─ scripts/
│  ├─ new-model.mjs
│  ├─ import-inbox.mjs
│  ├─ import-loose.mjs
│  ├─ normalize-model.mjs
│  ├─ generate-manifest.mjs
│  ├─ generate-zip.mjs
│  └─ validate-models.mjs
│
├─ src/
│  ├─ pages/
│  ├─ components/
│  └─ data/
│
├─ public/
├─ reports/
├─ package.json
└─ .github/
   └─ workflows/
      └─ deploy.yml
```

## 6. モデル管理単位

1モデル = 1フォルダ。

正式フォルダは以下。

```text
content/models/{slug}/
```

Markdown名はフォルダ名と一致させる。

```text
content/models/{slug}/{slug}.md
```

例。

```text
content/models/usb-a-cat/usb-a-cat.md
```

この場合。

```text
slug: usb-a-cat
URL: /models/usb-a-cat/
zip: usb-a-cat-v0.1.0-{hash}.zip
```

## 7. slug命名規則

slugはURL、Markdown名、zip名、内部IDに使う。

使用可能文字。

```text
a-z
A-Z
0-9
-
_
```

推奨は小文字英数字とハイフン。

良い例。

```text
usb-a-cat
m5stack-bracket
vrchat-accessory-stand
```

悪い例。

```text
USB A Cat
日本語名
model#001
名称 未設定
```

命名規則違反はERRORとする。

## 8. `_inbox` 仕様

### 8.1 目的

`_inbox` は、簡単アップロード用の一時投入フォルダである。

人間はここに雑にファイルを入れる。

```text
_inbox/{slug}/
```

最小構成。

```text
_inbox/usb-a-cat/
├─ body.stl
└─ IMG_001.jpg
```

これだけでpublicモデルを生成可能とする。

### 8.2 `_inbox` に入れられるもの

許可する拡張子。

```text
画像:
  .jpg .jpeg .png .webp

3Dプレビュー:
  .glb

配布元3D:
  .stl .step .stp .3mf .obj

補足資料:
  .txt .md .pdf
```

原則禁止。

```text
.html .htm
.js .mjs
.svg
.exe .bat .cmd .ps1 .sh
.php .asp
.zip .7z .rar
```

### 8.3 `_inbox` 直下に3Dファイルがある場合

単体3Dファイルは自動でフォルダ化する。

```text
_inbox/
└─ body.stl
```

import時に以下へ移動してから通常の変換を行う。

```text
_inbox/body/
└─ body.stl
```

対象拡張子。

```text
.fbx .step .stp .stl .3mf .obj .glb
```

同名slugが既に存在する場合は `body-2` のように連番を付ける。

画像や説明ファイルなど、単体3Dファイルではない直下ファイルはERROR。

```text
_inbox/
└─ IMG_001.jpg
```

複数ファイルを1つのモデルとして扱いたい場合は、従来どおり `_inbox/{slug}/` を作ってその中に入れる。

### 8.4 `_inbox` と既存slugが衝突した場合

以下の場合は標準でERROR。

```text
content/models/usb-a-cat/   既に存在
_inbox/usb-a-cat/           新規投入
```

表示。

```text
[ERROR] usb-a-cat: model already exists.

To merge:
npm run import:inbox usb-a-cat -- --merge --apply
```

`--merge` 指定時のみ既存モデルへ追加する。

## 9. `new:model` 仕様

空のモデルフォルダを作るコマンド。

```bash
npm run new:model usb-a-cat
```

生成内容。

```text
content/models/usb-a-cat/
├─ usb-a-cat.md
├─ photos/
└─ source/
```

初期Markdown。

```md
---
title: "USB A Cat"
category: "other"
tags: []
license: "CC BY 4.0"
version: "0.1.0"
status: "public"
unit: "mm"
created: "2026年06月"
uploaded: "2026年06月"
---

概要を書く。
```

## 10. `import:inbox` 仕様

`_inbox/{slug}/` の内容を正式モデルフォルダへ変換する。

コマンド。

```bash
npm run import:inbox usb-a-cat
npm run import:inbox usb-a-cat -- --apply
```

標準はdry-run。
`--apply` 指定時のみ実際に変更する。

### 10.1 変換例

入力。

```text
_inbox/usb-a-cat/
├─ IMG_001.jpg
├─ IMG_002.jpg
├─ body.stl
└─ memo.md
```

出力。

```text
content/models/usb-a-cat/
├─ usb-a-cat.md
├─ cover.jpg
├─ photos/
│  ├─ photo-001.jpg
│  └─ photo-002.jpg
└─ source/
   └─ body.stl
```

### 10.2 mdがある場合

`_inbox/{slug}/` に `.md` がある場合、本文として取り込む。

Front Matterがある場合は、必要項目を補完する。
不足している場合は初期値を追加する。

### 10.3 mdがない場合

テンプレートから `{slug}.md` を生成する。

初期状態は必ず以下。

```yaml
status: "draft"
```

いきなり公開しない。

## 11. `normalize:model` 仕様

既存モデルフォルダ内のファイル名や配置を整理する。

コマンド。

```bash
npm run normalize:model usb-a-cat
npm run normalize:model usb-a-cat -- --apply
```

標準はdry-run。

### 11.1 画像命名

写真は以下に統一。

```text
photos/photo-001.jpg
photos/photo-002.jpg
photos/photo-003.png
```

coverは以下に統一。

```text
cover.jpg
```

GLBプレビューは以下に統一。

```text
model.glb
```

### 11.2 source内ファイル

`source/` 内の配布元ファイルは、原則として元ファイル名を保持する。

理由。

* 元データ名の意味を残せる
* 不必要な差分を減らせる
* 既存データを壊しにくい

ただし、zip生成時にはslug基準で配布用ファイル名へ整理する。

### 11.3 md内参照の更新

画像やファイル名を変更した場合、Markdown本文内の参照も更新する。

例。

```md
![写真](IMG_001.jpg)
```

変更後。

```md
![写真](./photos/photo-001.jpg)
```

ただし、mdの本文を勝手に大きく書き換えない。

## 12. Markdown仕様

各モデルは `{slug}.md` で説明する。

例。

```md
---
title: "USB-A Cat"
summary: "USB-Aコネクタ頭の猫モデル"
category: "character"
tags:
  - cat
  - usb
  - 3d-print
license: "CC BY 4.0"
version: "0.1.0"
status: "public"
unit: "mm"
created: "2026年06月"
uploaded: "2026年06月"
commercial_use: false
redistribution: false
modification: true
credit_required: true
---

USB-Aの頭をした猫モデルです。

## 概要

3Dプリントして展示小物として使うモデルです。

## 注意事項

商用利用は禁止です。
```

## 13. Front Matter仕様

### 13.1 必須項目

`status: public` にする場合、以下を必須とする。

| 項目       |      型 | 内容    |
| -------- | -----: | ----- |
| title    | string | 表示名   |
| category | string | カテゴリ  |
| tags     |  array | タグ    |
| license  | string | ライセンス |
| status   | string | 公開状態  |
| unit     | string | モデル単位 |

### 13.2 推奨項目

| 項目           |       型 | 内容     |
| ------------ | ------: | ------ |
| summary      |  string | 一覧用説明  |
| version      |  string | バージョン  |
| author       |  string | 作者     |
| created      |  string | 作成日    |
| uploaded     |  string | アップロード日 |
| updated      |  string | 更新日    |
| scale        |  string | スケール   |
| material     |  string | 推奨材料   |
| printer      |  string | 使用プリンタ |
| nozzle       |  string | ノズル径   |
| layer_height |  string | 積層ピッチ  |
| support      | boolean | サポート要否 |
| difficulty   |  string | 難易度    |
| aliases      |   array | 旧slug  |

### 13.3 拡張項目

未知のパラメーターはエラーにしない。
`extra` として保持する。

例。

```yaml
vrchat_supported: true
magnet_size: "6x3mm"
screw: "M3"
```

生成JSONでは以下のように保持する。

```json
{
  "extra": {
    "vrchat_supported": true,
    "magnet_size": "6x3mm",
    "screw": "M3"
  }
}
```

## 14. status仕様

| status |  一覧 | 個別ページ | zip生成 | 用途   |
| ------ | --: | ----: | ----: | ---- |
| draft  | 非表示 |   非表示 |   しない | 下書き  |
| public |  表示 |    表示 |    する | 公開   |
| hidden | 非表示 |    表示 |    する | 限定公開 |

`_inbox` から生成されたモデルは標準で `public` とする。

`license` 未指定の場合は `CC BY 4.0` とする。

`created` と `uploaded` は `YYYY年MM月` 形式とする。

`created` 未指定の場合は、3Dモデルファイルの作成日から取得する。

## 15. カテゴリ仕様

カテゴリは1モデルにつき1つ。

初期カテゴリ。

```text
character
tool
jig
vrchat
gadget
fixture
accessory
other
```

カテゴリは棚、タグは付箋として扱う。

## 16. タグ仕様

タグは複数指定可能。

例。

```yaml
tags:
  - cat
  - usb
  - 3d-print
```

タグは検索、絞り込み、関連モデル表示に使用する。

## 17. ライセンス仕様

各モデルにはライセンスを必須とする。

初期候補。

```text
Original
CC0
CC BY 4.0
CC BY-SA 4.0
CC BY-NC 4.0
CC BY-NC-SA 4.0
MIT
Contact required
```

追加で以下を持てる。

```yaml
commercial_use: false
redistribution: false
modification: true
credit_required: true
```

zipには `LICENSE.txt` を自動同梱する。

## 18. 単位・スケール仕様

STLは単位情報を持たないため、`unit` を必須とする。

推奨。

```yaml
unit: "mm"
scale: "1:1"
```

モデル詳細ページにも表示する。

```text
単位: mm
スケール: 1:1
```

## 19. アセット自動検出仕様

### 19.1 cover

優先順位。

```text
1. cover.jpg
2. cover.png
3. thumbnail.jpg
4. thumbnail.png
5. photos/photo-001.*
6. no-image
```

### 19.2 preview

優先順位。

```text
1. FBX
2. STEP / STP
3. STL
4. なし
```

cover/thumbnailがない場合は、一覧のサムネイルにも3Dプレビューを表示する。
3DプレビューはFBX、STEP/STP、STLの順で選択する。

### 19.3 photos

対象。

```text
photos/*.jpg
photos/*.jpeg
photos/*.png
photos/*.webp
```

ファイル名順に表示する。

### 19.4 source

対象。

```text
source/*.stl
source/*.step
source/*.stp
source/*.3mf
source/*.obj
source/*.txt
source/*.pdf
```

sourceにファイルがある場合、zip生成対象とする。

## 20. zip生成仕様

リポジトリには非圧縮ファイルを保存する。

```text
source/
├─ body.stl
├─ base.step
└─ print-settings.txt
```

GitHub Actionsのビルド時にzipを生成する。

zip名。

```text
{slug}-v{version}-{contentHash}.zip
```

例。

```text
usb-a-cat-v0.1.0-a91f3bc.zip
```

`version` がない場合。

```text
{slug}-{contentHash}.zip
```

### 20.1 zip内構成

```text
usb-a-cat/
├─ README.md
├─ LICENSE.txt
├─ STL/
├─ STEP/
├─ 3MF/
├─ OBJ/
├─ docs/
└─ images/
```

### 20.2 zip内分類

| 拡張子           | zip内フォルダ |
| ------------- | -------- |
| .stl          | STL/     |
| .step .stp    | STEP/    |
| .3mf          | 3MF/     |
| .obj          | OBJ/     |
| .txt .md .pdf | docs/    |
| cover/photos  | images/  |

### 20.3 zip生成の安全条件

zipに含めるのは `source/` 配下の通常ファイルのみ。

以下はERROR。

```text
絶対パス
../ を含むパス
symlink
hardlink
source/外の参照
```

## 21. 既存ファイル変更時の挙動

### 21.1 mdを変更した場合

次回ビルドで以下を更新する。

```text
title
summary
category
tags
license
version
status
本文
extra
```

カテゴリ・タグ・一覧・詳細ページに反映する。

### 21.2 画像を変更した場合

`cover.jpg` を変更した場合、次回ビルドで新しいcoverを表示する。

`photos/` に画像を追加した場合、ギャラリーへ追加する。

削除した場合、ギャラリーから消す。

### 21.3 sourceを変更した場合

`source/` の中身が変わった場合、zipを再生成する。

contentHashが変わるため、zip URLも変わる。

### 21.4 versionを変え忘れた場合

`source/` が変わっているのに `version` が同じ場合、WARNとする。

```text
[WARN] usb-a-cat: source changed but version is unchanged.
```

MVPではWARN。
将来strict modeでERROR化可能。

### 21.5 フォルダ名を変えた場合

フォルダ名変更はslug変更として扱う。

旧URL対策として `aliases` を持てる。

```yaml
aliases:
  - "old-usb-cat"
```

旧URLから新URLへリダイレクトページを生成する。

### 21.6 md名が一致しない場合

ERROR。

```text
content/models/usb-a-cat/neko.md
```

期待値。

```text
content/models/usb-a-cat/usb-a-cat.md
```

## 22. manifest生成仕様

ビルド時に `content/models/` を走査してJSONを生成する。

出力。

```text
src/data/models.generated.json
```

例。

```json
{
  "slug": "usb-a-cat",
  "title": "USB-A Cat",
  "summary": "USB-Aコネクタ頭の猫モデル",
  "category": "character",
  "tags": ["cat", "usb", "3d-print"],
  "license": "Original",
  "version": "0.1.0",
  "status": "public",
  "unit": "mm",
  "assets": {
    "cover": "/models/usb-a-cat/cover.jpg",
    "preview": "/models/usb-a-cat/model.glb",
    "photos": [
      "/models/usb-a-cat/photos/photo-001.jpg"
    ],
    "download": "/models/usb-a-cat/downloads/usb-a-cat-v0.1.0-a91f3bc.zip"
  },
  "extra": {}
}
```

## 23. エラー・警告仕様

エラーは以下に出す。

```text
1. ローカル実行時のターミナル
2. GitHub Actionsログ
3. GitHub Actions Job Summary
4. reports/model-report.md
5. reports/model-report.json
```

### 23.1 ERROR

ビルド停止。

対象。

```text
_inbox直下に単体3Dではないファイルがある
slug命名規則違反
mdがない
フォルダ名とmd名が一致しない
titleがない
categoryがない
tagsが配列ではない
licenseがない
statusが不正
unitがない
参照ファイルが存在しない
同じslugが重複
100MiB以上のファイルがある
禁止拡張子がある
symlinkがある
path traversalがある
```

### 23.2 WARN

ビルド継続。

対象。

```text
coverがない
3Dプレビュー対象がない
photosが空
sourceが空
summaryがない
画像容量が大きい
version未更新
draftのまま
未知の拡張子がある
PDFにメタ情報が含まれる可能性がある
```

### 23.3 INFO

状態表示。

```text
検出モデル数
public件数
draft件数
hidden件数
写真枚数
sourceファイル数
zip生成数
```

## 24. セキュリティ仕様

### 24.1 Markdown

```text
raw HTMLは初期状態で禁止
script / iframe / object / embed / style は禁止
javascript: URLは禁止
data: URLは禁止
Markdownはsanitizeして描画
```

### 24.2 ファイル

```text
拡張子allowlist方式
禁止拡張子はERROR
SVGは_inbox由来では禁止
100MiB以上はERROR
50MiB超はWARN
```

### 24.3 画像

```text
EXIFを削除
coverは横1200px程度に最適化
photosは横1600px程度に最適化
WebP生成はPhase 2以降
```

### 24.4 GitHub Actions

```text
build job: contents read
validate job: contents read
deploy job: contents read, pages write, id-token write
auto-commitはMVPでは使わない
```

### 24.5 依存関係

```text
package-lock.jsonをコミット
npm ciを使用
Dependabot alertsを有効化
Dependency ReviewをPRで実行
Actionはバージョン固定
```

### 24.6 秘密情報

以下を検出したらERRORまたはWARN。

```text
.env
.pem
.key
.p12
credential系json
API keyらしき文字列
tokenらしき文字列
メールアドレス
電話番号
住所
```

### 24.7 公開事故防止

```text
_inbox生成物は標準でpublic
status未指定はpublic
license未指定はCC BY 4.0
created/uploadedはYYYY年MM月
created未指定時は3Dモデルファイルの作成日から取得
publicモデルにはtitle/category/tags/license/unit必須
draftは一覧サムネイル左上にDRAFT表示
```

## 25. サイト画面仕様

### 25.1 トップページ

表示内容。

```text
サイト概要
新着モデル
カテゴリ一覧
タグ一覧
利用条件へのリンク
注意事項
```

### 25.2 モデル一覧ページ

URL。

```text
/models/
```

表示内容。

```text
サムネイル
タイトル
summary
カテゴリ
タグ
ライセンス
更新日
```

機能。

```text
キーワード検索
カテゴリ絞り込み
タグ絞り込み
ライセンス絞り込み
新しい順
名前順
```

MVPではカテゴリ・タグ絞り込みまで。
全文検索はPhase 3。

### 25.3 モデル詳細ページ

URL。

```text
/models/{slug}/
```

表示内容。

```text
タイトル
summary
cover
3Dプレビュー
写真ギャラリー
本文
ダウンロードボタン
ライセンス
商用利用可否
改変可否
再配布可否
単位
バージョン
更新日
タグ
関連モデル
```

### 25.4 3Dプレビュー

FBX、STEP/STP、STLがある場合に表示。

機能。

```text
ドラッグ回転
ホイールズーム
ローディングスピナー
サムネイルhover時のカーソル追従回転
リセット
自動回転
ワイヤーメッシュ
マテリアル切り替え
ライティング切り替え
```

サムネイル画像がない場合は、一覧カードにも3Dプレビューを表示する。

### 25.5 ダウンロード欄

表示内容。

```text
Download ZIP
バージョン
ファイルサイズ
ライセンス
注意事項
```

ダウンロード前にライセンス条件が見えるUIにする。

## 26. 最適化された管理UIフロー

### 26.1 最小アップロードフロー

目的。
とにかく楽に追加する。

```text
1. GitHubまたはローカルで _inbox/{slug}/ を作る
2. 3Dモデルと画像を入れる
3. import:inbox を実行
4. publicモデルが生成される
5. mdを軽く編集
6. 非公開にしたい場合はstatusをdraftへ変更
7. push
8. GitHub Actionsで公開
```

最小入力。

```text
_inbox/usb-a-cat/
├─ body.stl
└─ IMG_001.jpg
```

自動生成。

```text
content/models/usb-a-cat/
├─ usb-a-cat.md
├─ cover.jpg
├─ photos/photo-001.jpg
└─ source/body.stl
```

### 26.2 丁寧作成フロー

```text
1. npm run new:model usb-a-cat
2. usb-a-cat.mdを書く
3. photos/に画像を入れる
4. source/にSTL/STEP等を入れる
5. npm run normalize:model usb-a-cat
6. dry-run確認
7. npm run normalize:model usb-a-cat -- --apply
8. npm run validate
9. statusを確認
10. push
```

### 26.3 既存モデルへの追加フロー

```text
1. _inbox/usb-a-cat/ に追加ファイルを入れる
2. npm run import:inbox usb-a-cat -- --merge
3. dry-run確認
4. npm run import:inbox usb-a-cat -- --merge --apply
5. mdを必要に応じて更新
6. push
```

挙動。

```text
画像は photos/photo-次番号 に追加
sourceファイルは source/ に追加
mdは上書きしない
既存のプレビュー/ソースと衝突する場合は警告
```

### 26.4 GitHub Web UI利用フロー

Phase 2で対応する。

```text
1. GitHub Web UIで _inbox/{slug}/ にファイルアップロード
2. GitHub Actionsが検証
3. import結果をmainへ自動コミット
4. コミット差分を確認
5. 必要に応じてmdを編集
6. publicとしてサイト生成
7. 非公開にしたい場合はstatusをdraftへ変更
```

現在は_inbox取り込み後、処理済みフォルダを`_uploaded/`へ退避する。
単体の3Dデータを_inbox直下へ置いた場合も、自動でモデルフォルダを作成して取り込む。

### 26.5 公開前チェックUI

GitHub Actions Job Summaryに以下を表示する。

```text
公開モデル数
draftモデル数
エラー
警告
各モデルの不足項目
zip生成結果
ファイルサイズ警告
セキュリティ警告
```

管理者はActions画面だけ見れば、公開可否を判断できる。

## 27. 最適化された閲覧者UIフロー

### 27.1 一覧から探す

```text
1. /models/ を開く
2. サムネイルカードを見る
3. カテゴリまたはタグで絞り込む
4. 気になるモデルを開く
```

カードに出す情報。

```text
サムネイル
タイトル
短い説明
カテゴリ
タグ
ライセンス
更新日
```

### 27.2 詳細を見る

```text
1. モデル詳細ページを開く
2. 3Dプレビューまたは写真を見る
3. 用途、注意事項、単位を確認
4. ライセンスを確認
5. Download ZIPを押す
```

詳細ページの上部優先順位。

```text
1. 画像または3Dプレビュー
2. タイトル
3. summary
4. Download ZIP
5. ライセンス
6. 本文
```

ダウンロードボタンは上部と下部の2か所に置く。

### 27.3 ライセンス確認

ダウンロード欄に以下を表示。

```text
商用利用: 可/不可
改変: 可/不可
再配布: 可/不可
クレジット: 必要/不要
```

曖昧な場合は `Original` として本文を読むように表示する。

### 27.4 サムネイルなしモデル

cover/thumbnailがないモデルは3Dプレビューを主表示にする。

```text
3D Preview
FBX > STEP/STP > STL
Pointer hover rotation
```

ただしエラー表示にはしない。

## 28. 実装フェーズ

## Phase 0: 設計・土台

目的。
仕様を固定し、最低限のプロジェクトを作る。

実装内容。

```text
modelsリポジトリ作成
Astro初期化
GitHub Pages設定
基本レイアウト作成
package.json作成
ディレクトリ作成
templates/model.md作成
```

完了条件。

```text
空のサイトがGitHub Pagesで表示される
```

## Phase 1: MVP

目的。
手動またはCLIでモデルを追加し、一覧・詳細・zip配布まで動かす。

実装内容。

```text
content/models/{slug}/{slug}.md 読み込み
Front Matter解析
モデル一覧ページ
モデル詳細ページ
cover表示
photos表示
sourceからzip生成
manifest生成
status draft/public/hidden
GitHub Actionsデプロイ
validate処理
エラー/警告レポート
```

コマンド。

```bash
npm run new:model {slug}
npm run validate
npm run build
```

完了条件。

```text
content/models/usb-a-cat/usb-a-cat.md を追加すると一覧に表示される
source/ からzipが生成される
draftは公開されない
publicは公開される
ERROR時はデプロイ停止する
```

## Phase 2: `_inbox` と正規化

目的。
簡単アップロードを実現する。

実装内容。

```text
_inbox/{slug}/ 読み込み
import:inbox
import:loose
normalize:model
画像リネーム
cover自動生成
photos自動整理
source自動移動
md自動生成
dry-run
--apply
既存slug衝突検出
--merge
```

コマンド。

```bash
npm run import:inbox {slug}
npm run import:inbox {slug} -- --apply
npm run import:loose {slug} -- --apply
npm run normalize:model {slug}
npm run normalize:model {slug} -- --apply
```

完了条件。

```text
_inbox/{slug}/ に3Dモデルと画像を入れてpublicモデルが生成される
_inbox直下の単体3Dファイルは自動フォルダ化される
_inbox直下の画像や説明ファイルはERRORになる
dry-runで変更案が見える
--apply指定時だけファイルが変更される
```

## Phase 3: UI強化

目的。
閲覧性と探しやすさを改善する。

実装内容。

```text
カテゴリ絞り込み
タグ絞り込み
ライセンス絞り込み
並び替え
関連モデル
モデル詳細のメタ情報表示
Download ZIP UI改善
レスポンシブ対応
```

完了条件。

```text
モデル数が増えても探せる
スマホでも閲覧しやすい
ライセンス条件が見やすい
```

## Phase 4: セキュリティ・品質強化

目的。
公開事故と危険ファイルを防ぐ。

実装内容。

```text
Markdown sanitize
raw HTML禁止
拡張子allowlist
symlink拒否
path traversal拒否
EXIF削除
画像リサイズ
100MiB制限
secret検出
Dependabot
Dependency Review
CSP設定
```

完了条件。

```text
危険なMarkdownが実行されない
禁止ファイルが入るとビルド停止する
画像のEXIFが削除される
secretらしき文字列を検出できる
```

## Phase 5: GitHub Web UI対応

目的。
ローカル環境なしでもアップロードしやすくする。

実装内容。

```text
_inboxアップロード検出
GitHub Actionsによるimport dry-run/apply
Job Summary表示
import結果をmainへ自動コミット
処理済み_inboxを_uploadedへ退避
publicとして反映
```

完了条件。

```text
GitHub Web UIだけで_inbox投入できる
Actionsがimport結果をmainへコミットする
処理済みフォルダが_uploadedへ移動する
```

## Phase 6: 検索・共有・拡張

目的。
配布サイトとして育てる。

実装内容。

```text
全文検索
OGP画像生成
RSS
sitemap
aliasesによる旧URLリダイレクト
多言語対応
GitHub Releases連携
大容量ファイル退避
WebP生成
GLB自動変換検討
```

完了条件。

```text
検索できる
SNS共有時に見栄えがよい
旧URLが壊れにくい
大容量ファイルをPages外へ逃がせる
```

## 29. MVPでやらないこと

MVPでは以下をやらない。

```text
Web上からの直接投稿フォーム
ログイン機能
コメント機能
いいね機能
ダウンロード数集計
決済
有料販売
STLからGLB自動変換
GitHub Releases完全連携
自動コミット
```

## 30. 受け入れ条件

MVP完了条件。

```text
GitHub Pagesでサイトが表示される
モデル一覧が表示される
モデル詳細が表示される
Markdown本文が表示される
cover画像が表示される
photosが表示される
sourceからzipが生成される
Download ZIPが動作する
status: draft は非公開
status: public は公開
ERRORがあるとデプロイ停止
WARNはJob Summaryに表示
フォルダ名とmd名不一致はERROR
100MiB以上のファイルはERROR
```

Phase 2完了条件。

```text
_inbox/{slug}/ に3Dモデルと画像を入れてpublic生成できる
画像がphoto-001形式に整理される
coverが自動生成される
sourceへ配布元ファイルが移動される
dry-runとapplyが分かれている
既存モデルは勝手に上書きされない
```

## 31. 最終的な運用イメージ

最も簡単な運用。

```text
1. _inbox/usb-a-cat/ を作る
2. 3Dモデルと画像を入れる
3. import:inbox を実行
4. usb-a-cat.md が自動生成される
5. title/category/tags/license/unitを確認
6. 非公開にしたい場合はstatusをdraftにする
7. push
8. GitHub Actionsが検証
9. zip生成
10. GitHub Pagesへ公開
```

閲覧者側。

```text
1. /models/ を開く
2. カード一覧を見る
3. タグやカテゴリで絞る
4. 詳細ページを見る
5. 3Dプレビューまたは写真を見る
6. ライセンスを確認
7. Download ZIP
```

## 32. 設計原則

```text
slugはフォルダ名を正とする
Markdown名はslugと一致させる
mdのFront Matterを機能の中心にする
未知パラメーターはextraとして保持する
sourceは非圧縮ファイル置き場にする
zipはビルド時に生成する
生成物はGit管理しない
原本はGitHub Actionsで勝手に変更しない
危険操作はdry-runを標準にする
public化は明示操作にする
```
