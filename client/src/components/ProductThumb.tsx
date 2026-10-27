import { useEffect, useState } from 'react';
import { ImageIcon } from './Icons';
import ImageLightbox from './ImageLightbox';

/** Product picture, or a placeholder when there is no image URL (or it fails to load). */
export default function ProductThumb({ url, alt = '' }: { url: string | null | undefined; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (url && !failed) {
    return (
      <>
        <button
          type="button"
          className="thumb-btn"
          aria-label={alt ? `View larger image of ${alt}` : 'View larger image'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <img
            className="thumb"
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </button>
        {open && <ImageLightbox src={url} alt={alt || 'Product image'} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <span className="thumb thumb-empty" role="img" aria-label="No image available">
      <ImageIcon width={22} height={22} />
    </span>
  );
}
