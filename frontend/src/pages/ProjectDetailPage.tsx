import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, getPapers, getPaper, deletePaper } from '../api/client';
import type { Project, Paper, PaperDetail } from '../types';
import GraphView from '../components/GraphView';
import PaperUploadModal from '../components/PaperUploadModal';
import PaperEditModal from '../components/PaperEditModal';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = Number(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<PaperDetail | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingPaper, setEditingPaper] = useState<PaperDetail | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = useCallback(async () => {
    const [proj, paps] = await Promise.all([getProject(pid), getPapers(pid)]);
    setProject(proj);
    setPapers(paps);
  }, [pid]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPaper = async (paperId: number) => {
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
      setSelectedPaper(null);
      return;
    }
    setSelectedPaperId(paperId);
    const detail = await getPaper(pid, paperId);
    setSelectedPaper(detail);
  };

  const handleNodeClick = (paperId: number) => {
    handleSelectPaper(paperId);
  };

  const handleEdit = async (e: React.MouseEvent, paperId: number) => {
    e.stopPropagation();
    const detail = await getPaper(pid, paperId);
    setEditingPaper(detail);
  };

  const handleDelete = async (e: React.MouseEvent, paperId: number) => {
    e.stopPropagation();
    if (!confirm('この論文を削除しますか？')) return;
    await deletePaper(pid, paperId);
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
      setSelectedPaper(null);
    }
    loadData();
    setRefreshTrigger(t => t + 1);
  };

  const handleUploaded = () => {
    loadData();
    setRefreshTrigger(t => t + 1);
  };

  const handleUpdated = async () => {
    loadData();
    setRefreshTrigger(t => t + 1);
    if (selectedPaperId) {
      const detail = await getPaper(pid, selectedPaperId);
      setSelectedPaper(detail);
    }
  };

  if (!project) return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - 常に上部に固定 */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 z-30">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 text-sm">← 一覧に戻る</button>
        <span className="text-gray-300">|</span>
        <h1 className="text-lg font-bold text-gray-800 flex-1">{project.name}</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 論文をアップロード
        </button>
      </header>

      {/* 中央: サイドバー + グラフ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: 論文一覧 */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold text-gray-700">論文一覧</span>
            <span className="text-xs text-gray-400">{papers.length}件</span>
          </div>

          {selectedPaperId && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-blue-600">サブグラフ表示中</span>
              <button
                onClick={() => { setSelectedPaperId(null); setSelectedPaper(null); }}
                className="text-xs text-blue-400 hover:text-blue-700"
              >
                全体表示に戻す
              </button>
            </div>
          )}

          {/* 論文リスト - スクロール可能、下まで見切れない */}
          <div className="overflow-y-auto flex-1">
            {papers.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">論文がまだありません</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {papers.map(p => (
                  <li
                    key={p.id}
                    onClick={() => handleSelectPaper(p.id)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedPaperId === p.id ? 'bg-orange-50 border-l-2 border-orange-400' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-tight line-clamp-2">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.year}年</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <button
                          onClick={e => handleEdit(e, p.id)}
                          className="text-gray-400 hover:text-blue-500 text-xs px-1.5 py-0.5 rounded hover:bg-blue-50"
                          title="編集"
                        >
                          編集
                        </button>
                        <button
                          onClick={e => handleDelete(e, p.id)}
                          className="text-gray-300 hover:text-red-500 text-xs px-1 py-0.5 rounded hover:bg-red-50"
                          title="削除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right: グラフ */}
        <main className="flex-1 relative">
          <GraphView
            projectId={pid}
            selectedPaperId={selectedPaperId}
            onNodeClick={handleNodeClick}
            refreshTrigger={refreshTrigger}
          />
        </main>
      </div>

      {/* Bottom: 論文詳細パネル - 画面下部に固定 */}
      {selectedPaper && (
        <div className="shrink-0 bg-white border-t-2 border-gray-200 shadow-2xl z-20" style={{ height: 220 }}>
          {/* パネルヘッダー */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-gray-100 shrink-0">
            <div className="flex-1 min-w-0 mr-4">
              <h2 className="text-sm font-bold text-gray-800 truncate">{selectedPaper.title}</h2>
              <span className="text-xs text-gray-400">{selectedPaper.year}年</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={e => handleEdit(e, selectedPaper.id)}
                className="text-xs text-blue-500 hover:underline px-2 py-1 rounded hover:bg-blue-50"
              >
                編集
              </button>
              <a
                href={`/uploads/${pid}/${selectedPaper.filename}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700"
              >
                PDFを開く
              </a>
              <button
                onClick={() => { setSelectedPaperId(null); setSelectedPaper(null); }}
                className="text-gray-400 hover:text-gray-600 text-base px-2 py-0.5 rounded hover:bg-gray-100"
                title="閉じる"
              >
                ✕
              </button>
            </div>
          </div>

          {/* パネルコンテンツ - 横並び4カラム */}
          <div className="flex gap-6 px-6 py-3 overflow-y-auto" style={{ height: 'calc(220px - 48px)' }}>
            {/* 説明 */}
            <div className="min-w-0" style={{ flex: 4 }}>
              <p className="text-xs font-medium text-gray-500 mb-1">説明</p>
              {selectedPaper.description
                ? <p className="text-xs text-gray-600 leading-relaxed">{selectedPaper.description}</p>
                : <p className="text-xs text-gray-400">説明なし</p>
              }
            </div>

            {/* 関連URL */}
            {selectedPaper.urls && selectedPaper.urls.length > 0 && (
              <div className="min-w-0" style={{ flex: 2 }}>
                <p className="text-xs font-medium text-gray-500 mb-1">関連URL</p>
                <div className="space-y-1">
                  {selectedPaper.urls.map((u, i) => (
                    <a
                      key={i}
                      href={u.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <span className="text-gray-400">↗</span>
                      <span className="font-medium truncate">{u.label || 'URL'}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 引用している論文 */}
            <div className="min-w-0" style={{ flex: 2 }}>
              <p className="text-xs font-medium text-gray-500 mb-1">引用している論文（{selectedPaper.citing.length}件）</p>
              {selectedPaper.citing.length === 0
                ? <p className="text-xs text-gray-400">なし</p>
                : <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: 120 }}>
                    {selectedPaper.citing.map(c => (
                      <button key={c.id} onClick={() => handleSelectPaper(c.id)}
                        className="block text-left w-full text-xs text-blue-600 hover:underline leading-tight">
                        {c.title}（{c.year}年）
                      </button>
                    ))}
                  </div>
              }
            </div>

            {/* 引用されている論文 */}
            <div className="min-w-0" style={{ flex: 2 }}>
              <p className="text-xs font-medium text-gray-500 mb-1">引用されている論文（{selectedPaper.cited_by.length}件）</p>
              {selectedPaper.cited_by.length === 0
                ? <p className="text-xs text-gray-400">なし</p>
                : <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: 120 }}>
                    {selectedPaper.cited_by.map(c => (
                      <button key={c.id} onClick={() => handleSelectPaper(c.id)}
                        className="block text-left w-full text-xs text-blue-600 hover:underline leading-tight">
                        {c.title}（{c.year}年）
                      </button>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <PaperUploadModal
          projectId={pid}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {editingPaper && (
        <PaperEditModal
          projectId={pid}
          paper={editingPaper}
          onClose={() => setEditingPaper(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
