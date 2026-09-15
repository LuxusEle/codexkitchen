// Detailed web sash, from the unchanged aluminum/sash.js + sashdoor.js snapshots.
// Source local Y is depth; after door twist local face = 45 - source Z.
// Polygon union of bottom, left_short, right_tall, mid_shelf, top_lip_h,
// top_lip_v. Coordinates below are [depth, face], in millimetres.
export const WEB_SASH_PROFILE = {
  id: "WEB_SASH_45x21.2x1.5",
  face: 45,
  depth: 21.2,
  wall: 1.5,
  outer: [
    [0, 0],
    [0, 45],
    [16.2, 45],
    [16.2, 1.5],
    [19.7, 1.5],
    [19.7, 8.5],
    [17.7, 8.5],
    [17.7, 10],
    [21.2, 10],
    [21.2, 0],
  ],
  inner: [
    [1.5, 1.5],
    [14.7, 1.5],
    [14.7, 43.5],
    [1.5, 43.5],
  ],
  panelInset: 10,
  panelThickness: 3,
  panelDepth: 18.2,
  miterStart: 45,
  miterEnd: 45,
  source: "reference/fabrication/aluminum/sash.js + sashdoor.js",
};

// Matching sash body for the user's selected combined-engine integrated handle.
// Do not mix its channel datum with the rotated older web profile above.
export const COMBINED_SASH_PROFILE = {
  id: "COMBINED_SASH_45x21.2x1.5",
  face: 45,
  depth: 21.2,
  wall: 1.5,
  outer: [
    [21.2, 0],
    [0, 0],
    [0, 10],
    [3.5, 10],
    [3.5, 8.5],
    [1.5, 8.5],
    [1.5, 1.5],
    [5, 1.5],
    [5, 45],
    [21.2, 45],
  ],
  inner: [
    [6.5, 1.5],
    [19.7, 1.5],
    [19.7, 43.5],
    [6.5, 43.5],
  ],
  panelInset: 10,
  panelThickness: 3,
  panelDepth: 1.75,
  miterStart: 45,
  miterEnd: 45,
  source:
    "reference/fabrication/combined/combined_engine.rb: build_sash_assembly",
};
export const SOURCE_HANDLE_PROFILE = {
  id: "WEB_SASH_WITH_COMBINED_GRIP_REVIEW",
  rise: 32,
  wall: 1.5,
  stockLength: 3000,
  outer: [
    [21.2, 0],
    [19.7, 0],
    [19.7, -30.5],
    [1.5, -30.5],
    [1.5, -22],
    [0, -22],
    [0, -32],
    [21.2, -32],
  ],
  source:
    "reference/fabrication/combined/combined_engine.rb: create_finger_handle_top_bar",
};
// User-selected detailed web channel. Adding a handle must NEVER replace it.
export const SASH_PROFILE = WEB_SASH_PROFILE;
// The retained web sash is the depth mirror of the combined-engine sash.
// Carry the grip through that SAME datum change: its mouth must face outward
// (+door depth), not back into the cabinet. Top/bottom placement remains a
// separate in-plane transform in Scene.jsx; do not rotate the entire sash.
export const HANDLE_PROFILE = {
  ...SOURCE_HANDLE_PROFILE,
  depthMirrored: true,
  outer: SOURCE_HANDLE_PROFILE.outer
    .map(([depth, face]) => [Number((SASH_PROFILE.depth-depth).toFixed(6)),face])
    .reverse(),
};
export function doorBody(front) {
  return {
    height: front.h - HANDLE_PROFILE.rise,
    y: front.handleSide === "bottom" ? HANDLE_PROFILE.rise : 0,
  };
}
