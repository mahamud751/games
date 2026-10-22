// Day/night cycle: gradient sky with sun and stars, a shaded ocean, sun/moon
// light with a shadow box that follows the camera target, and fog.
import * as THREE from 'three';
import { SHORE, SEA_Y } from './city.js';

const KEYS = [
  { h: 0, top: '#070824', hor: '#2a1646', sun: '#8f9cff', sunI: 0.45, hemi: 0.62, fog: '#150f2c', fd: 0.0029, night: 1 },
  { h: 5, top: '#0d1030', hor: '#3a1f4a', sun: '#8a8cff', sunI: 0.4, hemi: 0.6, fog: '#22183a', fd: 0.0027, night: 1 },
  { h: 6.4, top: '#3a4f8f', hor: '#ff9c7a', sun: '#ffb07a', sunI: 1.3, hemi: 0.65, fog: '#d9908a', fd: 0.0021, night: 0.45 },
  { h: 8, top: '#4d8ee0', hor: '#cfe6f5', sun: '#fff0d6', sunI: 2.5, hemi: 1.05, fog: '#b9d4e8', fd: 0.0015, night: 0 },
  { h: 16, top: '#3f7fd8', hor: '#d9e9f2', sun: '#fff0d6', sunI: 2.5, hemi: 1.05, fog: '#c2d8e6', fd: 0.0015, night: 0 },
  { h: 18.1, top: '#5a4b9c', hor: '#ffb27a', sun: '#ffb070', sunI: 2.2, hemi: 1.0, fog: '#e8a98a', fd: 0.0018, night: 0.1 },
  { h: 19.2, top: '#3a2470', hor: '#ff5e7e', sun: '#ff6a4a', sunI: 1.4, hemi: 0.85, fog: '#b4567a', fd: 0.0021, night: 0.55 },
  { h: 20.4, top: '#14103c', hor: '#7a2a72', sun: '#7a6cff', sunI: 0.4, hemi: 0.65, fog: '#3a1d4c', fd: 0.0026, night: 0.95 },
  { h: 24, top: '#070824', hor: '#2a1646', sun: '#8f9cff', sunI: 0.45, hemi: 0.62, fog: '#150f2c', fd: 0.0029, night: 1 }
].map(k => ({ ...k, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun), fog: new THREE.Color(k.fog) }));

const SKY_V = `varying vec3 vDir;
void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.9999, p.w); }`;
const SKY_F = `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSun; uniform float uStars; uniform float uDay;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHor, uTop, pow(smoothstep(0.0, 0.55, h), 0.75));
  float sd = max(dot(d, uSunDir), 0.0);
  float up = smoothstep(-0.12, 0.05, uSunDir.y);
  col += uSun * (pow(sd, 1200.0) * 9.0 * uDay + pow(sd, 10.0) * 0.45 * up + pow(sd, 3.0) * 0.12 * up);
  vec3 moonDir = -uSunDir;
  float md = max(dot(d, moonDir), 0.0);
  col += vec3(0.9, 0.92, 1.0) * smoothstep(0.9993, 0.9996, md) * (1.0 - uDay) * 1.4;
  vec3 cell = floor(d * 260.0);
  float s = hash(cell);
  col += uStars * step(0.9975, s) * smoothstep(0.04, 0.35, h) * (0.6 + 0.4 * hash(cell + 1.0));
  if (d.y < 0.0) col = uHor * 0.75;
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_V = `varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_F = `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSun; uniform vec3 uFog;
uniform float uFogD; uniform float uTime; uniform float uNight; uniform float uShore;
varying vec3 vW;
void main() {
  vec2 p = vW.xz; float t = uTime;
  vec3 n = vec3(0.0, 1.0, 0.0);
  n.x = 0.07 * cos(p.x * 0.21 + t * 1.1) + 0.05 * cos(p.x * 0.53 + p.y * 0.31 + t * 1.7) + 0.03 * cos(p.y * 1.3 + p.x * 0.9 + t * 2.3) + 0.015 * cos(p.x * 3.1 - p.y * 2.2 + t * 3.1);
  n.z = 0.07 * cos(p.y * 0.17 + t * 0.9) + 0.05 * cos(p.y * 0.47 - p.x * 0.29 + t * 1.5) + 0.03 * cos(p.x * 1.1 - p.y * 1.4 + t * 2.1) + 0.015 * cos(p.y * 2.9 + p.x * 2.4 + t * 2.7);
  n = normalize(n);
  vec3 V = normalize(vW - cameraPosition);
  vec3 R = reflect(V, n);
  float fres = 0.06 + 0.9 * pow(1.0 - max(dot(-V, n), 0.0), 4.0);
  vec3 sky = mix(uHor, uTop, clamp(R.y * 1.8, 0.0, 1.0));
  float shallow = 1.0 - smoothstep(uShore + 4.0, uShore + 70.0, vW.x);
  vec3 deep = mix(vec3(0.01, 0.09, 0.16), vec3(0.01, 0.025, 0.06), uNight);
  vec3 shal = mix(vec3(0.05, 0.42, 0.5), vec3(0.02, 0.08, 0.14), uNight);
  vec3 col = mix(deep, shal, shallow);
  col = mix(col, sky, fres);
  col += uSun * pow(max(dot(R, uSunDir), 0.0), 220.0) * 3.0;
  float foam = (1.0 - smoothstep(0.0, 3.5, vW.x - uShore - 10.0)) * step(uShore + 8.0, vW.x);
  foam *= 0.55 + 0.45 * sin(vW.z * 0.35 + t * 1.6 + sin(vW.z * 0.07) * 4.0);
  col = mix(col, vec3(0.92, 0.95, 0.95) * (1.0 - uNight * 0.7), clamp(foam, 0.0, 1.0) * 0.8);
  float d = length(vW - cameraPosition);
  float f = 1.0 - exp(-uFogD * uFogD * d * d);
  gl_FragColor = vec4(mix(col, uFog, f), 1.0);
}`;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.u = {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSun: { value: new THREE.Color() }, uStars: { value: 0 }, uDay: { value: 1 }, uFog: { value: new THREE.Color() },
      uFogD: { value: 0.002 }, uTime: { value: 0 }, uNight: { value: 0 }, uShore: { value: SHORE }
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false }));
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: WATER_V, fragmentShader: WATER_F }));
    this.water.position.y = SEA_Y;
    scene.add(this.water);
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 1; sc.far = 600;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.35;
    scene.add(this.sun, this.sun.target);
    this.k = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color() };
    this.night = 0;
  }
  update(hour, focus, cam, t) {
    let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) if (hour >= KEYS[i].h && hour < KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const f = (hour - a.h) / (b.h - a.h), k = this.k;
    k.top.copy(a.top).lerp(b.top, f); k.hor.copy(a.hor).lerp(b.hor, f);
    k.sun.copy(a.sun).lerp(b.sun, f); k.fog.copy(a.fog).lerp(b.fog, f);
    const sunI = a.sunI + (b.sunI - a.sunI) * f, hemi = a.hemi + (b.hemi - a.hemi) * f;
    this.night = a.night + (b.night - a.night) * f;
    const ang = (hour - 6) / 12 * Math.PI;
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const u = this.u;
    u.uTop.value.copy(k.top); u.uHor.value.copy(k.hor); u.uSun.value.copy(k.sun);
    u.uSunDir.value.copy(dir); u.uStars.value = this.night; u.uDay.value = 1 - this.night;
    u.uFog.value.copy(k.fog); u.uNight.value = this.night; u.uTime.value = t;
    u.uFogD.value = a.fd + (b.fd - a.fd) * f;
    this.scene.fog.color.copy(k.fog); this.scene.fog.density = u.uFogD.value;
    this.hemi.color.copy(k.top).lerp(new THREE.Color(1, 1, 1), 0.55);
    this.hemi.groundColor.copy(k.hor).multiplyScalar(0.5);
    this.hemi.intensity = hemi;
    const light = dir.y > -0.02 ? dir : dir.clone().negate();
    this.sun.color.copy(k.sun);
    this.sun.intensity = sunI;
    const sx = Math.round(focus.x), sz = Math.round(focus.z);
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + light.x * 250, Math.max(30, light.y * 250), sz + light.z * 250);
    this.dome.position.copy(cam.position);
    this.water.position.x = Math.round(cam.position.x / 50) * 50;
    this.water.position.z = Math.round(cam.position.z / 50) * 50;
    return this.night;
  }
}
