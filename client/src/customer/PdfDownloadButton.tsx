import type { Order, Shop } from '../types';
import { DownloadIcon } from '../components/Icons';
import { usePdfDownload } from './usePdfDownload';

interface Props {
  shop: Shop;
  order: Order;
  label?: string;
  className?: string;
}

/** "Download" button for an order's PDF with a loader and a retry on failure. */
export default function PdfDownloadButton({ shop, order, label = 'Download your order list', className = '' }: Props) {
  const { status, errorText, download } = usePdfDownload(shop, order);
  return (
    <>
      {status === 'error' && (
        <div className="alert alert-error" role="alert">
          We could not create the PDF this time. Please tap the button to try again. If it keeps failing, take a
          screenshot of your token and show it at the shop.
          {errorText && <small className="pdf-error-detail">{errorText}</small>}
        </div>
      )}
      <button
        type="button"
        className={`btn btn-primary ${className}`}
        onClick={download}
        disabled={status === 'working'}
        aria-busy={status === 'working'}
      >
        {status === 'working' ? (
          <>
            <span className="btn-spinner" aria-hidden />
            Preparing your PDF…
          </>
        ) : (
          <>
            <DownloadIcon width={18} height={18} />
            {status === 'error' ? 'Try again' : label}
          </>
        )}
      </button>
    </>
  );
}
