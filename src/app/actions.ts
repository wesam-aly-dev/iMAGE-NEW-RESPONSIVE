"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createNotificationJob,
  dispatchNotificationJob,
  getResolvedNotificationSettings,
} from "@/lib/notifications/email-service";
import type { FormType } from "@/lib/notifications/types";

function generateReferenceNumber(prefix: "INQ" | "APP"): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${year}-${rand}`;
}

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  fields?: Record<string, string>;
  values?: {
    name?: string;
    email?: string;
    phone?: string;
    countryCode?: string;
    projectId?: string;
    message?: string;
    consent?: boolean;
    marketingConsent?: boolean;
  };
};
const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((val) => !val || z.string().email().safeParse(val).success),
  phone: z.string().trim().min(5).max(30),
  countryCode: z.string().regex(/^[A-Z]{2}:\+[\d ]{1,8}$/),
  projectId: z.string().trim().optional(),
  enquiryType: z.string().trim().optional(),
  sourcePage: z.string().trim().optional(),
  sourceCta: z.string().trim().optional(),
  formVariant: z.string().trim().optional(),
  message: z.string().trim().max(5000).optional(),
  locale: z.enum(["en", "ar"]),
  website: z.string().max(0),
});

function contactFieldErrors(issues: z.core.$ZodIssue[], locale: string) {
  const ar = locale === "ar";
  const messages: Record<string, string> = {
    name: ar ? "يرجى إدخال الاسم." : "Please enter your name.",
    email: ar ? "يرجى إدخال بريد إلكتروني صحيح." : "Please enter a valid email address.",
    phone: ar ? "يرجى إدخال رقم هاتف صحيح." : "Please enter a valid phone number.",
    countryCode: ar ? "يرجى اختيار الدولة ورمز الاتصال." : "Please select a country and calling code.",
    projectId: ar ? "يرجى اختيار مشروع." : "Please select a project.",
    message: ar ? "يرجى كتابة رسالة." : "Please enter a message.",
  };
  return Object.fromEntries(
    issues.map((issue) => {
      const field = String(issue.path[0]);
      return [field, messages[field] ?? (ar ? "يرجى مراجعة هذا الحقل." : "Please review this field.")];
    })
  );
}

export async function submitContact(_: ContactState, formData: FormData): Promise<ContactState> {
  const values = Object.fromEntries(
    [
      "name",
      "email",
      "phone",
      "countryCode",
      "projectId",
      "enquiryType",
      "sourcePage",
      "sourceCta",
      "formVariant",
      "message",
      "locale",
      "website",
    ].map((key) => [key, String(formData.get(key) ?? "").trim()])
  );
  const consentVal = formData.get("consent");
  const consentChecked = consentVal === "on" || consentVal === "true";
  const marketingVal = formData.get("marketingConsent");
  const marketingChecked = marketingVal === "on" || marketingVal === "true";

  const preservedValues = {
    name: values.name,
    email: values.email,
    phone: values.phone,
    countryCode: values.countryCode || "EG:+20",
    projectId: values.projectId,
    message: values.message,
    consent: consentChecked,
    marketingConsent: marketingChecked,
  };

  const parsed = contactSchema.safeParse(values);
  const fieldErrors = parsed.success ? {} : contactFieldErrors(parsed.error.issues, values.locale);

  // If consent was not checked, flag consent error
  if (!consentChecked) {
    fieldErrors.consent =
      values.locale === "ar"
        ? "يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية للمتابعة."
        : "Please agree to the Terms & Conditions and Privacy Policy to proceed.";
  }

  // Dedicated Contact Page requires message field
  const isDedicatedContactPage =
    values.formVariant === "contact" ||
    values.sourcePage === "contact-page" ||
    values.sourceCta === "contact-page-form";

  if (isDedicatedContactPage && (!values.message || values.message.length < 1)) {
    fieldErrors.message =
      values.locale === "ar" ? "يرجى كتابة رسالة." : "Please enter a message.";
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0)
    return {
      status: "error",
      message:
        values.locale === "ar"
          ? "يرجى مراجعة الحقول المطلوبة والمحاولة مرة أخرى."
          : "Please review the required fields and try again.",
      fields: fieldErrors,
      values: preservedValues,
    };
  
  const ar=parsed.data.locale==="ar";
  let project=null;
  if(parsed.data.projectId && parsed.data.projectId !== "general" && parsed.data.projectId !== "all"){
    project=await prisma.project.findFirst({where:{id:parsed.data.projectId,status:"PUBLISHED"},select:{id:true,nameEn:true,nameAr:true}});
    if(!project)return{status:"error",message:ar?"يرجى اختيار مشروع متاح.":"Please select an available project.",fields:{projectId:"Invalid project"},values:preservedValues};
  }
  
  const [,callingCode]=parsed.data.countryCode.split(":");
  let subject=ar?"استفسار عام":"General Enquiry";
  if(project){
    subject=ar?project.nameAr:project.nameEn;
  } else if(parsed.data.enquiryType==="callback"){
    subject=ar?"طلب معاودة الاتصال":"Request a Callback";
  } else if(parsed.data.enquiryType==="visit"){
    subject=ar?"طلب حجز موعد زيارة":"Private Visit Request";
  }
  
  const metaParts:string[]=[];
  if(parsed.data.enquiryType)metaParts.push(`Type: ${parsed.data.enquiryType}`);
  const unitVal = String(formData.get("unitType") ?? "").trim();
  if(unitVal)metaParts.push(`Unit: ${unitVal}`);
  if(parsed.data.sourcePage)metaParts.push(`Page: ${parsed.data.sourcePage}`);
  if(parsed.data.sourceCta)metaParts.push(`CTA: ${parsed.data.sourceCta}`);
  metaParts.push(`Terms & Privacy: ${consentChecked ? "Accepted" : "Declined"}`);
  if(marketingChecked)metaParts.push("Marketing: Opted-In");
  const notes=metaParts.length?metaParts.join(" | "):null;

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim() || undefined;

  // Check idempotency if key was provided
  if (idempotencyKey) {
    const existing = await prisma.contactSubmission.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        status: "success",
        message: ar
          ? `شكراً لك، تم استلام استفسارك مسبقاً برقم مرجعي (${existing.referenceNumber || existing.id}). سيتواصل معك فريقنا قريباً.`
          : `Thank you, your enquiry was already received (Ref: ${existing.referenceNumber || existing.id}). Our team will be in touch shortly.`,
      };
    }
  }

  // Determine FormType
  let formType: FormType = "GENERAL_CONTACT";
  if (parsed.data.enquiryType === "callback" || values.formVariant === "callback") {
    formType = "CALLBACK";
  } else if (parsed.data.enquiryType === "unit" || unitVal) {
    formType = "UNIT_INQUIRY";
  } else if (parsed.data.enquiryType === "register_interest") {
    formType = "REGISTER_INTEREST";
  } else if (project) {
    formType = "PROJECT_INQUIRY";
  }

  const referenceNumber = generateReferenceNumber("INQ");
  const notificationSettings = await getResolvedNotificationSettings();

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.contactSubmission.create({
      data: {
        referenceNumber,
        name: parsed.data.name,
        email: parsed.data.email || "",
        phone: `${callingCode} ${parsed.data.phone}`,
        countryCode: parsed.data.countryCode,
        projectId: project ? project.id : null,
        projectName: project ? (ar ? project.nameAr : project.nameEn) : null,
        unitType: unitVal || null,
        formType,
        formVariant: values.formVariant || null,
        sourcePage: values.sourcePage || null,
        sourceCta: values.sourceCta || null,
        consentAccepted: consentChecked,
        marketingConsent: marketingChecked,
        consentVersion: "v1",
        idempotencyKey: idempotencyKey || null,
        status: "NEW",
        subject,
        notes,
        message: parsed.data.message || (ar ? "طلب معاودة الاتصال" : "Request a Call Back"),
        locale: parsed.data.locale,
        notificationStatus: "PENDING",
      },
    });

    const jobPayload = {
      referenceNumber,
      formType,
      formVariant: values.formVariant || null,
      name: parsed.data.name,
      email: parsed.data.email || "",
      phone: parsed.data.phone,
      countryCode: callingCode,
      subject,
      message: parsed.data.message || (ar ? "طلب معاودة الاتصال" : "Request a Call Back"),
      projectId: project ? project.id : null,
      projectName: project ? (ar ? project.nameAr : project.nameEn) : null,
      unitType: unitVal || null,
      sourcePage: values.sourcePage || null,
      sourceCta: values.sourceCta || null,
      locale: parsed.data.locale,
      consentAccepted: consentChecked,
      marketingConsent: marketingChecked,
      consentVersion: "v1",
      createdAt: created.createdAt.toISOString(),
    };

    const job = await createNotificationJob(tx, {
      jobType: "LEAD_INQUIRY",
      targetId: created.id,
      recipientEmail: notificationSettings.recipientEmail,
      senderEmail: notificationSettings.senderEmail,
      subject: `New Inquiry — ${project ? (ar ? project.nameAr : project.nameEn) : "General Inquiry"} — ${referenceNumber}`,
      payload: jobPayload,
    });

    return { created, jobId: job.id };
  });

  // Await notification dispatch before returning, while ensuring submission persistence is completely independent
  try {
    await dispatchNotificationJob(submission.jobId);
  } catch (err) {
    console.error("Notification dispatch error:", err);
  }

  return {
    status: "success",
    message: ar
      ? `شكراً لك${project ? `، تم استلام استفسارك بخصوص ${project.nameAr} بنجاح` : "، تم استلام استفسارك بنجاح"}. رقم المرجع: ${referenceNumber}. سيتواصل معك فريقنا المختص قريباً.`
      : `Thank you${project ? `, your enquiry regarding ${project.nameEn} has been received` : ", your enquiry has been received"}. Reference: ${referenceNumber}. Our specialized team will be in touch shortly.`,
  };
}

export type CareerApplicationState = {
  status: "idle" | "success" | "error";
  message?: string;
  fields?: Record<string, string>;
};

export async function submitCareerApplication(
  _: CareerApplicationState,
  formData: FormData
): Promise<CareerApplicationState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim() || undefined;
  const locale = String(formData.get("locale") ?? "en");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const cvFile = formData.get("cv") as File | null;

  const ar = locale === "ar";
  const fields: Record<string, string> = {};

  if (!fullName || fullName.length < 2) {
    fields.fullName = ar ? "يرجى إدخال الاسم كاملاً." : "Please enter your full name.";
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = ar ? "يرجى إدخال بريد إلكتروني صحيح." : "Please enter a valid email address.";
  }
  if (!phone || phone.length < 6) {
    fields.phone = ar ? "يرجى إدخال رقم هاتف صحيح." : "Please enter a valid phone number.";
  }
  if (!jobTitle) {
    fields.jobTitle = ar ? "يرجى تحديد الوظيفة المتقدم لها." : "Please specify the position.";
  }
  if (!cvFile || cvFile.size === 0) {
    fields.cv = ar ? "يرجى رفع السيرة الذاتية (CV)." : "Please upload your CV.";
  } else {
    if (cvFile.size > 5 * 1024 * 1024) {
      fields.cv = ar ? "الحد الأقصى لحجم الملف هو 5 ميجابايت." : "Maximum file size is 5 MB.";
    }
    const originalName = cvFile.name.toLowerCase();
    const isAllowedExt = /\.(pdf|doc|docx)$/i.test(originalName);
    if (!isAllowedExt) {
      fields.cv = ar
        ? "الصيغ المقبولة هي PDF أو Word (DOC, DOCX)."
        : "Allowed formats are PDF or Word (DOC, DOCX).";
    }
  }

  if (Object.keys(fields).length > 0) {
    return {
      status: "error",
      message: ar
        ? "يرجى مراجعة الحقول المطلوبة وتصحيح الأخطاء."
        : "Please review the required fields and correct any errors.",
      fields,
    };
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const crypto = await import("crypto");

    const privateUploadsDir = path.join(process.cwd(), "private-storage", "cvs");
    await fs.mkdir(privateUploadsDir, { recursive: true });

    const originalName = cvFile!.name;
    const ext = path.extname(originalName) || ".pdf";
    const secureId = crypto.randomUUID();
    const storedFileName = `${Date.now()}-${secureId}${ext}`;
    const storagePath = path.join(privateUploadsDir, storedFileName);

    const buffer = Buffer.from(await cvFile!.arrayBuffer());
    await fs.writeFile(storagePath, buffer);

    const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim() || undefined;
    if (idempotencyKey) {
      const existing = await prisma.careerApplication.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          status: "success",
          message: ar
            ? `تم استلام طلبك مسبقاً برقم مرجعي (${existing.referenceNumber || existing.id}).`
            : `Your application was already received (Ref: ${existing.referenceNumber || existing.id}).`,
        };
      }
    }

    const referenceNumber = generateReferenceNumber("APP");
    const notificationSettings = await getResolvedNotificationSettings();
    const careersRecipient = notificationSettings.careersRecipientEmail || notificationSettings.recipientEmail;

    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.careerApplication.create({
        data: {
          referenceNumber,
          jobId: jobId || null,
          jobTitle,
          fullName,
          email,
          phone,
          cvUrl: storagePath,
          cvFilename: originalName,
          notes: notes || null,
          status: "NEW",
          idempotencyKey: idempotencyKey || null,
          notificationStatus: "PENDING",
        },
      });

      const jobPayload = {
        referenceNumber,
        jobId: jobId || null,
        jobTitle,
        fullName,
        email,
        phone,
        cvUrl: storagePath,
        cvFilename: originalName,
        notes: notes || null,
        createdAt: created.createdAt.toISOString(),
      };

      const job = await createNotificationJob(tx, {
        jobType: "CAREER_APPLICATION",
        targetId: created.id,
        recipientEmail: careersRecipient,
        senderEmail: notificationSettings.senderEmail,
        subject: `New Application — ${jobTitle} — ${referenceNumber}`,
        payload: jobPayload,
      });

      return { created, jobId: job.id };
    });

    try {
      await dispatchNotificationJob(application.jobId);
    } catch (err) {
      console.error("Career notification dispatch error:", err);
    }

    return {
      status: "success",
      message: ar
        ? `تم استلام طلب التقديم لوظيفة "${jobTitle}" بنجاح (رقم المرجع: ${referenceNumber}). سيقوم فريق الموارد البشرية بمراجعة سيرتك الذاتية والتواصل معك.`
        : `Your application for "${jobTitle}" has been received successfully (Ref: ${referenceNumber}). Our People & Culture team will review your qualifications.`,
    };
  } catch (error) {
    console.error("Career application submission error:", error);
    return {
      status: "error",
      message: ar
        ? "حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى لاحقاً."
        : "An unexpected error occurred while submitting your application. Please try again.",
    };
  }
}
