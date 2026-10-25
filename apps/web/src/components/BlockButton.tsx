'use client';
import { useT } from './I18nProvider';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ShieldOff } from 'lucide-react';
import { useState } from 'react';

export function BlockButton({
  userId,
  initialBlocked,
  isSelf,
}: {
  userId: string;
  initialBlocked: boolean;
  isSelf?: boolean;
}) {
  const t = useT();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (isSelf) return null;

  const toggle = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (blocked) await api.delete(`/api/v1/me/blocks/${userId}`);
      else await api.post(`/api/v1/me/blocks/${userId}`);
      setBlocked((value) => !value);
      setMessage(blocked ? t('已解除屏蔽') : t('已屏蔽该用户'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={loading}
        className={cn(
          'h-9 rounded-full border border-line bg-white px-4 text-sm font-medium text-muted transition',
          blocked ? 'text-brand' : 'hover:border-red-200 hover:text-red-500',
        )}
      >
        <ShieldOff className="mr-1 inline h-4 w-4" />
        {blocked ? t('解除屏蔽') : t('屏蔽该用户')}
      </button>
      {message && <p className="mt-1 text-xs text-muted">{message}</p>}
    </div>
  );
}
