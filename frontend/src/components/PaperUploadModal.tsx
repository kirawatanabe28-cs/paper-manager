import { useRef, useState } from 'react';
import { analyzeCitations, extractHeader, getPapersForCitation, uploadPaper } from '../api/client';
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
  // ---- ステップ管理 ----
  const [step, setStep] = useState<1 | 2>(1);

  // ---- Step1 フォーム ----
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleHint, setTitleHint] = useState('');

  // ---- Step2 引用自動検出 ----
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeHint, setAnalyzeHint] = useState('');
  const [rawRefs, setRawRefs] = useState<string[]>([]);
  const [citingList, setCitingList] = useState<Paper[]>([]);
  const [citedByList, setCitedByList] = useState<Paper[]>([]);
  const [selectedCiting, setSelectedCiting] = useState<Set<number>>(new Set());
  const [selectedCitedBy, setSelectedCitedBy] = useState<Set<number>>(new Set());

  // ---- Step2 インライン新規アップロード ----
  const [showNewCiting, setShowNewCiting] = useState(false);
  const [showNewCitedBy, setShowNewCitedBy] = useState(false);
  const [newCiting, setNewCiting] = useState<NewPaperForm>(emptyNewPaper());
  const [newCitedBy, setNewCitedBy] = useState<NewPaperForm>(emptyNewPaper());
  const [newCitingLoading, setNewCitingLoading] = useState(false);
  const [newCitedByLoading, setNewCitedByLoading] = useState(false);

  // ---- 共通 ----
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const newCitingFileRef = useRef<HTMLInputElement>(null);
  const newCitedByFileRef = useRef<HTMLInputElement>(null);

  const yearNum = parseInt(year);

  // ---- Step1: PDF選択時にタイトル自動抽出 ----
  const handleFileChange = async (f: File) => {
    setFile(f);
    setTitleLoading(true);
    setTitleHint('');
    try {
      const { title: extractedTitle, year: extractedYear } = await extractHeader(f);
      if (extractedTitle) {
        setTitle(extractedTitle);
        if (extractedYear) {
          setYear(String(extractedYear));
          setTitleHint('✓ タイトルと発表年を自動抽出しました（修正可能）');
        } else {
          setTitleHint('✓ タイトルを自動抽出しました（発表年は手動で入力してください）');
        }
      } else {
        setTitleHint('タイトルを自動抽出できませんでした。手動で入力してください。');
      }
    } catch {
      setTitleHint('タイトルを自動抽出できませんでした。手動で入力してください。');
    } finally {
      setTitleLoading(false);
    }
  };

  // ---- Step2 移行：論文リスト取得 + GROBID引用自動検出 ----
  const goToStep2 = async () => {
    if (!title.trim()) { setError('論文タイトルを入力してください'); return; }
    if (!year || isNaN(yearNum) || yearNum < 1000 || yearNum > 2100) {
      setError('発表年を正しく入力してください'); return;
    }
    if (!file) { setError('PDFファイルを選択してください'); return; }
    setError('');
    setStep(2);
    setAnalyzing(true);
    setAnalyzeHint('');

    // 論文候補リストを先に取得（DBアクセスなので速い）
    const [citing, citedBy] = await Promise.all([
      getPapersForCitation(projectId, yearNum, 'citing').catch(() => [] as Paper[]),
      getPapersForCitation(projectId, yearNum, 'cited_by').catch(() => [] as Paper[]),
    ]);
    setCitingList(citing);
    setCitedByList(citedBy);

    // GROBID による引用自動検出（時間がかかる）
    try {
      const result = await analyzeCitations(projectId, title.trim(), yearNum, file);
      setSelectedCiting(new Set(result.citing_ids));
      setSelectedCitedBy(new Set(result.cited_by_ids));
      setRawRefs(result.raw_refs);
      const total = result.citing_ids.length + result.cited_by_ids.length;
      setAnalyzeHint(
        total > 0
          ? `✓ ${total}件の引用論文を自動検出しました（変更可能）`
          : '引用論文は自動検出されませんでした。手動で選択してください。'
      );
    } catch {
      setAnalyzeHint('引用論文の自動検出に失敗しました。手動で選択してください。');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleCiting = (id: number) => {
    if (analyzing) return;
    setSelectedCiting(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const toggleCitedBy = (id: number) => {
    if (analyzing) return;
    setSelectedCitedBy(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // ---- Step2 インラインアップロード ----
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

  // ---- 最終アップロード ----
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
        rawRefs,
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

  // ---- チェックボックス付き論文リスト行 ----
  const PaperRow = ({
    paper,
    checked,
    onToggle,
  }: { paper: Paper; checked: boolean; onToggle: () => void }) => (
    <li
      onClick={onToggle}
      className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors
        ${checked ? 'bg-blue-50' : ''}
        ${analyzing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        readOnly
        checked={checked}
        disabled={analyzing}
        className="accent-blue-500"
      />
      <span className="text-sm text-gray-700 flex-1 leading-tight">{paper.title}</span>
      <span className="text-xs text-gray-400 shrink-0">{paper.year}年</span>
    </li>
  );

  // ---- インライン新規アップロードフォーム ----
  const InlineUploadForm = ({
    form,
    onChange,
    fileRef: ref,
    loading: isLoading,
    onSubmit,
    maxYear,
    minYear,
  }: {
    form: NewPaperForm;
    onChange: (v: NewPaperForm) => void;
    fileRef: React.RefObject<HTMLInputElement | null>;
    loading: boolean;
    onSubmit: () => void;
    maxYear?: number;
    minYear?: number;
  }) => (
    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
      <input
        type="text"
        value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        placeholder="論文タイトル"
      />
      <input
        type="number"
        value={form.year}
        onChange={e => onChange({ ...form, year: e.target.value })}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        placeholder="発表年"
        max={maxYear}
        min={minYear}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => ref.current?.click()}
          className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-white"
        >
          PDF選択
        </button>
        <span className="text-xs text-gray-500 truncate">{form.file?.name ?? '未選択'}</span>
        <input
          ref={ref}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onChange({ ...form, file: f }); }}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={isLoading}
        className="w-full bg-blue-600 text-white text-sm rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'アップロード中...' : 'アップロードして追加'}
      </button>
    </div>
  );

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

          {/* ---- Step 1 ---- */}
          {step === 1 && (
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
                    if (!f.name.toLowerCase().endsWith('.pdf')) { alert('PDFファイルのみ選択できます'); return; }
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

              <UrlListEditor urls={urls} onChange={setUrls} />
            </div>
          )}

          {/* ---- Step 2 ---- */}
          {step === 2 && (
            <div className="space-y-5">
              {/* 自動検出ステータスバナー */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
                ${analyzing
                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                  : analyzeHint.startsWith('✓')
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'}`}
              >
                {analyzing && (
                  <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <span>
                  {analyzing
                    ? 'PDFを解析して引用論文を自動検出中です... しばらくお待ちください'
                    : analyzeHint || '引用関係を確認・調整してください'}
                </span>
              </div>

              {/* この論文が引用している論文 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  この論文が引用している論文
                  <span className="text-xs font-normal text-gray-400 ml-2">（{yearNum}年以前）</span>
                  {selectedCiting.size > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      {selectedCiting.size}件選択中
                    </span>
                  )}
                </h3>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {citingList.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">該当する論文がありません</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {citingList.map(p => (
                        <PaperRow
                          key={p.id}
                          paper={p}
                          checked={selectedCiting.has(p.id)}
                          onToggle={() => toggleCiting(p.id)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => !analyzing && setShowNewCiting(v => !v)}
                  disabled={analyzing}
                  className="mt-2 text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + 新しい論文をアップロード
                </button>
                {showNewCiting && (
                  <InlineUploadForm
                    form={newCiting}
                    onChange={setNewCiting}
                    fileRef={newCitingFileRef}
                    loading={newCitingLoading}
                    onSubmit={handleUploadNewCiting}
                    maxYear={yearNum}
                  />
                )}
              </div>

              {/* この論文を引用している論文 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  この論文を引用している論文
                  <span className="text-xs font-normal text-gray-400 ml-2">（{yearNum}年以降）</span>
                  {selectedCitedBy.size > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      {selectedCitedBy.size}件選択中
                    </span>
                  )}
                </h3>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {citedByList.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">該当する論文がありません</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {citedByList.map(p => (
                        <PaperRow
                          key={p.id}
                          paper={p}
                          checked={selectedCitedBy.has(p.id)}
                          onToggle={() => toggleCitedBy(p.id)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => !analyzing && setShowNewCitedBy(v => !v)}
                  disabled={analyzing}
                  className="mt-2 text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + 新しい論文をアップロード
                </button>
                {showNewCitedBy && (
                  <InlineUploadForm
                    form={newCitedBy}
                    onChange={setNewCitedBy}
                    fileRef={newCitedByFileRef}
                    loading={newCitedByLoading}
                    onSubmit={handleUploadNewCitedBy}
                    minYear={yearNum}
                  />
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
              <button
                onClick={goToStep2}
                disabled={titleLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                次へ（引用確認）
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                disabled={analyzing}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                戻る
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || analyzing}
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
