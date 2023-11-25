import "./style.css";
import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
//import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
//import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import Stats from 'three/addons/libs/stats.module.js';
//import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { gsap } from "gsap";
import { GUI } from "lil-gui";

// Debug
const gui = new GUI();

// variables
let cameraChoice = 1;
let app;
let camera, controls, scene, renderer, stats;
let texture, mesh;
let swimmingPool1, swimmingPool2, swimmingPool3, swimmingPool4;
const worldWidth = 256, worldDepth = 256;
const objLoader = new OBJLoader();
//const mtlLoader = new MTLLoader();
//const fbxLoader = new FBXLoader();
const fiveTone = new THREE.TextureLoader().load("/gradientMap/fiveTone.jpg")
const clock = new THREE.Clock();

// pointer lock controls
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUpward = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

//physics



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
  camera.position.set(200, 200, 200);
  camera.lookAt(0, 0, 0);

  // axis helper -> X: red, Y: green, Z: blue
  const axesHelper = new THREE.AxesHelper(500);
  axesHelper.position.y = 0.001; // above the ground slightly
  scene.add(axesHelper);
  gui.add(axesHelper, 'visible').name('Axes Helper');
  gui.add(axesHelper.position, 'y', 0, 1000, 1).name('Helper Height');

  // grid helper
  const gridHelper = new THREE.GridHelper(10000, 1000, "#444444", "#cccccc");
  scene.add(gridHelper);

  // ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // directional light
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(- 60, 100, 40);
  scene.add(dirLight);

  if (cameraChoice == 1) {

    // orbit control
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.enableRotate = true;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = true;

  }
  else {

    // pointer lock control
    createControls();

  }

  // resize
  const onResize = () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

  };

  window.addEventListener("resize", onResize);

  // trying out new stuffs from here
  const data = generateHeight(worldWidth, worldDepth);

  let geometry = new THREE.PlaneGeometry(7500, 7500, worldWidth - 1, worldDepth - 1);
  geometry.rotateX(- Math.PI / 2);

  const vertices = geometry.attributes.position.array;

  for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {

    // height of the geometry, j + 1 is the y axis
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
  mesh.visible = false;

  scene.add(mesh);

  gui.add(mesh, 'visible').name('Mesh Visibility');
  gui.add(mesh.material, 'wireframe').name('Wireframe');

  // stats monitor
  stats = new Stats();
  document.body.appendChild(stats.dom);
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

function createControls() {

  controls = new PointerLockControls(camera, document.body);

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

      case 'Space':
        moveUpward = true;
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

      case 'Space':
        moveUpward = false;
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

}

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------


// animate
function animate() {

  requestAnimationFrame(animate);

  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');

  if (cameraChoice == 1) {

    instructions.style.display = 'none';
    blocker.style.display = 'none';

  }

  if (cameraChoice == 2) updateControls();

  renderer.render(scene, camera);

  stats.update();

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

    direction.z = Math.abs(lookAtVector.z) * ((Number(moveForward) - Number(moveBackward)));
    direction.y = - lookAtVector.y * ((Number(moveForward) - Number(moveBackward))) - Number(moveUpward) / 2;
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // this ensures consistent movements in all directions

    if (moveForward || moveBackward || moveUpward) {

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

  const swimmingPool = new THREE.Group();
  const waterPool = new THREE.Group();
  const viewPort = new THREE.Group();

  // box
  const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
  });

  // platform
  let platform_P = new THREE.Mesh(baseGeometry);
  let platform_N = new THREE.Mesh(baseGeometry);
  platform_P.scale.set(48, 10, 15);
  platform_N.scale.set(16, 5, 8);
  platform_N.position.set(
    1,
    platform_P.scale.y / 2 - platform_N.scale.y / 2,
    - platform_P.scale.z / 2 + platform_N.scale.z / 2 + 2
  );

  platform_P.updateMatrix();
  platform_N.updateMatrix();

  let platformCSG_P = CSG.fromMesh(platform_P);
  let platformCSG_N = CSG.fromMesh(platform_N);
  let platformCSG = platformCSG_P.subtract(platformCSG_N);

  let platform = CSG.toMesh(platformCSG, platform_P.matrix, baseMaterial);


  swimmingPool.add(platform);

  // the pool itself
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: '#005eff',
    metalness: 0.8
  });

  const water = new THREE.Mesh(baseGeometry, waterMaterial);
  water.scale.set(16, 1, 8);

  waterPool.add(water);

  // padding
  const makeSide = (length, width, x, z) => {

    let side = new THREE.Mesh(baseGeometry, baseMaterial);

    side.scale.set(length, 1, width);
    side.position.set(x, 0.2, z);

    waterPool.add(side);

  }

  makeSide(water.scale.x + 2, 1, 0, water.scale.z / 2 + 0.5);
  makeSide(water.scale.x + 2, 1, 0, - water.scale.z / 2 - 0.5);
  makeSide(1, water.scale.z + 2, water.scale.x / 2 + 0.5, 0);
  makeSide(1, water.scale.z + 2, - water.scale.x / 2 - 0.5, 0);

  waterPool.position.set(
    1,
    platform.scale.y / 2 - (water.scale.y / 2 - 0.1),
    - platform.scale.z / 2 + water.scale.z / 2 + 2
  );
  swimmingPool.add(waterPool);

  // view port
  const viewPlatform = new THREE.Mesh(baseGeometry, baseMaterial);
  viewPlatform.scale.set(
    platform.scale.x / 3,
    platform.scale.y,
    platform.scale.z / 2
  );

  viewPort.add(viewPlatform);

  // armchair
  objLoader.load(

    '/models/armchair/armchair_.obj',
    (chair) => {
      
      while (chair.children.length > 0) {

        let thisChair = chair.children[0];
        thisChair.material = new THREE.MeshToonMaterial({
          color: '#ffffff',
          roughness: 1,
          gradientMap: fiveTone
        });

        thisChair.scale.set(0.05, 0.05, 0.05);
        thisChair.rotation.y = Math.PI/3;
        thisChair.position.set(-4, platform.scale.y / 2, 2);
        viewPort.add(thisChair);

      }
    }
  );

  viewPort.position.set(
    - platform.scale.x / 2 + viewPlatform.scale.x / 2,
    0,
    - platform.scale.z / 2 - viewPlatform.scale.z / 2
  );

  swimmingPool.add(viewPort);








  // swimming pool
  swimmingPool.scale.set(10, 10, 10);
  //swimmingPool.position.set(1247, 951, 263);
  scene.add(swimmingPool);

  gui.add(swimmingPool.position, 'x', -4000, 4000, 1).name('poolX');
  gui.add(swimmingPool.position, 'y', 0, 1000, 1).name('poolY');
  gui.add(swimmingPool.position, 'z', -4000, 4000, 1).name('poolZ');

}
