import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { CSM } from 'three/addons/csm/CSM.js';
import { CSMHelper } from 'three/addons/csm/CSMHelper.js';
import Pool from './swimmingPool.js';
import Hill from './hill.js/';

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
let hills = [];
let swimmingPools = [];
// let texture, mesh;
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
  let newHill = new Hill(csm, scene);
  hills.push(newHill);

  let newPool1 = new Pool(1247, 950, 346, 0, true, newHill, renderer, csm);
  swimmingPools.push(newPool1);
  let newPool2 = new Pool(1252, 1033, -3022, 2, true, newHill, renderer, csm);
  swimmingPools.push(newPool2);
  let newPool3 = new Pool(235, 499, -580, 1.6, true, newHill, renderer, csm);
  swimmingPools.push(newPool3);
  let newPool4 = new Pool(-1699, 295, -2106, 3.2, true, newHill, renderer, csm);
  swimmingPools.push(newPool4);
  let newPool5 = new Pool(- 1903, 1211, -71, - 1.5, true, newHill, renderer, csm);
  swimmingPools.push(newPool5);
  let newPool6 = new Pool(1965, 677, 3593, 0.4, true, newHill, renderer, csm);
  swimmingPools.push(newPool6);

  // resize
  const onResize = () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

  };

  window.addEventListener("resize", onResize);


  // stats monitor
  stats = new Stats();
  document.body.appendChild(stats.dom);
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

  renderer.render(scene, camera);

  stats.update();

};

function render() {

  let time = clock.getDelta();
  for (const p of swimmingPools) {
    // mixer update
    if (p.mixer != null) p.mixer.update(time);

    if (p.character) {
      let dist = camera.position.distanceTo(p.character.getWorldPosition(new THREE.Vector3()));
      if (dist < 400 && p.inIdle) {
        console.log('close');
        p.mixer._actions[0].setEffectiveWeight(0);
        p.mixer._actions[1].setEffectiveWeight(1);
        p.mixer._actions[1].reset();
        p.mixer._actions[1].play();
        p.inIdle = false;
      } else if (p.inIdle == false && dist > 400 && !p.gettingUp) {
        console.log('far');
        p.mixer._actions[2].reset();
        p.mixer._actions[2].play();
        p.gettingUp = true;
      }
    }


    // water update
    // Set uniforms: mouse interaction

    if (p.water != null) {
      let uniforms = p.water.heightmapVariable.material.uniforms;


      let x, z;
      if (p.diving == true) {
        x = -4;
        z = 0;
        p.diving = false
      } else {
        x = 10000;
        z = 10000;
      }

      uniforms['pos'].value.set(x, z);


      // Do the gpu computation
      p.water.gpuCompute.compute();

      // Get compute output in custom uniform
      p.water.waterUniforms['heightmap'].value = p.water.gpuCompute.getCurrentRenderTarget(p.water.heightmapVariable).texture;
    }
  }
}
