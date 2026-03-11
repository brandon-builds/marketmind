/**
 * Brokerage-Compatible Portfolio Export
 * Generates CSV files in formats compatible with major brokerages.
 */

export type BrokerageFormat = "schwab" | "fidelity" | "ibkr" | "generic";

interface PortfolioHolding {
  ticker: string;
  shares: number;
  price: number;
  value: number;
  sector?: string;
  change?: number;
  weight?: number;
}

function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateCompact(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function triggerDownload(content: string, filename: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Charles Schwab CSV Format
 * Schwab uses: Symbol, Description, Quantity, Price, Market Value, % of Account
 */
function exportSchwab(holdings: PortfolioHolding[], accountName: string) {
  const date = formatDate(new Date());
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const header = [
    `"Positions for ${accountName} as of ${date}"`,
    "",
    '"Symbol","Description","Quantity","Price","Market Value","Day Change %","% of Account"',
  ].join("\r\n");

  const rows = holdings.map((h) => {
    const pctOfAccount = totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(2) : "0.00";
    return [
      escapeCell(h.ticker),
      escapeCell(`${h.ticker} - ${h.sector || "Equity"}`),
      h.shares.toString(),
      `$${h.price.toFixed(2)}`,
      `$${h.value.toFixed(2)}`,
      `${(h.change || 0).toFixed(2)}%`,
      `${pctOfAccount}%`,
    ].join(",");
  });

  const totalRow = `"","Account Total","","","$${totalValue.toFixed(2)}","","100.00%"`;

  const content = [header, ...rows, "", totalRow].join("\r\n");
  triggerDownload(content, `MarketMind_Schwab_${formatDateCompact(new Date())}.csv`);
}

/**
 * Fidelity CSV Format
 * Fidelity uses: Account Number, Symbol, Description, Quantity, Last Price, Current Value
 */
function exportFidelity(holdings: PortfolioHolding[], accountName: string) {
  const date = formatDate(new Date());
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const header = [
    `"Fidelity Investments"`,
    `"Exported from MarketMind on ${date}"`,
    "",
    '"Account Number/Name","Symbol","Description","Quantity","Last Price","Current Value","Today\'s Gain/Loss Dollar","Today\'s Gain/Loss Percent","Cost Basis Total"',
  ].join("\r\n");

  const rows = holdings.map((h) => {
    const dayChange = h.price * (h.change || 0) / 100;
    const dayChangeDollar = dayChange * h.shares;
    return [
      escapeCell(accountName),
      escapeCell(h.ticker),
      escapeCell(`${h.ticker} ${h.sector || ""}`),
      h.shares.toString(),
      `$${h.price.toFixed(2)}`,
      `$${h.value.toFixed(2)}`,
      `$${dayChangeDollar.toFixed(2)}`,
      `${(h.change || 0).toFixed(2)}%`,
      `$${h.value.toFixed(2)}`,
    ].join(",");
  });

  const totalRow = `"","","TOTAL","","","$${totalValue.toFixed(2)}","","",""`;

  const content = [header, ...rows, "", totalRow].join("\r\n");
  triggerDownload(content, `MarketMind_Fidelity_${formatDateCompact(new Date())}.csv`);
}

/**
 * Interactive Brokers (IBKR) CSV Format
 * IBKR uses a specific format with header metadata
 */
function exportIBKR(holdings: PortfolioHolding[], accountName: string) {
  const date = formatDate(new Date());
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const header = [
    `"Statement","Header","Field Name","Field Value"`,
    `"Statement","Data","BrokerName","MarketMind Export"`,
    `"Statement","Data","Account","${accountName}"`,
    `"Statement","Data","WhenGenerated","${date}"`,
    "",
    `"Open Positions","Header","DataDiscriminator","Asset Category","Currency","Symbol","Quantity","Mult","Cost Price","Cost Basis","Close Price","Value","Unrealized P&L","Code"`,
  ].join("\r\n");

  const rows = holdings.map((h) => {
    return [
      '"Open Positions"',
      '"Data"',
      '"Summary"',
      '"Stocks"',
      '"USD"',
      escapeCell(h.ticker),
      h.shares.toString(),
      "1",
      h.price.toFixed(4),
      h.value.toFixed(2),
      h.price.toFixed(4),
      h.value.toFixed(2),
      "0.00",
      '""',
    ].join(",");
  });

  const totalRow = `"Open Positions","Total","","Stocks","USD","","","","","$${totalValue.toFixed(2)}","","$${totalValue.toFixed(2)}","0.00",""`;

  const content = [header, ...rows, "", totalRow].join("\r\n");
  triggerDownload(content, `MarketMind_IBKR_${formatDateCompact(new Date())}.csv`);
}

/**
 * Generic CSV Format (universal)
 */
function exportGeneric(holdings: PortfolioHolding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const header = '"Symbol","Shares","Price","Market Value","Weight %","Sector","Day Change %"';

  const rows = holdings.map((h) => {
    const weight = totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(2) : "0.00";
    return [
      escapeCell(h.ticker),
      h.shares.toString(),
      h.price.toFixed(2),
      h.value.toFixed(2),
      weight,
      escapeCell(h.sector || ""),
      (h.change || 0).toFixed(2),
    ].join(",");
  });

  const content = [header, ...rows].join("\r\n");
  triggerDownload(content, `MarketMind_Portfolio_${formatDateCompact(new Date())}.csv`);
}

/**
 * Main export function — dispatches to the correct brokerage format
 */
export function exportPortfolioBrokerage(
  format: BrokerageFormat,
  holdings: PortfolioHolding[],
  accountName: string = "MarketMind Portfolio",
) {
  switch (format) {
    case "schwab":
      return exportSchwab(holdings, accountName);
    case "fidelity":
      return exportFidelity(holdings, accountName);
    case "ibkr":
      return exportIBKR(holdings, accountName);
    case "generic":
    default:
      return exportGeneric(holdings);
  }
}

export const BROKERAGE_FORMATS: { key: BrokerageFormat; label: string; description: string }[] = [
  { key: "schwab", label: "Charles Schwab", description: "Schwab-compatible CSV with account totals" },
  { key: "fidelity", label: "Fidelity", description: "Fidelity Investments format with gain/loss" },
  { key: "ibkr", label: "Interactive Brokers", description: "IBKR statement format with position data" },
  { key: "generic", label: "Generic CSV", description: "Universal format compatible with any tool" },
];
