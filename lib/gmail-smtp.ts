import "server-only";
import { connect } from "node:tls";

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

export async function sendGmailMessage({ to, subject, html }: { to: string; subject: string; html: string }) {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !password) throw new Error("邮件服务尚未配置");

  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com", rejectUnauthorized: true });
    socket.setEncoding("utf8");
    socket.setTimeout(20_000, () => socket.destroy(new Error("Gmail SMTP 连接超时")));
    let buffer = "";
    let waiter: ((response: string) => void) | null = null;
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (/^\d{3} [^\r\n]*\r?\n$/m.test(buffer) && waiter) { const done = waiter; waiter = null; const response = buffer; buffer = ""; done(response); }
    });
    socket.on("error", reject);

    const read = () => new Promise<string>((next) => { waiter = next; });
    const command = async (line: string, expected: number[]) => {
      socket.write(`${line}\r\n`);
      const response = await read();
      const code = Number(response.slice(0, 3));
      if (!expected.includes(code)) throw new Error(`Gmail SMTP 返回 ${code}`);
    };

    socket.on("secureConnect", async () => {
      try {
        let response = await read();
        if (Number(response.slice(0, 3)) !== 220) throw new Error("Gmail SMTP 未就绪");
        await command("EHLO wuli.local", [250]);
        await command("AUTH LOGIN", [334]);
        await command(Buffer.from(user).toString("base64"), [334]);
        await command(Buffer.from(password).toString("base64"), [235]);
        await command(`MAIL FROM:<${user}>`, [250]);
        await command(`RCPT TO:<${to}>`, [250, 251]);
        await command("DATA", [354]);
        const message = [
          `From: ${encodeHeader("屋里")} <${user}>`,
          `To: <${to}>`,
          `Subject: ${encodeHeader(subject)}`,
          "MIME-Version: 1.0",
          "Content-Type: text/html; charset=UTF-8",
          "Content-Transfer-Encoding: 8bit",
          "",
          html.replace(/^\./gm, ".."),
          ".",
        ].join("\r\n");
        await command(message, [250]);
        socket.write("QUIT\r\n");
        socket.end();
        resolve();
      } catch (error) { socket.destroy(); reject(error); }
    });
  });
}
