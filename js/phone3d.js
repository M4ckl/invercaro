/* Our own iPhone, built from code (Pro Max proportions, height 1, screen facing +Z): aluminium body whose bevel is the rim
   around the black front glass, the display (planar UVs; give it an unlit emissive material), side buttons and the camera
   plateau on the back. Shared by the Mono story (js/story3d-engine.js) and the Sileo page (js/sileo3d.js). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DISPLAY = [1320, 2868];
export const ISLAND = { w: 125 / 402, h: 37.3 / 874, top: 11 / 874 };
/* Phone size in model units (height 1): 163.4 × 78 × 8.75 mm. */
const PHONE = { w: 78 / 163.4, h: 1, t: 8.75 / 163.4, r: 0.078, rim: 0.008, bezel: 0.017 };

export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function buildPhone(screenMaterial) {
  const { w: W, h: H, t: T, r: R, rim: B, bezel } = PHONE;
  const phone = new THREE.Group();
  const frame = new THREE.MeshPhysicalMaterial({ color: 0xdfe1e5, metalness: 0.85, roughness: 0.26, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x050506, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, metalness: 0.2, roughness: 0.08, clearcoat: 1 });

  /* Body: one rounded slab, its bevel is the polished rim around the front glass. */
  const depth = T - B * 2;
  const body = new THREE.ExtrudeGeometry(roundedRect(W - B * 2, H - B * 2, R - B), {
    depth, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 6, curveSegments: 24,
  });
  body.translate(0, 0, -depth / 2);
  phone.add(new THREE.Mesh(body, frame));

  const front = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - B * 2 - 0.002, H - B * 2 - 0.002, R - B - 0.001), 24), glass);
  front.position.z = T / 2 + 0.0002;
  phone.add(front);

  /* Display: Pro Max aspect, rounded corners; UVs map the recording across it. */
  const SW = W - bezel * 2;
  const SH = (SW * DISPLAY[1]) / DISPLAY[0];
  const screenGeo = new THREE.ShapeGeometry(roundedRect(SW, SH, R - bezel + 0.004), 24);
  const pos = screenGeo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / SW + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / SH + 0.5;
  }
  screenGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const screen = new THREE.Mesh(screenGeo, screenMaterial);
  screen.position.z = T / 2 + 0.0005;
  screen.renderOrder = 1;
  phone.add(screen);

  /* Side buttons: action + volume on the left, side button + Camera Control on the right. */
  [[-1, 0.3, 0.04], [-1, 0.2, 0.065], [-1, 0.115, 0.065], [1, 0.18, 0.1], [1, -0.12, 0.075]].forEach(([side, y, len]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.008, len, T * 0.42, 2, 0.003), frame);
    b.position.set(side * (W / 2 + 0.0012), y, 0);
    phone.add(b);
  });

  /* Back: the full-width camera plateau with three lenses and the flash. */
  const plateau = new THREE.Mesh(new RoundedBoxGeometry(W - 0.03, 0.2, 0.012, 4, 0.006), frame);
  plateau.position.set(0, H / 2 - 0.13, -T / 2 - 0.002);
  phone.add(plateau);
  [[-0.13, 0.04], [-0.13, -0.045], [-0.055, 0]].forEach(([x, y]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 40), frame);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, plateau.position.y + y, -T / 2 - 0.012);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 40), lensGlass);
    lens.rotation.y = Math.PI;
    lens.position.set(x, plateau.position.y + y, -T / 2 - 0.0181);
    phone.add(ring, lens);
  });
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.4 }));
  flash.rotation.y = Math.PI;
  flash.position.set(0.12, plateau.position.y + 0.04, -T / 2 - 0.0081);
  phone.add(flash);

  return phone;
}
