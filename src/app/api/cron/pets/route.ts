import { processBackgroundPetNotifications } from "@/services/pet-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processBackgroundPetNotifications();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] pet processing failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Pet processing failed" }, { status: 500 });
  }
}
