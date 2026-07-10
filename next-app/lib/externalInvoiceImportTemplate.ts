const HEADERS = [
  "username",
  "fullName",
  "email",
  "phoneNumber",
  "address",
  "provider",
  "debitLabel",
  "amount",
  "payDueDate",
  "billingMonth",
  "status",
] as const;

const SAMPLE_ROW: Record<(typeof HEADERS)[number], string | number> = {
  username: "user001",
  fullName: "Jane Customer",
  email: "jane@example.com",
  phoneNumber: "+96170123456",
  address: "Beirut, Hamra St, Bldg 12",
  provider: "ISP-X",
  debitLabel: "",
  amount: 45,
  payDueDate: "2026-07-15",
  billingMonth: "2026-06-01",
  status: "pending",
};

const SAMPLE_CARRYOVER: Record<(typeof HEADERS)[number], string | number> = {
  ...SAMPLE_ROW,
  debitLabel: "carryover",
  amount: 30,
  payDueDate: "2026-07-10",
};

/** Download a starter Excel template for external invoice import. xlsx is loaded lazily to keep it out of the page bundle. */
export async function downloadExternalInvoiceImportTemplate(filename = "external_invoices_import_template.xlsx") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW, SAMPLE_CARRYOVER], { header: [...HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, filename);
}

export const EXTERNAL_INVOICE_IMPORT_COLUMNS = HEADERS;
