/** Safe http(s)/geo link for a shop maps URL, or null when it is missing or not a URL. */
export function mapsHref(url: string | undefined): string | null {
  const v = (url ?? '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'geo:') return v;
  } catch {
    return null;
  }
  return null;
}

/** Saved Maps link, or a Google Maps search for the shop address when no link is saved. */
export function shopMapsHref(shop: { mapsUrl?: string; address?: string } | null | undefined): string | null {
  const saved = mapsHref(shop?.mapsUrl);
  if (saved) return saved;
  const address = (shop?.address ?? '').trim();
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export type StoreId = 1 | 2;

export interface StoreLocation {
  id: StoreId;
  name: string;
  address: string;
  mapsUrl: string;
}

export function shopHasSecondStore(shop: { address2?: string; mapsUrl2?: string } | null | undefined): boolean {
  return Boolean((shop?.address2 ?? '').trim() || (shop?.mapsUrl2 ?? '').trim());
}

/** Pickup locations the customer can choose from. Store 1 is always included; store 2 only if configured. */
export function shopLocations(
  shop: {
    locationName?: string;
    address?: string;
    mapsUrl?: string;
    locationName2?: string;
    address2?: string;
    mapsUrl2?: string;
  } | null | undefined
): StoreLocation[] {
  if (!shop) return [];
  const locs: StoreLocation[] = [
    {
      id: 1,
      name: (shop.locationName ?? '').trim() || 'Main store',
      address: shop.address ?? '',
      mapsUrl: shop.mapsUrl ?? '',
    },
  ];
  if (shopHasSecondStore(shop)) {
    locs.push({
      id: 2,
      name: (shop.locationName2 ?? '').trim() || 'Second store',
      address: shop.address2 ?? '',
      mapsUrl: shop.mapsUrl2 ?? '',
    });
  }
  return locs;
}

/** Maps link for the pickup store saved on an order, falling back to the shop's first location. */
export function pickupMapsHref(
  order: { pickupMapsUrl?: string; pickupAddress?: string; pickupStore?: number } | null | undefined,
  shop?: { mapsUrl?: string; address?: string; mapsUrl2?: string; address2?: string } | null
): string | null {
  const fromOrder = shopMapsHref({ mapsUrl: order?.pickupMapsUrl, address: order?.pickupAddress });
  if (fromOrder) return fromOrder;
  if (order?.pickupStore === 2) {
    return shopMapsHref({ mapsUrl: shop?.mapsUrl2, address: shop?.address2 }) ?? shopMapsHref(shop);
  }
  return shopMapsHref(shop);
}

export function pickupLabel(order: { pickupName?: string; pickupAddress?: string } | null | undefined): string {
  const name = (order?.pickupName ?? '').trim();
  const address = (order?.pickupAddress ?? '').trim();
  if (name && address) return `${name} — ${address}`;
  return name || address;
}

/** Short pickup-store name for admin lists and filters. */
export function orderStoreLabel(
  order: { pickupStore?: number; pickupName?: string } | null | undefined,
  shop?: { locationName?: string; locationName2?: string } | null
): string {
  const saved = (order?.pickupName ?? '').trim();
  if (saved) return saved;
  if (order?.pickupStore === 2) return (shop?.locationName2 ?? '').trim() || 'Second store';
  return (shop?.locationName ?? '').trim() || 'First store';
}

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "Rs. 1,250" (plain text; safe for PDF fonts too) */
export const money = (n: number) => `Rs. ${inr.format(n)}`;

/** Same, with the rupee symbol, for on-screen use. */
export const rupee = (n: number) => `₹${inr.format(n)}`;

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Default message used when sending an order to the shop on WhatsApp. */
export const ORDER_MESSAGE = 'Hi, Please check this order';

/**
 * Link that opens the WhatsApp app on a chat with the shop's number, with the message pre-filled.
 * (WhatsApp links cannot attach files; the PDF is attached separately, see sharePdf.)
 */
export function shopChatLink(whatsapp: string, text: string = ORDER_MESSAGE): string {
  const number = whatsapp.replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export type BrandFilter = 'all' | 'standard' | 'krishna' | 'others';

export const BRAND_FILTERS: { id: BrandFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'standard', label: 'Standard' },
  { id: 'krishna', label: 'Krishna' },
  { id: 'others', label: 'Others' },
];

/** Groups a product into Standard, Krishna, or Others for the customer brand filter. */
export function matchesBrand(brand: string | undefined, filter: BrandFilter): boolean {
  if (filter === 'all') return true;
  const b = (brand ?? '').trim().toLowerCase();
  const isStandard = b.includes('standard');
  const isKrishna = b.includes('krishna');
  if (filter === 'standard') return isStandard;
  if (filter === 'krishna') return isKrishna;
  return !isStandard && !isKrishna;
}

/** A friendly emoji for a category, picked from its name. */
export function categoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (/gift|box|combo|pack/.test(n)) return '🎁';
  if (/spark/.test(n)) return '✨';
  if (/flower|pot|fountain/.test(n)) return '🌸';
  if (/chakkar|chakra|wheel|spinner/.test(n)) return '🌀';
  if (/rocket|sky|shot|aerial/.test(n)) return '🚀';
  if (/sound|bomb|bijili|crack|atom|bang/.test(n)) return '💥';
  if (/kid|child|fun/.test(n)) return '🎈';
  return '🎆';
}

export function cleanPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

export type VideoSource =
  | { kind: 'iframe'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'link'; src: string };

/** Turn a product video URL into something we can play inline. */
export function parseVideo(url: string): VideoSource {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1` };
    }
    if (host.endsWith('youtube.com')) {
      let id = u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      if (!id && m) id = m[1];
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1` };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/(\d{5,})/);
      if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1` };
    }
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(u.pathname)) {
      return { kind: 'file', src: url };
    }
    if (host === 'drive.google.com') {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) return { kind: 'iframe', src: `https://drive.google.com/file/d/${m[1]}/preview` };
    }
  } catch {
    /* fall through */
  }
  return { kind: 'link', src: url };
}
