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
    // 選択中の論文情報を再取得して反映
    if (selectedPaperId) {
      const detail = await getPaper(pid, selectedPaperId);
      setSelectedPaper(detail);
    }
  };

  if (!project) return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
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

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Left: Paper list */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">論文一覧</span>
            <span className="text-xs text-gray-400">{papers.length}件</span>
          </div>

          {selectedPaperId && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <span className="text-xs text-blue-600">サブグラフ表示中</span>
              <button
                onClick={() => { setSelectedPaperId(null); setSelectedPaper(null); }}
                className="text-xs text-blue-400 hover:text-blue-700"
              >
                全体表示に戻す
              </button>
            </div>
          )}

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

          {/* 選択中の論文の詳細 */}
          {selectedPaper && (
            <div className="border-t border-gray-200 p-4 bg-gray-50 overflow-y-auto" style={{ maxHeight: '45%' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">論文詳細</p>
                <button
                  onClick={e => handleEdit(e, selectedPaper.id)}
                  className="text-xs text-blue-500 hover:underline"
                >
                  編集
                </button>
              </div>

              {selectedPaper.description && (
                <p className="text-xs text-gray-600 mb-3 leading-relaxed bg-white border border-gray-200 rounded p-2">
                  {selectedPaper.description}
                </p>
              )}

              {selectedPaper.urls && selectedPaper.urls.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">関連URL</p>
                  <div className="space-y-1">
                    {selectedPaper.urls.map((u, i) => (
                      <a
                        key={i}
                        href={u.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline truncate"
                      >
                        <span className="text-gray-400">↗</span>
                        <span className="font-medium shrink-0">{u.label || 'URL'}</span>
                        <span className="text-gray-400 truncate">{u.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1">引用している論文（{selectedPaper.citing.length}件）</p>
                {selectedPaper.citing.length === 0
                  ? <p className="text-xs text-gray-400">なし</p>
                  : selectedPaper.citing.map(c => (
                    <button key={c.id} onClick={() => handleSelectPaper(c.id)}
                      className="block text-left w-full text-xs text-blue-600 hover:underline leading-tight mb-1">
                      {c.title}（{c.year}年）
                    </button>
                  ))
                }
              </div>
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1">引用されている論文（{selectedPaper.cited_by.length}件）</p>
                {selectedPaper.cited_by.length === 0
                  ? <p className="text-xs text-gray-400">なし</p>
                  : selectedPaper.cited_by.map(c => (
                    <button key={c.id} onClick={() => handleSelectPaper(c.id)}
                      className="block text-left w-full text-xs text-blue-600 hover:underline leading-tight mb-1">
                      {c.title}（{c.year}年）
                    </button>
                  ))
                }
              </div>
              <a
                href={`/uploads/${pid}/${selectedPaper.filename}`}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs bg-blue-600 text-white rounded px-2 py-1.5 hover:bg-blue-700"
              >
                PDFを開く
              </a>
            </div>
          )}
        </aside>

        {/* Right: Graph */}
        <main className="flex-1 relative">
          <GraphView
            projectId={pid}
            selectedPaperId={selectedPaperId}
            onNodeClick={handleNodeClick}
            refreshTrigger={refreshTrigger}
          />
        </main>
      </div>

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
