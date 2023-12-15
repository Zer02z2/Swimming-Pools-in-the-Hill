import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { gsap } from "gsap";

export default class SwimmingPool {

    constructor(x, y, z, r, w, scene, renderer, csm) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.r = r;

        this.swimmingPool = new THREE.Group();
        this.waterPool = new THREE.Group();
        this.viewPort = new THREE.Group();

        // model loader
        this.gltfLoader = new GLTFLoader();
        this.threeTone = new THREE.TextureLoader().load("./gradientMap/threeTone.jpg");
        this.fourTone = new THREE.TextureLoader().load("./gradientMap/fourTone.jpg");
        this.fiveTone = new THREE.TextureLoader().load("./gradientMap/fiveTone.jpg");

        this.threeTone.minFilter = this.threeTone.magFilter =
            this.fourTone.minFilter = this.fourTone.magFilter =
            this.fiveTone.minFilter = this.fiveTone.magFilter = THREE.NearestFilter;

        this.csm = csm;

        // box
        this.baseGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.baseMaterial = new THREE.MeshStandardMaterial({
            color: 'rgb(220, 220, 220)',
        });
        this.csm.setupMaterial(this.baseMaterial);

        // platform - subtracting one geometry from another to create the pool
        let platform_P = new THREE.Mesh(this.baseGeometry);
        let platform_N = new THREE.Mesh(this.baseGeometry);
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

        this.platform = CSG.toMesh(platformCSG, platform_P.matrix, this.baseMaterial);
        this.platform.castShadow = true;
        this.platform.receiveShadow = true;

        this.swimmingPool.add(this.platform);

        // the pool itself
        const valuesChanger = (water) => {

            water.heightmapVariable.material.uniforms['size'].value = 1;
            water.heightmapVariable.material.uniforms['viscosityConstant'].value = 0.98;
        };

        if (w == true) {
            this.water = new Water(this.waterPool, renderer);
            valuesChanger(this.water);
        } else {

            let waterMaterial = new THREE.MeshStandardMaterial({
                color: 'rgb(1, 34, 117)',
                metalness: 0.8
            });
            let water = new THREE.Mesh(baseGeometry, waterMaterial);
            water.scale.set(16, 1, 8);
            water.position.set(0, 0.1, 0);
            this.waterPool.add(water);

        }


        // padding
        const makeSide = (length, width, x, z) => {

            let side = new THREE.Mesh(this.baseGeometry, this.baseMaterial);

            side.scale.set(length, 1, width);
            side.position.set(x, 0.2, z);

            side.castShadow = true;
            side.receiveShadow = true;

            this.waterPool.add(side);

        }

        makeSide(this.water.BOUNDSX + 2, 1, 0, this.water.BOUNDSY / 2 + 0.5);
        makeSide(this.water.BOUNDSX + 2, 1, 0, - this.water.BOUNDSY / 2 - 0.5);
        makeSide(1, this.water.BOUNDSY + 2, this.water.BOUNDSX / 2 + 0.5, 0);
        makeSide(1, this.water.BOUNDSY + 2, - this.water.BOUNDSX / 2 - 0.5, 0);

        this.waterPool.position.set(
            1,
            this.platform.scale.y / 2 - 0.5,
            - this.platform.scale.z / 2 + this.water.BOUNDSY / 2 + 2
        );
        this.swimmingPool.add(this.waterPool);

        // view port, build vew platform
        this.viewPlatform = new THREE.Mesh(this.baseGeometry, this.baseMaterial);
        this.viewPlatform.scale.set(
            this.platform.scale.x / 3,
            this.platform.scale.y - 1,
            this.platform.scale.z / 1.5
        );

        this.viewPlatform.castShadow = true;
        this.viewPlatform.receiveShadow = true;
        this.viewPort.add(this.viewPlatform);

        // adjust view port
        this.viewPort.position.set(
            - this.platform.scale.x / 2 + this.viewPlatform.scale.x / 2,
            - this.platform.scale.y / 2 + this.viewPlatform.scale.y / 2,
            - this.platform.scale.z / 2 - this.viewPlatform.scale.z / 2
        );

        this.swimmingPool.add(this.viewPort);



        // swimming pool
        this.swimmingPool.scale.set(10, 10, 10);
        this.swimmingPool.position.set(this.x, this.y, this.z);
        this.swimmingPool.rotateY(this.r);
        scene.add(this.swimmingPool);

        // if (debugging) {
        //   sceneUI.add(swimmingPool.position, 'x', -4000, 4000, 1).name('poolX');
        //   sceneUI.add(swimmingPool.position, 'y', 0, 2000, 1).name('poolY');
        //   sceneUI.add(swimmingPool.position, 'z', -4000, 4000, 1).name('poolZ');
        // }

        this.addModels();
        this.addCharacter();
    }

    addModels() {
        // import armchair
        this.gltfLoader.load(

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
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    chairComponent.material = newMaterial;
                    chairModel.add(chairComponent);
                }

                chairModel.scale.set(2, 2, 2);
                chairModel.rotation.y = Math.PI / 3;
                chairModel.position.set(-4, this.viewPlatform.scale.y / 2, 2);
                this.viewPort.add(chairModel);

                // if (debugging) {
                //   viewPortUI.add(chairModel.position, 'x', -10, 10, 0.1).name("chair X");
                //   viewPortUI.add(chairModel.position, 'z', -10, 10, 0.1).name("chair Z");
                //   viewPortUI.add(chairModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("chair rotation");
                // }
            }
        );

        // import couch
        this.gltfLoader.load(

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
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    couchComponent.material = newMaterial;
                    couchModel.add(couchComponent);
                }

                couchModel.scale.set(0.04, 0.04, 0.04);
                couchModel.rotation.y = Math.PI * 1.05;
                couchModel.position.set(3, this.viewPlatform.scale.y / 2, 2.5);
                this.viewPort.add(couchModel);

                // if (debugging) {
                //   viewPortUI.add(couchModel.position, 'x', -10, 10, 0.1).name("couch X");
                //   viewPortUI.add(couchModel.position, 'z', -10, 10, 0.1).name("couch Z");
                //   viewPortUI.add(couchModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("couch rotation");
                // }
            }
        );

        // import table
        this.gltfLoader.load(

            './models/table/table.glb',
            (table) => {

                let tableModel = new THREE.Group();
                while (table.scene.children.length > 0) {

                    let tableComponent = table.scene.children[0];

                    if (tableComponent.isMesh) tableComponent.castShadow = true;
                    if (tableComponent.isMesh) tableComponent.receiveShadow = true;

                    let newMaterial = new THREE.MeshToonMaterial({
                        color: '#ffffff',
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    tableComponent.material = newMaterial
                    tableModel.add(tableComponent);

                }

                tableModel.scale.set(4, 4, 4);
                tableModel.rotation.y = Math.PI * 1.05;
                tableModel.position.set(3.1, this.viewPlatform.scale.y / 2, - 2.8);
                this.viewPort.add(tableModel);

                // if (debugging) {
                //   viewPortUI.add(tableModel.position, 'x', -10, 10, 0.1).name("table X");
                //   viewPortUI.add(tableModel.position, 'z', -10, 10, 0.1).name("table Z");
                //   viewPortUI.add(tableModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("table rotation");
                // }
            }
        );

        // import plant
        this.gltfLoader.load(

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
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    plantComponent.material = newMaterial;
                    plantModel.add(plantComponent);

                }

                plantModel.scale.set(1, 1, 1);
                plantModel.position.set(-5, this.viewPlatform.scale.y / 2, -3);
                this.viewPort.add(plantModel);
            }
        )

        // import opened umbrella
        this.gltfLoader.load(

            './models/umbrella/opened.glb',
            (umbrella) => {

                let umbrellaModel = new THREE.Group();

                while (umbrella.scene.children.length > 0) {

                    let umbrellaComponent = umbrella.scene.children[0];

                    if (umbrellaComponent.isMesh) umbrellaComponent.castShadow = true;
                    if (umbrellaComponent.isMesh) umbrellaComponent.receiveShadow = true;

                    let newMaterial = new THREE.MeshToonMaterial({
                        color: '#ffffff',
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    umbrellaComponent.material = newMaterial;
                    umbrellaModel.add(umbrellaComponent);
                }

                umbrellaModel.scale.set(0.03, 0.03, 0.03);
                umbrellaModel.position.set(-1.1, this.viewPlatform.scale.y / 2, 3.4);
                umbrellaModel.rotateY(90);
                this.viewPort.add(umbrellaModel);

                // if (debugging) {
                //   viewPortUI.add(umbrellaModel.position, 'x', -10, 10, 0.1).name("umbrella X");
                //   viewPortUI.add(umbrellaModel.position, 'z', -5, 5, 0.1).name("umbrella Z");
                // }
            }
        )

        // import pool chair
        this.gltfLoader.load(

            './models/armchair/poolChair.glb',
            (chair) => {

                let chairModel = new THREE.Group();

                while (chair.scene.children.length > 0) {

                    let chairComponent = chair.scene.children[0];

                    if (chairComponent.isMesh) chairComponent.castShadow = true;
                    if (chairComponent.isMesh) chairComponent.receiveShadow = true;

                    let newMaterial = new THREE.MeshToonMaterial({
                        color: '#ffffff',
                        gradientMap: this.fiveTone
                    });
                    chairComponent.material = newMaterial;
                    this.csm.setupMaterial(newMaterial);
                    chairModel.add(chairComponent);

                }

                chairModel.scale.set(2, 2, 2);
                let chairModel2 = chairModel.clone();
                chairModel.position.set(19, this.platform.scale.y / 2, 1.6);
                chairModel2.position.set(19, this.platform.scale.y / 2, -3.1);

                this.swimmingPool.add(chairModel);
                this.swimmingPool.add(chairModel2);

                // if (debugging) {
                //   poolUI.add(chairModel.position, 'x', -20, 20, 0.1).name("chair X");
                //   poolUI.add(chairModel.position, 'z', -10, 10, 0.1).name("chair Z");
                //   poolUI.add(chairModel.rotation, 'y', 0, 2 * Math.PI, 0.1).name("chair rotation");
                // }
            }
        )

        // import closed umbrella
        this.gltfLoader.load(

            './models/umbrella/closed.glb',
            (umbrella) => {

                let umbrellaModel = new THREE.Group();

                while (umbrella.scene.children.length > 0) {

                    let umbrellaComponent = umbrella.scene.children[0];

                    if (umbrellaComponent.isMesh) umbrellaComponent.castShadow = true;
                    if (umbrellaComponent.isMesh) umbrellaComponent.receiveShadow = true;

                    let newMaterial = new THREE.MeshToonMaterial({
                        color: '#ffffff',
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    umbrellaComponent.material = newMaterial;
                    umbrellaModel.add(umbrellaComponent);

                }

                umbrellaModel.scale.set(3, 3, 3);
                umbrellaModel.position.set(20.5, this.platform.scale.y / 2, -0.8);
                umbrellaModel.rotateY(90);
                this.swimmingPool.add(umbrellaModel);

                // if (debugging) {
                //   poolUI.add(umbrellaModel.position, 'x', -50, 50, 0.1).name("umbrella X");
                //   poolUI.add(umbrellaModel.position, 'z', -10, 10, 0.1).name("umbrella Z");
                // }
            }
        )
    }

    addCharacter() {
        // import character
        this.inIdle = true;
        this.diving = false;
        this.gettingUp = false;

        this.gltfLoader.load(

            './models/character/boxMan.glb',
            (character) => {

                this.character = character.scene;

                character.scene.traverse((node) => {

                    if (node.isMesh) node.castShadow = true;
                    if (node.isMesh) node.receiveShadow = true;

                    let newMaterial = new THREE.MeshToonMaterial({
                        color: '#ffffff',
                        gradientMap: this.fiveTone
                    });
                    this.csm.setupMaterial(newMaterial);
                    node.material = newMaterial;
                })

                this.mixer = new THREE.AnimationMixer(character.scene);
                this.idleAction = this.mixer.clipAction(character.animations[4]);

                this.diveAction = this.mixer.clipAction(character.animations[2]);
                this.diveAction.loop = THREE.LoopOnce;

                this.climbAction = this.mixer.clipAction(character.animations[1]);
                this.climbAction.loop = THREE.LoopOnce;

                this.standAction = this.mixer.clipAction(character.animations[5]);
                this.standAction.loop = THREE.LoopOnce;
                //standAction.clampWhenFinished = true;

                this.turnAction = this.mixer.clipAction(character.animations[6]);
                this.turnAction.loop = THREE.LoopOnce;
                //turnAction.clampWhenFinished = true;

                // idleAction.play();
                this.mixer._actions[0].play();

                this.mixer.addEventListener('finished', (m) => {

                    switch (m.action._clip.name) {

                        case 'idle2':
                            break;

                        case 'dive':
                            console.log("dived");
                            this.diveAction.setEffectiveWeight(0);
                            this.climbAction.setEffectiveWeight(1);
                            this.diving = true;
                            this.character.position.set(
                                - this.water.BOUNDSX / 2 - this.waterPool.position.x + 2.5,
                                this.platform.scale.y / 2 - 3,
                                this.waterPool.position.z);
                            this.character.rotateY(3);
                            break;

                        case 'climb':
                            console.log('climbed');
                            this.climbAction.setEffectiveWeight(0);
                            this.standAction.setEffectiveWeight(1);
                            this.character.position.set(
                                - this.water.BOUNDSX / 2 - this.waterPool.position.x + 1,
                                this.platform.scale.y / 2,
                                this.waterPool.position.z);
                            this.standAction.reset();
                            this.standAction.play();
                            break;

                        case 'standUp':
                            console.log('stood');
                            this.standAction.setEffectiveWeight(0);
                            this.turnAction.setEffectiveWeight(1);
                            gsap.to(this.character.position, {
                                x: - this.water.BOUNDSX / 2 - this.waterPool.position.x,
                                duration: 1,
                            });
                            this.turnAction.crossFadeFrom(this.standAction, 0.5, true);
                            this.turnAction.reset();
                            this.turnAction.play();
                            break;

                        case 'turn':
                            console.log('turned');
                            this.turnAction.setEffectiveWeight(0);
                            this.idleAction.setEffectiveWeight(1);
                            this.character.rotateY(-3);
                            this.idleAction.reset();
                            // idleAction.crossFadeFrom(turnAction, 0.5, true);
                            this.idleAction.play();
                            this.inIdle = true;
                            this.gettingUp = false;
                    }
                });

                // console.log(mixer._actions);

                this.character.scale.set(2, 2, 2);
                this.character.position.set(
                    - this.water.BOUNDSX / 2 - this.waterPool.position.x,
                    this.platform.scale.y / 2,
                    this.waterPool.position.z);

                this.character.rotateY(1.5);

                this.swimmingPool.add(this.character);
            });
    }


}




class Water {

    constructor(waterPool, renderer) {
        // water
        // Texture width for simulation
        this.WIDTHX = 128;
        this.WIDTHY = 64;

        // Water size in system units
        this.BOUNDSX = 16;
        this.BOUNDSY = 8;

        this.waterMesh;
        this.gpuCompute;
        this.heightmapVariable;
        this.waterUniforms;
        this.readWaterLevelShader;
        this.readWaterLevelRenderTarget;
        this.readWaterLevelImage;
        this.waterNormal = new THREE.Vector3();

        // const simplex = new SimplexNoise();

        this.waterX = 0;
        this.waterZ = 0;

        const materialColor = '#031745';

        const geometry = new THREE.PlaneGeometry(this.BOUNDSX, this.BOUNDSY, this.WIDTHX - 1, this.WIDTHY - 1);

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
        material.defines.WIDTHX = this.WIDTHX.toFixed(1);
        material.defines.WIDTHY = this.WIDTHY.toFixed(1);
        material.defines.BOUNDSX = this.BOUNDSX.toFixed(1);
        material.defines.BOUNDSY = this.BOUNDSY.toFixed(1);

        this.waterUniforms = material.uniforms;

        this.waterMesh = new THREE.Mesh(geometry, material);
        this.waterMesh.rotation.x = - Math.PI / 2;
        this.waterMesh.matrixAutoUpdate = false;
        this.waterMesh.position.set(0, 0.5, 0);
        this.waterMesh.updateMatrix();

        waterPool.add(this.waterMesh);

        // Creates the gpu computation class and sets it up


        this.gpuCompute = new GPUComputationRenderer(this.WIDTHX, this.WIDTHY, renderer);

        if (renderer.capabilities.isWebGL2 === false) {

            this.gpuCompute.setDataType(THREE.HalfFloatType);

        }

        const heightmap0 = this.gpuCompute.createTexture();

        this.heightmapVariable = this.gpuCompute.addVariable('heightmap', document.getElementById('heightmapFragmentShader').textContent, heightmap0);

        this.gpuCompute.setVariableDependencies(this.heightmapVariable, [this.heightmapVariable]);

        this.heightmapVariable.material.uniforms['pos'] = { value: new THREE.Vector2(0, 0) };
        this.heightmapVariable.material.uniforms['size'] = { value: 1.0 };
        this.heightmapVariable.material.uniforms['viscosityConstant'] = { value: 0.98 };
        this.heightmapVariable.material.uniforms['heightCompensation'] = { value: 0 };
        this.heightmapVariable.material.defines.BOUNDSX = this.BOUNDSX.toFixed(1);
        this.heightmapVariable.material.defines.BOUNDSY = this.BOUNDSY.toFixed(1);

        const error = this.gpuCompute.init();
        if (error !== null) {

            console.error(error);

        }

        // Create compute shader to read water level
        this.readWaterLevelShader = this.gpuCompute.createShaderMaterial(document.getElementById('readWaterLevelFragmentShader').textContent, {
            point1: { value: new THREE.Vector2() },
            levelTexture: { value: null }
        });
        this.readWaterLevelShader.defines.WIDTHX = this.WIDTHX.toFixed(1);
        this.readWaterLevelShader.defines.WIDTHY = this.WIDTHY.toFixed(1);
        this.readWaterLevelShader.defines.BOUNDSX = this.BOUNDSX.toFixed(1);
        this.readWaterLevelShader.defines.BOUNDSY = this.BOUNDSY.toFixed(1);

        // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
        this.readWaterLevelImage = new Uint8Array(4 * 1 * 4);

        this.readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(4, 1, {
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: false
        });
    }
}
