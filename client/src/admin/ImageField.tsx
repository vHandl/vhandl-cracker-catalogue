import { useRef, useState } from 'react';
import { adminApi } from '../api';
import ProductThumb from '../components/ProductThumb';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1200;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

/** Shrinks big photos (phone cameras) before upload; GIFs and small files are sent as they are. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 400 * 1024) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

interface Props {
  label: string;
  /** Either a web link or an uploaded file's path (e.g. "/uploads/abc.png"). */
  value: string;
  onChange: (url: string) => void;
  onError: (e: unknown) => boolean;
}

/** An image can be pasted as a web link or uploaded from this device. */
export default function ImageField({ label, value, onChange, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) return setError('Please choose an image file (PNG, JPG, GIF or WebP).');
    setBusy(true);
    try {
      const body = await shrink(file);
      if (body.size > MAX_BYTES) throw new Error('That image is larger than 5 MB. Choose a smaller one.');
      const { url } = await adminApi.uploadImage(body);
      onChange(url);
    } catch (err) {
      if (!onError(err)) setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div className="image-field">
        <ProductThumb url={value || null} />
        <div className="image-field-main">
          <input
            type="text"
            inputMode="url"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            maxLength={500}
            placeholder="Paste a web link, or upload a file"
            aria-label={`${label} link`}
          />
          <div className="image-field-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : 'Upload from device'}
            </button>
            {value && (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => onChange('')}>
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={onPick} />
          </div>
        </div>
      </div>
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
