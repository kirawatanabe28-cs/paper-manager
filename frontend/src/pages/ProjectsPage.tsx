import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, createProject, deleteProject } from '../api/client';
import type { Project } from '../types';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => getProjects().then(setProjects);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) { setError('プロジェクト名を入力してください'); return; }
    setLoading(true);
    try {
      await createProject(name.trim(), description.trim());
      setName(''); setDescription(''); setShowModal(false); setError('');
      load();
    } catch {
      setError('作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('このプロジェクトを削除しますか？（論文データもすべて削除されます）')) return;
    await deleteProject(id);
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">論文管理アプリ</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 新しいプロジェクト
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {projects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">プロジェクトがまだありません</p>
            <p className="text-sm mt-1">「新しいプロジェクト」から始めましょう</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{p.name}</h2>
                  {p.description && <p className="text-gray-500 text-sm mt-1">{p.description}</p>}
                  <p className="text-xs text-gray-400 mt-2">論文数: {p.paper_count}</p>
                </div>
                <button
                  onClick={e => handleDelete(e, p.id)}
                  className="text-red-400 hover:text-red-600 text-sm px-3 py-1 rounded hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">新しいプロジェクト</h2>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">プロジェクト名 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 機械学習関連論文"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明（任意）</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="プロジェクトの説明"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowModal(false); setError(''); setName(''); setDescription(''); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
