import { CareerApplicationPayload, FormType, LeadInquiryPayload, TestEmailPayload } from "./types";

function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatExplicitTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Africa/Cairo",
    });
    const timePart = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      timeZone: "Africa/Cairo",
    });
    return `${datePart}, ${timePart} (Cairo Time)`;
  } catch {
    return isoString;
  }
}

function getFormTypeTitle(formType: FormType | string, isAr: boolean): string {
  switch (formType) {
    case "CALLBACK":
      return isAr ? "طلب معاودة الاتصال" : "Callback Request";
    case "UNIT_INQUIRY":
      return isAr ? "استفسار عن وحدة" : "Unit Inquiry";
    case "REGISTER_INTEREST":
      return isAr ? "تسجيل اهتمام" : "Register Interest";
    case "PROJECT_INQUIRY":
      return isAr ? "استفسار عن مشروع" : "Project Inquiry";
    case "CAREER_APPLICATION":
      return isAr ? "طلب توظيف" : "Career Application";
    case "GENERAL_CONTACT":
    default:
      return isAr ? "استفسار عام" : "General Inquiry";
  }
}

function cleanHeader(val?: string | null): string {
  if (!val) return "";
  return String(val).replace(/[\r\n\t]+/g, " ").trim();
}

export function buildLeadEmail(payload: LeadInquiryPayload, appUrl = ""): { subject: string; text: string; html: string } {
  const isAr = payload.locale === "ar";
  const formTypeLabel = getFormTypeTitle(payload.formType, isAr);

  const safeName = cleanHeader(payload.name) || (isAr ? "عميل" : "Customer");
  const safeRef = cleanHeader(payload.referenceNumber);
  const subject = isAr
    ? `استفسار جديد عبر الموقع | ${safeName} | ${safeRef}`
    : `New Website Inquiry | ${safeName} | ${safeRef}`;

  const formattedTime = formatExplicitTimestamp(payload.createdAt);

  const cleanAppUrl = appUrl.replace(/\/+$/, "");
  const cmsLeadUrl = cleanAppUrl ? `${cleanAppUrl}/admin/leads?id=${encodeURIComponent(payload.referenceNumber)}` : "";

  const submissionLangDisplay = isAr ? "العربية (Arabic)" : "English";

  // Check if message should be shown (omit empty or placeholder default messages)
  const isDefaultCallbackMessage =
    !payload.message ||
    !payload.message.trim() ||
    payload.message === "Request a Call Back" ||
    payload.message === "طلب معاودة الاتصال";
  const hasCustomMessage = !isDefaultCallbackMessage;

  const phoneDisplay = payload.phone
    ? `${payload.countryCode ? `+${payload.countryCode.replace(/^\+/, "")} ` : ""}${payload.phone}`.trim()
    : (isAr ? "غير محدد" : "Not provided");

  const emailDisplay = payload.email && payload.email.trim()
    ? payload.email.trim()
    : (isAr ? "غير محدد" : "Not provided");

  const projectDisplay = payload.projectName && payload.projectName.trim()
    ? payload.projectName.trim()
    : (isAr ? "استفسار عام" : "General inquiry");

  // Plain-text alternative
  const textLines: string[] = [
    "Image Developments",
    isAr ? "إشعار استفسار جديد عبر الموقع" : "New Website Inquiry",
    "-------------------",
    "",
    isAr
      ? "تم استلام استفسار جديد عبر الموقع الإلكتروني:"
      : "A new inquiry has been received through the website.",
    "",
    `${isAr ? "الرقم المرجعي" : "Reference Number"}: ${payload.referenceNumber}`,
    `${isAr ? "نوع الاستفسار" : "Inquiry Type"}: ${formTypeLabel}`,
    `${isAr ? "الاسم بالكامل" : "Customer Name"}: ${payload.name}`,
    `${isAr ? "رقم الهاتف" : "Phone"}: ${phoneDisplay}`,
    `${isAr ? "البريد الإلكتروني" : "Email"}: ${emailDisplay}`,
    `${isAr ? "المشروع / الاهتمام" : "Project / Interest"}: ${projectDisplay}`,
  ];

  if (payload.unitType) {
    textLines.push(`${isAr ? "نوع الوحدة" : "Unit Type"}: ${payload.unitType}`);
  }
  if (hasCustomMessage && payload.message) {
    textLines.push(`${isAr ? "نص الرسالة" : "Message"}: ${payload.message.trim()}`);
  }
  textLines.push(`${isAr ? "صفحة التقديم" : "Source Page"}: ${payload.sourcePage || (isAr ? "نموذج التواصل بالموقع" : "Website Contact Form")}`);
  textLines.push(`${isAr ? "لغة التقديم" : "Submission Language"}: ${submissionLangDisplay}`);
  textLines.push(`${isAr ? "تاريخ ووقت التقديم" : "Submission Date & Time"}: ${formattedTime}`);

  if (cmsLeadUrl) {
    textLines.push("");
    textLines.push(`${isAr ? "عرض الاستفسار في لوحة التحكم" : "View Inquiry in CMS"}: ${cmsLeadUrl}`);
  }

  textLines.push("");
  textLines.push("Automated notification from Image Developments.");

  const text = textLines.join("\n");

  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";
  const brandName = isAr ? "إيمدج للتطوير العقاري" : "Image Developments";
  const headerTitle = isAr ? "إشعار استفسار جديد" : "New Website Inquiry";
  const leadSummary = isAr
    ? "تم استلام استفسار جديد عبر نماذج الموقع الإلكتروني."
    : "A new inquiry has been received through the website.";

  const html = `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin: 0; padding: 0; background-color: #f6f7f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #162c20; line-height: 1.5; direction: ${dir}; text-align: ${align}; }
  .email-container { width: 100%; max-width: 580px; margin: 32px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #dfe4dc; }
  .email-header { background-color: #233d2c; padding: 24px 28px; color: #ffffff; }
  .email-brand { font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; color: #d9965a; margin: 0 0 4px 0; font-weight: 600; }
  .email-title { font-size: 20px; font-weight: 500; margin: 0; color: #ffffff; }
  .email-body { padding: 28px; }
  .email-summary { font-size: 14px; color: #5e6b63; margin: 0 0 20px 0; line-height: 1.5; }
  .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .details-table tr { border-bottom: 1px solid #edf1ea; }
  .details-table td { padding: 10px 0; font-size: 13px; vertical-align: top; text-align: ${align}; }
  .label-col { width: 155px; color: #5e6b63; font-weight: 500; }
  .value-col { color: #162c20; font-weight: 600; }
  .message-block { background-color: #f6f7f3; border-${isAr ? "right" : "left"}: 3px solid #d9965a; padding: 12px 16px; margin: 16px 0 24px 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #162c20; }
  .action-wrap { text-align: center; margin: 28px 0 12px 0; }
  .action-btn { display: inline-block; background-color: #233d2c; color: #ffffff !important; text-decoration: none; padding: 11px 26px; border-radius: 6px; font-size: 13px; font-weight: 600; }
  .email-footer { background-color: #faf9f6; border-top: 1px solid #dfe4dc; padding: 16px 28px; text-align: center; font-size: 12px; color: #5e6b63; }
</style>
</head>
<body>
<div class="email-container">
  <div class="email-header">
    <div class="email-brand">${escapeHtml(brandName)}</div>
    <h1 class="email-title">${escapeHtml(headerTitle)}</h1>
  </div>
  <div class="email-body">
    <p class="email-summary">${escapeHtml(leadSummary)}</p>

    <table class="details-table" role="presentation">
      <tr>
        <td class="label-col">${isAr ? "الرقم المرجعي:" : "Reference Number:"}</td>
        <td class="value-col" style="font-family: monospace; color: #233d2c;">${escapeHtml(payload.referenceNumber)}</td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "نوع الاستفسار:" : "Inquiry Type:"}</td>
        <td class="value-col" style="color: #233d2c;">${escapeHtml(formTypeLabel)}</td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "الاسم بالكامل:" : "Customer Name:"}</td>
        <td class="value-col">${escapeHtml(payload.name)}</td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "رقم الهاتف:" : "Phone:"}</td>
        <td class="value-col" dir="ltr" style="text-align: ${align};">
          ${payload.phone ? `<a href="tel:${escapeHtml((payload.countryCode ? `+${payload.countryCode.replace(/[^\d]/g, "")}` : "") + payload.phone.replace(/[^\d+]/g, ""))}" style="color: #b36f55; text-decoration: none; font-weight: 600;">${escapeHtml(phoneDisplay)}</a>` : `<span style="color: #718076;">${isAr ? "غير محدد" : "Not provided"}</span>`}
        </td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "البريد الإلكتروني:" : "Email:"}</td>
        <td class="value-col">
          ${payload.email && payload.email.trim() ? `<a href="mailto:${escapeHtml(payload.email.trim())}" style="color: #233d2c; text-decoration: underline;">${escapeHtml(payload.email.trim())}</a>` : `<span style="color: #718076; font-style: italic;">${isAr ? "غير محدد" : "Not provided"}</span>`}
        </td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "المشروع / الاهتمام:" : "Project / Interest:"}</td>
        <td class="value-col">
          ${payload.projectName && payload.projectName.trim() ? `<span style="color: #233d2c; font-weight: 600;">${escapeHtml(payload.projectName.trim())}</span>` : `<span style="color: #718076; font-style: italic;">${isAr ? "استفسار عام" : "General inquiry"}</span>`}
        </td>
      </tr>
      ${payload.unitType ? `
      <tr>
        <td class="label-col">${isAr ? "نوع الوحدة:" : "Unit Type:"}</td>
        <td class="value-col">${escapeHtml(payload.unitType)}</td>
      </tr>` : ""}
      <tr>
        <td class="label-col">${isAr ? "صفحة التقديم:" : "Source Form/Page:"}</td>
        <td class="value-col" style="font-family: monospace; font-size: 12px; color: #5e6b63;">${escapeHtml(payload.sourcePage || "Website Contact Form")}</td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "لغة التقديم:" : "Language:"}</td>
        <td class="value-col">${escapeHtml(submissionLangDisplay)}</td>
      </tr>
      <tr>
        <td class="label-col">${isAr ? "تاريخ التقديم:" : "Submission Time:"}</td>
        <td class="value-col" style="font-size: 12px;">${escapeHtml(formattedTime)}</td>
      </tr>
    </table>

    ${hasCustomMessage ? `
    <div style="font-size: 12px; font-weight: 600; color: #5e6b63; text-transform: uppercase; margin-top: 16px;">${isAr ? "رسالة العميل:" : "Customer Message:"}</div>
    <div class="message-block">${escapeHtml(payload.message.trim())}</div>
    ` : ""}

    ${cmsLeadUrl ? `
    <div class="action-wrap">
      <a href="${escapeHtml(cmsLeadUrl)}" class="action-btn" target="_blank" rel="noopener noreferrer">${isAr ? "عرض الاستفسار في لوحة التحكم ←" : "View Inquiry in CMS →"}</a>
    </div>
    ` : ""}
  </div>
  <div class="email-footer">
    ${isAr ? "إشعار تلقائي من إيمدج للتطوير العقاري." : "Automated notification from Image Developments."}
  </div>
</div>
</body>
</html>`;

  return { subject, text, html };
}

export function buildCareerEmail(payload: CareerApplicationPayload, appUrl = ""): { subject: string; text: string; html: string } {
  const subject = `New Application — ${payload.jobTitle} — ${payload.referenceNumber}`;
  const formattedTime = formatExplicitTimestamp(payload.createdAt);

  const cleanAppUrl = appUrl.replace(/\/+$/, "");
  const cmsCareerUrl = cleanAppUrl ? `${cleanAppUrl}/admin/careers` : "";

  const text = [
    "Image Developments",
    "New Job Application",
    "-------------------",
    "",
    "A candidate has submitted an application through the careers portal.",
    "",
    `Reference Number: ${payload.referenceNumber}`,
    `Position: ${payload.jobTitle}`,
    `Candidate Name: ${payload.fullName}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email}`,
    `CV/Resume File: ${payload.cvFilename}`,
    `Submission Date & Time: ${formattedTime}`,
    ...(payload.notes ? [`Notes: ${payload.notes}`] : []),
    "",
    cmsCareerUrl ? `View in CMS Careers Portal: ${cmsCareerUrl}` : "",
    "",
    "Note: Candidate CV documents remain stored in authenticated private storage.",
    "Automated notification from Image Developments.",
  ].filter(Boolean).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin: 0; padding: 0; background-color: #f6f7f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #162c20; line-height: 1.5; }
  .email-container { width: 100%; max-width: 580px; margin: 32px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #dfe4dc; }
  .email-header { background-color: #233d2c; padding: 24px 28px; color: #ffffff; }
  .email-brand { font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; color: #d9965a; margin: 0 0 4px 0; font-weight: 600; }
  .email-title { font-size: 20px; font-weight: 500; margin: 0; color: #ffffff; }
  .email-body { padding: 28px; }
  .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .details-table tr { border-bottom: 1px solid #edf1ea; }
  .details-table td { padding: 10px 0; font-size: 13px; vertical-align: top; }
  .label-col { width: 150px; color: #5e6b63; font-weight: 500; }
  .value-col { color: #162c20; font-weight: 600; }
  .action-wrap { text-align: center; margin: 28px 0 12px 0; }
  .action-btn { display: inline-block; background-color: #233d2c; color: #ffffff !important; text-decoration: none; padding: 11px 26px; border-radius: 6px; font-size: 13px; font-weight: 600; }
  .privacy-notice { font-size: 11px; color: #5e6b63; background-color: #f6f7f3; padding: 8px 12px; border-radius: 4px; margin-top: 16px; text-align: center; }
  .email-footer { background-color: #faf9f6; border-top: 1px solid #dfe4dc; padding: 16px 28px; text-align: center; font-size: 12px; color: #5e6b63; }
</style>
</head>
<body>
<div class="email-container">
  <div class="email-header">
    <div class="email-brand">Image Developments</div>
    <h1 class="email-title">New Job Application</h1>
  </div>
  <div class="email-body">
    <p style="font-size: 14px; color: #5e6b63; margin: 0 0 20px 0;">A candidate has submitted an application for an open vacancy.</p>
    <table class="details-table" role="presentation">
      <tr>
        <td class="label-col">Reference Number:</td>
        <td class="value-col" style="font-family: monospace; color: #233d2c;">${escapeHtml(payload.referenceNumber)}</td>
      </tr>
      <tr>
        <td class="label-col">Position:</td>
        <td class="value-col">${escapeHtml(payload.jobTitle)}</td>
      </tr>
      <tr>
        <td class="label-col">Candidate Name:</td>
        <td class="value-col">${escapeHtml(payload.fullName)}</td>
      </tr>
      <tr>
        <td class="label-col">Phone:</td>
        <td class="value-col"><a href="tel:${escapeHtml(payload.phone)}" style="color: #d9965a; text-decoration: none; font-weight: 600;">${escapeHtml(payload.phone)}</a></td>
      </tr>
      <tr>
        <td class="label-col">Email:</td>
        <td class="value-col"><a href="mailto:${escapeHtml(payload.email)}" style="color: #233d2c;">${escapeHtml(payload.email)}</a></td>
      </tr>
      <tr>
        <td class="label-col">CV Document:</td>
        <td class="value-col">${escapeHtml(payload.cvFilename)}</td>
      </tr>
      <tr>
        <td class="label-col">Submission Time:</td>
        <td class="value-col" style="font-size: 12px;">${escapeHtml(formattedTime)}</td>
      </tr>
      ${payload.notes ? `
      <tr>
        <td class="label-col">Candidate Notes:</td>
        <td class="value-col">${escapeHtml(payload.notes)}</td>
      </tr>` : ""}
    </table>

    <div class="privacy-notice">
      Security note: CV attachments remain private and are accessible only to authenticated administrators.
    </div>

    ${cmsCareerUrl ? `
    <div class="action-wrap">
      <a href="${escapeHtml(cmsCareerUrl)}" class="action-btn" target="_blank" rel="noopener noreferrer">Review in CMS Careers Portal →</a>
    </div>
    ` : ""}
  </div>
  <div class="email-footer">
    Automated notification from Image Developments.
  </div>
</div>
</body>
</html>`;

  return { subject, text, html };
}

export function buildTestEmail(payload: TestEmailPayload): { subject: string; text: string; html: string } {
  const subject = `Test Notification — Image Developments`;
  const formattedTime = formatExplicitTimestamp(payload.triggeredAt);

  const text = [
    "Image Developments",
    "Notification Service Test",
    "-------------------------",
    "",
    "This is an automated test email sent from the Image Developments CMS.",
    "",
    `Target Recipient: ${payload.recipientEmail}`,
    `Triggered Time: ${formattedTime}`,
    `Environment: ${payload.environment}`,
    "",
    "Automated notification from Image Developments.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin: 0; padding: 0; background-color: #f6f7f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #162c20; }
  .email-container { width: 100%; max-width: 540px; margin: 32px auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #dfe4dc; overflow: hidden; }
  .email-header { background-color: #233d2c; padding: 20px 24px; color: #ffffff; }
  .email-body { padding: 24px; }
  .status-badge { display: inline-block; padding: 4px 12px; background-color: #e6f4ea; color: #137333; border-radius: 16px; font-weight: 600; font-size: 12px; margin-bottom: 16px; }
  .email-footer { background-color: #faf9f6; border-top: 1px solid #dfe4dc; padding: 14px 24px; font-size: 12px; color: #5e6b63; text-align: center; }
</style>
</head>
<body>
<div class="email-container">
  <div class="email-header">
    <div style="font-size: 12px; color: #d9965a; text-transform: uppercase; font-weight: 600;">Image Developments</div>
    <h2 style="margin: 4px 0 0 0; font-size: 18px; color: #ffffff;">Notification Service Test</h2>
  </div>
  <div class="email-body">
    <div class="status-badge">&check; Email Notification Flow Active</div>
    <p style="font-size: 14px; margin-top: 0; color: #162c20;">This email confirms that the notification dispatcher is functional and successfully reaching this recipient mailbox.</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
      <tr><td style="padding: 6px 0; color: #5e6b63; width: 140px;">Target Recipient:</td><td style="font-weight: 600;">${escapeHtml(payload.recipientEmail)}</td></tr>
      <tr><td style="padding: 6px 0; color: #5e6b63;">Triggered Time:</td><td>${escapeHtml(formattedTime)}</td></tr>
      <tr><td style="padding: 6px 0; color: #5e6b63;">Environment:</td><td>${escapeHtml(payload.environment)}</td></tr>
    </table>
  </div>
  <div class="email-footer">
    Automated notification from Image Developments.
  </div>
</div>
</body>
</html>`;

  return { subject, text, html };
}
