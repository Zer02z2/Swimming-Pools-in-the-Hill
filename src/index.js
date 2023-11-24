import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
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
//controls stuff
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

init();
makePools();
animate();


//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------

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

  // orbit control

  // controls = new OrbitControls(camera, renderer.domElement);
  // controls.enableDamping = true;
  // controls.dampingFactor = 0.05;
  // controls.screenSpacePanning = false;
  // controls.enableRotate = true;
  // controls.rotateSpeed = 0.5;
  // controls.enableZoom = true;

  // first person control

  // controls = new FirstPersonControls(camera, renderer.domElement);
  // controls.movementSpeed = 150;
  // controls.lookSpeed = 0.1;
  // controls.rollSpeed = 1;

  // pointer lock control

  controls = new PointerLockControls(camera, document.body);
  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');

  instructions.addEventListener('click', function () {

    controls.lock();

  });

  controls.addEventListener('lock', function () {

    instructions.style.display = 'none';
    blocker.style.display = 'none';

  });

  controls.addEventListener('unlock', function () {

    blocker.style.display = 'block';
    instructions.style.display = '';

  });

  scene.add(controls.getObject());

  const onKeyDown = (event) => {

    switch (event.code) {

      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;

      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;

      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;

      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;

    }

  };

  const onKeyUp = (event) => {

    switch (event.code) {

      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;

      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;

      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;

      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;

    }

  };

  const onMouseDown = (event) => {

    switch (event.button) {

      case 0:
        moveForward = true;
        break;

      case 2:
        moveBackward = true;
        break;
    }
  }

  const onMouseUp = (event) => {

    switch (event.button) {

      case 0:
        moveForward = false;
        break;

      case 2:
        moveBackward = false;
        break;
    }
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);


  // resize
  const onResize = () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

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


//--------------------------------------------------------------------------
//--------------------------------------------------------------------------


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

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------


// animate
function animate() {

  requestAnimationFrame(animate);

  updateControls();

  renderer.render(scene, camera);
  //controls.update(clock.getDelta());

};

//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------

function updateControls() {

  const time = performance.now();

  let lookAtVector = new THREE.Vector3(0, 0, -1);
  lookAtVector.applyQuaternion(camera.quaternion);
  lookAtVector.normalize();

  //console.log(lookAtVector);

  if (controls.isLocked === true) {

    const delta = (time - prevTime) / 1000;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    velocity.y -= velocity.y * 10.0 * delta; // 100.0 = mass

    direction.z = Math.abs(lookAtVector.z) * (Number(moveForward) - Number(moveBackward));
    direction.y = - lookAtVector.y * (Number(moveForward) - Number(moveBackward));
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // this ensures consistent movements in all directions

    if (moveForward || moveBackward) {

      velocity.z -= direction.z * 4000.0 * delta;
      velocity.y -= direction.y * 4000.0 * delta;

    }

    if (moveLeft || moveRight) velocity.x -= direction.x * 4000.0 * delta;


    controls.moveRight(- velocity.x * delta);
    controls.moveForward(- velocity.z * delta);

    controls.getObject().position.y += (velocity.y * delta); // new behavior

  }

  prevTime = time;

}

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
