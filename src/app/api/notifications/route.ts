import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.appNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, event: true, title: true, body: true, url: true, readAt: true, createdAt: true, pet: { select: { name: true } } },
  });
  return Response.json({
    unread: notifications.filter((notification) => notification.readAt === null).length,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      event: notification.event,
      title: notification.title,
      body: notification.body,
      url: notification.url,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      petName: notification.pet.name,
    })),
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown = {};
  try { body = await request.json(); } catch { /* Empty body marks all as read. */ }
  const id = typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" ? body.id : undefined;
  await prisma.appNotification.updateMany({
    where: id ? { id, userId: user.id } : { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true });
}
