import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Channels by stc — Smart Inventory",
    short_name: "Channels Inv.",
    description: "Smart Inventory and Stock Automation System with AI Chatbots",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#7c1fff",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/images/logoSTC.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/logoSTC.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
