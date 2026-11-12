import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B Finance | Sistema Financeiro",
    short_name: "B Finance",
    description:
      "Gerencie receitas, despesas, transações e cartões em um único painel.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F172A",
    theme_color: "#0F172A",
    icons: [
      {
        src: "/Logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/Logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
