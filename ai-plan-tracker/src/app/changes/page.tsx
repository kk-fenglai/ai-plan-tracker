import type { Metadata } from "next";
import { ChangeLog } from "@/components/ChangeLog";
import { changes } from "@/data/changes";
import { plans } from "@/data/plans";

export const metadata: Metadata = { title: "套餐变更日志 · AI 套餐追踪" };

export default function ChangesPage() {
  return (
    <>
      <h1>各家套餐最近改了什么</h1>
      <p className="lead">
        每条变更都分开写「事实」（变更前 → 变更后）和「解读」，并附原文出处。
      </p>
      <ChangeLog changes={changes} plans={plans} />
    </>
  );
}
