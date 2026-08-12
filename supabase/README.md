# Supabase 接入

1. 新建一个免费 Supabase 项目。
2. 打开 SQL Editor，执行 `schema.sql`。
3. 复制 `.env.example` 为 `.env.local`，填写 Project URL 和 anon key。
4. 安装客户端：`pnpm add @supabase/supabase-js`。

`schema.sql` 已启用行级权限（RLS）：只有同一家庭成员能读取或修改家庭任务、完成记录和动态。服务端密钥不得写入 `NEXT_PUBLIC_*` 环境变量。

当前页面仍使用本地数据层；填入项目配置后再启用云端适配器，可在离线时继续保留本地数据。
