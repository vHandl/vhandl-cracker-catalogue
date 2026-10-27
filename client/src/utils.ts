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
