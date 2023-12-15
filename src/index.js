import "./style.css";
import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { CSM } from 'three/addons/csm/CSM.js';
import { CSMHelper } from 'three/addons/csm/CSMHelper.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { gsap } from "gsap";

// Debug
let debugging = false;
let gui, sceneUI, poolUI, viewPortUI;
if (debugging) {
  gui = new GUI();
  sceneUI = gui.addFolder("Scene");
  poolUI = gui.addFolder("Swimming Pool");
  viewPortUI = gui.addFolder("Viewport");
}


// variables
let cameraChoice = 2;
let app;
let camera, controls, scene, renderer, stats, csm, csmHelper;
let mixers = [];
let characters = [];
let diving, gettingUp, inIdle;
let texture, mesh;
const clock = new THREE.Clock();

const worldWidth = 256, worldDepth = 256;

const gltfLoader = new GLTFLoader();
const threeTone = new THREE.TextureLoader().load("./gradientMap/threeTone.jpg")
const fourTone = new THREE.TextureLoader().load("./gradientMap/fourTone.jpg")
const fiveTone = new THREE.TextureLoader().load("./gradientMap/fiveTone.jpg")

// pointer lock controls
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUpward = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let moveSpeed = 10000;

// CSM param
const params = {
  orthographic: false,
  fade: true,
  far: 2000,
  mode: 'practical',
  intensity: 0.9,
  color: 0xffffff,
  lightX: - 2,
  lightY: - 10,
  lightZ: 2,
  margin: 100,
  lightFar: 5000,
  lightNear: 1,
  autoUpdateHelper: false,
  updateHelper: function () {

    csmHelper.update();

  }
};

// water
// Texture width for simulation
const WIDTHX = 128;
const WIDTHY = 64;

// Water size in system units
const BOUNDSX = 16;
const BOUNDSY = 8;

let waterMesh;
let gpuCompute;
let heightmapVariable;
let waterUniforms;
let readWaterLevelShader;
 let readWaterLevelRenderTarget;
 let readWaterLevelImage;
 const waterNormal = new THREE.Vector3();

// const simplex = new SimplexNoise();

let waterX, waterZ;
waterX = waterZ = 0;



init();
animate();


//-------------------------------------------------- Init ----------------------------------------------

function init() {
  // app
  app = document.getElementById('app');

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);

  threeTone.minFilter = threeTone.magFilter =
    fourTone.minFilter = fourTone.magFilter =
    fiveTone.minFilter = fiveTone.magFilter = THREE.NearestFilter;

  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xefd1b5);
  scene.fog = new THREE.FogExp2(0xefd1b5, 0.0005);

  // perspective camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    20000
  );
  camera.position.set(1747, 1200, 513);
  camera.lookAt(1247, 1000, 313);

  // axis helper -> X: red, Y: green, Z: blue
  const axesHelper = new THREE.AxesHelper(500);
  axesHelper.position.y = 0.001; // above the ground slightly
  // scene.add(axesHelper);
  if (debugging) {
    sceneUI.add(axesHelper, 'visible').name('Axes Helper');
    sceneUI.add(axesHelper.position, 'y', 0, 1000, 1).name('Helper Height');
  }


  // grid helper
  const gridHelper = new THREE.GridHelper(10000, 1000, "#444444", "#cccccc");
  scene.add(gridHelper);

  // ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // directional light
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.1);
  dirLight.position.set(0, 1, 0);
  scene.add(dirLight);
  const helper = new THREE.DirectionalLightHelper(dirLight, 5);
  scene.add(helper);


  // CSM
  csm = new CSM({
    maxFar: params.far,
    cascades: 4,
    mode: params.mode,
    parent: scene,
    shadowMapSize: 10240,
    lightDirection: new THREE.Vector3(params.lightX, params.lightY, params.lightZ).normalize(),
    lightIntensity: params.intensity,
    lightColor: params.color,
    camera: camera
  });

  csmHelper = new CSMHelper(csm);
  csmHelper.visible = true;
  scene.add(csmHelper);

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

  // make swimming pool
  makePools(1247, 950, 346, 0, true);
  makePools(1252, 1033, -3022, 2, false);
  // makePools(235, 499, -580, 1.6, false);
  makePools(-1699, 295, -2106, 3.2, false);
  makePools(- 1903, 1211, -71, - 1.5, false);
  makePools(1965, 677, 3593, 0.4, false);

  // resize
  const onResize = () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

  };

  window.addEventListener("resize", onResize);

  // generate mountains
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

  csm.setupMaterial(texture);

  //mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
  mesh = new THREE.Mesh(geometry, texture);

  mesh.visible = true;
  mesh.receiveShadow = true;

  scene.add(mesh);

  if (debugging) {
    sceneUI.add(mesh, 'visible').name('Mesh Visibility');
    sceneUI.add(mesh.material, 'wireframe').name('Wireframe');
  }

  // stats monitor
  stats = new Stats();
  document.body.appendChild(stats.dom);
}



//------------------------------------------ Perlin Noise ----------------------------------------------


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

//---------------------------------------- Pointer Lock Control --------------------------------------------

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

function updateControls() {

  const time = performance.now();

  let lookAtVector = new THREE.Vector3(0, 0, -1);
  lookAtVector.applyQuaternion(camera.quaternion);
  lookAtVector.normalize();

  if (controls.isLocked === true) {

    const delta = (time - prevTime) / 1000;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    velocity.y -= velocity.y * 10.0 * delta; // 100.0 = mass

    direction.z = (Number(moveForward) - Number(moveBackward));
    direction.y = - lookAtVector.y * ((Number(moveForward) - Number(moveBackward))) - Number(moveUpward) / 2;
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // this ensures consistent movements in all directions

    if (moveForward || moveBackward || moveUpward) {

      velocity.z -= direction.z * moveSpeed * delta;
      velocity.y -= direction.y * moveSpeed * delta;

    }

    if (moveLeft || moveRight) velocity.x -= direction.x * moveSpeed * delta;


    controls.moveRight(- velocity.x * delta);
    controls.moveForward(- velocity.z * delta);

    controls.getObject().position.y += (velocity.y * delta); // new behavior

  }

  prevTime = time;

}

//--------------------------------------------- Animate --------------------------------------------


// animate
function animate() {

  requestAnimationFrame(animate);

  // Update mixer
  if (mixers[0] != null) mixers[0].update(clock.getDelta());

  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');

  if (cameraChoice == 1) {

    instructions.style.display = 'none';
    blocker.style.display = 'none';

  }

  if (cameraChoice == 2) updateControls();

  csm.update();

  if (params.autoUpdateHelper) {

    csmHelper.update();

  }

  render();

  stats.update();

};

function render() {

  // Set uniforms: mouse interaction
  const uniforms = heightmapVariable.material.uniforms;

  if (characters[0]) {
    let dist = camera.position.distanceTo(characters[0].getWorldPosition(new THREE.Vector3()));
    if (dist < 400 && inIdle) {
      console.log('close');
      mixers[0]._actions[0].setEffectiveWeight(0);
      mixers[0]._actions[1].setEffectiveWeight(1);
      mixers[0]._actions[1].reset();
      mixers[0]._actions[1].play();
      inIdle = false;
    } else if (inIdle == false && dist > 400 && !gettingUp) {
      console.log('far');
      mixers[0]._actions[2].reset();
      mixers[0]._actions[2].play();
      gettingUp = true;
    }
  } 

  let x, z;
  if (diving == true) {
    x = -4;
    z = 0;
    diving = false
  } else {
    x = 10000;
    z = 10000;
  }

  uniforms['pos'].value.set(x, z);


  // Do the gpu computation
  gpuCompute.compute();

  // Get compute output in custom uniform
  waterUniforms['heightmap'].value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;

  // Render
  renderer.render(scene, camera);
}


// ----------------------------------------- water ---------------------------------------------------

function initWater(waterPool) {

  const materialColor = '#031745';

  const geometry = new THREE.PlaneGeometry(BOUNDSX, BOUNDSY, WIDTHX - 1, WIDTHY - 1);

  // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.ShaderLib['phong'].uniforms,
      {
        'heightmap': { value: null }
      }
    ]),
    vertexShader: document.getElementById('waterVertexShader').textContent,
    fragmentShader: THREE.ShaderChunk['meshphong_frag']

  });

  material.lights = true;

  // Material attributes from THREE.MeshPhongMaterial
  // Sets the uniforms with the material values
  material.uniforms['diffuse'].value = new THREE.Color(materialColor);
  material.uniforms['specular'].value = new THREE.Color(0x111111);
  material.uniforms['shininess'].value = Math.max(50, 1e-4);
  material.uniforms['opacity'].value = material.opacity;

  // Defines
  material.defines.WIDTHX = WIDTHX.toFixed(1);
  material.defines.WIDTHY = WIDTHY.toFixed(1);
  material.defines.BOUNDSX = BOUNDSX.toFixed(1);
  material.defines.BOUNDSY = BOUNDSY.toFixed(1);

  waterUniforms = material.uniforms;

  waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = - Math.PI / 2;
  waterMesh.matrixAutoUpdate = false;
  waterMesh.position.set(0, 0.5, 0);
  waterMesh.updateMatrix();

  waterPool.add(waterMesh);

  // Creates the gpu computation class and sets it up

  gpuCompute = new GPUComputationRenderer(WIDTHX, WIDTHY, renderer);

  if (renderer.capabilities.isWebGL2 === false) {

    gpuCompute.setDataType(THREE.HalfFloatType);

  }

  const heightmap0 = gpuCompute.createTexture();

  heightmapVariable = gpuCompute.addVariable('heightmap', document.getElementById('heightmapFragmentShader').textContent, heightmap0);

  gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

  heightmapVariable.material.uniforms['pos'] = { value: new THREE.Vector2(0, 0) };
  heightmapVariable.material.uniforms['size'] = { value: 1.0 };
  heightmapVariable.material.uniforms['viscosityConstant'] = { value: 0.98 };
  heightmapVariable.material.uniforms['heightCompensation'] = { value: 0 };
  heightmapVariable.material.defines.BOUNDSX = BOUNDSX.toFixed(1);
  heightmapVariable.material.defines.BOUNDSY = BOUNDSY.toFixed(1);

  const error = gpuCompute.init();
  if (error !== null) {

    console.error(error);

  }

  // Create compute shader to read water level
  readWaterLevelShader = gpuCompute.createShaderMaterial(document.getElementById('readWaterLevelFragmentShader').textContent, {
    point1: { value: new THREE.Vector2() },
    levelTexture: { value: null }
  });
  readWaterLevelShader.defines.WIDTHX = WIDTHX.toFixed(1);
  readWaterLevelShader.defines.WIDTHY = WIDTHY.toFixed(1);
  readWaterLevelShader.defines.BOUNDSX = BOUNDSX.toFixed(1);
  readWaterLevelShader.defines.BOUNDSY = BOUNDSY.toFixed(1);

  // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
  readWaterLevelImage = new Uint8Array(4 * 1 * 4);

  readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(4, 1, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false
  });

}


// --------------------------------------- Swimming Pool ----------------------------------------------

function makePools(x, y, z, r, w) {

  const swimmingPool = new THREE.Group();
  const waterPool = new THREE.Group();
  const viewPort = new THREE.Group();

  // box
  const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 'rgb(220, 220, 220)',
  });
  csm.setupMaterial(baseMaterial);

  // platform - subtracting one geometry from another to create the pool
  let platform_P = new THREE.Mesh(baseGeometry);
  let platform_N = new THREE.Mesh(baseGeometry);
  platform_P.scale.set(48, 15, 15);
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
  platform.castShadow = true;
  platform.receiveShadow = true;

  swimmingPool.add(platform);

  // the pool itself
  const valuesChanger = () => {

    heightmapVariable.material.uniforms['size'].value = 1;
    heightmapVariable.material.uniforms['viscosityConstant'].value = 0.98;
  };
  
  if (w == true){
    initWater(waterPool);
    valuesChanger();
  } else {

    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 'rgb(1, 34, 117)',
      metalness: 0.8
    });
    const water = new THREE.Mesh(baseGeometry, waterMaterial);
    water.scale.set(16, 1, 8);
    water.position.set(0, 0.1, 0);
    waterPool.add(water);

  }


  // padding
  const makeSide = (length, width, x, z) => {

    let side = new THREE.Mesh(baseGeometry, baseMaterial);

    side.scale.set(length, 1, width);
    side.position.set(x, 0.2, z);

    side.castShadow = true;
    side.receiveShadow = true;

    waterPool.add(side);

  }

  makeSide(BOUNDSX + 2, 1, 0, BOUNDSY / 2 + 0.5);
  makeSide(BOUNDSX + 2, 1, 0, - BOUNDSY / 2 - 0.5);
  makeSide(1, BOUNDSY + 2, BOUNDSX / 2 + 0.5, 0);
  makeSide(1, BOUNDSY + 2, - BOUNDSX / 2 - 0.5, 0);

  waterPool.position.set(
    1,
    platform.scale.y / 2 - 0.5,
    - platform.scale.z / 2 + BOUNDSY / 2 + 2
  );
  swimmingPool.add(waterPool);

  // view port, build vew platform
  const viewPlatform = new THREE.Mesh(baseGeometry, baseMaterial);
  viewPlatform.scale.set(
    platform.scale.x / 3,
    platform.scale.y - 1,
    platform.scale.z / 1.5
  );

  viewPlatform.castShadow = true;
  viewPlatform.receiveShadow = true;
  viewPort.add(viewPlatform);

  // import armchair
  gltfLoader.load(

    './models/armchair/SofaDesign.glb',
    (chair) => {

      let chairModel = new THREE.Group();

      while (chair.scene.children.length > 0) {

        let chairComponent = chair.scene.children[0];

        if (chairComponent.isMesh) chairComponent.castShadow = true;
        if (chairComponent.isMesh) chairComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: (() => {
            if (chair.scene.children.length > 4) return 'rgb(207, 170, 122)';
            else return '#ffffff';
          })(),
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        chairComponent.material = newMaterial;
        chairModel.add(chairComponent);
      }

      chairModel.scale.set(2, 2, 2);
      chairModel.rotation.y = Math.PI / 3;
      chairModel.position.set(-4, viewPlatform.scale.y / 2, 2);
      viewPort.add(chairModel);

      if (debugging) {
        viewPortUI.add(chairModel.position, 'x', -10, 10, 0.1).name("chair X");
        viewPortUI.add(chairModel.position, 'z', -10, 10, 0.1).name("chair Z");
        viewPortUI.add(chairModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("chair rotation");
      }
    }
  );

  // import couch
  gltfLoader.load(

    './models/couch/couch.glb',
    (couch) => {

      let couchModel = new THREE.Group();
      while (couch.scene.children.length > 0) {

        let couchComponent = couch.scene.children[0];

        if (couchComponent.isMesh) couchComponent.castShadow = true;
        if (couchComponent.isMesh) couchComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: (() => {
            if (couch.scene.children.length > 7) return 'rgb(207, 170, 122)';
            else return '#ffffff';
          })(),
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        couchComponent.material = newMaterial;
        couchModel.add(couchComponent);
      }

      couchModel.scale.set(0.04, 0.04, 0.04);
      couchModel.rotation.y = Math.PI * 1.05;
      couchModel.position.set(3, viewPlatform.scale.y / 2, 2.5);
      viewPort.add(couchModel);

      if (debugging) {
        viewPortUI.add(couchModel.position, 'x', -10, 10, 0.1).name("couch X");
        viewPortUI.add(couchModel.position, 'z', -10, 10, 0.1).name("couch Z");
        viewPortUI.add(couchModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("couch rotation");
      }
    }
  );

  // import table
  gltfLoader.load(

    './models/table/table.glb',
    (table) => {

      let tableModel = new THREE.Group();
      while (table.scene.children.length > 0) {

        let tableComponent = table.scene.children[0];

        if (tableComponent.isMesh) tableComponent.castShadow = true;
        if (tableComponent.isMesh) tableComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: '#ffffff',
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        tableComponent.material = newMaterial
        tableModel.add(tableComponent);

      }

      tableModel.scale.set(4, 4, 4);
      tableModel.rotation.y = Math.PI * 1.05;
      tableModel.position.set(3.1, viewPlatform.scale.y / 2, - 2.8);
      viewPort.add(tableModel);

      if (debugging) {
        viewPortUI.add(tableModel.position, 'x', -10, 10, 0.1).name("table X");
        viewPortUI.add(tableModel.position, 'z', -10, 10, 0.1).name("table Z");
        viewPortUI.add(tableModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("table rotation");
      }
    }
  );

  // import plant
  gltfLoader.load(

    './models/plant_pot/pedilanthus_plant.glb',
    (plant) => {

      let plantModel = new THREE.Group();

      while (plant.scene.children.length > 0) {

        let plantComponent = plant.scene.children[0];

        if (plantComponent.isMesh) plantComponent.castShadow = true;
        if (plantComponent.isMesh) plantComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: (() => {
            if (plant.scene.children.length > 8) {
              if (Math.random() < 0.8) return 'rgb(27, 56, 31)';
              else return 'rgb(20, 61, 36)'
            }
            else return '#ffffff';
          })(),
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        plantComponent.material = newMaterial;
        plantModel.add(plantComponent);

      }

      plantModel.scale.set(1, 1, 1);
      plantModel.position.set(-5, viewPlatform.scale.y / 2, -3);
      viewPort.add(plantModel);
    }
  )

  // import opened umbrella
  gltfLoader.load(

    './models/umbrella/opened.glb',
    (umbrella) => {

      let umbrellaModel = new THREE.Group();

      while (umbrella.scene.children.length > 0) {

        let umbrellaComponent = umbrella.scene.children[0];

        if (umbrellaComponent.isMesh) umbrellaComponent.castShadow = true;
        if (umbrellaComponent.isMesh) umbrellaComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: '#ffffff',
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        umbrellaComponent.material = newMaterial;
        umbrellaModel.add(umbrellaComponent);
      }

      umbrellaModel.scale.set(0.03, 0.03, 0.03);
      umbrellaModel.position.set(-1.1, viewPlatform.scale.y / 2, 3.4);
      umbrellaModel.rotateY(90);
      viewPort.add(umbrellaModel);

      if (debugging) {
        viewPortUI.add(umbrellaModel.position, 'x', -10, 10, 0.1).name("umbrella X");
        viewPortUI.add(umbrellaModel.position, 'z', -5, 5, 0.1).name("umbrella Z");
      }
    }
  )

  // import pool chair
  gltfLoader.load(

    './models/armchair/poolChair.glb',
    (chair) => {

      let chairModel = new THREE.Group();

      while (chair.scene.children.length > 0) {

        let chairComponent = chair.scene.children[0];

        if (chairComponent.isMesh) chairComponent.castShadow = true;
        if (chairComponent.isMesh) chairComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: '#ffffff',
          gradientMap: fiveTone
        });
        chairComponent.material = newMaterial;
        csm.setupMaterial(newMaterial);
        chairModel.add(chairComponent);

      }

      chairModel.scale.set(2, 2, 2);
      let chairModel2 = chairModel.clone();
      chairModel.position.set(19, platform.scale.y / 2, 1.6);
      chairModel2.position.set(19, platform.scale.y / 2, -3.1);

      swimmingPool.add(chairModel);
      swimmingPool.add(chairModel2);

      if (debugging) {
        poolUI.add(chairModel.position, 'x', -20, 20, 0.1).name("chair X");
        poolUI.add(chairModel.position, 'z', -10, 10, 0.1).name("chair Z");
        poolUI.add(chairModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("chair rotation");
      }
    }
  )

  // import closed umbrella
  gltfLoader.load(

    './models/umbrella/closed.glb',
    (umbrella) => {

      let umbrellaModel = new THREE.Group();

      while (umbrella.scene.children.length > 0) {

        let umbrellaComponent = umbrella.scene.children[0];

        if (umbrellaComponent.isMesh) umbrellaComponent.castShadow = true;
        if (umbrellaComponent.isMesh) umbrellaComponent.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: '#ffffff',
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        umbrellaComponent.material = newMaterial;
        umbrellaModel.add(umbrellaComponent);

      }

      umbrellaModel.scale.set(3, 3, 3);
      umbrellaModel.position.set(20.5, platform.scale.y / 2, -0.8);
      umbrellaModel.rotateY(90);
      swimmingPool.add(umbrellaModel);

      if (debugging) {
        poolUI.add(umbrellaModel.position, 'x', -50, 50, 0.1).name("umbrella X");
        poolUI.add(umbrellaModel.position, 'z', -10, 10, 0.1).name("umbrella Z");
      }
    }
  )

  // import character
  diving = gettingUp = false;
  gltfLoader.load(

    './models/character/boxMan.glb',
    (character) => {

      character.scene.traverse((node) => {

        if (node.isMesh) node.castShadow = true;
        if (node.isMesh) node.receiveShadow = true;

        let newMaterial = new THREE.MeshToonMaterial({
          color: '#ffffff',
          gradientMap: fiveTone
        });
        csm.setupMaterial(newMaterial);
        node.material = newMaterial;
      })

      let mixer = new THREE.AnimationMixer(character.scene);
      mixers.push(mixer);
      const idleAction = mixer.clipAction(character.animations[4]);

      const diveAction = mixer.clipAction(character.animations[2]);
      diveAction.loop = THREE.LoopOnce;

      const climbAction = mixer.clipAction(character.animations[1]);
      climbAction.loop = THREE.LoopOnce;

      const standAction = mixer.clipAction(character.animations[5]);
      standAction.loop = THREE.LoopOnce;
      //standAction.clampWhenFinished = true;

      const turnAction = mixer.clipAction(character.animations[6]);
      turnAction.loop = THREE.LoopOnce;
      //turnAction.clampWhenFinished = true;

      // idleAction.play();
      mixer._actions[0].play();
      inIdle = true;
      gettingUp = false;

      mixer.addEventListener('finished', (m) => {

        switch (m.action._clip.name) {

          case 'idle2':
            break;

          case 'dive':
            console.log("dived");
            diveAction.setEffectiveWeight(0);
            climbAction.setEffectiveWeight(1);
            diving = true;
            character.scene.position.set(
              - BOUNDSX / 2 - waterPool.position.x + 2.5,
              platform.scale.y / 2 - 3,
              waterPool.position.z);
              character.scene.rotateY(3);
            break;

          case 'climb':
            console.log('climbed');
            climbAction.setEffectiveWeight(0);
            standAction.setEffectiveWeight(1);
            character.scene.position.set(
              - BOUNDSX / 2 - waterPool.position.x + 1,
              platform.scale.y / 2,
              waterPool.position.z);
            standAction.reset();
            standAction.play();
            break;

          case 'standUp':
            console.log('stood');
            standAction.setEffectiveWeight(0);
            turnAction.setEffectiveWeight(1);
            gsap.to(character.scene.position, {
              x: - BOUNDSX / 2 - waterPool.position.x,
              duration: 1,
            });         
            turnAction.crossFadeFrom(standAction, 0.5, true);
            turnAction.reset();
            turnAction.play();
            break;

          case 'turn':
            console.log('turned');
            turnAction.setEffectiveWeight(0);
            idleAction.setEffectiveWeight(1);
            character.scene.rotateY(-3);
            idleAction.reset();
            // idleAction.crossFadeFrom(turnAction, 0.5, true);
            idleAction.play();
            inIdle = true;
            gettingUp = false;
        }
      })

      // console.log(mixer._actions);
      
      character.scene.scale.set(2, 2, 2);
      character.scene.position.set(
        - BOUNDSX / 2 - waterPool.position.x,
        platform.scale.y / 2,
        waterPool.position.z);
        character.scene.rotateY(1.5);

      swimmingPool.add(character.scene);
      characters.push(character.scene);
    }
  );


  // adjust view port
  viewPort.position.set(
    - platform.scale.x / 2 + viewPlatform.scale.x / 2,
    - platform.scale.y / 2 + viewPlatform.scale.y / 2,
    - platform.scale.z / 2 - viewPlatform.scale.z / 2
  );

  swimmingPool.add(viewPort);



  // swimming pool
  swimmingPool.scale.set(10, 10, 10);
  swimmingPool.position.set(x, y, z);
  swimmingPool.rotateY(r);
  scene.add(swimmingPool);

  if (debugging) {
    sceneUI.add(swimmingPool.position, 'x', -4000, 4000, 1).name('poolX');
    sceneUI.add(swimmingPool.position, 'y', 0, 2000, 1).name('poolY');
    sceneUI.add(swimmingPool.position, 'z', -4000, 4000, 1).name('poolZ');
  }

}
