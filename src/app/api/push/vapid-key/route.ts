import { isPushConfigured } from "@/lib/env";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  return Response.json({
    supported: isPushConfigured() && typeof publicKey === "string" && publicKey.length > 0,
    publicKey: publicKey ?? "",
  });
}
