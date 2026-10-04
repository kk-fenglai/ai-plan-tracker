import type { Metadata } from "next";
import { MySubscriptions } from "@/components/MySubscriptions";
import { plans } from "@/data/plans";

export const metadata: Metadata = { title: "我的订阅 · AI 套餐追踪" };

export default function MinePage() {
  return (
    <>
      <h1>我是不是买重了？</h1>
      <p className="lead">
        勾选正在付费的档位，看每月一共花多少、哪些能力重复购买、哪个可以去掉。
      </p>
      <MySubscriptions plans={plans} />
    </>
  );
}
