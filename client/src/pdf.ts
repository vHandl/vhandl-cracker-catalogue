import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, Shop } from './types';
import { formatDateTime, money, ORDER_MESSAGE } from './utils';

const BRAND: [number, number, number] = [225, 29, 72]; // brand rose
const NIGHT: [number, number, number] = [26, 17, 69]; // header band
const GOLD: [number, number, number] = [255, 200, 61];
const DARK: [number, number, number] = [23, 19, 47];
const SOFT: [number, number, number] = [253, 242, 247];

export interface PdfResult {
  blob: Blob;
  filename: string;
}

function groupByCategory(order: Order) {
  const groups: { category: string; items: Order['items'] }[] = [];
  for (const it of order.items) {
    let g = groups.find((x) => x.category === it.category);
    if (!g) {
      g = { category: it.category, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

export function buildOrderPdf(shop: Shop, order: Order): PdfResult {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ---- header band ----
  doc.setFillColor(...NIGHT);
  doc.rect(0, 0, pageW, 92, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 92, pageW, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(shop.name, margin, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const contact = [shop.phone && `Phone: ${shop.phone}`, shop.whatsapp && `WhatsApp: +${shop.whatsapp}`]
    .filter(Boolean)
    .join('   |   ');
  if (contact) doc.text(contact, margin, 60);
  const pickupLine = [order.pickupName, order.pickupAddress].filter((s) => (s ?? '').trim()).join(' — ');
  const headerAddress = pickupLine || shop.address;
  if (headerAddress) doc.text(headerAddress, margin, 76, { maxWidth: pageW - margin * 2 });

  // ---- token + customer box ----
  let y = 112;
  doc.setFillColor(...SOFT);
  doc.roundedRect(margin, y, pageW - margin * 2, 74, 6, 6, 'F');

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('ORDER TOKEN', margin + 16, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...BRAND);
  doc.text(order.token, margin + 16, y + 56);

  const rightX = margin + 180;
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer', rightX, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customerName, rightX + 60, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.text('Contact', rightX, y + 40);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customerPhone, rightX + 60, y + 40);
  doc.setFont('helvetica', 'bold');
  doc.text('Date', rightX, y + 58);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateTime(order.createdAt), rightX + 60, y + 58);

  y += 74 + 18;
  if (pickupLine) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(`Pickup: ${pickupLine}`, margin, y, { maxWidth: pageW - margin * 2 });
    y += 16;
  }

  // ---- one table per category ----
  const groups = groupByCategory(order);
  for (const g of groups) {
    const subtotal = g.items.reduce((s, i) => s + i.lineTotal, 0);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [
          {
            content: g.category,
            colSpan: 5,
            styles: { fillColor: BRAND, textColor: 255, fontSize: 11, halign: 'left' },
          },
        ],
        ['Code', 'Item', 'Qty', 'Rate', 'Amount'],
      ],
      body: [
        ...g.items.map((i) => [
          i.code,
          i.name,
          `${i.qty}`,
          `${money(i.price)} / ${i.unit}`,
          money(i.lineTotal),
        ]),
        [
          {
            content: `${g.category} subtotal`,
            colSpan: 4,
            styles: { fontStyle: 'bold', halign: 'right', fillColor: SOFT },
          },
          { content: money(subtotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: SOFT } },
        ],
      ],
      styles: { fontSize: 9.5, cellPadding: 5, textColor: DARK, lineColor: [229, 231, 235] },
      headStyles: { fillColor: [243, 244, 246], textColor: DARK, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 55 },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 100, halign: 'right' },
        4: { cellWidth: 80, halign: 'right' },
      },
      didParseCell: (data) => {
        // first head row is the category banner
        if (data.section === 'head' && data.row.index === 0) {
          data.cell.styles.fillColor = BRAND;
          data.cell.styles.textColor = [255, 255, 255];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ---- grand total ----
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 120) {
    doc.addPage();
    y = 50;
  }
  doc.setFillColor(...BRAND);
  doc.roundedRect(margin, y, pageW - margin * 2, 38, 6, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ESTIMATED TOTAL', margin + 14, y + 24);
  doc.text(money(order.total), pageW - margin - 14, y + 24, { align: 'right' });

  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(
    'This is only an estimate of your selection, not a final bill. Show this token at the shop to retrieve your list.',
    margin,
    y + 58,
    { maxWidth: pageW - margin * 2 }
  );

  // ---- page numbers ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`${shop.name}  -  Token ${order.token}  -  Page ${p} of ${pages}`, pageW / 2, pageH - 20, {
      align: 'center',
    });
  }

  const date = new Date(order.createdAt);
  const stamp = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  const filename = `Order-${order.token}${stamp ? `-${stamp}` : ''}.pdf`;
  return { blob: doc.output('blob'), filename };
}

export function downloadPdf({ blob, filename }: PdfResult) {
  const url = URL.createObjectURL(blob);
  // Some phone browsers (older iOS Safari, in-app browsers) ignore the "download" attribute;
  // for those, open the PDF in a new tab so it can still be viewed and saved.
  const canDownload = 'download' in document.createElement('a');
  if (!canDownload) {
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000); // phones can be slow to start the save
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Opens the phone's share sheet with the PDF attached (WhatsApp is listed there). Falls back to download. */
export async function sharePdf(pdf: PdfResult, shop: Shop, order: Order): Promise<ShareOutcome> {
  const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });
  const text = ORDER_MESSAGE;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${shop.name} order ${order.token}`, text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // otherwise fall through to download
    }
  }
  downloadPdf(pdf);
  return 'downloaded';
}