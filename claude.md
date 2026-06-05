# 作業メモ

## 2026-06-05

- README.md を UTF-8 として確認した。
- 仕様の中心は「GitHub Pages 上の静的 3D モデル配布サイト」。
- MVP の必須範囲は Astro、Markdown + Front Matter、一覧/詳細ページ、cover/photos 表示、source から zip 生成、draft/public/hidden 制御、validate とレポート、GitHub Actions Pages deploy。
- `status` 未指定は `draft` 扱い。`draft` は一覧にも詳細にも出さず、zip 生成もしない。
- URL は README の例に合わせ、サイト base を `/models` にする。リポジトリ名と Pages の公開パスが異なる場合は `PUBLIC_BASE_PATH` で調整できるようにする。
- 生成物は Git 管理しない方針。`src/data/models.generated.json` と `public/{slug}/...` はビルド時に再生成する。
- raw HTML は Markdown レンダリング前に拒否し、描画側でも HTML をエスケープする方針。
- まず Phase 1 MVP を実装し、Phase 2 の `_inbox` 系は安全な dry-run/apply の入口を入れる。
- zip 生成後に manifest 生成で `public/` を丸ごと掃除すると downloads が消えるため、assets コピーでは `downloads/` を残すようにした。
- `npm.cmd run build` 済み。空モデル状態で validate、zip 生成、manifest 生成、Astro build が成功した。
- 現在の生成ページは `/models/` 相当のトップ/一覧と `/models/terms/`。public モデルが増えると `/models/{slug}/` も静的生成される。
- Actions ログ確認。失敗していたのは独自 `deploy.yml` ではなく、GitHub Pages の標準 Jekyll build。
- Jekyll が `src/pages/terms.astro` を Front Matter として読んで `Invalid YAML front matter` で失敗していた。
- 原因は Pages 設定が `Deploy from branch` 側になっている可能性が高い。自動走査/zip生成を使うには Pages source を `GitHub Actions` にする必要がある。
- workflow に `actions/configure-pages@v5` を追加して、Actions デプロイ構成を明示した。
