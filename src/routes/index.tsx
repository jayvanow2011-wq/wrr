import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

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
    ],
  }),
  component: Index,
});

function Index() {
  const rootRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Load hidencloud CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/hidencloud/css/style.css";
    document.head.appendChild(link);

    // Load hidencloud JS
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/hidencloud/js/main.js";
    document.body.appendChild(script);
  }, []);

  return <div id="app" ref={rootRef} className="hidencloud-root" />;
}
