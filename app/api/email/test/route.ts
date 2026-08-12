import { sendGmailMessage } from "@/lib/gmail-smtp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !key) return Response.json({ error: "请先登录云端账号" }, { status: 401 });

  const profileResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!profileResponse.ok) return Response.json({ error: "登录状态已失效" }, { status: 401 });
  const profile = await profileResponse.json() as { email?: string; user_metadata?: { name?: string } };
  if (!profile.email) return Response.json({ error: "账号没有可用邮箱" }, { status: 400 });

  try {
    const name = profile.user_metadata?.name ?? "家人";
    await sendGmailMessage({
      to: profile.email,
      subject: "屋里提醒已连接",
      html: `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;background:#f4f6f2;padding:32px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:20px;padding:30px;color:#183c2f"><div style="font-size:13px;color:#718077">屋里 · 家庭工作台</div><h1 style="font-size:26px;margin:14px 0">提醒已经准备好了</h1><p style="line-height:1.8;color:#52645b">${name}，这是一封测试邮件。以后家务即将到期、已经逾期，或每日家庭摘要生成时，都可以通过这个邮箱提醒你。</p><div style="margin-top:24px;padding:16px;border-radius:14px;background:#edf3ee;color:#285541">今天先不用忙，屋里会帮你记得。</div></div></div>`,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "邮件发送失败" }, { status: 502 });
  }
}
