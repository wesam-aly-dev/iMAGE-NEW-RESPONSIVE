"use client";
import React, { useActionState } from "react";
import { testNotificationEmailAction } from "@/app/admin/actions";

interface NotificationTestFormProps {
  defaultEmail: string;
  savedRecipient?: string;
  lastTestAt?: string | null;
  lastTestResult?: string | null;
  smtpConfigured: boolean;
  hasResend?: boolean;
}

export function NotificationTestForm({
  defaultEmail,
  savedRecipient,
  lastTestAt,
  lastTestResult,
  smtpConfigured,
  hasResend,
}: NotificationTestFormProps) {
  const [state, formAction, pending] = useActionState(testNotificationEmailAction, {});

  const isConfigured = smtpConfigured || Boolean(hasResend);

  return (
    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border, #e5e7eb)" }}>
      <div style={{ marginBottom: "16px" }}>
        <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600 }}>
          Verify Email Delivery / اختبار إرسال البريد
        </h4>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #6b7280)" }}>
          Send an immediate test message through your configured mail delivery adapter to verify connectivity.
        </p>
      </div>

      {/* Provider Status Pill */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
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
              ? "Provider: Direct SMTP"
              : "No Provider Configured (SMTP / Resend missing)"}
          </span>
        </div>

        {savedRecipient && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--muted, #6b7280)",
            }}
          >
            Saved CMS Inquiries Recipient: <strong>{savedRecipient}</strong>
          </div>
        )}
      </div>

      {!isConfigured && (
        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#92400e",
            marginBottom: "14px",
          }}
        >
          <strong>Notice:</strong> No SMTP or Resend credentials found in environment variables (
          <code>SMTP_HOST</code> or <code>RESEND_API_KEY</code>). Test dispatch will test the pipeline and report <code>BLOCKED</code> until credentials are supplied in your server environment.
        </div>
      )}

      <form action={formAction} style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <label
            htmlFor="testRecipientEmail"
            style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}
          >
            Test Destination Email / بريد استلام الرسالة التجريبية
          </label>
          <input
            id="testRecipientEmail"
            name="recipientEmail"
            type="email"
            required
            defaultValue={defaultEmail}
            placeholder="admin@imagedevelopments.com"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border, #d1d5db)",
              fontSize: "14px",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 18px",
            backgroundColor: "#2a4534",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {pending ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>Send Test Email</span>
              <span aria-hidden="true" style={{ fontSize: "14px" }}>→</span>
            </>
          )}
        </button>
      </form>

      {state.success && (
        <div
          role="status"
          style={{
            marginTop: "14px",
            padding: "10px 14px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#166534",
          }}
        >
          &check; {state.success}
        </div>
      )}

      {state.error && (
        <div
          role="alert"
          style={{
            marginTop: "14px",
            padding: "10px 14px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#991b1b",
          }}
        >
          &times; {state.error}
        </div>
      )}

      {lastTestAt && (
        <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--muted, #6b7280)" }}>
          Last test run: <strong>{new Date(lastTestAt).toLocaleString("en-GB")}</strong>
          {lastTestResult && (
            <div style={{ marginTop: "2px", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all" }}>
              {lastTestResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
