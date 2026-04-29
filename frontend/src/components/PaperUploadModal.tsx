import { useRef, useState } from 'react';
import { extractTitle, uploadPaper } from '../api/client';
import type { UrlItem } from '../types';
import UrlListEditor from './UrlListEditor';

interface Props {
  projectId: number;
  onClose: () => void;
  onUploaded: () => void;
}

export default function PaperUploadModal({ projectId, onClose, onUploaded }: Props) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleHint, setTitleHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const yearNum = parseInt(year);

  const handleFileChange = async (f: File) => {
    setFile(f);
    setTitleLoading(true);
    setTitleHint('');
    try {
      const extracted = await extractTitle(f);
      if (extracted) {
        setTitle(extracted);
        setTitleHint('✓ タイトルを自動抽出しました（修正可能）');
      } else {
        setTitleHint('タイトルを自動抽出できませんでした。手動で入力してください。');
      }
    } catch {
      setTitleHint('タイトルを自動抽出できませんでした。手動で入力してください。');
    } finally {
      setTitleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('論文タイトルを入力してください'); return; }
    if (!year || isNaN(yearNum) || yearNum < 1000 || yearNum > 2100) {
      setError('発表年を正しく入力してください'); return;
    }
    if (!file) { setError('PDFファイルを選択してください'); return; }

    setError('');
    setLoading(true);
    try {
      await uploadPaper(projectId, {
        title: title.trim(),
        year: yearNum,
        description: description.trim(),
        file,
        citingPaperIds: [],
        citedByPaperIds: [],
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
          <div>
            <h2 className="text-lg font-bold text-gray-800">論文をアップロード</h2>
            <p className="text-xs text-gray-400 mt-0.5">引用関係はGROBIDで自動検出されます</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {error && <p className="text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="space-y-4">
            {/* PDF */}
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
                    <p className="text-xs text-gray-400 mt-1">PDFのみ対応 · 選択後にタイトルを自動抽出します</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!f.name.toLowerCase().endsWith('.pdf')) {
                    alert('PDFファイルのみ選択できます');
                    return;
                  }
                  await handleFileChange(f);
                }}
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">論文タイトル *</label>
              <div className="relative">
                <input
                  type="text"
                  value={titleLoading ? '' : title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={titleLoading}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder={titleLoading ? 'タイトルを抽出中...' : 'タイトルを入力'}
                />
                {titleLoading && (
                  <span className="absolute right-3 top-2 text-xs text-blue-500 animate-pulse">抽出中...</span>
                )}
              </div>
              {titleHint && (
                <p className={`text-xs mt-1 ${titleHint.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>
                  {titleHint}
                </p>
              )}
            </div>

            {/* Year */}
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

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">論文の説明（任意）</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="論文の概要（グラフ上でホバーすると表示されます）"
              />
            </div>

            {/* URLs */}
            <UrlListEditor urls={urls} onChange={setUrls} />

            {loading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                PDFを解析して引用論文を自動検出中です... しばらくお待ちください
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || titleLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '処理中...' : 'アップロード'}
          </button>
        </div>
      </div>
    </div>
  );
}
