const COVER_WIDTH = 1920;
const COVER_HEIGHT = 480;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Rejects formats and sizes the server would refuse anyway. */
export function assertImageFile(file: File, maxMb = 10): void {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('图片只支持 JPEG、PNG 或 WebP');
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`图片不能超过 ${maxMb} MB`);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败'));
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Centre-crops an uploaded image to the 4:1 space cover ratio and encodes it as
 * WebP so the stored file stays small regardless of the original size.
 */
export async function cropCover(file: File): Promise<Blob> {
  assertImageFile(file, 20);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持图片处理');
    context.fillStyle = '#f1f2f3';
    context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
    const scale = Math.max(COVER_WIDTH / image.width, COVER_HEIGHT / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (COVER_WIDTH - width) / 2, (COVER_HEIGHT - height) / 2, width, height);
    const webp = await toBlob(canvas, 'image/webp', 0.9);
    if (webp) return webp;
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.9);
    if (jpeg) return jpeg;
    throw new Error('图片处理失败');
  } finally {
    URL.revokeObjectURL(url);
  }
}
