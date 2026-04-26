import { useEffect, useRef, useState } from 'react';
import { getPapersForCitation, uploadPaper } from '../api/client';
import type { Paper, UrlItem } from '../types';
import UrlListEditor from './UrlListEditor';

interface NewPaperForm {
  title: string;
  year: string;
  file: File | null;
}

const emptyNewPaper = (): NewPaperForm => ({ title: '', year: '', file: null });

interface Props {
  projectId: number;
  onClose: () => void;
  onUploaded: () => void;
}

export default function PaperUploadModal({ projectId, onClose, onUploaded }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 引用関係
  const [citingList, setCitingList] = useState<Paper[]>([]);
  const [citedByList, setCitedByList] = useState<Paper[]>([]);
  const [selectedCiting, setSelectedCiting] = useState<Set<number>>(new Set());
  const [selectedCitedBy, setSelectedCitedBy] = useState<Set<number>>(new Set());

  // インライン新規アップロード
  const [showNewCiting, setShowNewCiting] = useState(false);
  const [showNewCitedBy, setShowNewCitedBy] = useState(false);
  const [newCiting, setNewCiting] = useState<NewPaperForm>(emptyNewPaper());
  const [newCitedBy, setNewCitedBy] = useState<NewPaperForm>(emptyNewPaper());
  const [newCitingLoading, setNewCitingLoading] = useState(false);
  const [newCitedByLoading, setNewCitedByLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const newCitingFileRef = useRef<HTMLInputElement>(null);
  const newCitedByFileRef = useRef<HTMLInputElement>(null);

  const yearNum = parseInt(year);

  const loadCitationLists = async () => {
    if (!year || isNaN(yearNum)) return;
    const [citing, citedBy] = await Promise.all([
      getPapersForCitation(projectId, yearNum, 'citing'),
      getPapersForCitation(projectId, yearNum, 'cited_by'),
    ]);
    setCitingList(citing);
    setCitedByList(citedBy);
  };

  useEffect(() => {
    if (step === 2) loadCitationLists();
  }, [step]);

  const toggleCiting = (id: number) => {
    setSelectedCiting(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleCitedBy = (id: number) => {
    setSelectedCitedBy(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const goToStep2 = () => {
    if (!title.trim()) { setError('論文タイトルを入力してください'); return; }
    if (!year || isNaN(yearNum) || yearNum < 1000 || yearNum > 2100) {
      setError('発表年を正しく入力してください'); return;
    }
    if (!file) { setError('PDFファイルを選択してください'); return; }
    setError('');
    setStep(2);
  };

  const handleUploadNewCiting = async () => {
    if (!newCiting.title.trim() || !newCiting.year || !newCiting.file) {
      alert('タイトル、発表年、PDFをすべて入力してください'); return;
    }
    setNewCitingLoading(true);
    try {
      const uploaded = await uploadPaper(projectId, {
        title: newCiting.title.trim(),
        year: parseInt(newCiting.year),
        description: '',
        file: newCiting.file,
        citingPaperIds: [],
        citedByPaperIds: [],
        urls: [],
      });
      setSelectedCiting(prev => new Set([...prev, uploaded.id]));
      setCitingList(prev => [uploaded, ...prev]);
      setNewCiting(emptyNewPaper());
      setShowNewCiting(false);
    } catch {
      alert('アップロードに失敗しました');
    } finally {
      setNewCitingLoading(false);
    }
  };

  const handleUploadNewCitedBy = async () => {
    if (!newCitedBy.title.trim() || !newCitedBy.year || !newCitedBy.file) {
      alert('タイトル、発表年、PDFをすべて入力してください'); return;
    }
    setNewCitedByLoading(true);
    try {
      const uploaded = await uploadPaper(projectId, {
        title: newCitedBy.title.trim(),
        year: parseInt(newCitedBy.year),
        description: '',
        file: newCitedBy.file,
        citingPaperIds: [],
        citedByPaperIds: [],
        urls: [],
      });
      setSelectedCitedBy(prev => new Set([...prev, uploaded.id]));
      setCitedByList(prev => [uploaded, ...prev]);
      setNewCitedBy(emptyNewPaper());
      setShowNewCitedBy(false);
    } catch {
      alert('アップロードに失敗しました');
    } finally {
      setNewCitedByLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await uploadPaper(projectId, {
        title: title.trim(),
        year: yearNum,
        description: description.trim(),
        file,
        citingPaperIds: Array.from(selectedCiting),
        citedByPaperIds: Array.from(selectedCitedBy),
        urls: urls.filter(u => u.url.trim()),
      });
      onUploaded();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'アップロードに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">論文をアップロード</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">ステップ {step} / 2</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {error && <p className="text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">論文タイトル *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="論文のタイトルを入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">発表年 *</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 2020"
                  min={1900}
                  max={2100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">論文の説明（任意）</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="論文の概要や研究内容を入力（グラフ上でホバーすると表示されます）"
                />
              </div>
              <UrlListEditor urls={urls} onChange={setUrls} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDFファイル *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {file ? (
                    <p className="text-sm text-blue-600 font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">クリックしてPDFを選択</p>
                      <p className="text-xs text-gray-400 mt-1">PDFのみ対応</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && f.name.toLowerCase().endsWith('.pdf')) setFile(f);
                    else if (f) alert('PDFファイルのみ選択できます');
                  }}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg">
                <strong>{title}</strong>（{year}年）の引用関係を設定します（任意）
              </p>

              {/* この論文が引用している論文 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  この論文が引用している論文
                  <span className="text-xs font-normal text-gray-400 ml-2">（{yearNum}年以前の論文）</span>
                </h3>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {citingList.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">該当する論文がありません</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {citingList.map(p => (
                        <li
                          key={p.id}
                          onClick={() => toggleCiting(p.id)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${selectedCiting.has(p.id) ? 'bg-blue-50' : ''}`}
                        >
                          <input type="checkbox" readOnly checked={selectedCiting.has(p.id)} className="accent-blue-500" />
                          <span className="text-sm text-gray-700 flex-1 leading-tight">{p.title}</span>
                          <span className="text-xs text-gray-400 shrink-0">{p.year}年</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => setShowNewCiting(v => !v)}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  + 新しい論文をアップロード
                </button>
                {showNewCiting && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={newCiting.title}
                      onChange={e => setNewCiting(v => ({ ...v, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="論文タイトル"
                    />
                    <input
                      type="number"
                      value={newCiting.year}
                      onChange={e => setNewCiting(v => ({ ...v, year: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="発表年"
                      max={yearNum}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => newCitingFileRef.current?.click()}
                        className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-white"
                      >
                        PDF選択
                      </button>
                      <span className="text-xs text-gray-500 truncate">{newCiting.file?.name ?? '未選択'}</span>
                      <input
                        ref={newCitingFileRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setNewCiting(v => ({ ...v, file: f }));
                        }}
                      />
                    </div>
                    <button
                      onClick={handleUploadNewCiting}
                      disabled={newCitingLoading}
                      className="w-full bg-blue-600 text-white text-sm rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {newCitingLoading ? 'アップロード中...' : 'アップロードして追加'}
                    </button>
                  </div>
                )}
              </div>

              {/* この論文を引用している論文 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  この論文を引用している論文
                  <span className="text-xs font-normal text-gray-400 ml-2">（{yearNum}年以降の論文）</span>
                </h3>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {citedByList.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">該当する論文がありません</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {citedByList.map(p => (
                        <li
                          key={p.id}
                          onClick={() => toggleCitedBy(p.id)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${selectedCitedBy.has(p.id) ? 'bg-blue-50' : ''}`}
                        >
                          <input type="checkbox" readOnly checked={selectedCitedBy.has(p.id)} className="accent-blue-500" />
                          <span className="text-sm text-gray-700 flex-1 leading-tight">{p.title}</span>
                          <span className="text-xs text-gray-400 shrink-0">{p.year}年</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => setShowNewCitedBy(v => !v)}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  + 新しい論文をアップロード
                </button>
                {showNewCitedBy && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={newCitedBy.title}
                      onChange={e => setNewCitedBy(v => ({ ...v, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="論文タイトル"
                    />
                    <input
                      type="number"
                      value={newCitedBy.year}
                      onChange={e => setNewCitedBy(v => ({ ...v, year: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="発表年"
                      min={yearNum}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => newCitedByFileRef.current?.click()}
                        className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-white"
                      >
                        PDF選択
                      </button>
                      <span className="text-xs text-gray-500 truncate">{newCitedBy.file?.name ?? '未選択'}</span>
                      <input
                        ref={newCitedByFileRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setNewCitedBy(v => ({ ...v, file: f }));
                        }}
                      />
                    </div>
                    <button
                      onClick={handleUploadNewCitedBy}
                      disabled={newCitedByLoading}
                      className="w-full bg-blue-600 text-white text-sm rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {newCitedByLoading ? 'アップロード中...' : 'アップロードして追加'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                キャンセル
              </button>
              <button onClick={goToStep2} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                次へ（引用設定）
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                戻る
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'アップロード中...' : 'アップロード完了'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
