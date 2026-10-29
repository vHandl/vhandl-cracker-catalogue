import { memo, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  RowAutoHeightModule,
  RowStyleModule,
  ValidationModule,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  type IsFullWidthRowParams,
} from 'ag-grid-community';
import ProductThumb from '../components/ProductThumb';
import QtyStepper from '../components/QtyStepper';
import { gridTheme } from '../gridTheme';
import type { Category, Product, Selection } from '../types';
import { PlayIcon } from '../components/Icons';
import { categoryIcon, rupee } from '../utils';

// Register only the AG Grid features this list needs (keeps the phone download small).
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowAutoHeightModule,
  RowStyleModule,
  CellStyleModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []), // warns in dev if a needed module is missing
]);

/* ---------- row model: category heading rows + item rows in one flat list ---------- */
interface GroupRow {
  kind: 'group';
  id: string;
  name: string;
  count: number;
}
interface ItemRow {
  kind: 'item';
  id: string;
  product: Product;
  qty: number;
}
type Row = GroupRow | ItemRow;

interface GridContext {
  toggle: (id: number) => void;
  setQty: (id: number, qty: number) => void;
  openVideo: (p: Product) => void;
}

type CellProps = ICellRendererParams<Row, unknown, GridContext>;

/* ---------- cell renderers ---------- */
function itemOf(p: CellProps): ItemRow | null {
  return p.data && p.data.kind === 'item' ? p.data : null;
}

function SelectCell(p: CellProps) {
  const row = itemOf(p);
  if (!row) return null;
  return (
    <label className="g-select">
      <input
        type="checkbox"
        className="check"
        checked={row.qty > 0}
        disabled={row.product.outOfStock}
        onChange={() => p.context.toggle(row.product.id)}
        aria-label={`Select ${row.product.name}`}
      />
    </label>
  );
}

function CodeCell(p: CellProps) {
  const row = itemOf(p);
  return row ? <span className="card-code">{row.product.code}</span> : null;
}

/** Wide layout: picture (or placeholder) before the item name. */
function NameCell(p: CellProps) {
  const row = itemOf(p);
  if (!row) return null;
  return (
    <div className="g-named">
      <ProductThumb url={row.product.imageUrl} alt={row.product.name} />
      <span className="g-name">{row.product.name}</span>
    </div>
  );
}

function PriceCell(p: CellProps) {
  const row = itemOf(p);
  if (!row) return null;
  return (
    <span className="card-price">
      {rupee(row.product.price)} <small>/ {row.product.unit}</small>
    </span>
  );
}

/** Stock status badge: "Available" or "Out of Stock". */
function StatusCell(p: CellProps) {
  const row = itemOf(p);
  if (!row) return null;
  return row.product.outOfStock ? (
    <span className="badge badge-out">Out of Stock</span>
  ) : (
    <span className="badge badge-on">Available</span>
  );
}

function VideoButton({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  if (!product.videoUrl) return null;
  return (
    <button
      type="button"
      className="video-btn"
      aria-label={`Watch video of ${product.name}`}
      onClick={() => onOpen(product)}
    >
      <PlayIcon width={14} height={14} />
      Watch video
    </button>
  );
}

function VideoCell(p: CellProps) {
  const row = itemOf(p);
  return row ? <VideoButton product={row.product} onOpen={p.context.openVideo} /> : null;
}

/** Phone layout: picture, details, video button and quantity all in one cell, so the text gets the full width. */
function ItemCell(p: CellProps) {
  const row = itemOf(p);
  if (!row) return null;
  const { product } = row;
  return (
    <div className="g-item-block">
      <div className="g-item-row">
        <ProductThumb url={product.imageUrl} alt={product.name} />
        <div className="g-item">
          <div className="g-item-title">
            <span className="card-code">{product.code}</span>
            <span className="g-name">{product.name}</span>
          </div>
          <span className="g-price-line">
            <VideoButton product={product} onOpen={p.context.openVideo} />
            <span className="card-price">
              {rupee(product.price)} <small>/ {product.unit}</small>
            </span>
          </span>
        </div>
      </div>
      {/* Next line: quantity and (once selected) the cost */}
      <div className="g-item-actions">
        {product.outOfStock ? (
          <span className="badge badge-out">Out of Stock</span>
        ) : (
          <QtyControl row={row} p={p} />
        )}
        {row.qty > 0 && <strong className="g-amount g-amount-inline">{rupee(product.price * row.qty)}</strong>}
      </div>
    </div>
  );
}

function QtyControl({ row, p }: { row: ItemRow; p: CellProps }) {
  return (
    <QtyStepper
      value={row.qty}
      onChange={(n) => p.context.setQty(row.product.id, n)}
      label={`Quantity of ${row.product.name}`}
      min={0}
    />
  );
}

/** Wide layout: stepper, starting at 0. Out-of-stock items have none. */
function QtyCell(p: CellProps) {
  const row = itemOf(p);
  if (!row || row.product.outOfStock) return null;
  return <QtyControl row={row} p={p} />;
}

function AmountCell(p: CellProps) {
  const row = itemOf(p);
  if (!row || row.qty === 0) return null;
  return <strong className="g-amount">{rupee(row.product.price * row.qty)}</strong>;
}

/** Full-width category heading row. */
function GroupCell(p: CellProps) {
  if (!p.data || p.data.kind !== 'group') return null;
  return (
    <div className="g-group">
      <span className="g-group-icon" aria-hidden>
        {categoryIcon(p.data.name)}
      </span>
      <span>{p.data.name}</span>
      <span className="count">{p.data.count}</span>
    </div>
  );
}

/* ---------- column layouts ---------- */
const COMMON: ColDef<Row> = {
  sortable: false,
  resizable: false,
  suppressMovable: true,
  suppressHeaderMenuButton: true,
  suppressNavigable: true,
};

const COMPACT_COLS: ColDef<Row>[] = [
  { headerName: '', width: 52, cellRenderer: SelectCell, cellClass: 'g-cell-center', headerClass: 'g-head-center' },
  {
    headerName: 'Item',
    flex: 1,
    minWidth: 120,
    autoHeight: true,
    cellRenderer: ItemCell,
  },
];

const WIDE_COLS: ColDef<Row>[] = [
  {
    headerName: '',
    width: 44,
    minWidth: 40,
    maxWidth: 48,
    cellRenderer: SelectCell,
    cellClass: 'g-cell-center',
    headerClass: 'g-head-center',
  },
  {
    headerName: 'Code',
    width: 72,
    minWidth: 64,
    maxWidth: 72,
    cellRenderer: CodeCell,
    autoHeight: true,
    cellClass: 'g-cell-code',
    headerClass: 'g-head-code',
  },
  { headerName: 'Item', flex: 1, minWidth: 260, autoHeight: true, wrapText: true, cellRenderer: NameCell },
  { headerName: 'Price', width: 120, cellRenderer: PriceCell },
  { headerName: 'Status', width: 116, cellRenderer: StatusCell },
  { headerName: 'Video', width: 116, cellRenderer: VideoCell },
  { headerName: 'Quantity', width: 106, cellRenderer: QtyCell },
  { headerName: 'Amount', width: 100, cellRenderer: AmountCell, cellClass: 'g-cell-end', headerClass: 'g-head-end' },
];

function useWide(minWidth = 900) {
  const query = `(min-width: ${minWidth}px)`;
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return wide;
}

interface Props {
  categories: Category[];
  selection: Selection;
  onToggle: (id: number) => void;
  onQty: (id: number, qty: number) => void;
  onVideo: (p: Product) => void;
}

function CatalogueGrid({ categories, selection, onToggle, onQty, onVideo }: Props) {
  const wide = useWide();

  const rows = useMemo<Row[]>(
    () =>
      categories.flatMap<Row>((c) => [
        { kind: 'group', id: `cat-${c.id}`, name: c.name, count: c.products.length },
        ...c.products.map<ItemRow>((product) => ({
          kind: 'item',
          id: `p-${product.id}`,
          product,
          qty: selection[product.id] || 0,
        })),
      ]),
    [categories, selection]
  );

  const context = useMemo<GridContext>(
    () => ({ toggle: onToggle, setQty: onQty, openVideo: onVideo }),
    [onToggle, onQty, onVideo]
  );

  return (
    <div className="grid-wrap">
      <AgGridReact<Row>
        theme={gridTheme}
        rowData={rows}
        columnDefs={wide ? WIDE_COLS : COMPACT_COLS}
        defaultColDef={COMMON}
        context={context}
        getRowId={(p: GetRowIdParams<Row>) => p.data.id}
        isFullWidthRow={(p: IsFullWidthRowParams<Row>) => p.rowNode.data?.kind === 'group'}
        fullWidthCellRenderer={GroupCell}
        getRowHeight={(p) => (p.data?.kind === 'group' ? 46 : undefined)}
        rowClassRules={{
          'row-selected': (p) => p.data?.kind === 'item' && p.data.qty > 0,
          'row-oos': (p) => p.data?.kind === 'item' && p.data.product.outOfStock,
          'row-group': (p) => p.data?.kind === 'group',
        }}
        domLayout="autoHeight" // the page scrolls, not the grid (best on phones)
        headerHeight={38}
        rowHeight={60}
        suppressCellFocus
        suppressRowHoverHighlight={false}
        animateRows={false}
        ensureDomOrder
      />
    </div>
  );
}

export default memo(CatalogueGrid);
