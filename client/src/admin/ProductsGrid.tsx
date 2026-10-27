import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  NumberFilterModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  TextFilterModule,
  ValidationModule,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type ICellRendererParams,
  type RowSelectionOptions,
} from 'ag-grid-community';
import { EditIcon, TrashIcon } from '../components/Icons';
import { gridTheme } from '../gridTheme';
import type { AdminProduct } from '../types';
import { rupee } from '../utils';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowSelectionModule,
  RowApiModule,
  TextFilterModule,
  NumberFilterModule,
  RowStyleModule,
  CellStyleModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);

interface GridContext {
  edit: (p: AdminProduct) => void;
  remove: (p: AdminProduct) => void;
  /** Phone layout: the code moves under the item name. */
  narrow: boolean;
}
type CellProps<V = unknown> = ICellRendererParams<AdminProduct, V, GridContext>;

function CodeCell(p: CellProps<string>) {
  return p.value ? <span className="card-code">{p.value}</span> : null;
}

/** Item name with a small second line: (code on phones) · brand · video flag. */
function NameCell(p: CellProps<string>) {
  const d = p.data;
  if (!d) return null;
  const sub = [
    p.context.narrow ? d.code : '',
    d.brand,
    d.videoUrl ? '🎬 video' : '',
    p.context.narrow && d.outOfStock ? 'out of stock' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="g-two-line" title={d.name}>
      <span className="g-ellipsis">{d.name}</span>
      {sub && <small className="g-ellipsis muted">{sub}</small>}
    </div>
  );
}

/** Inventory-style status badge: Shown (green) / Hidden (grey). */
function StatusCell(p: CellProps<string>) {
  const shown = p.data?.active;
  return <span className={`badge ${shown ? 'badge-on' : 'badge-off'}`}>{p.value}</span>;
}

/** Stock badge: Available (green) / Out of Stock (red). */
function StockCell(p: CellProps<string>) {
  return <span className={`badge ${p.data?.outOfStock ? 'badge-out' : 'badge-on'}`}>{p.value}</span>;
}

function ActionsCell(p: CellProps) {
  const row = p.data;
  if (!row) return null;
  return (
    <div className="g-actions">
      <button
        type="button"
        className="icon-action"
        title="Edit"
        aria-label={`Edit ${row.name}`}
        onClick={() => p.context.edit(row)}
      >
        <EditIcon width={18} height={18} />
      </button>
      <button
        type="button"
        className="icon-action icon-action-danger"
        title="Delete"
        aria-label={`Delete ${row.name}`}
        onClick={() => p.context.remove(row)}
      >
        <TrashIcon width={18} height={18} />
      </button>
    </div>
  );
}

/** Columns dropped on phones so the item name, price and row actions stay readable. */
const SECONDARY = new Set(['code', 'categoryName', 'stock']);

const COLUMNS: ColDef<AdminProduct>[] = [
  { field: 'code', headerName: 'Code', width: 110, cellRenderer: CodeCell },
  { field: 'name', headerName: 'Item', flex: 1, minWidth: 170, cellRenderer: NameCell },
  { field: 'categoryName', headerName: 'Category', width: 150 },
  {
    field: 'price',
    headerName: 'Price',
    width: 130,
    type: 'rightAligned',
    filter: 'agNumberColumnFilter',
    valueFormatter: (p) => (p.value == null ? '' : `${rupee(p.value)} / ${p.data?.unit ?? ''}`),
  },
  {
    colId: 'status',
    headerName: 'Status',
    width: 110,
    valueGetter: (p) => (p.data?.active ? 'Shown' : 'Hidden'),
    cellRenderer: StatusCell,
  },
  {
    colId: 'stock',
    headerName: 'Stock',
    width: 130,
    valueGetter: (p) => (p.data?.outOfStock ? 'Out of Stock' : 'Available'),
    cellRenderer: StockCell,
  },
  {
    colId: 'actions',
    headerName: '',
    width: 110,
    pinned: 'right',
    sortable: false,
    filter: false,
    floatingFilter: false,
    resizable: false,
    suppressMovable: true,
    cellRenderer: ActionsCell,
  },
];

const DEFAULT_COL: ColDef<AdminProduct> = {
  sortable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  resizable: true,
  suppressHeaderMenuButton: true,
  suppressHeaderFilterButton: true,
  suppressFloatingFilterButton: true,
  filterParams: { buttons: [], debounceMs: 150 },
};

const ROW_SELECTION: RowSelectionOptions<AdminProduct> = {
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
  selectAll: 'filtered',
};

function useNarrow(maxWidth = 760) {
  const query = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

interface Props {
  products: AdminProduct[];
  onEdit: (p: AdminProduct) => void;
  onDelete: (p: AdminProduct) => void;
  onSelectionChange: (ids: number[]) => void;
  /** Change this number to clear the current selection. */
  clearSelectionKey: number;
}

/** Admin product list: AG Grid inventory-style table with sorting, filters, status badges and row selection. */
function ProductsGrid({ products, onEdit, onDelete, onSelectionChange, clearSelectionKey }: Props) {
  const api = useRef<GridApi<AdminProduct> | null>(null);
  const narrow = useNarrow();
  const context = useMemo<GridContext>(() => ({ edit: onEdit, remove: onDelete, narrow }), [onEdit, onDelete, narrow]);
  const columns = useMemo(
    () =>
      narrow
        ? COLUMNS.filter((c) => !SECONDARY.has(String(c.field ?? c.colId))).map((c) =>
            c.colId === 'actions' ? { ...c, width: 104 } : c.colId === 'status' ? { ...c, width: 110 } : c
          )
        : COLUMNS,
    [narrow]
  );

  useEffect(() => {
    api.current?.deselectAll();
  }, [clearSelectionKey]);

  // Few rows: let the grid size itself; many rows: fixed height with an inner scrollbar.
  const compact = products.length <= 10;

  return (
    <div className={`admin-grid ${compact ? 'auto' : ''}`}>
      <AgGridReact<AdminProduct>
        theme={gridTheme}
        rowData={products}
        columnDefs={columns}
        defaultColDef={DEFAULT_COL}
        context={context}
        getRowId={(p: GetRowIdParams<AdminProduct>) => String(p.data.id)}
        rowSelection={ROW_SELECTION}
        onGridReady={(e) => {
          api.current = e.api;
        }}
        onSelectionChanged={(e) => onSelectionChange(e.api.getSelectedRows().map((r) => r.id))}
        rowClassRules={{ 'row-hidden': (p) => p.data?.active === false }}
        domLayout={compact ? 'autoHeight' : 'normal'}
        rowHeight={56}
        headerHeight={42}
        floatingFiltersHeight={44}
        suppressCellFocus
        animateRows={false}
      />
    </div>
  );
}

export default memo(ProductsGrid);
