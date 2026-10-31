'use client';
import { useLocale, useT } from './I18nProvider';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { DanmakuEngine, type DanmakuOptions } from '@uiliuili/danmaku';
import type { DanmakuItem, VideoDetail } from '@uiliuili/shared';
import Hls from 'hls.js';
import {
  ArrowLeftRight,
  Flag,
  ListVideo,
  Maximize,
  MessageSquare,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Send,
  Settings2,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';

interface SegmentResponse {
  items: DanmakuItem[];
  segment: number;
}

const defaultOptions: DanmakuOptions = {
  opacity: 0.9,
  fontSize: 25,
  speed: 6,
  displayArea: 0.75,
  scrollEnabled: true,
  topEnabled: true,
  bottomEnabled: true,
  bold: false,
  fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  shadow: true,
  blockedWords: [],
  blockedUsers: [],
};

const COLORS = [
  '#ffffff',
  '#fe0302',
  '#ff7204',
  '#ffaa02',
  '#ffd302',
  '#ffff00',
  '#a0ee00',
  '#00cd00',
  '#019899',
  '#4266be',
  '#89d5ff',
  '#cc0273',
  '#222222',
];

function timeLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function readBlockedUsers(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('uiliuili:danmaku-blocked-users') ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function DanmakuPlayer({ video }: { video: VideoDetail }) {
  const t = useT();
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DanmakuEngine | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const rafRef = useRef<number | null>(null);
  const loadedSegments = useRef(new Set<number>());
  const lastSaved = useRef(0);
  const viewed = useRef(new Set<string>());
  const autoPlayNext = useRef(false);

  const playableParts = useMemo(
    () => video.parts.filter((part) => Boolean(part.playlistUrl)),
    [video.parts],
  );
  const initialPart = useMemo(() => {
    if (video.progressPartId) {
      const found = video.parts.find((part) => part.id === video.progressPartId);
      if (found) return found;
    }
    return playableParts[0] ?? null;
  }, [video.parts, video.progressPartId, playableParts]);

  const [activePartId, setActivePartId] = useState<string | null>(initialPart?.id ?? null);
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [levels, setLevels] = useState<Array<{ index: number; height: number }>>([]);
  const [quality, setQuality] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; name: string }>>([]);
  const [audioTrack, setAudioTrack] = useState(0);
  const [danmakuOn, setDanmakuOn] = useState(video.status !== 'failed');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [options, setOptions] = useState<DanmakuOptions>(defaultOptions);
  const [viewers, setViewers] = useState(0);
  const [message, setMessage] = useState('');
  const [sendText, setSendText] = useState('');
  const [sendMode, setSendMode] = useState<'scroll' | 'top' | 'bottom'>('scroll');
  const [sendColor, setSendColor] = useState('#ffffff');
  const [sendPool, setSendPool] = useState<'normal' | 'subtitle' | 'special'>('normal');
  const [sending, setSending] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [webFullscreen, setWebFullscreen] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** A freshly signed node URL, used after the previous one expired. */
  const [remoteSource, setRemoteSource] = useState<{ key: string; url: string } | null>(null);
  const refreshingSource = useRef(false);

  const activePart = useMemo(
    () => video.parts.find((part) => part.id === activePartId) ?? initialPart,
    [video.parts, activePartId, initialPart],
  );
  const activeIndex = video.parts.findIndex((part) => part.id === activePart?.id);
  const nextPart = activeIndex >= 0 ? video.parts[activeIndex + 1] : undefined;
  const sourceKey = activePart?.id ?? 'main';
  const source =
    remoteSource?.key === sourceKey
      ? remoteSource.url
      : (activePart?.playlistUrl ?? video.playlistUrl);

  /**
   * Node playback URLs live for a few minutes. When a segment request comes
   * back 401/403, ask the site for a new signature instead of failing the
   * video; at most one refresh runs at a time.
   */
  const refreshRemoteSource = useCallback(async () => {
    if (refreshingSource.current) return;
    refreshingSource.current = true;
    try {
      const query = activePartId ? `?partId=${encodeURIComponent(activePartId)}` : '';
      const data = await api.get<{ playlistUrl: string | null }>(
        `/api/v1/videos/${video.id}/playlist${query}`,
      );
      if (data.playlistUrl) {
        setRemoteSource({ key: activePartId ?? 'main', url: data.playlistUrl });
        setError(null);
      } else {
        setError(t('视频加载失败，请稍后重试'));
      }
    } catch {
      setError(t('视频加载失败，请稍后重试'));
    } finally {
      refreshingSource.current = false;
    }
  }, [activePartId, t, video.id]);

  useEffect(() => {
    setBlockedUsers(readBlockedUsers());
    setAutoplay(localStorage.getItem('uiliuili:autoplay') !== 'false');
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const stored = localStorage.getItem('uiliuili:danmaku-options');
    let initial = defaultOptions;
    if (stored) {
      try {
        initial = { ...defaultOptions, ...(JSON.parse(stored) as Partial<DanmakuOptions>) };
      } catch {}
    }
    setOptions(initial);
    engineRef.current = new DanmakuEngine(canvasRef.current, initial);
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Push the filtered list into the engine. Blocking a user removes their past danmaku too.
  useEffect(() => {
    const filtered = items.filter((item) => !blockedUsers.includes(item.userHash));
    engineRef.current?.setItems(filtered);
    engineRef.current?.setTime((videoRef.current?.currentTime ?? 0) * 1000);
  }, [items, blockedUsers]);

  useEffect(() => {
    engineRef.current?.setOptions({ ...options, opacity: danmakuOn ? options.opacity : 0 });
    localStorage.setItem('uiliuili:danmaku-options', JSON.stringify(options));
  }, [options, danmakuOn]);

  const loadSegment = async (partKey: string | null, segment: number) => {
    if (loadedSegments.current.has(segment)) return;
    loadedSegments.current.add(segment);
    try {
      const query = new URLSearchParams({ segment: String(segment) });
      if (partKey) query.set('partId', partKey);
      const data = await api.get<SegmentResponse>(
        `/api/v1/videos/${video.id}/danmaku?${query.toString()}`,
      );
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...data.items.filter((item) => !seen.has(item.id))];
      });
    } catch {
      loadedSegments.current.delete(segment);
    }
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !source) return;
    setError(null);
    setLevels([]);
    setAudioTracks([]);
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(source);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels.map((level, index) => ({ index, height: level.height })));
        setAudioTracks(
          hls.audioTracks.map((track, index) => ({
            id: index,
            name: track.name || track.lang || `音轨 ${index + 1}`,
          })),
        );
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        setAudioTracks(
          hls.audioTracks.map((track, index) => ({
            id: index,
            name: track.name || track.lang || `音轨 ${index + 1}`,
          })),
        );
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        const status = data.response?.code;
        if (status === 401 || status === 403) {
          void refreshRemoteSource();
          return;
        }
        if (data.fatal) setError(t('视频加载失败，请稍后重试'));
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }
    videoEl.src = source;
    const onNativeError = () => {
      void refreshRemoteSource();
    };
    videoEl.addEventListener('error', onNativeError);
    return () => videoEl.removeEventListener('error', onNativeError);
  }, [refreshRemoteSource, source, t]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/danmaku`, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.emit('join', { videoId: video.id, partId: activePartId });
    socket.on(
      'danmaku',
      (event: { videoId: string; partId?: string | null; item: DanmakuItem }) => {
        if (event.videoId !== video.id) return;
        if ((event.partId ?? null) !== (activePartId ?? null)) return;
        setItems((current) =>
          current.some((item) => item.id === event.item.id) ? current : [...current, event.item],
        );
      },
    );
    socket.on('viewers', (data: { videoId: string; partId?: string | null; count: number }) => {
      if (data.videoId === video.id) setViewers(data.count);
    });
    socket.on('blocked', (data: { message?: string }) => {
      setMessage(data.message ?? t('发送失败'));
    });
    return () => {
      socket.emit('leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [video.id, activePartId]);

  // Reset part-scoped state when the active part changes.
  useEffect(() => {
    loadedSegments.current = new Set();
    setItems([]);
    engineRef.current?.clear();
    if (activePartId) {
      void api
        .get<{ items: DanmakuItem[] }>(
          `/api/v1/videos/${video.id}/danmaku/list?partId=${encodeURIComponent(activePartId)}`,
        )
        .then((data) => setItems(data.items))
        .catch(() => undefined);
    } else {
      void api
        .get<{ items: DanmakuItem[] }>(`/api/v1/videos/${video.id}/danmaku/list`)
        .then((data) => setItems(data.items))
        .catch(() => undefined);
    }
  }, [activePartId, video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onLoaded = () => {
      setDuration(el.duration || video.durationSeconds);
      if (
        video.progressMs > 5000 &&
        video.progressMs < (el.duration || video.durationSeconds) * 1000 - 5000
      ) {
        el.currentTime = video.progressMs / 1000;
      }
      if (autoPlayNext.current) {
        autoPlayNext.current = false;
        void el.play().catch(() => undefined);
      }
      Array.from(el.textTracks).forEach((track) => {
        track.mode = subtitlesOn ? 'showing' : 'hidden';
      });
    };
    const onTime = () => {
      const time = el.currentTime;
      setCurrentTime(time);
      const segment = Math.floor((time * 1000) / (6 * 60 * 1000));
      void loadSegment(activePartId, segment);
      void loadSegment(activePartId, segment + 1);
      if (Date.now() - lastSaved.current > 10_000) {
        lastSaved.current = Date.now();
        void api
          .post(`/api/v1/videos/${video.id}/progress`, {
            positionMs: Math.floor(time * 1000),
            durationMs: Math.floor((el.duration || 0) * 1000),
            completed: false,
            ...(activePartId ? { partId: activePartId } : {}),
          })
          .catch(() => undefined);
      }
    };
    const onPlay = () => {
      setPlaying(true);
      if (!viewed.current.has(activePartId ?? 'legacy')) {
        viewed.current.add(activePartId ?? 'legacy');
        const query = activePartId ? `?partId=${encodeURIComponent(activePartId)}` : '';
        void api.get(`/api/v1/videos/${video.id}/playlist${query}`).catch(() => undefined);
      }
      const tick = () => {
        if (videoRef.current) {
          engineRef.current?.setTime(videoRef.current.currentTime * 1000);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      engineRef.current?.setTime(el.currentTime * 1000);
    };
    const onSeeked = () => {
      engineRef.current?.setTime(el.currentTime * 1000);
      const segment = Math.floor((el.currentTime * 1000) / (6 * 60 * 1000));
      void loadSegment(activePartId, segment);
    };
    const onEnded = () => {
      void api
        .post(`/api/v1/videos/${video.id}/progress`, {
          positionMs: Math.floor(el.duration * 1000),
          durationMs: Math.floor(el.duration * 1000),
          completed: true,
          ...(activePartId ? { partId: activePartId } : {}),
        })
        .catch(() => undefined);
      if (autoplay && nextPart?.playlistUrl) switchPart(nextPart.id);
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('ended', onEnded);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [
    video.id,
    video.progressMs,
    video.durationSeconds,
    activePartId,
    autoplay,
    nextPart,
    subtitlesOn,
  ]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    el.playbackRate = speed;
  }, [volume, muted, speed]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    Array.from(el.textTracks).forEach((track) => {
      track.mode = subtitlesOn ? 'showing' : 'hidden';
    });
  }, [subtitlesOn, source]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlay();
      }
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      if (event.key.toLowerCase() === 'w') setWebFullscreen((value) => !value);
      if (event.key.toLowerCase() === 'd') setDanmakuOn((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const switchPart = (partId: string | null) => {
    if (partId === activePartId) return;
    autoPlayNext.current = true;
    setActivePartId(partId);
  };

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) await el.play().catch(() => undefined);
    else el.pause();
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await container.requestFullscreen().catch(() => undefined);
  };

  const togglePictureInPicture = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      setMessage(t('当前浏览器不支持画中画'));
    }
  };

  const blockUser = (userHash: string) => {
    const next = [...new Set([...blockedUsers, userHash])];
    setBlockedUsers(next);
    localStorage.setItem('uiliuili:danmaku-blocked-users', JSON.stringify(next));
    setMessage(t('已屏蔽该用户的弹幕'));
  };

  const reportDanmaku = async (item: DanmakuItem) => {
    try {
      await api.post(`/api/v1/videos/${video.id}/report`, {
        targetType: 'danmaku',
        targetId: item.id,
        reason: 'other',
      });
      setMessage(t('举报已提交，我们会尽快处理'));
    } catch (reportError) {
      setMessage(reportError instanceof Error ? reportError.message : t('操作失败'));
    }
  };

  const sendDanmaku = async () => {
    const text = sendText.trim();
    if (!text) return;
    setSending(true);
    setMessage('');
    try {
      const payload = {
        videoId: video.id,
        progressMs: Math.floor((videoRef.current?.currentTime ?? 0) * 1000),
        mode: sendMode,
        pool: sendPool,
        color: sendColor,
        fontSize: options.fontSize,
        content: text,
        ...(activePartId ? { partId: activePartId } : {}),
      };
      const socket = socketRef.current;
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket
            .timeout(5000)
            .emit(
              'send',
              payload,
              (err: Error | null, response: { ok: boolean; error?: string }) => {
                if (err) return reject(err);
                if (!response?.ok) return reject(new Error(response?.error ?? t('发送失败')));
                resolve();
              },
            );
        });
      } else {
        const response = await api.post<{ item: DanmakuItem }>(
          `/api/v1/videos/${video.id}/danmaku`,
          payload,
        );
        setItems((current) =>
          current.some((item) => item.id === response.item.id)
            ? current
            : [...current, response.item],
        );
      }
      setSendText('');
      setMessage(t('弹幕已发送'));
    } catch (sendError) {
      setMessage(sendError instanceof Error ? sendError.message : t('发送失败'));
    } finally {
      setSending(false);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const visibleItems = items.filter((item) => !blockedUsers.includes(item.userHash));

  if (!source) {
    return (
      <div className="relative overflow-hidden rounded-xl2 bg-black">
        <div className="aspect-video">
          {video.coverUrl && (
            <img src={video.coverUrl} alt="" className="h-full w-full object-cover opacity-50" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <p className="text-lg font-semibold">
              {video.status === 'processing' || video.status === 'uploading'
                ? t('视频正在处理中')
                : video.status === 'failed'
                  ? t('视频处理失败')
                  : t('视频暂不可播放')}
            </p>
            <p className="mt-2 text-sm text-white/65">{t('请稍后刷新页面')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className={cn(
          'player-shell group relative overflow-hidden bg-black',
          webFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-xl2',
        )}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => playing && setShowControls(false)}
      >
        <video
          ref={videoRef}
          className={cn('w-full bg-black', webFullscreen ? 'h-full' : 'aspect-video')}
          playsInline
          poster={video.coverUrl ?? undefined}
          onClick={() => void togglePlay()}
          onDoubleClick={() => void toggleFullscreen()}
        >
          {video.subtitles.map((subtitle) => (
            <track
              key={subtitle.language}
              kind="subtitles"
              src={subtitle.url}
              srcLang={subtitle.language}
              label={subtitle.label}
            />
          ))}
        </video>
        <canvas ref={canvasRef} className="danmaku-canvas" />

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-10 text-white transition',
            showControls || !playing ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="relative mb-2 h-1.5 rounded-full bg-white/25">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand"
              style={{ width: `${progressPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={0.1}
              value={currentTime}
              onChange={(event) => {
                const el = videoRef.current;
                if (el) el.currentTime = Number(event.target.value);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={t('播放进度')}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => void togglePlay()}
              className="rounded p-1 hover:bg-white/15"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              className="rounded p-1 hover:bg-white/15"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                setVolume(Number(event.target.value));
                setMuted(false);
              }}
              className="hidden w-20 accent-[#fb7299] sm:block"
              aria-label={t('音量')}
            />
            <span className="tabular-nums text-xs text-white/85">
              {timeLabel(currentTime)} / {timeLabel(duration)}
            </span>
            {viewers > 0 && (
              <span className="ml-1 text-xs text-white/55">
                {viewers} {t('人在看')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDanmakuOn((value) => !value)}
                className={cn(
                  'rounded p-1 hover:bg-white/15',
                  danmakuOn ? 'text-brand' : 'text-white/60',
                )}
                title={t('弹幕开关')}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setListOpen((value) => !value)}
                className={cn('rounded p-1 hover:bg-white/15', listOpen && 'text-brand')}
                title={t('弹幕列表')}
              >
                <ListVideo className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="rounded p-1 hover:bg-white/15"
                title={t('弹幕设置')}
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <select
                value={quality}
                onChange={(event) => {
                  const level = Number(event.target.value);
                  setQuality(level);
                  if (hlsRef.current) hlsRef.current.currentLevel = level;
                }}
                className="rounded bg-black/40 px-1.5 py-1 text-xs text-white outline-none"
              >
                <option value={-1}>{t('自动')}</option>
                {levels.map((level) => (
                  <option key={level.index} value={level.index}>
                    {level.height}p
                  </option>
                ))}
              </select>
              {audioTracks.length > 1 && (
                <select
                  value={audioTrack}
                  onChange={(event) => {
                    const index = Number(event.target.value);
                    setAudioTrack(index);
                    if (hlsRef.current) hlsRef.current.audioTrack = index;
                  }}
                  className="rounded bg-black/40 px-1.5 py-1 text-xs text-white outline-none"
                  title={t('音轨')}
                >
                  {audioTracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="rounded bg-black/40 px-1.5 py-1 text-xs text-white outline-none"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <option key={value} value={value}>
                    {value}x
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSubtitlesOn((value) => !value)}
                className={cn(
                  'rounded p-1 hover:bg-white/15',
                  subtitlesOn ? 'text-brand' : 'text-white/60',
                )}
                title={t('字幕')}
              >
                <Subtitles className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void togglePictureInPicture()}
                className="rounded p-1 hover:bg-white/15"
                title={t('画中画')}
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
              {nextPart?.playlistUrl && (
                <button
                  type="button"
                  onClick={() => switchPart(nextPart.id)}
                  className="rounded p-1 hover:bg-white/15"
                  title={t('下一P')}
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setWebFullscreen((value) => !value)}
                className={cn('rounded p-1 hover:bg-white/15', webFullscreen && 'text-brand')}
                title={t('网页全屏')}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="rounded p-1 hover:bg-white/15"
                title={t('全屏')}
              >
                {webFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {webFullscreen && (
          <button
            type="button"
            onClick={() => setWebFullscreen(false)}
            className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"
            title={t('退出网页全屏')}
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {listOpen && (
          <div className="motion-slide-in-right absolute bottom-20 right-3 top-3 w-72 overflow-hidden rounded-xl bg-black/85 text-xs text-white shadow-float backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="font-semibold">
                {t('弹幕列表')}（{visibleItems.length}）
              </span>
              <button type="button" onClick={() => setListOpen(false)} className="text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin max-h-[calc(100%-40px)] overflow-y-auto p-1">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-start gap-2 rounded px-2 py-1.5 hover:bg-white/10"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const el = videoRef.current;
                      if (el) el.currentTime = item.progressMs / 1000;
                    }}
                    className="shrink-0 tabular-nums text-white/55"
                  >
                    {timeLabel(item.progressMs / 1000)}
                  </button>
                  <span className="min-w-0 flex-1 break-words" style={{ color: item.color }}>
                    {item.content}
                  </span>
                  <span className="hidden shrink-0 gap-1 group-hover:flex">
                    <button
                      type="button"
                      onClick={() => blockUser(item.userHash)}
                      className="text-white/55 hover:text-white"
                      title={t('屏蔽该用户')}
                    >
                      <Minimize className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void reportDanmaku(item)}
                      className="text-white/55 hover:text-white"
                      title={t('举报')}
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="motion-slide-in-right absolute right-3 top-3 w-80 rounded-xl bg-black/85 p-4 text-xs text-white shadow-float backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">{t('弹幕设置')}</span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-white/60"
              >
                {t('关闭')}{' '}
              </button>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-1">
              {(['scroll', 'top', 'bottom'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setOptions((current) => ({
                      ...current,
                      scrollEnabled:
                        mode === 'scroll' ? !current.scrollEnabled : current.scrollEnabled,
                    }))
                  }
                  className={cn(
                    'rounded border border-white/15 px-2 py-1',
                    options.scrollEnabled === (mode === 'scroll') ? 'bg-white/20' : '',
                  )}
                >
                  {t(mode === 'scroll' ? '滚动' : mode === 'top' ? '顶部' : '底部')}
                </button>
              ))}
            </div>
            <label className="mb-3 flex items-center justify-between">
              <span>{t('自动连播')}</span>
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(event) => {
                  setAutoplay(event.target.checked);
                  localStorage.setItem(
                    'uiliuili:autoplay',
                    event.target.checked ? 'true' : 'false',
                  );
                }}
                className="accent-[#fb7299]"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 flex justify-between">
                <span>{t('不透明度')}</span>
                <span>{Math.round(options.opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={options.opacity}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, opacity: Number(event.target.value) }))
                }
                className="w-full accent-[#fb7299]"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 flex justify-between">
                <span>{t('字号')}</span>
                <span>{options.fontSize}px</span>
              </span>
              <input
                type="range"
                min={14}
                max={40}
                step={1}
                value={options.fontSize}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, fontSize: Number(event.target.value) }))
                }
                className="w-full accent-[#fb7299]"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 flex justify-between">
                <span>{t('速度')}</span>
                <span>{options.speed}</span>
              </span>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={options.speed}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, speed: Number(event.target.value) }))
                }
                className="w-full accent-[#fb7299]"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 flex justify-between">
                <span>{t('显示区域')}</span>
                <span>{Math.round(options.displayArea * 100)}%</span>
              </span>
              <input
                type="range"
                min={0.25}
                max={1}
                step={0.05}
                value={options.displayArea}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    displayArea: Number(event.target.value),
                  }))
                }
                className="w-full accent-[#fb7299]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block">{t('屏蔽词（逗号分隔）')}</span>
              <input
                value={options.blockedWords.join(',')}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    blockedWords: event.target.value
                      .split(',')
                      .map((word) => word.trim())
                      .filter(Boolean),
                  }))
                }
                className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-white outline-none"
              />
            </label>
            {blockedUsers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBlockedUsers([]);
                  localStorage.removeItem('uiliuili:danmaku-blocked-users');
                }}
                className="mt-3 text-white/60 hover:text-white"
              >
                {t('清除已屏蔽用户')}（{blockedUsers.length}）
              </button>
            )}
          </div>
        )}
      </div>

      {video.parts.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {video.parts.map((part, index) => (
            <button
              key={part.id ?? `legacy-${index}`}
              type="button"
              disabled={!part.playlistUrl}
              onClick={() => switchPart(part.id)}
              className={cn(
                'chip',
                part.id === activePart?.id &&
                  'chip-active border-brand bg-brand-light text-brand-dark',
                !part.playlistUrl && 'opacity-50',
              )}
            >
              P{index + 1} {part.title}
            </button>
          ))}
        </div>
      )}

      {video.allowDanmaku === false ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl2 border border-line bg-canvas px-3 py-2.5 text-xs text-muted">
          <MessageSquare className="h-4 w-4" />
          {t('作者已关闭这篇稿件的弹幕。')}
        </div>
      ) : (
        <div className="mt-3 rounded-xl2 border border-line bg-white p-2">
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2 text-xs text-muted">
            <select
              value={sendMode}
              onChange={(event) => setSendMode(event.target.value as typeof sendMode)}
              className="rounded border border-line bg-white px-1.5 py-1 text-xs outline-none"
              title={t('弹幕类型')}
            >
              <option value="scroll">{t('滚动')}</option>
              <option value="top">{t('顶部')}</option>
              <option value="bottom">{t('底部')}</option>
            </select>
            <select
              value={sendPool}
              onChange={(event) => setSendPool(event.target.value as typeof sendPool)}
              className="rounded border border-line bg-white px-1.5 py-1 text-xs outline-none"
              title={t('弹幕池')}
            >
              <option value="normal">{t('普通弹幕')}</option>
              <option value="subtitle">{t('字幕弹幕')}</option>
              <option value="special">{t('特殊弹幕')}</option>
            </select>
            <div className="flex items-center gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSendColor(color)}
                  className={cn(
                    'h-4 w-4 rounded-full border',
                    sendColor === color ? 'border-brand ring-2 ring-brand/30' : 'border-line',
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={sendText}
              onChange={(event) => setSendText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void sendDanmaku();
              }}
              maxLength={100}
              placeholder={t('发个弹幕见证当下')}
              className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void sendDanmaku()}
              disabled={sending || !sendText.trim()}
              className="btn-primary h-9 rounded-full px-4"
            >
              <Send className="h-4 w-4" />
              {t('发送')}{' '}
            </button>
          </div>
        </div>
      )}
      {(message || error) && (
        <p className={cn('mt-2 text-xs', error ? 'text-red-500' : 'text-muted')}>
          {error ?? message}
        </p>
      )}
      <div className="mt-2 text-xs text-muted">
        {formatCount(video.danmaku, locale)} {t('条弹幕 · 当前')} {viewers} {t('人在看')}{' '}
      </div>
    </div>
  );
}
