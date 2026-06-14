# 作業メモ

このリポジトリは `https://xenoah.github.io/archive-3dmodels/` で公開する、Xenoah の3Dモデル配布アーカイブ。

現在の実装に存在しない仕様や、古い `/models/` 前提の仕様は参照しないこと。

## 現行の重要仕様

- Astro の静的サイト。
- `astro.config.mjs` の既定値は `site: "https://xenoah.github.io"`、`base: "/archive-3dmodels"`。
- モデルデータは `content/models/{slug}/{slug}.md`。
- 生成データは `src/data/models.generated.json`。
- 公開用アセットは `public/{slug}/` へ生成される。
- `src/layouts/BaseLayout.astro` が全ページ共通の head、GA4、Search Console確認タグ、言語切替を持つ。
- 日本語/英語切替あり。初期表示は日本語。
- 作者表記は Xenoah。

## 最近の主な作業

### 言語切替

- JP/EN切替を追加。
- デフォルトは日本語。
- `data-lang-ja` / `data-lang-en`、placeholder、aria-labelを切り替える。

### GA4

全ページ共通の head に Google tag を追加済み。

```text
G-PHNBTBWCDK
```

CSP は `googletagmanager.com` と `google-analytics.com` を許可している。

### Google Search Console

HTMLタグ方式で所有権確認済み。

```html
<meta name="google-site-verification" content="aPtYwfsh75Fol8ou1AKrAWZXEAKl97LEWKER4G2wiuQ">
```

このタグは削除しないこと。

Search Console プロパティ:

```text
https://xenoah.github.io/archive-3dmodels/
```

送信する sitemap:

```text
https://xenoah.github.io/archive-3dmodels/sitemap.xml
```

### SEO

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

`sitemap.xml` は `public` モデルだけを含める。

`draft` と `hidden` の詳細ページは生成されるが、`noindex, follow`。

### 3Dビューア

`src/components/ModelViewer.astro` を使う。

一覧ページは3DプレビューがデフォルトON。上部メニューの `3D ON/OFF` で切り替える。cover/thumbnail/photos 由来の画像があればサムネイル表示を優先し、画像がなければ3Dプレビューを表示する。

詳細ページでは `assets.viewers` にある対応ファイルだけをタブ表示する。複数ある場合、最初のビューアだけ自動起動し、非表示のビューアはタブ選択時に起動する。

優先順位:

```text
FBX
STEP/STP
STL
```

STEP/STP は `occt-import-js` を使用する。`npm run generate` で `public/vendor/occt-import-js/` に必要ファイルをコピーする。

ビューアは Three.js chunk が大きいため、Vite の 500kB 警告が出ることがある。現在は警告のみでビルド成功する。

ソース一覧の各ファイルは個別ダウンロードできる。保存名は `{slug}_{部品名}.{ext}` 形式。

追加ファイルはブラックリスト方式。`FORBIDDEN_EXTENSIONS` と `FORBIDDEN_FILENAMES` に該当しない `source/` 配下のファイルは生成データ、公開アセット、個別DLに反映される。

`npm run capture:covers` で画像がないSTLモデルから `auto-cover.png` を自動生成できる。既に `auto-cover.png` がある場合はスキップし、再生成したい場合は `npm run capture:covers -- --force` を使う。Chrome/Edge のヘッドレス撮影が使えない環境では `npm run capture:covers -- --fallback-only` でブラウザなしの簡易STLレンダーを使う。`auto-cover.png` は手動の cover/thumbnail/photos より優先度が低い。

`_inbox/**` push 時の `Import Inbox` GitHub Action は、取り込み後に `npm run capture:covers -- --fallback-only` を実行して `auto-cover.png` も取り込みコミットに含める。

### 日付管理

表示用:

```text
created
uploaded
updated
```

内部用:

```text
createdAt
uploadedAt
updatedAt
```

`*At` は `YYYY-MM-DD` の日付。秒単位の管理はしない。

モデル移動後の作成日推定では、`content/models/{slug}/source/` だけでなく `_uploaded/{slug}/` の同名ファイルも見る。

ただし Git は元のOS作成日時を保持しないため、正確に残したい場合は Front Matter に明示する。

### ZIP生成

`scripts/generate-zip.mjs` がZIPを作る。

ZIPに含める:

```text
readme.txt
3Dモデルファイル
```

ZIPに含めない:

```text
LICENSE.txt
README.md
images/
cover画像
photos画像
.txt .md .pdf などの補足資料
```

古いZIPは生成時に削除される。

現在のモデル一覧に存在しない `public/{slug}` の古い公開フォルダも、生成時に掃除する。

### 注意事項と免責

詳細ページのダウンロード欄に、スクロール可能な注意事項ボックスを表示する。

- 日本語文
- 英語文
- 作者 Xenoah の免責

ダウンロードボタンは注意事項欄の後に置く。

### ライセンス表記

`src/pages/terms.astro` に利用ライブラリ表記を追加済み。

```text
Astro: MIT License
three.js: MIT License
occt-import-js: LGPL-2.1
Google tag / Google Analytics
```

## status

| status | 一覧 | 詳細 | sitemap | robots | ZIP |
| --- | --- | --- | --- | --- | --- |
| public | 表示 | 生成 | 含める | index, follow | 生成 |
| draft | 表示、DRAFTバッジ付き | 生成 | 含めない | noindex, follow | 生成しない |
| hidden | 非表示 | 生成 | 含めない | noindex, follow | 生成 |

`private` は無効。`status is invalid` の原因になる。

## `_inbox` import

主なコマンド:

```bash
npm run import:inbox {slug}
npm run import:inbox {slug} -- --apply
npm run import:all-inbox
npm run import:all-inbox -- --apply
```

GitHub Actions では `_inbox/**` への push で `Import Inbox` が動き、`import:all-inbox -- --apply` の後に `capture:covers -- --fallback-only` を実行する。画像がないSTLモデルは `auto-cover.png` が生成され、取り込みコミットに含まれる。

既存モデルへ追加:

```bash
npm run import:inbox {slug} -- --merge
npm run import:inbox {slug} -- --merge --apply
```

新規importの既定値:

```yaml
license: "CC BY 4.0"
status: "public"
unit: "mm"
commercial_use: false
redistribution: false
modification: true
credit_required: true
```

説明文にCopilot向けプロンプトは入れない。本文は空欄から始める。

`import:all-inbox -- --apply` は、取り込み成功後に `_inbox/{slug}` を `_uploaded/{slug}` へ移動する。処理完了後は `_inbox` 内に取り込み済みモデルを残さない。失敗したslugだけ原因確認のため `_inbox` に残る。

### 作成日維持

Git はOS作成日時を保持しない。GitHub Actions 上で正確な作成日を反映するには、push 前に `_inbox` のメタデータをコミットする必要がある。

推奨:

```bash
npm.cmd run setup:hooks
```

これで `.githooks/pre-commit` が有効になり、commit 時に `node scripts/stamp-inbox-created.mjs --stage` が走る。`_inbox/{slug}/.archive-upload.json` または `_inbox/.archive-upload.json` が生成・stageされる。import成功後は元ファイルとメタデータごと `_uploaded/{slug}` に退避する。

手動:

```bash
npm.cmd run stamp:inbox
git add _inbox
```

`scripts/lib/date-utils.mjs` は `.archive-upload.json` の `createdAt` を最優先で読む。既存の `createdAt` は通常上書きしない。作り直す場合は `npm.cmd run stamp:inbox -- --force`。

## 検証

通常確認:

```bash
npm.cmd run capture:covers -- --fallback-only
npm.cmd run generate
npm.cmd run validate
npm.cmd run build
```

PowerShell環境では `npm` ではなく `npm.cmd` を使うと実行ポリシーに引っかかりにくい。

ローカルで通常のカバー生成を試す場合は `npm.cmd run capture:covers`。Chrome/Edge がスクリーンショットを書けない場合は `npm.cmd run capture:covers -- --fallback-only`。既存の `auto-cover.png` を作り直す場合は `npm.cmd run capture:covers -- --force`。

現在よく出る警告:

- cover image is missing
- photos are empty
- status is draft
- Vite chunk size warning

これらは現状、ビルド失敗ではない。

## 現在の重要ファイル

```text
src/layouts/BaseLayout.astro
src/pages/index.astro
src/pages/[slug].astro
src/pages/terms.astro
src/pages/sitemap.xml.js
src/pages/robots.txt.js
src/components/ModelViewer.astro
scripts/generate-zip.mjs
scripts/generate-manifest.mjs
scripts/import-inbox.mjs
scripts/import-all-inbox.mjs
scripts/lib/date-utils.mjs
scripts/lib/model-utils.mjs
scripts/lib/constants.mjs
```

## 触るときの注意

- `src/data/models.generated.json` と `public/{slug}/` は生成物。`npm run generate` / `npm run build` で更新される。
- Search Console確認タグは消さない。
- GA4タグは `BaseLayout.astro` にある。
- ZIP仕様を変える場合は、生成後に実際のZIPを開いて中身を確認する。
- SEO変更時は `dist/sitemap.xml`、`dist/robots.txt`、生成HTMLの head を確認する。
- `draft` を検索結果に出さないため、sitemapには含めず、詳細ページは `noindex, follow`。
