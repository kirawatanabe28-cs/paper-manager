# 論文管理アプリ

プロジェクトごとに論文をPDFで管理し、引用関係を有向グラフで可視化するアプリです。  
GROBIDによるPDFの自動解析で、タイトル抽出・引用関係の自動検出をサポートします。

---

## 機能

- プロジェクト作成・削除
- 論文のPDFアップロード
- PDFアップロード時にタイトル・発行年を自動抽出
- 参考文献リストから引用関係を自動検出
- 引用関係の手動設定・編集
- 有向グラフで引用関係を可視化
---

## 起動方法

**必要なもの：Docker のみ**（Docker Desktop または Docker CLI + WSL2）

アプリ本体（フロントエンド・バックエンド）と GROBID がまとめて起動します。

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

ブラウザで **http://127.0.0.1:3000** を開く（Windowsの場合）

> 論文データ（PDF・DB）は `data/` フォルダに保存されます。`docker compose down` しても消えません。

> GROBID は起動に30秒〜1分かかります。起動直後にPDFをアップロードするとタイトル抽出が失敗することがありますが、しばらく待ってから再試行してください。

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| グラフ描画 | React Flow + dagre |
| バックエンド | FastAPI + SQLAlchemy + SQLite |
| PDF解析 | GROBID 0.9.0-crf |
| インフラ | Docker / docker-compose + nginx |

---

## ライセンス・サードパーティ
本アプリのライセンスは [Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0) に従います。
GROBID の使用に関するライセンス表記は [NOTICE](./NOTICE) を参照してください。
