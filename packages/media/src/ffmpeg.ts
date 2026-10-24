import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ProbeResult, RenditionPlan, TranscodeProgress, TranscodeResult } from './types';

const LADDER: Array<{ height: number; videoBitrate: number; audioBitrate: number }> = [
  { height: 360, videoBitrate: 800_000, audioBitrate: 96_000 },
  { height: 480, videoBitrate: 1_400_000, audioBitrate: 128_000 },
  { height: 720, videoBitrate: 2_800_000, audioBitrate: 128_000 },
  { height: 1080, videoBitrate: 5_000_000, audioBitrate: 160_000 },
  { height: 1440, videoBitrate: 9_000_000, audioBitrate: 192_000 },
  { height: 2160, videoBitrate: 18_000_000, audioBitrate: 192_000 },
];

function run(command: string, args: string[], onLine?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const handle = (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (stderr.length > 32_000) stderr = stderr.slice(-16_000);
      if (onLine) {
        for (const line of text.split(/\r?\n/)) if (line) onLine(line);
      }
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export interface FfmpegOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
}

export async function probeVideo(file: string, options: FfmpegOptions = {}): Promise<ProbeResult> {
  const ffprobe = options.ffprobePath ?? process.env.FFPROBE_PATH ?? 'ffprobe';
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffprobe,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr.slice(-1000)}`));
        return;
      }
      try {
        const data = JSON.parse(stdout) as {
          format?: { duration?: string; size?: string; bit_rate?: string };
          streams?: Array<{
            codec_type?: string;
            codec_name?: string;
            width?: number;
            height?: number;
            duration?: string;
          }>;
        };
        const video = data.streams?.find((stream) => stream.codec_type === 'video');
        const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
        if (!video) throw new Error('The file has no video stream');
        resolve({
          durationSeconds: Math.round(Number(data.format?.duration ?? video.duration ?? 0)),
          width: video.width ?? 0,
          height: video.height ?? 0,
          bitrate: Number(data.format?.bit_rate ?? 0),
          videoCodec: video.codec_name ?? 'unknown',
          audioCodec: audio?.codec_name ?? null,
          hasAudio: Boolean(audio),
          sizeBytes: Number(data.format?.size ?? 0),
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function buildLadder(sourceHeight: number, aspectRatio = 16 / 9): RenditionPlan[] {
  const max = Math.max(360, sourceHeight);
  const selected = LADDER.filter((item) => item.height <= max);
  if (selected.length === 0) selected.push(LADDER[0]!);
  return selected.map((item) => {
    const height = Math.min(item.height, max);
    const width = Math.max(2, Math.round((height * aspectRatio) / 2) * 2);
    return {
      quality: `${height}p`,
      width,
      height,
      videoBitrate: item.videoBitrate,
      audioBitrate: item.audioBitrate,
    };
  });
}

function parseProgress(line: string, callback?: (percent: number) => void): void {
  const match = line.match(/^out_time_ms=(\d+)/);
  if (match) {
    const ms = Number(match[1]);
    if (Number.isFinite(ms) && callback) callback(ms);
  }
}

export async function transcodeToHls(
  input: string,
  outputDir: string,
  options: FfmpegOptions & {
    maxHeight?: number;
    onProgress?: (progress: TranscodeProgress) => void;
  } = {},
): Promise<TranscodeResult> {
  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';
  const probe = await probeVideo(input, options);
  options.onProgress?.({ stage: 'probe', percent: 5 });
  const sourceHeight = probe.height || 1080;
  const sourceAspect = probe.width && probe.height ? probe.width / probe.height : 16 / 9;
  const cap = Math.min(options.maxHeight ?? 1080, sourceHeight);
  const ladder = buildLadder(cap, sourceAspect);
  await fsp.mkdir(outputDir, { recursive: true });

  const renditions: TranscodeResult['renditions'] = [];
  const totalDurationMs = Math.max(1, probe.durationSeconds * 1000);
  for (let index = 0; index < ladder.length; index += 1) {
    const plan = ladder[index]!;
    const directory = path.join(outputDir, plan.quality);
    await fsp.mkdir(directory, { recursive: true });
    const args = [
      '-y',
      '-i',
      input,
      '-vf',
      `scale=-2:${plan.height}:flags=lanczos`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-profile:v',
      'main',
      '-crf',
      '21',
      '-maxrate',
      String(plan.videoBitrate),
      '-bufsize',
      String(plan.videoBitrate * 2),
      '-g',
      '48',
      '-keyint_min',
      '48',
      '-sc_threshold',
      '0',
      '-c:a',
      'aac',
      '-b:a',
      String(plan.audioBitrate),
      '-ac',
      '2',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_flags',
      'independent_segments',
      '-hls_segment_filename',
      path.join(directory, 'segment_%04d.ts'),
      '-progress',
      'pipe:1',
      '-nostats',
      path.join(directory, 'index.m3u8'),
    ];
    await run(ffmpeg, args, (line) => {
      parseProgress(line, (ms) => {
        const current = Math.min(1, ms / totalDurationMs);
        const overall = (index + current) / ladder.length;
        options.onProgress?.({
          stage: 'video',
          percent: Math.round(5 + overall * 80),
          rendition: plan.quality,
        });
      });
    });
    renditions.push({
      ...plan,
      directory,
      playlist: path.join(directory, 'index.m3u8'),
    });
  }

  const masterPath = path.join(outputDir, 'master.m3u8');
  const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const rendition of renditions) {
    const bandwidth = rendition.videoBitrate + rendition.audioBitrate;
    masterLines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${rendition.width}x${rendition.height},NAME="${rendition.quality}"`,
      `${rendition.quality}/index.m3u8`,
    );
  }
  await fsp.writeFile(masterPath, `${masterLines.join('\n')}\n`);

  const coverPath = path.join(outputDir, 'cover.jpg');
  await run(ffmpeg, [
    '-y',
    '-ss',
    String(Math.min(1, Math.max(0, probe.durationSeconds / 10))),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:-2',
    '-q:v',
    '3',
    coverPath,
  ]);
  options.onProgress?.({ stage: 'cover', percent: 90 });

  let spritePath: string | null = null;
  let previewVttPath: string | null = null;
  try {
    spritePath = path.join(outputDir, 'sprite.jpg');
    await run(ffmpeg, [
      '-y',
      '-i',
      input,
      '-vf',
      'fps=1/10,scale=160:-2,tile=10x10',
      '-frames:v',
      '1',
      '-q:v',
      '5',
      spritePath,
    ]);
    const frames = Math.max(1, Math.ceil(probe.durationSeconds / 10));
    const vttLines = ['WEBVTT', ''];
    for (let index = 0; index < frames; index += 1) {
      const start = index * 10;
      const end = start + 10;
      const x = (index % 10) * 160;
      const y = Math.floor(index / 10) * 90;
      vttLines.push(
        `${formatVttTime(start)} --> ${formatVttTime(end)}`,
        `sprite.jpg#xywh=${x},${y},160,90`,
        '',
      );
    }
    previewVttPath = path.join(outputDir, 'preview.vtt');
    await fsp.writeFile(previewVttPath, vttLines.join('\n'));
  } catch {
    spritePath = null;
    previewVttPath = null;
  }

  options.onProgress?.({ stage: 'complete', percent: 100 });
  return {
    masterPlaylist: masterPath,
    renditions,
    coverPath,
    spritePath,
    previewVttPath,
    durationSeconds: probe.durationSeconds,
  };
}

export async function extractCover(
  input: string,
  output: string,
  atSeconds = 1,
  options: FfmpegOptions = {},
): Promise<void> {
  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';
  await fsp.mkdir(path.dirname(output), { recursive: true });
  await run(ffmpeg, [
    '-y',
    '-ss',
    String(Math.max(0, atSeconds)),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:-2',
    '-q:v',
    '3',
    output,
  ]);
}

export async function checkFfmpeg(
  options: FfmpegOptions = {},
): Promise<{ ffmpeg: string; ffprobe: string }> {
  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';
  const ffprobe = options.ffprobePath ?? process.env.FFPROBE_PATH ?? 'ffprobe';
  await run(ffmpeg, ['-version']);
  await run(ffprobe, ['-version']);
  return { ffmpeg, ffprobe };
}

function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
