'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewColumnPage() {
  const t = useT();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!title.trim()) {
      setError(t('请先填写标题'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.post<{ id: string }>('/api/v1/studio/articles', {
        title: title.trim(),
        summary: summary.trim(),
        content,
      });
      router.push(`/studio/columns/${created.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('创建失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('写专栏')}</h2>
        <p className="mt-1 text-sm text-muted">{t('支持 Markdown 排版，保存后可继续编辑。')}</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="card grid gap-4 p-5">
        <label className="grid gap-1.5">
          <span className="label">{t('标题')}</span>
          <input
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            className="input"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="label">{t('摘要')}</span>
          <textarea
            value={summary}
            maxLength={300}
            rows={2}
            onChange={(event) => setSummary(event.target.value)}
            className="input resize-y"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="label">{t('正文')}</span>
          <textarea
            value={content}
            rows={16}
            onChange={(event) => setContent(event.target.value)}
            className="input resize-y font-mono text-sm"
            placeholder={t('开始写作…')}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={() => void create()}
            className="btn-primary"
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('创建专栏')}
          </button>
        </div>
      </div>
    </div>
  );
}
