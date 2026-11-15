export type NotificationStatus = "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED" | "BLOCKED" | "SKIPPED";

export type FormType =
  | "GENERAL_CONTACT"
  | "CALLBACK"
  | "PROJECT_INQUIRY"
  | "UNIT_INQUIRY"
  | "REGISTER_INTEREST";

export interface LeadInquiryPayload {
  referenceNumber: string;
  formType: FormType;
  formVariant?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  countryCode?: string | null;
  subject: string;
  message: string;
  projectId?: string | null;
  projectName?: string | null;
  unitType?: string | null;
  sourcePage?: string | null;
  sourceCta?: string | null;
  locale: string;
  consentAccepted: boolean;
  marketingConsent: boolean;
  consentVersion?: string | null;
  createdAt: string;
}

export interface CareerApplicationPayload {
  referenceNumber: string;
  jobId?: string | null;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  cvUrl: string;
  cvFilename: string;
  notes?: string | null;
  createdAt: string;
}

export interface TestEmailPayload {
  recipientEmail: string;
  triggeredAt: string;
  environment: string;
}

export interface EmailSendOptions {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  status: NotificationStatus;
  messageId?: string;
  error?: string;
  provider?: "smtp" | "resend" | "none";
}

