# 黒い砂漠 ボス出現タイマー

黒い砂漠のボス出現予定を表示し、指定したボス・通知タイミングでアラームを鳴らすローカル用タイマーアプリです。

最終更新メモ: 2026-05-22

## 現在の仕様

- オフラインで起動できるHTML/CSS/JavaScriptアプリ
- Dドライブや外部サイトには依存せず、ボス時刻データは `app.js` 内に保持
- 元表画像は `assets/boss-schedule.png` として保存
- 背景画像はAI補完した文字なし画像 `assets/boss-background-ai-clean.png` を使用
- ブラウザで直接開く通常版と、Microsoft Edgeのアプリモードで開く軽量exe版を用意
- Electron版の構成もあり、必要ならデスクトップアプリとしてビルド可能

## 主な機能

- 次の対象ボスを大きく表示
- 今日の予定と明日以降の予定を分けて表示
- 次に鳴るアラーム一覧を表示
- ボスごとの色分け表示
- 鳴らすボスをチェックボックスで選択
- プリセット切り替え
  - 全部ON
  - ガーモスだけ
  - 朝鮮ボス
  - ワールドボス
  - 全部OFF
- 通知タイミング選択
  - 30分前
  - 15分前
  - 5分前
  - 1分前
  - ちょうど
- アラーム音選択
  - ベル
  - チャイム
  - 警告
  - リマインダー
  - ストップまで
- 音量調整
- 音量テスト
- アラーム停止
- 通知許可・音声有効化・次回通知・逃し通知の状態表示
- アラーム履歴
- 設定リセット
- 設定コピー
- 元の表画像の表示

## アラーム仕様

- 通常のアラーム音は約4秒
- `リマインダー` は不快感を抑えたチャイム反復で約10秒
- `ストップまで` はアラーム停止ボタンを押すまで鳴り続ける
- 音量テストでも選択中のアラーム音と音量を確認可能
- ブラウザ/Edge/Electronの音声仕様により、初回はユーザー操作後に音が鳴る

## 保存される設定

以下はブラウザ/Electron側の `localStorage` に保存されます。

- 選択中のボス
- 音量
- アラーム音
- 通知タイミング
- アラーム履歴
- 最終確認時刻

## 起動方法

### 通常HTML版

`index.html` を開きます。

```text
C:\Users\cloford\Documents\Codex\2026-05-16\pc\index.html
```

### 軽量exe版

`dist-light` フォルダ内のexeを起動します。

```text
C:\Users\cloford\Documents\Codex\2026-05-16\pc\dist-light\ボス出現タイマー-Light.exe
```

軽量版はMicrosoft Edgeのアプリモードで `index.html` を開く方式です。exe単体ではなく、同じフォルダ内の以下が必要です。

```text
index.html
app.js
styles.css
assets
ボス出現タイマー-Light.exe
```

### Electron版

依存関係を入れた状態で以下を実行します。

```powershell
npm.cmd install
npm.cmd start
```

Windows用portable exeを作る場合:

```powershell
npm.cmd run package
```

生成先:

```text
dist\ボス出現タイマー 1.0.0.exe
```

## 配布メモ

友達に渡す場合は、容量の軽い `dist-light` をzip化するのが基本です。

- Electron版はChromiumを同梱するため重い
- 軽量版はPCに入っているMicrosoft Edgeを使うため小さい
- 軽量版の配布時はフォルダ構造を崩さない
- zipは展開してからexeを起動する

## 現在の注意点

- 軽量版はMicrosoft Edgeが入っているWindows PC前提
- ブラウザやEdgeを完全に閉じるとアラームは動作しない
- PCがスリープ中の間は鳴らない
- スリープ復帰後は逃し通知の表示で確認する
- GitHubには生成物 `dist/`、`dist-light/`、`node_modules/`、zipはコミットしない

## 主要ファイル

```text
index.html                         画面構成
styles.css                         見た目
app.js                             タイマー・アラーム処理
assets/boss-schedule.png           元表画像
assets/boss-background-ai-clean.png 背景画像
assets/app-icon.ico                Windowsアイコン
launcher/BossTimerLightLauncher.cs 軽量版exeのランチャーソース
electron/main.js                   Electron版起動処理
docs/test-spec.pdf                 テスト仕様書PDF
tests/app-offline.test.js          オフライン自動テスト
```

## Git運用メモ

作業は段階ごとにコミットしています。GitHubで履歴を確認できます。

```powershell
git status
git log --oneline
git push
```
