import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { gsap } from "gsap";

// app
const app = document.querySelector("#app");

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b8b8b8');

// perspective camera
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  1000
);
camera.position.set(20, 10, 20);

// axis helper -> X: red, Y: green, Z: blue
const axesHelper = new THREE.AxesHelper(5);
axesHelper.position.y = 0.001; // above the ground slightly
//scene.add(axesHelper);

// grid helper
const gridHelper = new THREE.GridHelper(100, 100, "#444444", "#cccccc");
scene.add(gridHelper);

// ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// directional light
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(-60, 100, 40);
scene.add(dirLight);

// control
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.enableRotate = true;
controls.rotateSpeed = 0.5;
controls.enableZoom = true;

// resize
const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener("resize", onResize);

// box
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshNormalMaterial();
const baseMaterial = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  //metalness: 0,
  //roughness: 0
})
const baseMaterial0 = new THREE.MeshStandardMaterial({
  color: '#ededed',
  //metalness: 0,
  //roughness: 0
})
//const boxMesh = new THREE.Mesh(boxGeometry, material);

const swimmingPool = new THREE.Group();
const base = new THREE.Mesh(boxGeometry, baseMaterial0);
base.scale.set(15, 1, 10);
swimmingPool.add(base);
//scene.add(boxMesh);

//swimming pool
const waterMaterial = new THREE.MeshStandardMaterial({
  color: '#005eff',
  metalness: 0.8
});
const water = new THREE.Mesh(boxGeometry, waterMaterial);
water.scale.set(6, 1, 5);
water.position.set(0, 0.1, 0);
swimmingPool.add(water);

const side1 = new THREE.Mesh(boxGeometry, baseMaterial);
const side2 = new THREE.Mesh(boxGeometry, baseMaterial);
const side3 = new THREE.Mesh(boxGeometry, baseMaterial);
const side4 = new THREE.Mesh(boxGeometry, baseMaterial);

side1.scale.set(8, 1, 1);
side2.scale.set(8, 1, 1);
side3.scale.set(1, 1, 5);
side4.scale.set(1, 1, 5);

side1.position.set(0, 0.2, 2.5);
side2.position.set(0, 0.2, -2.5);
side3.position.set(-3.5, 0.2, 0);
side4.position.set(3.5, 0.2, 0);

swimmingPool.add(side1);
swimmingPool.add(side2);
swimmingPool.add(side3);
swimmingPool.add(side4);


swimmingPool.position.set(0, 0.5, 0);
scene.add(swimmingPool);

// animate
const animate = () => {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
  controls.update();
};

animate();
