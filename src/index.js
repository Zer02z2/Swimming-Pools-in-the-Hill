import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
//import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { gsap } from "gsap";

//initialize
let app;
let camera, controls, scene, renderer;
let texture, mesh;
const worldWidth = 256, worldDepth = 256;
const clock = new THREE.Clock();
const fiveTone = new THREE.TextureLoader().load("/fiveTone.jpg")

init();
makePools();
animate();

function init() {
  // app
  app = document.getElementById('app');

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enable = true;
  renderer.shadowMap.renderReverseSided = false;
  app.appendChild(renderer.domElement);

  fiveTone.minFilter = THREE.NearestFilter
  fiveTone.magFilter = THREE.NearestFilter

  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8b8b8');

  // perspective camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    20000
  );
  camera.position.set(2000, 1000, 2000);
  camera.lookAt(0, 0, 0);

  // axis helper -> X: red, Y: green, Z: blue
  const axesHelper = new THREE.AxesHelper(5);
  axesHelper.position.y = 0.001; // above the ground slightly
  //scene.add(axesHelper);

  // grid helper
  const gridHelper = new THREE.GridHelper(10000, 10000, "#444444", "#cccccc");
  //scene.add(gridHelper);

  // ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // directional light
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(- 60, 100, 40);
  scene.add(dirLight);

  // control
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.enableRotate = true;
  controls.rotateSpeed = 0.5;
  controls.enableZoom = true;
  // controls = new FirstPersonControls(camera, renderer.domElement);
  // controls.movementSpeed = 150;
  // controls.lookSpeed = 0.1;

  // resize
  const onResize = () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    //controls.handleResize();

  };

  window.addEventListener("resize", onResize);

  //trying out new stuffs from here
  const data = generateHeight(worldWidth, worldDepth);

  let geometry = new THREE.PlaneGeometry(7500, 7500, worldWidth - 1, worldDepth - 1);
  geometry.rotateX(- Math.PI / 2);

  const vertices = geometry.attributes.position.array;

  for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {

    //height of the geometry, j + 1 is the y axis
    vertices[j + 1] = data[i] * 10;

  }

  //geometry = BufferGeometryUtils.mergeVertices(geometry, 0.1);
  geometry.computeVertexNormals(true);

  //texture = new THREE.CanvasTexture(generateTexture(data, worldWidth, worldDepth));


  texture = new THREE.MeshToonMaterial({

    color: 'rgb(222, 131, 62)',
    wireframe: false,
    side: THREE.DoubleSide,
    gradientMap: fiveTone,

  });
  texture.warpS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  //mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
  mesh = new THREE.Mesh(geometry, texture);

  mesh.receiveShadow = true;
  mesh.castShadow = true;

  scene.add(mesh);
}

function generateHeight(width, height) {

  let seed = Math.PI / 4;
  window.Math.random = () => {

    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);

  }

  const size = width * height, data = new Uint8Array(size);
  const perlin = new ImprovedNoise(), z = Math.random() * 60;

  let quality = 1;

  for (let j = 0; j < 4; j++) {

    for (let i = 0, l = 10; i < size; i++) {

      const x = i % width, y = ~ ~(i / width);
      data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);

    }

    quality *= 5;

  }

  return data;

}

function generateTexture(data, width, height) {

  let context, image, imageData, shade;

  const vector3 = new THREE.Vector3(0, 0, 0);

  const sun = new THREE.Vector3(1, 1, 1);
  sun.normalize();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);

  image = context.getImageData(0, 0, canvas.width, canvas.height);
  imageData = image.data;

  for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {

    vector3.x = data[j - 2] - data[j + 2];
    vector3.y = 2;
    vector3.z = data[j - width * 2] - data[j + width * 2];
    vector3.normalize();

    shade = vector3.dot(sun);

    imageData[i] = (96 + shade * 128) * (0.5 + data[j] * 0.007);
    imageData[i + 1] = (32 + shade * 96) * (0.5 + data[j] * 0.007);
    imageData[i + 2] = (shade * 96) * (0.5 + data[j] * 0.007);
  }

  context.putImageData(image, 0, 0);

  // Scaled 4x ??
  const canvasScaled = document.createElement('canvas');
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;

  context = canvasScaled.getContext('2d');
  context.scale(4, 4);
  context.drawImage(canvas, 0, 0);

  image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
  imageData = image.data;

  for (let i = 0, l = imageData.length; i < l; i += 4) {

    const v = ~ ~(Math.random() * 5);

    imageData[i] += v;
    imageData[i + 1] += v;
    imageData[i + 2] += v;

  }

  context.putImageData(image, 0, 0);

  return canvasScaled;

}


// animate
function animate() {

  requestAnimationFrame(animate);

  renderer.render(scene, camera);
  controls.update(clock.getDelta());

};

function makePools() {
  // box
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshNormalMaterial();
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    wireframe: false,
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

}