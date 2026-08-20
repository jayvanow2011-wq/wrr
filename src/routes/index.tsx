import { createFileRoute } from "@tanstack/react-router";
import { HCPanel } from "@/components/hc/HCPanel";
import "@/components/hc/hc-styles.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HidenCloud — Control Panel" },
      {
        name: "description",
        content: "HidenCloud dark control panel with dashboard, clients and builder.",
      },
      { property: "og:title", content: "HidenCloud — Control Panel" },
      {
        property: "og:description",
        content: "Dark control panel with dashboard, clients and builder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <HCPanel />;
}
