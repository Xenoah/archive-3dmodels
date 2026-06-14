# archive-3dmodels

Xenoah が制作・配布する 3D モデルの静的アーカイブです。

公開URL:

```text
https://xenoah.github.io/archive-3dmodels/
```

Astro で静的HTMLを生成し、GitHub Pages に公開します。サーバー処理はありません。

## 現在の主な機能

- 日本語/英語の表示切り替え。初期表示は日本語。
- モデル一覧、検索、カテゴリ/タグ/ライセンス絞り込み、並び替え。
- モデル詳細ページ、3Dプレビュー、写真、ソース一覧、関連モデル表示。
- FBX、STEP/STP、STL のブラウザ内3Dプレビュー。
- ダウンロード前の注意事項と免責文を日本語/英語で表示。
- ZIPダウンロード生成。
- ライセンス条件、作者 Xenoah、利用ライブラリ表記。
- GA4 トラッキング。
- SEO用の canonical、OGP/Twitter Card、JSON-LD、sitemap.xml、robots.txt。
- Google Search Console の HTML タグ所有権確認。
- RSS、alias redirect。
- `_inbox` からのモデル取り込みと `_uploaded` への退避。

## 技術構成

| 項目 | 内容 |
| --- | --- |
| Static site | Astro |
| 3D preview | three.js |
| STEP/STP import | occt-import-js |
| Content | Markdown + Front Matter |
| Hosting | GitHub Pages |
| Analytics | Google tag / GA4 |

## ディレクトリ

```text
content/models/{slug}/
  {slug}.md
  cover.jpg または cover.png
  model.glb または preview.glb
  photos/
  source/

_inbox/
  {slug}/

_uploaded/
  {slug}/

src/
  components/
  data/models.generated.json
  layouts/
  pages/

public/
  {slug}/
  vendor/occt-import-js/

scripts/
  import-inbox.mjs
  import-all-inbox.mjs
  normalize-model.mjs
  generate-zip.mjs
  generate-manifest.mjs
  validate-models.mjs
```

## モデル構成

1モデルは1フォルダです。

```text
content/models/{slug}/{slug}.md
```

`slug` は URL、フォルダ名、Markdown名、ZIP名の基準になります。

使える文字:

```text
A-Z
a-z
0-9
-
_
```

## Front Matter

`status: public` のモデルでは、以下が必須です。

```yaml
title: "Model Name"
category: "other"
tags: []
license: "CC BY 4.0"
status: "public"
unit: "mm"
```

よく使う項目:

```yaml
summary: ""
version: "0.1.0"
author: "Xenoah"
created: "2026年06月"
createdAt: "2026-06-07"
uploaded: "2026年06月"
uploadedAt: "2026-06-07"
updated: "2026年06月"
updatedAt: "2026-06-07"
scale: ""
commercial_use: false
redistribution: false
modification: true
credit_required: true
aliases: []
```

`created` / `uploaded` / `updated` は表示用の年月です。
`createdAt` / `uploadedAt` / `updatedAt` は内部管理用の日付です。秒単位の管理はしません。

`created` が未指定の場合、生成処理は主な3Dモデルファイルから日時を推定します。移動後の `source/` だけでなく、同名の `_uploaded/{slug}/` があればそちらも参照します。ただし Git に push された後のファイル作成日時は元のOS作成日時を保持しないため、正確に残したい場合は Front Matter に明示してください。

`summary` は本文説明の冒頭から自動生成されます。カード上では長くなりすぎないように末尾をフェードアウトします。

未知の Front Matter キーはエラーにせず、生成JSONの `extra` に保持します。

## status

| status | 一覧 | 詳細ページ | sitemap | robots | ZIP |
| --- | --- | --- | --- | --- | --- |
| public | 表示 | 生成 | 含める | index, follow | 生成 |
| draft | 表示、DRAFTバッジ付き | 生成 | 含めない | noindex, follow | 生成しない |
| hidden | 非表示 | 生成 | 含めない | noindex, follow | 生成 |

`private` は無効です。非公開にしたい場合は `draft`、限定URLとして残したい場合は `hidden` を使います。

## ZIP生成

詳細ページのソース一覧から各ファイルを個別にダウンロードできます。保存名は `{slug}_{部品名}.{ext}` 形式です。

ZIPは `npm run generate` または `npm run build` で生成されます。

ZIPに含めるもの:

```text
{slug}/readme.txt
{slug}/FBX/*.fbx
{slug}/STL/*.stl
{slug}/STEP/*.step
{slug}/STEP/*.stp
{slug}/3MF/*.3mf
{slug}/OBJ/*.obj
```

ZIPに含めないもの:

```text
LICENSE.txt
README.md
images/
cover画像
photos画像
.txt .md .pdf などの補足資料
```

生成時に古いZIPは削除され、現在のモデル一覧に存在しない `public/{slug}` の古い公開フォルダも掃除されます。

## 3Dプレビュー

詳細ページと、カバー画像が無い一覧カードでは3Dプレビューを表示します。

優先順位:

```text
FBX
STEP/STP
STL
```

STEP/STP 表示には `occt-import-js` を使います。`npm run generate` 時に `node_modules/occt-import-js/dist` から `public/vendor/occt-import-js/` へ JS/WASM をコピーします。

## `_inbox` 取り込み

`_inbox/{slug}/` にファイルを置き、dry-run で確認してから apply します。

```bash
npm run import:inbox {slug}
npm run import:inbox {slug} -- --apply
```

全 `_inbox` をまとめて処理:

```bash
npm run import:all-inbox
npm run import:all-inbox -- --apply
```

GitHub Actions の `Import Inbox` は `_inbox/**` への push で起動し、取り込み後に `npm run capture:covers -- --fallback-only` を実行します。画像がないSTLモデルには `auto-cover.png` が生成され、取り込みコミットに含まれます。

既存モデルへ追加する場合:

```bash
npm run import:inbox {slug} -- --merge
npm run import:inbox {slug} -- --merge --apply
```

`import:all-inbox -- --apply` は `_inbox/{slug}` を削除・移動しません。push後に pull/sync で戻ってきた `_inbox/{slug}` は、`npm run sync:uploaded -- --apply` で作成日をMarkdownへ反映してからローカルの `_uploaded/{slug}` へ移動します。

`_inbox` 直下に単体3Dファイルを置いた場合は、自動でフォルダ化してから取り込みます。対象は `.fbx`、`.step`、`.stp`、`.stl`、`.3mf`、`.obj`、`.glb` です。画像や説明文など、単体3Dファイルではない直下ファイルはエラーです。

## 取り込み時の初期値

新規取り込みの既定値:

```yaml
license: "CC BY 4.0"
status: "public"
unit: "mm"
commercial_use: false
redistribution: false
modification: true
credit_required: true
```

説明文の本文は自動プロンプトを入れず、空欄から始めます。

## 検証と生成

```bash
npm run validate
npm run capture:covers
npm run generate
npm run build
```

ローカルでカバーだけ生成する場合:

```bash
npm run capture:covers
```

Chrome/Edge のヘッドレス撮影が動かない環境では、ブラウザを使わない簡易STLレンダーで生成します。

```bash
npm run capture:covers -- --fallback-only
```

既存の `auto-cover.png` を作り直す場合:

```bash
npm run capture:covers -- --force
```

Windows PowerShell で `npm.ps1` の実行ポリシーに止められる場合は `npm.cmd` を使います。

```powershell
npm.cmd run capture:covers -- --fallback-only
npm.cmd run generate
```

`npm run build` は以下を実行します。

```text
validate
generate zip
generate manifest
astro build
```

## SEOとSearch Console

実装済み:

- canonical
- meta description
- robots meta
- OGP / Twitter Card
- JSON-LD
  - WebSite
  - CollectionPage
  - CreativeWork
  - BreadcrumbList
  - WebPage
- sitemap.xml
- robots.txt
- RSS
- Google Search Console HTML tag verification

Search Console のプロパティ:

```text
https://xenoah.github.io/archive-3dmodels/
```

送信する sitemap:

```text
https://xenoah.github.io/archive-3dmodels/sitemap.xml
```

確認タグは `src/layouts/BaseLayout.astro` に入っています。所有権確認状態を維持するため削除しないでください。

## ライセンス表記

規約ページに主な利用ライブラリを表示します。

```text
Astro: MIT License
three.js: MIT License
occt-import-js: LGPL-2.1
Google tag / Google Analytics: Google の規約・ポリシーに従う
```

## 注意事項

ダウンロード前に、詳細ページのスクロール可能な注意事項欄で日本語/英語の免責文を表示します。

作者は Xenoah です。各モデルおよび同梱ファイルは現状有姿で提供され、利用によって生じた損害、事故、不具合、トラブルについて作者 Xenoah は責任を負いません。

## 現在の既知の警告

`npm run build` 時に以下のような警告が出ることがありますが、エラーではありません。

- cover/photos が無いモデルの警告。
- draft モデルの警告。
- Three.js/ビューア chunk が Vite の 500kB 警告しきい値を超える警告。
## 現在の追加仕様メモ

- 追加ファイルはブラックリスト方式。`FORBIDDEN_EXTENSIONS` と `FORBIDDEN_FILENAMES` に該当しない `source/` 配下のファイルはソース一覧と個別DLに反映される。
- 一覧ページは3DプレビューがデフォルトON。上部メニューの `3D ON/OFF` で切り替える。cover/thumbnail/photos がある場合は画像を優先し、画像がない場合は3Dプレビューを表示する。
- `npm run capture:covers` で、画像がないSTLモデルから `auto-cover.png` を自動生成できる。既に `auto-cover.png` がある場合はスキップし、再生成したい場合は `npm run capture:covers -- --force` を使う。Chrome/Edge が使えない環境では `npm run capture:covers -- --fallback-only` でブラウザなしの簡易STLレンダーを使う。後から cover/thumbnail/photos を追加した場合は手動画像が優先される。
- `_inbox/**` push 時の `Import Inbox` Action は、取り込み後に `npm run capture:covers -- --fallback-only` を実行して `auto-cover.png` も一緒にコミットする。
- 詳細ページの3Dプレビューは `assets.viewers` にある対応ファイルだけを表示する。対応形式は FBX、STEP/STP、STL。
