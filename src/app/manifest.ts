import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bereket Dairy — Factory Management System",
    short_name: "Bereket Dairy",
    description: "Production, warehouse, orders, sales and money for the Bereket dairy factory.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any", // tablets on the floor are often landscape
    background_color: "#ffffff",
    theme_color: "#000000",
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp", purpose: "any" },
      { src: "/icons/maskable-512.webp", sizes: "512x512", type: "image/webp", purpose: "maskable" },
    ],
  };
}
