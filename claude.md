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
- `content/test/XYZ_30cube.stl` を `content/models/test/source/XYZ_30cube.stl` に移動し、`content/models/test/test.md` を `status: public` で作成。cover/photos/GLB は未設定なので WARN は出るが、一覧・詳細・zip生成確認用としては動く。
- NotFound 対策。GitHub Pages のプロジェクトサイト URL は通常 `/archive-3dmodels/` なので、Astro と workflow の `PUBLIC_BASE_PATH` を `/models` から `/archive-3dmodels` に変更した。
- manifest/asset URL 用の `siteBase()` も `/archive-3dmodels` をデフォルトに変更。これでローカル build でも download URL が `/archive-3dmodels/test/downloads/...` になる。
- サイトUIは静的 HTML/CSS/JS 出力のまま、ヒーロー、サマリーパネル、カード、軽い hover 表現を追加して、重い画像やフレームワークを増やさずリッチ寄りに調整した。
- ユーザーから「UIがテキストベース」「ページは普通にGUIでいい」と指摘あり。STLのみで cover/GLB/photos がないと文字中心に見えるため、CSSだけの3D風プレースホルダー、詳細ページの action strip、カードの視覚表現を追加した。
- ユーザーが `content/models/test/Screenshot 2026-06-05 222319.png` を追加。`cover.png` にコピーし、`photos/photo-001.png` に移動した。
- 画像追加後 `npm.cmd run build` 成功。cover/photos の WARN は消え、残り WARN は `model.glb` なしのみ。download zip は `test-v0.1.0-94cbb71.zip` に更新。
- Phase 2 完了コメント: `import:inbox` は既存モデル merge 時に写真連番を継続し、source 同名衝突は `-2` 形式で回避するようにした。既存 `model.glb` がある場合は新規 preview を警告して取り込まない。
- Phase 2 完了コメント: `normalize:model` はトップ階層の画像を `cover`/`photos/photo-###` に整理し、トップ階層の GLB/source を正規位置へ移動し、Markdown 内の単純な相対参照を更新するようにした。
- Phase 2 検証: `npm.cmd run build` 成功、`npm.cmd run normalize:model test` dry-run 成功。
- Phase 3 完了コメント: 一覧に並び替え (`Newest first`, `Name A-Z`, `Category`) を追加し、既存の検索/カテゴリ/タグ/ライセンス絞り込みと同時に動くようにした。
- Phase 3 完了コメント: 詳細ページにタグ/カテゴリ一致で関連モデルを最大3件表示する `Related Models` を追加した。
- Phase 3 完了コメント: 文字化けしていた `index.astro`, `[slug].astro`, `terms.astro` のUI文言をASCII中心に整理。`terms` も普通のGUIページとして生成される。
- Phase 3 検証: `npm.cmd run build` 成功。
