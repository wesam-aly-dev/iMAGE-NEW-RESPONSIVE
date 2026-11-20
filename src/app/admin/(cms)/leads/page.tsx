import { prisma } from "@/lib/prisma";
import { LeadsInbox, type SerializedLead } from "@/components/admin/leads-inbox";

export default async function LeadsPage() {
  const [leads, projects, notificationJobs, globalSettings] = await Promise.all([
    prisma.contactSubmission
      .findMany({
        orderBy: { createdAt: "desc" },
      })
      .catch(async (err) => {
        console.warn("Falling back to raw query for leads page:", err?.message);
        try {
          const raw = await prisma.$queryRaw<Array<any>>`SELECT * FROM "ContactSubmission" ORDER BY "createdAt" DESC`;
          return raw.map((r) => ({
            ...r,
            createdAt: new Date(r.createdAt),
            notificationSentAt: r.notificationSentAt ? new Date(r.notificationSentAt) : null,
            consentAccepted: Boolean(r.consentAccepted),
            marketingConsent: Boolean(r.marketingConsent),
            isRead: Boolean(r.isRead),
            isArchived: Boolean(r.isArchived),
          }));
        } catch (rawErr) {
          console.error("Leads raw query fallback error:", rawErr);
          return [];
        }
      }),
    prisma.project.findMany({
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.notificationJob.findMany({
      where: { jobType: "LEAD_INQUIRY" },
      select: { targetId: true, recipientEmail: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.globalSettings.findUnique({
      where: { id: "global" },
      select: { notificationRecipientEmail: true },
    }),
  ]);

  const jobsByLeadId = new Map<string, string>();
  for (const j of notificationJobs) {
    if (j.targetId && !jobsByLeadId.has(j.targetId)) {
      jobsByLeadId.set(j.targetId, j.recipientEmail);
    }
  }

  const configuredRecipient = globalSettings?.notificationRecipientEmail || "info@image-developments.com";

  const serializedLeads: SerializedLead[] = leads.map((lead) => ({
    id: lead.id,
    referenceNumber: lead.referenceNumber,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    countryCode: lead.countryCode,
    subject: lead.subject,
    projectId: lead.projectId,
    projectName: lead.projectName,
    unitType: lead.unitType,
    formType: lead.formType,
    formVariant: lead.formVariant,
    sourcePage: lead.sourcePage,
    sourceCta: lead.sourceCta,
    consentAccepted: lead.consentAccepted,
    marketingConsent: lead.marketingConsent,
    consentVersion: lead.consentVersion,
    status: lead.status,
    notes: lead.notes,
    message: lead.message,
    locale: lead.locale,
    notificationStatus: lead.notificationStatus,
    notificationError: lead.notificationError,
    notificationAttempts: lead.notificationAttempts,
    notificationSentAt: lead.notificationSentAt ? lead.notificationSentAt.toISOString() : null,
    notificationRecipient: jobsByLeadId.get(lead.id) || null,
    isRead: lead.isRead,
    isArchived: lead.isArchived,
    createdAt: lead.createdAt.toISOString(),
  }));

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.nameEn,
  }));

  return (
    <>
      <header className="page-head leads-page-head">
        <div>
          <p>Sales &amp; Customer Relations</p>
          <h1>Leads Inbox</h1>
          <span>
            Follow up on customer inquiries, callbacks, and interest registrations from across the website.
          </span>
        </div>
      </header>

      <LeadsInbox initialLeads={serializedLeads} projects={projectOptions} configuredRecipient={configuredRecipient} />
    </>
  );
}
