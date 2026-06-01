// Cloudflare Pages Function —— 私密反馈接收端
// 路径：POST /api/feedback
// 作用：接收访客留言 → 发到你的邮箱（Resend）。留言不落地、不公开，只有你收到。
//
// 需要在 Cloudflare Pages 项目 → Settings → Environment variables 配置：
//   RESEND_API_KEY   （必填）Resend 的 API Key
//   FEEDBACK_TO      （必填）收信邮箱，例如 xmiao2343@gmail.com
//   FEEDBACK_FROM    （可选）发信地址，默认用 Resend 测试发件人 onboarding@resend.dev
//   TURNSTILE_SECRET （可选）配了才启用 Cloudflare Turnstile 人机校验

const MAX_LEN = 5000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function verifyTurnstile(secret, token, ip) {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token || "");
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const out = await r.json().catch(() => ({}));
  return !!out.success;
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) {
    return json({ ok: false, error: "服务未配置（缺少 RESEND_API_KEY / FEEDBACK_TO）" }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }

  // 蜜罐字段：正常用户看不到，机器人常会填 → 直接当成功丢弃，不打扰真人
  if (data.website) return json({ ok: true });

  const message = (data.message || "").toString().trim();
  const name = (data.name || "").toString().trim().slice(0, 120);
  const contact = (data.contact || "").toString().trim().slice(0, 200);

  if (!message) return json({ ok: false, error: "留言内容不能为空" }, 400);
  if (message.length > MAX_LEN) return json({ ok: false, error: "留言过长" }, 400);

  // 可选：Turnstile 人机校验（配了 secret 才启用）
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      data["cf-turnstile-response"],
      request.headers.get("CF-Connecting-IP")
    );
    if (!ok) return json({ ok: false, error: "人机校验未通过，请重试" }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  const ref = request.headers.get("Referer") || "";

  const text =
    `来自博客的新留言：\n\n` +
    `${message}\n\n` +
    `——————————\n` +
    `称呼：${name || "(匿名)"}\n` +
    `联系方式：${contact || "(未留)"}\n` +
    `来源页：${ref}\n` +
    `IP：${ip}\n` +
    `UA：${ua}\n`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.FEEDBACK_FROM || "mantou blog <onboarding@resend.dev>",
      to: [env.FEEDBACK_TO],
      reply_to: contact || undefined,
      subject: `📮 博客新留言${name ? `（来自 ${name}）` : ""}`,
      text,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    return json({ ok: false, error: "发送失败，请稍后再试", detail }, 502);
  }

  return json({ ok: true });
}

// 非 POST 一律拒绝（留言数据不对外暴露任何读取接口）
export async function onRequest({ request }) {
  if (request.method === "POST") return; // 交给 onRequestPost
  return json({ ok: false, error: "Method Not Allowed" }, 405);
}
