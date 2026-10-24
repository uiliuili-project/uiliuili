'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Check, UserPlus } from 'lucide-react';
import { useState } from 'react';

export function FollowButton({
  userId,
  initialFollowing,
  isSelf,
}: {
  userId: string;
  initialFollowing: boolean;
  isSelf?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (isSelf) return null;

  const toggle = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (following) await api.delete(`/api/v1/users/${userId}/follow`);
      else await api.post(`/api/v1/users/${userId}/follow`);
      setFollowing((value) => !value);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
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
          'h-9 rounded-full px-5 text-sm font-medium transition',
          following
            ? 'border border-line bg-white text-muted hover:border-red-200 hover:text-red-500'
            : 'bg-brand text-white hover:bg-brand-dark',
        )}
      >
        {following ? (
          <>
            <Check className="mr-1 inline h-4 w-4" />
            已关注
          </>
        ) : (
          <>
            <UserPlus className="mr-1 inline h-4 w-4" />
            关注
          </>
        )}
      </button>
      {message && <p className="mt-1 text-xs text-red-500">{message}</p>}
    </div>
  );
}
