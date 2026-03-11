/**
 * CSV Export Utility
 * Generates well-formatted CSV files and triggers browser download.
 */

interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
}

export function exportToCsv<T>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[],
) {
  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";

  // Header row
  const headers = columns.map((c) => escapeCell(c.header)).join(",");

  // Data rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = col.accessor(row);
        if (val === null || val === undefined) return "";
        return escapeCell(String(val));
      })
      .join(","),
  );

  const csvContent = BOM + [headers, ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${formatDate(new Date())}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

function escapeCell(value: string): string {
  // If the value contains commas, quotes, or newlines, wrap in quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
