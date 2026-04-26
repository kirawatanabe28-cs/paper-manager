import type { UrlItem } from '../types';

interface Props {
  urls: UrlItem[];
  onChange: (urls: UrlItem[]) => void;
}

export default function UrlListEditor({ urls, onChange }: Props) {
  const add = () => onChange([...urls, { url: '', label: '' }]);

  const update = (index: number, field: keyof UrlItem, value: string) => {
    const next = urls.map((u, i) => i === index ? { ...u, [field]: value } : u);
    onChange(next);
  };

  const remove = (index: number) => onChange(urls.filter((_, i) => i !== index));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        関連URL（任意・複数登録可）
      </label>

      {urls.length === 0 && (
        <p className="text-xs text-gray-400 mb-2">URLが登録されていません</p>
      )}

      <div className="space-y-2">
        {urls.map((u, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={u.label}
              onChange={e => update(i, 'label', e.target.value)}
              placeholder="ラベル（例: PDF, DOI, arXiv）"
              className="w-28 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="url"
              value={u.url}
              onChange={e => update(i, 'url', e.target.value)}
              placeholder="https://..."
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-gray-400 hover:text-red-500 shrink-0 px-1"
              title="削除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 text-sm text-blue-600 hover:underline"
      >
        + URLを追加
      </button>
    </div>
  );
}
