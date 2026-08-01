import { z } from "zod";
import { ensureUid } from "@/lib/mida/uid";
import { ingestProduct } from "@/lib/mida/services/product";

const bodySchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => /^https?:$/.test(new URL(u).protocol), "http(s) only"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_url" }, { status: 400 });
  }

  await ensureUid();
  const product = await ingestProduct(parsed.data.url);
  return Response.json({ product });
}
