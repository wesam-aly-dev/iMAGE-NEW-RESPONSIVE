"use client";

import { useState } from "react";

export type ExportLead = {
  createdAt: string;
  name: string;
  email: string | null;
  phone: string;
  subject: string;
  message: string;
  status: string;
  notes: string;
};

type ExportFormat = "csv" | "json" | "pdf";

const csvCell = (value: string) => {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
};

export function leadsToCsv(leads: ExportLead[]) {
  const headings = ["Date", "Name", "Email", "Phone", "Project", "Message", "Status", "Follow-up notes"];
  const rows = leads.map((lead) => [
    lead.createdAt,
    lead.name,
    lead.email ?? "",
    lead.phone,
    lead.subject,
    lead.message,
    lead.status,
    lead.notes,
  ]);

  return [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadFile(contents: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LeadExport({ leads }: { leads: ExportLead[] }) {
  const [format, setFormat] = useState<ExportFormat>("csv");

  function exportLeads() {
    const date = new Date().toISOString().slice(0, 10);

    if (format === "pdf") {
      window.print();
      return;
    }

    if (format === "json") {
      downloadFile(JSON.stringify(leads, null, 2), "application/json;charset=utf-8", `leads-${date}.json`);
      return;
    }

    downloadFile(`\uFEFF${leadsToCsv(leads)}`, "text/csv;charset=utf-8", `leads-${date}.csv`);
  }

  return (
    <div className="lead-export" aria-label="Export leads" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "13px" }}>
        <span style={{ fontWeight: 500, color: "var(--muted)" }}>Format:</span>
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
          style={{ width: "auto", padding: "6px 10px", fontSize: "12.5px", height: "34px", borderRadius: "var(--radius-sm)" }}
        >
          <option value="csv">CSV (.csv)</option>
          <option value="pdf">Print / PDF (.pdf)</option>
          <option value="json">JSON (.json)</option>
        </select>
      </label>
      <button
        className="secondary"
        type="button"
        onClick={exportLeads}
        disabled={!leads.length}
        style={{ height: "34px", padding: "0 13px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Export {leads.length} {leads.length === 1 ? "lead" : "leads"}</span>
      </button>
    </div>
  );
}
