import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';
import { useBackClose } from './useBackClose';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

/** True when the point lands on the photo itself, not the empty space around a non-matching aspect ratio. */
function hitTestPhoto(img: HTMLImageElement, x: number, y: number) {
  const box = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh || !box.width || !box.height) {
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }
  const scale = Math.min(box.width / nw, box.height / nh);
  const width = nw * scale;
  const height = nh * scale;
  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

/** Full product photo in a fixed frame. Closes from the close button, Escape, Back, or a tap outside the photo. */
export default function ImageLightbox({ src, alt, onClose }: Props) {
  useBackClose(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="image-lightbox"
      onMouseDown={(e) => {
        const img = (e.currentTarget as HTMLElement).querySelector('img');
        if (img && e.target === img && hitTestPhoto(img, e.clientX, e.clientY)) return;
        onClose();
      }}
    >
      <div className="image-lightbox-frame" role="dialog" aria-modal="true" aria-label={alt || 'Product image'}>
        <button
          type="button"
          className="icon-btn image-lightbox-close"
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          <CloseIcon width={18} height={18} />
        </button>
        <img src={src} alt={alt} decoding="async" />
      </div>
    </div>,
    document.body
  );
}
