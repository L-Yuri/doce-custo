import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doce Lucro",
    short_name: "Doce Lucro",
    description: "Gestão, custos e precificação para confeitaria.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f4ed",
    theme_color: "#9d3152",
    lang: "pt-BR",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
