import type { DesignKind } from "./catalog";

export type Anchor = {
  id: string;
  name: string;
  /** world position on the ear surface (raycast against the normalized head) */
  position: [number, number, number];
  /** outward surface normal at the piercing point (smoothed) */
  normal: [number, number, number];
  allowed: DesignKind[];
};

/**
 * Piercing spots on the left ear of the normalized head
 * (head height 3.0, centered at origin, left ear rotated to face +Z).
 * Positions were harvested by raycasting clicks against the actual mesh
 * in debug mode (?debug=1); normals smoothed toward the ear plane.
 */
export const ANCHORS: Anchor[] = [
  {
    id: "lobe",
    name: "תנוך",
    position: [-0.134, 0.354, 0.519],
    normal: [-0.35, -0.15, 0.93],
    allowed: ["stud", "ring", "dangle"],
  },
  {
    id: "lobe2",
    name: "תנוך שני",
    position: [-0.084, 0.379, 0.565],
    normal: [-0.3, -0.2, 0.93],
    allowed: ["stud", "ring", "dangle"],
  },
  {
    id: "lobe3",
    name: "תנוך עליון",
    position: [-0.042, 0.412, 0.598],
    normal: [-0.3, 0.1, 0.95],
    allowed: ["stud", "ring"],
  },
  {
    id: "tragus",
    name: "טראגוס",
    position: [-0.182, 0.469, 0.499],
    normal: [-0.4, -0.05, 0.92],
    allowed: ["stud", "ring"],
  },
  {
    id: "conch",
    name: "קונץ'",
    position: [-0.129, 0.493, 0.509],
    normal: [-0.06, -0.05, 1.0],
    allowed: ["stud"],
  },
  {
    id: "helix",
    name: "הליקס",
    position: [0.008, 0.546, 0.61],
    normal: [-0.03, 0.23, 0.97],
    allowed: ["stud", "ring"],
  },
  {
    id: "helix2",
    name: "הליקס עליון",
    position: [-0.035, 0.654, 0.611],
    normal: [-0.15, 0.35, 0.92],
    allowed: ["stud", "ring"],
  },
  {
    id: "flat",
    name: "פלאט",
    position: [-0.077, 0.609, 0.542],
    normal: [-0.35, -0.15, 0.93],
    allowed: ["stud"],
  },
  {
    id: "forward-helix",
    name: "הליקס קדמי",
    position: [-0.157, 0.64, 0.512],
    normal: [-0.23, 0.04, 0.97],
    allowed: ["stud", "ring"],
  },
];

export function anchorById(id: string): Anchor {
  const a = ANCHORS.find((a) => a.id === id);
  if (!a) throw new Error(`unknown anchor ${id}`);
  return a;
}
