# 論文管理アプリ

プロジェクトごとに論文をPDFで管理し、引用関係を有向グラフで可視化するアプリです。

---

## 起動手順

### 前提
- `uv` がインストール済み（確認済み）
- `Node.js` がインストール済み（確認済み）

---

### バックエンド（初回のみ）

PowerShell または コマンドプロンプトを開いて実行：

```powershell
cd "c:\大学院研究\論文管理アプリ\backend"
uv venv --python 3.12
uv pip install -r requirements.txt
```

### バックエンド（毎回の起動）

```powershell
cd "c:\大学院研究\論文管理アプリ\backend"
.venv\Scripts\uvicorn.exe main:app --reload
```

`INFO: Application startup complete.` と表示されれば成功。

---

### フロントエンド（別のターミナルで実行）

```powershell
cd "c:\大学院研究\論文管理アプリ\frontend"
npm run dev
```

`Local: http://localhost:5173/` と表示されれば成功。

---

### アクセス

ブラウザで **http://localhost:5173** を開く

> バックエンドとフロントエンドは **両方同時に起動** している必要があります。
> 停止するときは各ターミナルで `Ctrl + C`
