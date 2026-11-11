import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'

export type DataTableColumn<Row> = {
  key: string
  header: string
  render: (row: Row) => ReactNode
}

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyTitle = 'Nothing to show yet',
  emptyDescription = 'When there is data to display, it will appear here.',
}: DataTableProps<Row>) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="data-table__empty" colSpan={columns.length}>
                <EmptyState
                  icon={<span aria-hidden="true">—</span>}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
