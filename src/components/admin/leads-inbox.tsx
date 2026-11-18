"use client";

import React, { useState, useTransition } from "react";
import { LeadExport } from "./lead-export";
import {
  deleteLead,
  updateLead,
  markLeadReadStatus,
  toggleLeadArchive,
  retryLeadNotificationAction,
  dispatchPendingNotificationsAction,
} from "@/app/admin/actions";

export interface SerializedLead {
  id: string;
  referenceNumber: string | null;
  name: string;
  email: string;
  phone: string | null;
  countryCode: string | null;
  subject: string;
  projectId: string | null;
  projectName: string | null;
  unitType: string | null;
  formType: string;
  formVariant: string | null;
  sourcePage: string | null;
  sourceCta: string | null;
  consentAccepted: boolean;
  marketingConsent: boolean;
  consentVersion: string | null;
  status: string;
  notes: string | null;
  message: string;
  locale: string;
  notificationStatus: string;
  notificationError: string | null;
  notificationAttempts: number;
  notificationSentAt: string | null;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
}

interface LeadsInboxProps {
  initialLeads: SerializedLead[];
  projects: ProjectOption[];
}

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"] as const;

export function LeadsInbox({ initialLeads, projects }: LeadsInboxProps) {
  const [leads, setLeads] = useState<SerializedLead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<SerializedLead | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "UNREAD" | "NEW" | "CONTACTED" | "QUALIFIED" | "CLOSED" | "FAILED" | "ARCHIVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedFormType, setSelectedFormType] = useState("ALL");
  const [isPending, startTransition] = useTransition();
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string; isError?: boolean } | null>(null);

  // Sync when initialLeads prop updates
  React.useEffect(() => {
    setLeads(initialLeads);
    if (selectedLead) {
      const refreshed = initialLeads.find((l) => l.id === selectedLead.id);
      if (refreshed) setSelectedLead(refreshed);
    }
  }, [initialLeads]);

  // Compute metrics
  const unreadCount = leads.filter((l) => !l.isRead && !l.isArchived).length;
  const newCount = leads.filter((l) => l.status === "NEW" && !l.isArchived).length;
  const failedCount = leads.filter(
    (l) => (l.notificationStatus === "FAILED" || l.notificationStatus === "BLOCKED") && !l.isArchived
  ).length;

  // Filtered list
  const filteredLeads = leads.filter((lead) => {
    // Tab filter
    if (activeTab === "ARCHIVED") {
      if (!lead.isArchived) return false;
    } else {
      if (lead.isArchived) return false;
      if (activeTab === "UNREAD" && lead.isRead) return false;
      if (activeTab === "NEW" && lead.status !== "NEW") return false;
      if (activeTab === "CONTACTED" && lead.status !== "CONTACTED") return false;
      if (activeTab === "QUALIFIED" && lead.status !== "QUALIFIED") return false;
      if (activeTab === "CLOSED" && lead.status !== "CLOSED") return false;
      if (activeTab === "FAILED" && lead.notificationStatus !== "FAILED" && lead.notificationStatus !== "BLOCKED") return false;
    }

    // Project filter
    if (selectedProject !== "ALL") {
      if (lead.projectId !== selectedProject && lead.projectName !== selectedProject) return false;
    }

    // Form type filter
    if (selectedFormType !== "ALL") {
      if (lead.formType !== selectedFormType) return false;
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.phone && lead.phone.toLowerCase().includes(q)) ||
        (lead.referenceNumber && lead.referenceNumber.toLowerCase().includes(q)) ||
        (lead.projectName && lead.projectName.toLowerCase().includes(q)) ||
        (lead.message && lead.message.toLowerCase().includes(q)) ||
        (lead.notes && lead.notes.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const handleToggleRead = (id: string, currentRead: boolean) => {
    const nextRead = !currentRead;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, isRead: nextRead } : l)));
    if (selectedLead?.id === id) {
      setSelectedLead((prev) => (prev ? { ...prev, isRead: nextRead } : null));
    }
    startTransition(async () => {
      await markLeadReadStatus(id, nextRead);
    });
  };

  const handleToggleArchive = (id: string, currentArchived: boolean) => {
    const nextArchived = !currentArchived;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, isArchived: nextArchived } : l)));
    if (selectedLead?.id === id) {
      setSelectedLead(null);
    }
    startTransition(async () => {
      await toggleLeadArchive(id, nextArchived);
    });
  };

  const handleRetryNotification = async (id: string) => {
    setActionFeedback({ id, message: "Retrying email dispatch..." });
    const res = await retryLeadNotificationAction(id);
    if (res.success) {
      setActionFeedback({ id, message: res.success, isError: false });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, notificationStatus: "DELIVERED", notificationError: null } : l
        )
      );
      if (selectedLead?.id === id) {
        setSelectedLead((prev) =>
          prev ? { ...prev, notificationStatus: "DELIVERED", notificationError: null } : null
        );
      }
    } else {
      setActionFeedback({ id, message: res.error || "Retry failed", isError: true });
    }
  };

  const handleProcessOutbox = () => {
    setActionFeedback({ id: "outbox", message: "Processing pending outbox jobs..." });
    startTransition(async () => {
      const res = await dispatchPendingNotificationsAction();
      if (res.success) {
        setActionFeedback({ id: "outbox", message: res.success, isError: false });
      } else {
        setActionFeedback({ id: "outbox", message: res.error || "Failed to process outbox", isError: true });
      }
    });
  };

  const exportData = filteredLeads.map((l) => ({
    createdAt: l.createdAt,
    name: l.name,
    email: l.email,
    phone: l.phone ?? "",
    subject: l.subject,
    message: l.message,
    status: l.status,
    notes: l.notes ?? "",
  }));

  const getFormTypeBadge = (type: string) => {
    switch (type) {
      case "CALLBACK":
        return <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "#eff6ff", color: "#1d4ed8" }}>Callback</span>;
      case "PROJECT_INQUIRY":
        return <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "#fdf2f8", color: "#be185d" }}>Project</span>;
      case "UNIT_INQUIRY":
        return <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "#fef3c7", color: "#b45309" }}>Unit & Plan</span>;
      case "REGISTER_INTEREST":
        return <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "#f3e8ff", color: "#7e22ce" }}>Interest</span>;
      case "CAREER_APPLICATION":
        return <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "#ede9fe", color: "#6d28d9" }}>Career App</span>;
      default:
        return <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "#f3f4f6", color: "#374151" }}>General</span>;
    }
  };

  const getNotificationBadge = (status: string, error?: string | null) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span
            title="Email delivery confirmed"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: "#dcfce7", color: "#15803d" }}
          >
            &check; Delivered
          </span>
        );
      case "ACCEPTED":
        return (
          <span
            title="Email accepted by provider for delivery"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: "#dbeafe", color: "#1d4ed8" }}
          >
            &check; Accepted by Provider
          </span>
        );
      case "PROCESSING":
        return (
          <span
            title="Notification currently in progress"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: "#e0e7ff", color: "#4338ca" }}
          >
            Processing...
          </span>
        );
      case "BLOCKED": {
        const isRecipientError = error?.includes("recipient");
        return (
          <span
            title={error || "Delivery blocked: Check SMTP or recipient configuration"}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: "#fef3c7", color: "#b45309" }}
          >
            &bull; {isRecipientError ? "Blocked (No Recipient)" : "Blocked (No SMTP)"}
          </span>
        );
      }
      case "FAILED":
        return (
          <span
            title={error || "Delivery failed"}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: "#fee2e2", color: "#b91c1c" }}
          >
            &times; Failed
          </span>
        );
      case "SKIPPED":
        return (
          <span
            title="Notification disabled in settings"
            style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 500, backgroundColor: "#f3f4f6", color: "#6b7280" }}
          >
            — Skipped
          </span>
        );
      default:
        return (
          <span
            title="Pending dispatch"
            style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 500, backgroundColor: "#f3f4f6", color: "#4b5563" }}
          >
            Pending
          </span>
        );
    }
  };

  return (
    <div className="leads-inbox-container">
      {/* Metric Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        <div style={{ backgroundColor: "#ffffff", padding: "14px 18px", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted, #5e6b63)", textTransform: "uppercase", fontWeight: 600 }}>Total Inquiries</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink, #162c20)", marginTop: "4px" }}>{leads.length}</div>
        </div>
        <div style={{ backgroundColor: "#ffffff", padding: "14px 18px", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted, #5e6b63)", textTransform: "uppercase", fontWeight: 600 }}>Unread</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: unreadCount > 0 ? "#b36f55" : "var(--ink, #162c20)", marginTop: "4px" }}>
            {unreadCount}
          </div>
        </div>
        <div style={{ backgroundColor: "#ffffff", padding: "14px 18px", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted, #5e6b63)", textTransform: "uppercase", fontWeight: 600 }}>New Status</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#2a4534", marginTop: "4px" }}>{newCount}</div>
        </div>
        <div style={{ backgroundColor: "#ffffff", padding: "14px 18px", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)" }}>
          <div style={{ fontSize: "12px", color: "var(--muted, #5e6b63)", textTransform: "uppercase", fontWeight: 600 }}>Notification Issues</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: failedCount > 0 ? "#b91c1c" : "var(--ink, #162c20)", marginTop: "4px" }}>
            {failedCount}
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--line, #dfe4dc)",
          marginBottom: "16px",
          overflowX: "auto",
          paddingBottom: "2px",
        }}
      >
        {[
          { key: "ALL", label: "All Leads" },
          { key: "UNREAD", label: `Unread (${unreadCount})` },
          { key: "NEW", label: "New" },
          { key: "CONTACTED", label: "Contacted" },
          { key: "QUALIFIED", label: "Qualified" },
          { key: "CLOSED", label: "Closed" },
          ...(failedCount > 0 ? [{ key: "FAILED", label: `Delivery Issues (${failedCount})` }] : []),
          { key: "ARCHIVED", label: "Archived" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid #2a4534" : "2px solid transparent",
              color: activeTab === tab.key ? "#2a4534" : "var(--muted, #5e6b63)",
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", flex: "1 1 500px" }}>
          <input
            type="search"
            placeholder="Search leads by name, email, phone, ref, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: "1 1 240px",
              padding: "7px 12px",
              fontSize: "13px",
              border: "1px solid var(--line, #dfe4dc)",
              borderRadius: "6px",
            }}
          />

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{
              padding: "7px 10px",
              fontSize: "13px",
              border: "1px solid var(--line, #dfe4dc)",
              borderRadius: "6px",
              background: "#ffffff",
            }}
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={selectedFormType}
            onChange={(e) => setSelectedFormType(e.target.value)}
            style={{
              padding: "7px 10px",
              fontSize: "13px",
              border: "1px solid var(--line, #dfe4dc)",
              borderRadius: "6px",
              background: "#ffffff",
            }}
          >
            <option value="ALL">All Form Types</option>
            <option value="GENERAL_CONTACT">General Contact</option>
            <option value="CALLBACK">Callback Request</option>
            <option value="PROJECT_INQUIRY">Project Inquiry</option>
            <option value="UNIT_INQUIRY">Unit / Floor Plan</option>
            <option value="REGISTER_INTEREST">Register Interest</option>
            <option value="CAREER_APPLICATION">Career Applications</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={handleProcessOutbox}
            disabled={isPending}
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "#2a4534",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>Process Outbox</span>
          </button>
          <LeadExport leads={exportData} />
        </div>
      </div>

      {/* Global Feedback Banner */}
      {actionFeedback && (
        <div
          role="status"
          style={{
            padding: "8px 14px",
            marginBottom: "14px",
            borderRadius: "6px",
            fontSize: "13px",
            backgroundColor: actionFeedback.isError ? "#fee2e2" : "#f0fdf4",
            color: actionFeedback.isError ? "#991b1b" : "#166534",
            border: `1px solid ${actionFeedback.isError ? "#fecaca" : "#bbf7d0"}`,
          }}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Leads Table */}
      <div className="table-wrap" style={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line, #dfe4dc)", backgroundColor: "#fafaf8" }}>
              <th style={{ padding: "10px 14px", width: "36px" }} />
              <th style={{ padding: "10px 14px" }}>Ref & Date</th>
              <th style={{ padding: "10px 14px" }}>Customer</th>
              <th style={{ padding: "10px 14px" }}>Inquiry Details</th>
              <th style={{ padding: "10px 14px" }}>Notification</th>
              <th style={{ padding: "10px 14px" }}>Status / Notes</th>
              <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => {
              const isUnread = !lead.isRead;
              return (
                <tr
                  key={lead.id}
                  style={{
                    borderBottom: "1px solid var(--line-subtle, #edf1ea)",
                    backgroundColor: isUnread ? "#fdfbf7" : "transparent",
                    fontWeight: isUnread ? 500 : 400,
                  }}
                >
                  {/* Read / Unread Indicator Dot */}
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <button
                      type="button"
                      title={lead.isRead ? "Mark as unread" : "Mark as read"}
                      onClick={() => handleToggleRead(lead.id, lead.isRead)}
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        border: "none",
                        backgroundColor: lead.isRead ? "#d1d5db" : "#b36f55",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  </td>

                  {/* Ref & Date */}
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 600, color: "#2a4534" }}>
                      {lead.referenceNumber || `INQ-${lead.id.slice(0, 6)}`}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted, #5e6b63)", marginTop: "2px" }}>
                      {new Date(lead.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>

                  {/* Customer Contact */}
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600, color: "var(--ink, #162c20)" }}>{lead.name}</div>
                    <div style={{ fontSize: "12px", marginTop: "2px" }}>
                      <a href={`mailto:${lead.email}`} style={{ color: "#2a4534", textDecoration: "underline" }}>
                        {lead.email}
                      </a>
                    </div>
                    {lead.phone && (
                      <div style={{ fontSize: "12px", marginTop: "2px" }}>
                        <a href={`tel:${lead.phone}`} style={{ color: "#b36f55" }}>
                          {lead.phone}
                        </a>
                      </div>
                    )}
                  </td>

                  {/* Inquiry Details */}
                  <td style={{ padding: "10px 14px", maxWidth: "240px" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                      {getFormTypeBadge(lead.formType)}
                      {lead.projectName && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#b36f55" }}>
                          {lead.projectName}
                        </span>
                      )}
                      {lead.unitType && (
                        <span style={{ fontSize: "11px", color: "#4b5563" }}>({lead.unitType})</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted, #5e6b63)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {lead.message}
                    </div>
                  </td>

                  {/* Notification Status */}
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <div>{getNotificationBadge(lead.notificationStatus, lead.notificationError)}</div>
                    {(lead.notificationStatus === "FAILED" || lead.notificationStatus === "BLOCKED") && (
                      <button
                        type="button"
                        onClick={() => handleRetryNotification(lead.id)}
                        disabled={isPending}
                        style={{
                          marginTop: "4px",
                          display: "block",
                          fontSize: "11px",
                          color: "#2a4534",
                          textDecoration: "underline",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Retry delivery
                      </button>
                    )}
                  </td>

                  {/* Follow-up / Status Form */}
                  <td style={{ padding: "10px 14px" }}>
                    <form action={updateLead} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <input type="hidden" name="id" value={lead.id} />
                      <div style={{ display: "flex", gap: "4px" }}>
                        <select
                          name="status"
                          defaultValue={lead.status}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            border: "1px solid var(--line, #dfe4dc)",
                            background: "#ffffff",
                          }}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          style={{
                            padding: "4px 10px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            border: "1px solid var(--line, #dfe4dc)",
                            background: "#fafaf8",
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>
                      </div>
                      <input
                        type="text"
                        name="notes"
                        defaultValue={lead.notes ?? ""}
                        placeholder="Internal notes..."
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "4px",
                          border: "1px solid var(--line, #dfe4dc)",
                          width: "100%",
                        }}
                      />
                    </form>
                  </td>

                  {/* Row Actions */}
                  <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLead(lead);
                        if (!lead.isRead) handleToggleRead(lead.id, false);
                      }}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: "#2a4534",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "6px",
                      }}
                    >
                      Details &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(lead.id, lead.isArchived)}
                      title={lead.isArchived ? "Unarchive lead" : "Archive lead"}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: "#f3f4f6",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "6px",
                      }}
                    >
                      {lead.isArchived ? "Unarchive" : "Archive"}
                    </button>
                    <form action={deleteLead} style={{ display: "inline-block" }}>
                      <input type="hidden" name="id" value={lead.id} />
                      <button
                        type="submit"
                        className="danger"
                        onClick={(e) => {
                          if (!confirm(`Delete inquiry from ${lead.name}?`)) e.preventDefault();
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: "12px",
                          backgroundColor: "#fef2f2",
                          color: "#991b1b",
                          border: "1px solid #fecaca",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredLeads.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--muted, #5e6b63)" }}>
            No leads match your filter or search query.
          </div>
        )}
      </div>

      {/* Detail Slide-out Drawer / Modal */}
      {selectedLead && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLead(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "540px",
              height: "100%",
              backgroundColor: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              overflowY: "auto",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "1px solid var(--line, #dfe4dc)", paddingBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: "#2a4534" }}>
                    {selectedLead.referenceNumber || `INQ-${selectedLead.id.slice(0, 8)}`}
                  </span>
                  {getFormTypeBadge(selectedLead.formType)}
                </div>
                <h3 style={{ margin: "6px 0 0 0", fontSize: "18px", fontWeight: 600 }}>{selectedLead.name}</h3>
                <div style={{ fontSize: "12px", color: "var(--muted, #5e6b63)", marginTop: "2px" }}>
                  Submitted on {new Date(selectedLead.createdAt).toLocaleString("en-GB")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "var(--muted, #5e6b63)",
                  padding: "4px 8px",
                }}
              >
                &times;
              </button>
            </div>

            {/* Quick Contact Box */}
            <div style={{ backgroundColor: "#f9f8f5", padding: "16px", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", color: "#627264", marginBottom: "8px" }}>
                Contact Information
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px", fontSize: "13px" }}>
                <span style={{ color: "var(--muted, #5e6b63)" }}>Email:</span>
                <a href={`mailto:${selectedLead.email}`} style={{ color: "#2a4534", fontWeight: 600, textDecoration: "underline" }}>
                  {selectedLead.email}
                </a>

                <span style={{ color: "var(--muted, #5e6b63)" }}>Phone:</span>
                {selectedLead.phone ? (
                  <a href={`tel:${selectedLead.phone}`} style={{ color: "#b36f55", fontWeight: 700 }}>
                    {selectedLead.phone}
                  </a>
                ) : (
                  <span style={{ color: "#999" }}>Not provided</span>
                )}

                {selectedLead.projectName && (
                  <>
                    <span style={{ color: "var(--muted, #5e6b63)" }}>Project:</span>
                    <strong style={{ color: "#b36f55" }}>{selectedLead.projectName}</strong>
                  </>
                )}

                {selectedLead.unitType && (
                  <>
                    <span style={{ color: "var(--muted, #5e6b63)" }}>Unit Type:</span>
                    <span>{selectedLead.unitType}</span>
                  </>
                )}
              </div>
            </div>

            {/* Origin & Consent Metadata */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", color: "#627264", marginBottom: "8px" }}>
                Submission Source & Consent
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px", fontSize: "13px" }}>
                <span style={{ color: "var(--muted, #5e6b63)" }}>Source Page:</span>
                <code style={{ fontSize: "12px", background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
                  {selectedLead.sourcePage || "Direct"}
                </code>

                <span style={{ color: "var(--muted, #5e6b63)" }}>Trigger CTA:</span>
                <span>{selectedLead.sourceCta || "Standard Submit"}</span>

                <span style={{ color: "var(--muted, #5e6b63)" }}>Terms & Privacy:</span>
                <span>{selectedLead.consentAccepted ? "✓ Accepted" : "Declined"}</span>

                <span style={{ color: "var(--muted, #5e6b63)" }}>Marketing:</span>
                <span>{selectedLead.marketingConsent ? "✓ Opted in" : "No"}</span>

                <span style={{ color: "var(--muted, #5e6b63)" }}>Language:</span>
                <span>{selectedLead.locale === "ar" ? "Arabic (العربية)" : "English"}</span>
              </div>
            </div>

            {/* Message Body */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", color: "#627264", marginBottom: "8px" }}>
                Customer Requirements / Message
              </div>
              <div
                style={{
                  backgroundColor: "#faf9f6",
                  border: "1px solid var(--line, #dfe4dc)",
                  borderRadius: "6px",
                  padding: "14px 16px",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedLead.message || "No custom message provided."}
              </div>
            </div>

            {selectedLead.formType === "CAREER_APPLICATION" && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "12px 16px",
                  backgroundColor: "#f5f3ff",
                  border: "1px solid #ddd6fe",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#5b21b6",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Linked Career Vacancy Application</div>
                <div>
                  This inquiry corresponds to a candidate application submitted through the Careers portal.
                  Candidate CV files remain securely stored in private storage.
                </div>
                <div style={{ marginTop: "8px" }}>
                  <a
                    href="/admin/careers"
                    style={{
                      display: "inline-block",
                      color: "#6d28d9",
                      fontWeight: 600,
                      textDecoration: "underline",
                      fontSize: "12px",
                    }}
                  >
                    Open Careers Portal to Review Application & Download CV →
                  </a>
                </div>
              </div>
            )}

            {/* Notification Delivery Box */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--line, #dfe4dc)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", color: "#627264" }}>
                  Email Notification Dispatch
                </span>
                {getNotificationBadge(selectedLead.notificationStatus, selectedLead.notificationError)}
              </div>
              {selectedLead.notificationSentAt && (
                <div style={{ fontSize: "12px", color: "var(--muted, #5e6b63)" }}>
                  Delivered at: {new Date(selectedLead.notificationSentAt).toLocaleString("en-GB")}
                </div>
              )}
              {selectedLead.notificationError && (
                <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "4px", background: "#fef2f2", padding: "8px 12px", borderRadius: "4px" }}>
                  <strong>Error:</strong> {selectedLead.notificationError}
                </div>
              )}
              <div style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleRetryNotification(selectedLead.id)}
                  style={{
                    padding: "6px 14px",
                    backgroundColor: "#2a4534",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Retry Email Notification Dispatch →
                </button>
              </div>
            </div>

            {/* Follow-up Notes & Status Form */}
            <div style={{ marginTop: "auto", borderTop: "1px solid var(--line, #dfe4dc)", paddingTop: "16px" }}>
              <form action={updateLead} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input type="hidden" name="id" value={selectedLead.id} />
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Lead Follow-up Status
                  </label>
                  <select
                    name="status"
                    defaultValue={selectedLead.status}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--line, #dfe4dc)",
                      fontSize: "13px",
                    }}
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Follow-up Notes / Activity Log
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={selectedLead.notes ?? ""}
                    rows={4}
                    placeholder="Log calls, client interest, scheduled visits, or qualification notes..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--line, #dfe4dc)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    style={{
                      padding: "9px 20px",
                      backgroundColor: "#2a4534",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Save Follow-up Details
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

