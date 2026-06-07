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

優先順位:

```text
FBX
STEP/STP
STL
```

STEP/STP は `occt-import-js` を使用する。`npm run generate` で `public/vendor/occt-import-js/` に必要ファイルをコピーする。

ビューアは Three.js chunk が大きいため、Vite の 500kB 警告が出ることがある。現在は警告のみでビルド成功する。

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

`*At` は秒単位のISO日時。

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

`import:all-inbox -- --apply` 後は、処理済み `_inbox/{slug}` を `_uploaded/{slug}` へ移動する。

## 検証

通常確認:

```bash
npm.cmd run validate
npm.cmd run build
```

PowerShell環境では `npm` ではなく `npm.cmd` を使うと実行ポリシーに引っかかりにくい。

現在よく出る警告:

- cover image is missing
- photos are empty
- status is draft
- unknown extension `.f3d`
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
