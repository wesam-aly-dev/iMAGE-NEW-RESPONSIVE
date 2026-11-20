"use client";
import React, { useActionState } from "react";
import {
  testNotificationEmailAction,
  testSmtpConnectionAction,
  clearNotificationStatusAction,
} from "@/app/admin/actions";

interface NotificationTestFormProps {
  defaultEmail: string;
  savedRecipient?: string;
  lastTestAt?: string | null;
  lastTestResult?: string | null;
  smtpConfigured: boolean;
  hasResend?: boolean;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpEncryption?: string;
  smtpUser?: string | null;
  hasSmtpPassword?: boolean;
}

export function NotificationTestForm({
  defaultEmail,
  savedRecipient,
  lastTestAt,
  lastTestResult,
  smtpConfigured,
  hasResend,
  smtpHost,
  smtpPort = 465,
  smtpEncryption = "SSL",
  smtpUser,
  hasSmtpPassword,
}: NotificationTestFormProps) {
  const [emailState, emailFormAction, emailPending] = useActionState(testNotificationEmailAction, {});
  const [socketState, socketFormAction, socketPending] = useActionState(testSmtpConnectionAction, {});
  const [clearState, clearFormAction, clearPending] = useActionState(clearNotificationStatusAction, {});

  const isConfigured = smtpConfigured || Boolean(hasResend);

  return (
    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border, #e5e7eb)" }}>
      <div style={{ marginBottom: "16px" }}>
        <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600 }}>
          Verify Email Delivery &amp; Connection Diagnostics / اختبار اتصال البريد
        </h4>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #6b7280)" }}>
          Test raw socket connectivity to your mail server or send an immediate test message to verify delivery.
        </p>
      </div>

      {/* Provider Status Pill */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: isConfigured ? "#ecfdf5" : "#fffbeb",
            color: isConfigured ? "#065f46" : "#92400e",
            border: `1px solid ${isConfigured ? "#a7f3d0" : "#fde68a"}`,
          }}
        >
          <span style={{ fontSize: "10px" }}>{isConfigured ? "●" : "▲"}</span>
          <span>
            {hasResend
              ? "Provider: Resend API"
              : smtpConfigured
              ? `Provider: SMTP (${smtpHost || "custom"}:${smtpPort} ${smtpEncryption})`
              : "No Provider Configured (SMTP / Resend missing)"}
          </span>
        </div>

        {savedRecipient && (
          <div style={{ fontSize: "12px", color: "var(--muted, #6b7280)" }}>
            Primary Recipient: <strong>{savedRecipient}</strong>
          </div>
        )}
      </div>

      {/* Test Actions Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
        {/* 1. Raw SMTP Socket Test (No email sent) */}
        <div style={{ padding: "16px", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px" }}>
          <h5 style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: 600 }}>1. Test SMTP Connection</h5>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--muted, #6b7280)" }}>
            Verifies TCP handshake, TLS encryption, and AUTH credentials without sending an email.
          </p>
          <form action={socketFormAction}>
            <input type="hidden" name="smtpHost" value={smtpHost || ""} />
            <input type="hidden" name="smtpPort" value={String(smtpPort)} />
            <input type="hidden" name="smtpEncryption" value={smtpEncryption} />
            <input type="hidden" name="smtpUser" value={smtpUser || ""} />
            <button
              type="submit"
              disabled={socketPending || (!smtpHost && !process.env.SMTP_HOST)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#ffffff",
                border: "1px solid var(--border, #d1d5db)",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: socketPending ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {socketPending ? "Testing Socket..." : "Test Connection"}
            </button>
          </form>

          {socketState.success && (
            <div style={{ marginTop: "10px", padding: "8px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "4px", fontSize: "12px", color: "#166534" }}>
              &check; {socketState.success}
            </div>
          )}
          {socketState.error && (
            <div style={{ marginTop: "10px", padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "12px", color: "#991b1b" }}>
              &times; {socketState.error}
            </div>
          )}
        </div>

        {/* 2. Dispatch Live Test Email */}
        <div style={{ padding: "16px", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px" }}>
          <h5 style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: 600 }}>2. Send Test Notification Email</h5>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--muted, #6b7280)" }}>
            Sends an immediate test message through your active email provider to confirm inbox delivery.
          </p>
          <form action={emailFormAction} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="testRecipientEmail"
              name="recipientEmail"
              type="email"
              required
              defaultValue={defaultEmail}
              placeholder="admin@imagedevelopments.com"
              style={{
                flex: "1 1 auto",
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #d1d5db)",
                fontSize: "13px",
              }}
            />
            <button
              type="submit"
              disabled={emailPending}
              style={{
                padding: "8px 14px",
                backgroundColor: "#2a4534",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: emailPending ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {emailPending ? "Sending..." : "Send Test"}
            </button>
          </form>

          {emailState.success && (
            <div style={{ marginTop: "10px", padding: "8px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "4px", fontSize: "12px", color: "#166534" }}>
              &check; {emailState.success}
            </div>
          )}
          {emailState.error && (
            <div style={{ marginTop: "10px", padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "12px", color: "#991b1b" }}>
              &times; {emailState.error}
            </div>
          )}
        </div>
      </div>

      {lastTestAt && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "12px", color: "var(--muted, #6b7280)", padding: "10px 12px", background: "rgba(0,0,0,0.01)", border: "1px solid var(--border, #e5e7eb)", borderRadius: "6px" }}>
          <div>
            Last test: <strong>{new Date(lastTestAt).toLocaleString("en-GB")}</strong>
            {lastTestResult && (
              <div style={{ marginTop: "2px", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all" }}>
                {lastTestResult}
              </div>
            )}
          </div>
          <form action={clearFormAction}>
            <button
              type="submit"
              disabled={clearPending}
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                background: "transparent",
                border: "1px solid var(--border, #d1d5db)",
                borderRadius: "4px",
                cursor: "pointer",
                color: "var(--muted, #6b7280)",
              }}
            >
              Clear Status
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
