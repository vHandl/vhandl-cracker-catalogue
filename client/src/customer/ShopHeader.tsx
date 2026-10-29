import type { Shop } from '../types';
import { BurstArt, GoogleMapsIcon, MapPinIcon, PhoneIcon, ReceiptIcon, WhatsAppIcon } from '../components/Icons';
import { shopHasSecondStore, shopMapsHref } from '../utils';

interface Props {
  shop: Shop;
  orderCount: number;
  onOpenOrders: () => void;
}

function AddressRow({
  name,
  address,
  mapsUrl,
}: {
  name?: string;
  address: string;
  mapsUrl: string | null;
}) {
  const label = name?.trim();
  if (!address && !mapsUrl) return null;
  const mapLabel = label ? `Open ${label} in Google Maps` : 'Open in Google Maps';
  return (
    <p className="hero-address">
      {mapsUrl ? (
        <a
          className="btn btn-light btn-sm hero-map-btn"
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={mapLabel}
          title={mapLabel}
        >
          <GoogleMapsIcon width={14} height={14} />
        </a>
      ) : (
        <MapPinIcon width={18} height={18} />
      )}
      <span>
        {label ? <strong className="hero-location-name">{label}</strong> : null}
        {address || (mapsUrl ? 'Open map' : '')}
      </span>
    </p>
  );
}

export default function ShopHeader({ shop, orderCount, onOpenOrders }: Props) {
  const mapsUrl = shopMapsHref(shop);
  const secondMapsUrl = shopMapsHref({ mapsUrl: shop.mapsUrl2, address: shop.address2 });
  const showSecond = shopHasSecondStore(shop);

  return (
    <header className="hero">
      <BurstArt className="hero-art" />

      <div className="hero-title">
        {shop.logoUrl && <img className="hero-logo" src={shop.logoUrl} alt="" />}
        <h1>{shop.name}</h1>
      </div>

      {(shop.address || showSecond) && (
        <div className="hero-locations">
          <AddressRow name={shop.locationName} address={shop.address} mapsUrl={mapsUrl} />
          {showSecond && (
            <AddressRow name={shop.locationName2} address={shop.address2} mapsUrl={secondMapsUrl} />
          )}
        </div>
      )}

      <div className="hero-actions">
        <div className="hero-contact">
          {shop.phone && (
            <a className="btn btn-light btn-sm" href={`tel:${shop.phone.replace(/[^\d+]/g, '')}`}>
              <PhoneIcon width={16} height={16} />
              Call {shop.phone}
            </a>
          )}
          {shop.whatsapp && (
            <a
              className="btn btn-whatsapp btn-sm"
              href={`https://wa.me/${shop.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon width={16} height={16} />
              WhatsApp
            </a>
          )}
        </div>
        <button type="button" className="btn btn-light btn-sm hero-orders-btn" onClick={onOpenOrders}>
          <ReceiptIcon width={16} height={16} />
          <span className="hero-orders-label">My orders</span>
          {orderCount > 0 && <b className="hero-count">{orderCount}</b>}
        </button>
      </div>
    </header>
  );
}
