import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "屋里 | 家庭维护工作台",
  description: "和家人一起，把家照料得刚刚好。",
  applicationName: "屋里",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f6f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {/*
        THESIS: 屋里把家务变成一套可感知的家庭生活节律，拒绝企业任务看板和游戏化打卡。
        OWN-WORLD: 珍珠灰白、森林绿、自然家居影像、细线图标与克制的柔和圆角。
        STORY: 家人看见今晚剩余时间，完成最值得做的事，并让共享节律自然更新。
        FIRST VIEWPORT: 家庭头像和家居光影在上，今晚时间与周节律居中，行动列表紧随其后。
        FORM: 手机优先的生活工作台，seed ee738667。
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
