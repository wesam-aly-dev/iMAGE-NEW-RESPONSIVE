import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/session";
import { processPendingNotificationJobs } from "@/lib/notifications/email-service";

export async function POST(req: NextRequest) {
  // Authorization: check admin session OR Bearer CRON_SECRET
  const admin = await getAdmin();
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isCronAuthorized = Boolean(
    cronSecret &&
    authHeader &&
    authHeader.startsWith("Bearer ") &&
    authHeader.slice(7).trim() === cronSecret
  );

  if (!admin && !isCronAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10;

  const result = await processPendingNotificationJobs(limit);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  // Allow GET for Vercel Cron or browser dev checks with proper auth
  return POST(req);
}

