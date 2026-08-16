import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { sendTestPushNotification } from "@/services/notifications";

const payloadSchema = z.object({
  userId: z.string().min(1).optional(),
  body: z.string().trim().min(1).max(180).optional(),
});

/** Protected manual push test endpoint. Prefer the authenticated browser session. */
export async function POST(request: Request) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    // Empty body is valid for a session-authenticated request.
  }
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const sessionUser = await getSessionUser().catch(() => null);
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const hasCronAuth = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);

  if (!sessionUser && !hasCronAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (hasCronAuth && !parsed.data.userId) return Response.json({ error: "userId is required with CRON_SECRET" }, { status: 400 });

  const userId = sessionUser?.id ?? parsed.data.userId;
  if (!userId) return Response.json({ error: "Could not resolve user" }, { status: 401 });

  const result = await sendTestPushNotification(userId, parsed.data.body);
  return Response.json({ ok: true, ...result });
}
