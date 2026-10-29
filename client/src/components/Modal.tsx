import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 'sheet' slides up from the bottom on phones; 'dialog' is centred. */
  variant?: 'sheet' | 'dialog';
  footer?: ReactNode;
  hideClose?: boolean;
  className?: string;
}

export default function Modal({ title, onClose, children, variant = 'sheet', footer, hideClose, className }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className={`modal-backdrop ${variant}${className ? ` ${className}` : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        {variant === 'sheet' && <div className="sheet-handle" aria-hidden />}
        <div className="modal-head">
          <h2>{title}</h2>
          {!hideClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon width={18} height={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
