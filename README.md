# 📖 StudyFlow - 学習時間記録 & TODOアプリ (Tauri v2)

GitHub Actions を利用してクラウド上で自動ビルドを行い、インストーラー（macOS / Windows / Linux）をダウンロードして実行できるデスクトップアプリケーションです。

> **💡 ローカルでの開発環境構築は一切不要です！**  
> お使いのパソコンに Node.js や Rust、ビルドツールなどをインストールする必要はありません。  
> このプロジェクトを GitHub にプッシュするだけで、GitHub Actions が自動的に各 OS 向けの実行ファイルをビルド・パッケージングします。

---

## ✨ 主な機能

1. **⏱️ 学習タイマー (Start / Stop 記録)**
   - **ワンクリック計測**: 「Start」で学習開始、「Stop & 記録」で学習時間を自動保存。
   - **科目・TODO連動**: 英語・プログラミング・数学などの科目や、登録したTODOタスクと紐付けて記録可能。
   - **ポモドーロタイマー機能**: 通常のストップウォッチ（カウントアップ）に加え、25分間の集中タイマーモードも搭載。
2. **📝 TODOタスク管理**
   - 今日のやることの追加・完了チェック・削除。
   - タスク横の再生アイコンをクリックすると、そのタスクのタイマーが即座に起動。
   - 予定目安時間やメモの記録。
3. **📅 過去データの読み出し & 振り返り**
   - 日付ピッカー・前日/翌日ボタンで、過去の任意の日付の学習記録を即座に閲覧。
   - その日に「何時から何時まで」「何の科目を勉強したか」「どのTODOを達成したか」を詳細表示。
4. **📊 統計グラフ & 集計**
   - 直近7日間の学習時間推移（棒グラフ）を自動描画。
   - 一番勉強した科目の自動集計。
5. **💾 データの永続化 & バックアップ**
   - アプリを閉じてもデータは自動保持（ローカル保存）。
   - JSONファイルによるエクスポート・インポート機能に対応。

---

## 🚀 GitHub Actions でのビルド＆ダウンロード手順

### Step 1: GitHub で新しいリポジトリを作成
1. ブラウザで [GitHub](https://github.com/) にログインします。
2. 右上の「+」アイコン → **「New repository」** をクリックします。
3. リポジトリ名（例: `study-todo-app`）を入力します（Public / Private どちらでも構いません）。
4. 「Initialize this repository with...」（READMEや.gitignoreの追加）のチェックは**すべて外した状態**で「**Create repository**」を押します。

### Step 2: ソースコードを GitHub にプッシュ
お使いのパソコンのターミナルで以下のコマンドを実行します。  
（`YOUR_USERNAME` と `study-todo-app` は作成したリポジトリの URL に合わせて変更してください）

```bash
cd /Users/tyam/study-todo-app

# git リポジトリを初期化
git init
git add .
git commit -m "Initial commit: StudyFlow app"

# メインブランチに設定してGitHubにプッシュ
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/study-todo-app.git
git push -u origin main
```

---

### Step 3: 自動ビルドの確認 & ダウンロード

1. GitHub のリポジトリページを開き、上部メニューの **「Actions」** タブをクリックします。
2. プッシュすると自動的に **「Build App (Artifacts)」** ワークフローが起動します。  
   （※「Run workflow」ボタンから手動でいつでも実行することも可能です）
3. ビルドジョブ（macOS, Windows, Linux）が実行されます（通常 5〜10分程度）。
4. ビルドが完了（緑のチェックマーク ✅）したら、そのワークフロー実行をクリックして開きます。
5. ページ下部の **「Artifacts」** セクションにお使いの OS に合わせたダウンロードリンクが表示されます：
   - **`study-flow-macos`**: macOS用（`.dmg` または `.app`）
   - **`study-flow-windows`**: Windows用（`.exe` または `.msi`）
   - **`study-flow-linux`**: Linux用（`.deb` または `.AppImage`）
6. 該当の Artifact をクリックすると、zip ファイルとしてダウンロードできます！

---

## 💻 ダウンロードしたアプリの起動方法

### 🍎 macOS の場合
1. ダウンロードした zip ファイルを解凍します。
2. `.dmg` ファイルを開き、`StudyFlow.app` を「アプリケーション（Applications）」フォルダにドラッグ＆ドロップします。
3. アプリをダブルクリックして起動します。
   - ※「開発元が未確認のため開けません」と表示された場合：
     - **「システム設定」→「プライバシーとセキュリティ」** を開き、画面下部にある「このまま開く」をクリックするか、
     - アプリを **右クリック（または Control + クリック）して「開く」** を選択すると起動できます。

### 🪟 Windows の場合
1. ダウンロードした zip ファイルを解凍します。
2. `.exe`（NSIS インストーラー）を実行します。
   - ※「WindowsによってPCが保護されました（SmartScreen）」が表示された場合：
     - 「**詳細情報**」をクリックし、現れた「**実行**」ボタンを押してください。

---

## 📁 プロジェクト構成

```text
study-todo-app/
├── .github/
│   └── workflows/
│       ├── build.yml       # push/手動実行で各OS向けバイナリをArtifactsに保存
│       └── release.yml     # タグ(v*)プッシュ時にGitHub Releasesに自動公開
├── src-tauri/
│   ├── Cargo.toml          # Rustバックエンド依存関係 (Tauri v2)
│   ├── tauri.conf.json     # アプリウィンドウ・バンドル設定
│   ├── build.rs            # ビルドスクリプト
│   ├── src/main.rs         # Tauri エントリーポイント
│   ├── capabilities/       # Tauri v2 パーミッション
│   └── icons/              # アプリアイコン (各解像度PNG, ico, icns)
├── src/
│   ├── index.html          # UI レイアウト (タブ、タイマー、TODO、履歴画面)
│   ├── style.css           # 洗練されたダークモード風モダンUIデザイン
│   ├── app.js              # タイマー・TODO・過去データ読み出し・バックアップロジック
│   └── chart.js            # 週間学習推移を描画する軽量Canvasチャート
├── package.json            # フロントエンド依存設定 (Vite)
├── vite.config.js          # Vite バンドル設定
└── .gitignore              # Git 除外設定
```

---

## 🏷️ GitHub Releases で正式リリースする場合（オプション）

タグをプッシュすると、GitHub の「Releases」ページにインストーラーが自動添付されます。

```bash
git tag v1.0.0
git push origin v1.0.0
```
プッシュ後、リポジトリの「Releases」ページに各 OS のインストーラーが並び、誰でも直接ワンクリックでダウンロードできるようになります。
