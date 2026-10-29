import { useEffect, useState, type MouseEvent } from 'react';
import { ImageIcon, PlayIcon } from './Icons';
import ImageLightbox from './ImageLightbox';

function stopGrid(e: MouseEvent) {
  e.stopPropagation();
}

/** Product picture, or a placeholder when there is no image URL (or it fails to load). */
export default function ProductThumb({
  url,
  alt = '',
  onPlay,
}: {
  url: string | null | undefined;
  alt?: string;
  /** Optional play control on the photo; does not open the image lightbox. */
  onPlay?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setFailed(false), [url]);

  const playBtn = onPlay ? (
    <button
      type="button"
      className="thumb-play"
      aria-label={alt ? `Watch video of ${alt}` : 'Watch video'}
      onMouseDown={stopGrid}
      onClick={(e) => {
        stopGrid(e);
        e.preventDefault();
        onPlay();
      }}
    >
      <PlayIcon width={10} height={10} />
    </button>
  ) : null;

  if (url && !failed) {
    return (
      <>
        <span className="thumb-wrap">
          <button
            type="button"
            className="thumb-btn"
            aria-label={alt ? `View larger image of ${alt}` : 'View larger image'}
            onMouseDown={stopGrid}
            onClick={(e) => {
              stopGrid(e);
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
          {playBtn}
        </span>
        {open && <ImageLightbox src={url} alt={alt || 'Product image'} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <span className="thumb-wrap">
      <span className="thumb thumb-empty" role="img" aria-label="No image available">
        <ImageIcon width={22} height={22} />
      </span>
      {playBtn}
    </span>
  );
}
