import { HomeTabs } from "@/components/HomeTabs";
import { RecentChanges } from "@/components/RecentChanges";
import { apiModels } from "@/data/apiModels";
import { changes } from "@/data/changes";
import { CNY_PER_USD, plans } from "@/data/plans";

export default function Home() {
  const official = plans.filter((p) => p.verification === "official").length;
  const officialApi = apiModels.filter((m) => m.verification === "official").length;
  return (
    <>
      <h1>AI 订阅和 API，哪个便宜、哪个贵</h1>
      <p className="lead">
        收录 {plans.length} 个个人订阅档位、{apiModels.length} 个 API 模型。其中 {official} 个档位和 {officialApi}{" "}
        个模型已对照官方页面核对，其余标「待核实」。
      </p>
      <RecentChanges changes={changes} />
      <HomeTabs plans={plans} apiModels={apiModels} cnyRate={CNY_PER_USD} />
    </>
  );
}
