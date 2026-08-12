"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CheckCircle, EnvelopeSimple, HouseLine, Key, Plus } from "@phosphor-icons/react";
import { createCloudHousehold, isCloudConfigured, joinCloudHousehold, listMyHouseholds, restoreCloudSession, sendMagicLink, type CloudHousehold, type CloudSession } from "@/lib/supabase-rest";
import { CloudProvider } from "@/lib/cloud-context";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [localMode, setLocalMode] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [households, setHouseholds] = useState<CloudHousehold[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasLoginCallback = window.location.hash.includes("access_token");
    const wantsCloud = params.get("cloud") === "1" || hasLoginCallback;
    if (!wantsCloud) {
      setChecking(false);
      return;
    }
    setLocalMode(false);
    restoreCloudSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!session) return;
    listMyHouseholds(session).then((items) => {
      setHouseholds(items);
      if (items[0]) window.localStorage.setItem("wuli-active-household", items[0].id);
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "家庭信息读取失败，请检查网络后重试");
      setHouseholds([]);
    });
  }, [session]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await sendMagicLink(email.trim(), name.trim() || email.split("@")[0]); setSent(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "发送失败，请稍后重试"); }
    finally { setBusy(false); }
  }

  if (checking) return <main className="auth-shell"><div className="auth-loading">正在打开屋里…</div></main>;
  if (localMode) return <>{children}</>;
  if (session && households === null) return <main className="auth-shell"><div className="auth-loading">正在整理你的家庭…</div></main>;
  if (session && households?.length === 0 && error) return <main className="auth-shell"><section className="onboard-panel"><header><div className="auth-brand"><HouseLine size={22} weight="fill" /><span>屋里</span></div><h1>网络有点慢</h1><p>{error}</p></header><div className="onboard-options"><button onClick={() => window.location.reload()}><span><b>重新连接</b><small>刷新后再次读取家庭数据</small></span><ArrowRight size={17} /></button><button onClick={() => setLocalMode(true)}><span><b>先进入本地模式</b><small>稍后网络恢复后再同步</small></span><ArrowRight size={17} /></button></div></section></main>;
  if (session && households?.length === 0) return <HouseholdOnboarding session={session} onReady={async () => {
    const items = await listMyHouseholds(session); setHouseholds(items); if (items[0]) window.localStorage.setItem("wuli-active-household", items[0].id);
  }} />;
  if (session && households?.length) return <CloudProvider session={session} household={households[0]}>{children}</CloudProvider>;

  return <main className="auth-shell"><section className="auth-panel" aria-label="登录屋里">
    <div className="auth-scene"><div className="auth-brand"><HouseLine size={22} weight="fill" /><span>屋里</span></div><div><small>把日子照料得井井有条</small><h1>家里的事，<br />有人记得。</h1><p>任务、提醒和完成记录会安全同步给家人。</p></div></div>
    <div className="auth-form-wrap">
      {sent ? <div className="auth-sent"><CheckCircle size={34} weight="fill" /><h2>登录邮件已发送</h2><p>请在邮箱中打开登录链接，之后会自动回到屋里。</p><button onClick={() => setSent(false)}>换个邮箱</button></div> : <form onSubmit={submit}>
        <span className="auth-eyebrow">家庭云同步</span><h2>开始使用屋里</h2><p>无需设置密码，邮箱只用于登录和接收家庭周报。</p>
        <label>你的称呼<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：小林" autoComplete="name" /></label>
        <label>邮箱地址<div className="auth-input"><EnvelopeSimple size={18} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></div></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy || !email.trim()}>{busy ? "正在发送…" : <>发送登录邮件<ArrowRight size={17} /></>}</button>
      </form>}
      <button className="auth-local" onClick={() => setLocalMode(true)}>先使用本地体验版</button>
      {!isCloudConfigured() && <p className="auth-warning">云端配置尚未完成，目前只能使用本地模式。</p>}
    </div>
  </section></main>;
}

function HouseholdOnboarding({ session, onReady }: { session: CloudSession; onReady: () => Promise<void> }) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { if (mode === "create") await createCloudHousehold(session, value || "我们家"); else await joinCloudHousehold(session, value); await onReady(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败，请重试"); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="onboard-panel">
    <header><div className="auth-brand"><HouseLine size={22} weight="fill" /><span>屋里</span></div><small>欢迎回来，{session.user?.user_metadata?.name ?? session.user?.email?.split("@")[0] ?? "新成员"}</small><h1>先找到你的家</h1><p>每个家庭拥有独立的任务、成员与完成记录。</p></header>
    {mode === "choose" ? <div className="onboard-options"><button onClick={() => setMode("create")}><Plus size={21} /><span><b>创建一个新家庭</b><small>我是第一个使用屋里的人</small></span><ArrowRight size={17} /></button><button onClick={() => setMode("join")}><Key size={21} /><span><b>用邀请码加入</b><small>家人已经创建了家庭</small></span><ArrowRight size={17} /></button></div> : <form onSubmit={submit}><button type="button" className="onboard-back" onClick={() => { setMode("choose"); setError(""); }}>← 返回</button><h2>{mode === "create" ? "给这个家取个名字" : "输入家庭邀请码"}</h2><p>{mode === "create" ? "稍后可以随时修改，也可以邀请家人加入。" : "邀请码由家庭管理员在“家庭空间”中分享。"}</p><label>{mode === "create" ? "家庭名称" : "8 位邀请码"}<input autoFocus required value={value} onChange={(event) => setValue(event.target.value)} placeholder={mode === "create" ? "例如：我们家" : "例如：WULI8256"} /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={busy || !value.trim()}>{busy ? "正在处理…" : mode === "create" ? "创建家庭" : "加入家庭"}</button></form>}
  </section></main>;
}
