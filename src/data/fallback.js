export const FALLBACK_PRODUCTS = [
  { id: "1", name: "Aurora Pendant", category: "pendant", image_url: "https://images.unsplash.com/photo-1565818652107-397974f6bb0e?w=600&q=80" },
  { id: "2", name: "Lumen Sconce", category: "sconce", image_url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&q=80" },
  { id: "3", name: "Celeste Chandelier", category: "chandelier", image_url: "https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&q=80" },
  { id: "4", name: "Noir Floor Lamp", category: "floor", image_url: "https://images.unsplash.com/photo-1507473889964-fe6f813af4c4?w=600&q=80" },
  { id: "5", name: "Ember Mini Pendant", category: "pendant", image_url: "https://images.unsplash.com/photo-1524484485831-a92ffc35ce9e?w=600&q=80" },
  { id: "6", name: "Halo Desk Lamp", category: "office", image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80" },
  { id: "7", name: "Stratus Cluster", category: "pendant", image_url: "https://images.unsplash.com/photo-1540932239984-3012e4d4b0ef?w=600&q=80" },
  { id: "8", name: "Arc Wall Light", category: "sconce", image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" },
  { id: "9", name: "Prism Office Pendant", category: "office", image_url: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=600&q=80" },
  { id: "10", name: "Solstice Chandelier", category: "chandelier", image_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80" },
  { id: "11", name: "Dusk Floor Lamp", category: "floor", image_url: "https://images.unsplash.com/photo-1594620302200-ffee4ee1173f?w=600&q=80" },
  { id: "12", name: "Beacon Task Light", category: "office", image_url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80" },
];

const WORK_GRADIENTS = [
  "linear-gradient(135deg, #1a1510 0%, #3d2e1f 50%, #f59e0b 100%)",
  "linear-gradient(135deg, #0f0f0f 0%, #2a2420 60%, #fbbf24 100%)",
  "linear-gradient(135deg, #1c1814 0%, #4a3728 50%, #d97706 100%)",
  "linear-gradient(135deg, #121212 0%, #2d2d2d 70%, #f0ece4 100%)",
  "linear-gradient(135deg, #0a0a0a 0%, #1f1a16 40%, #f59e0b 100%)",
  "linear-gradient(135deg, #151210 0%, #3a3028 60%, #fbbf24 100%)",
];

export const FALLBACK_WORKS = [
  { id: "1", title: "Meridian Hotel Lobby", type: "Hospitality", location: "Prishtinë, 2025", image_url: null, video_url: null, gradient: WORK_GRADIENTS[0] },
  { id: "2", title: "Loft 42 Residence", type: "Residential", location: "Tirana, 2025", image_url: null, video_url: null, gradient: WORK_GRADIENTS[1] },
  { id: "3", title: "Botanica Restaurant", type: "Restaurant", location: "Prizren, 2024", image_url: null, video_url: null, gradient: WORK_GRADIENTS[2] },
  { id: "4", title: "Northline Offices", type: "Corporate", location: "Skopje, 2024", image_url: null, video_url: null, gradient: WORK_GRADIENTS[3] },
  { id: "5", title: "Atelier Showroom", type: "Retail", location: "Prishtinë, 2024", image_url: null, video_url: null, gradient: WORK_GRADIENTS[4] },
  { id: "6", title: "Villa Dukagjini", type: "Residential", location: "Pejë, 2023", image_url: null, video_url: null, gradient: WORK_GRADIENTS[5] },
];

export function workGradient(index) {
  return WORK_GRADIENTS[index % WORK_GRADIENTS.length];
}
