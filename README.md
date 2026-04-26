# 論文管理アプリ

プロジェクトごとに論文をPDFで管理し、引用関係を有向グラフで可視化するアプリです。

---

## 起動方法 A：Docker（推奨）

**必要なもの：Docker のみ**（Docker Desktop または Docker CLI + WSL2）

### 初回

```bash
docker compose up --build
```

### 2回目以降

```bash
docker compose up
```

### 停止

```bash
docker compose down
```

### アクセス

ブラウザで **http://localhost** を開く

> 論文データ（PDF・DB）は `data/` フォルダに保存されます。`docker compose down` しても消えません。

---

## 起動方法 B：ローカル開発（uv + Node.js）

### 前提
- `uv` がインストール済み
- `Node.js` がインストール済み

### バックエンド（初回のみ：仮想環境セットアップ）

```powershell
cd backend
uv venv --python 3.12
uv pip install -r requirements.txt
```

### バックエンド（毎回の起動）

```powershell
cd backend
.venv\Scripts\uvicorn.exe main:app --reload
```

### フロントエンド（別ターミナルで）

```powershell
cd frontend
npm run dev
```

ブラウザで **http://localhost:5173** を開く

---

## 機能

- プロジェクト作成・削除
- 論文のPDFアップロード（タイトル・発表年・説明のメタデータ付き）
- 引用関係の設定（年フィルタ付き、インライン新規アップロード対応）
- 論文の編集（タイトル・年・説明・引用関係）
- 有向グラフで引用関係を可視化（dagre 自動レイアウト）
- 特定の論文を選択するとサブグラフを表示
- グラフノードにカーソルを合わせると説明文を表示
