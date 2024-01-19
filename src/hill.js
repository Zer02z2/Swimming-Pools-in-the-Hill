import * as THREE from "three";
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export default class Hill {

  constructor(width, height, csm, scene) {

    this.width = width;
    this.height = height;
    this.group = new THREE.Group();
    this.worldWidth = 256;
    this.worldDepth = 256;

    this.threeTone = new THREE.TextureLoader().load("./gradientMap/threeTone.jpg")
    this.fourTone = new THREE.TextureLoader().load("./gradientMap/fourTone.jpg")
    this.fiveTone = new THREE.TextureLoader().load("./gradientMap/fiveTone.jpg")

    this.threeTone.minFilter = this.threeTone.magFilter =
      this.fourTone.minFilter = this.fourTone.magFilter =
      this.fiveTone.minFilter = this.fiveTone.magFilter = THREE.NearestFilter;

    // generate mountains
    this.data = generateHeight(this.worldWidth, this.worldDepth);

    this.geometry = new THREE.PlaneGeometry(this.width, this.height, this.worldWidth - 1, this.worldDepth - 1);
    this.geometry.rotateX(- Math.PI / 2);

    const vertices = this.geometry.attributes.position.array;

    for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {

      // height of the geometry, j + 1 is the y axis
      vertices[j + 1] = this.data[i] * 10;

    }

    //geometry = BufferGeometryUtils.mergeVertices(geometry, 0.1);
    this.geometry.computeVertexNormals(true);

    //texture = new THREE.CanvasTexture(generateTexture(data, worldWidth, worldDepth));


    this.texture = new THREE.MeshToonMaterial({

      color: 'rgb(222, 131, 62)',
      wireframe: false,
      side: THREE.DoubleSide,
      gradientMap: this.fiveTone,

    });
    this.texture.warpS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    csm.setupMaterial(this.texture);

    //mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    this.mesh = new THREE.Mesh(this.geometry, this.texture);

    this.mesh.visible = true;
    // this.mesh.receiveShadow = true;

    this.group.add(this.mesh);
    //scene.add(this.group);

    // if (debugging) {
    //     sceneUI.add(mesh, 'visible').name('Mesh Visibility');
    //     sceneUI.add(mesh.material, 'wireframe').name('Wireframe');
    // }
  }

  // add(pool) {
  //   this.group.add(pool);
  // }
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