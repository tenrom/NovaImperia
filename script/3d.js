
const loader = new THREE.TextureLoader()
const heightMap = loader.load("DLA/Example/step4Blur.png")
const textureMap = loader.load("DLA/Example/step4Blur.png")

const gui= new GUI()

const canvas3D=document.getElementById('div3d-canvas')

const renderer = new THREE.WebGLRenderer({antialias: true , canvas:canvas3D, alpha:true,preserveDrawingBuffer: true})
renderer.setSize(600,600)
renderer.outputColorSpace = THREE.SRGBColorSpace

const fov= 75
const aspect= 600/600
const near=0.1
const far=30
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
camera.position.y=9
camera.position.z=6
// camera.lookAt(0,0,0)

gui.add(camera.position, 'x', -20, 20, 1).name('Camera X')
gui.add(camera.position, 'y', -20, 20, 1).name('Camera Y')
gui.add(camera.position, 'z', -20, 20, 1).name('Camera Z')

const scene = new THREE.Scene()

const controls = new OrbitControls(camera,renderer.domElement)
controls.enableDamping=true
controls.dampingFactor=0.5

//Helper

const axesHelper = new THREE.AxesHelper( 10 )
scene.add(axesHelper)
axesHelper.visible=false

//Geometry

const geo = new THREE.PlaneGeometry(10,10,120,120)

//Material

const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.9,
    map: textureMap,
    transparent:true,
    side:THREE.DoubleSide,
    displacementMap:heightMap,
    displacementScale:4,
    shading: THREE.SmoothShading,
    needsUpdate:true,
    normalScale:new THREE.Vector2(1,-1)
})


const matWireframe = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    wireframe:true,
    displacementMap:heightMap,
    displacementScale:4,
    shading: THREE.SmoothShading,
    needsUpdate:true
})

//Mesh

const plane = new THREE.Mesh(geo,mat)
scene.add(plane)
const planeWireframe = new THREE.Mesh(geo,matWireframe)
plane.add(planeWireframe)

geo.computeVertexNormals()

planeWireframe.visible=false
planeWireframe.scale.set(1.001,1.001,1.001)
plane.rotation.x=THREE.MathUtils.degToRad(-90)

let rotationSettings={x:-90,y:0,z:0}
gui.add(rotationSettings, 'x', -360, 360, 1).name('Plane Rotation X').onChange((value)=>{
    plane.rotation.x=THREE.MathUtils.degToRad(value);
})

let settings={showWireframe:false, showAxes:false, debugLights:false, showLights:true}
gui.add(settings,'showWireframe').name('Show Wireframe').onChange((value)=>{
    planeWireframe.visible=value
})
gui.add(settings,'showAxes').name('Show Axes').onChange((value)=>{
    axesHelper.visible=value
})


//Light

const ambientLightDebug = new THREE.AmbientLight("#ffffff" , 1)
scene.add(ambientLightDebug)
ambientLightDebug.visible=false

const ambientLight = new THREE.AmbientLight("#ddeeff" , 1)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight("#fff8e7",2.5);//"#ffef97"
directionalLight.position.set(7, 3, 4);
scene.add(directionalLight)

gui.add(directionalLight.position, 'x', -20, 20, 1).name('Light X')
gui.add(directionalLight.position, 'y', -20, 20, 1).name('Light Y')
gui.add(directionalLight.position, 'z', -20, 20, 1).name('Light Z')


const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight,10)
scene.add(directionalLightHelper)
directionalLightHelper.visible=false

gui.add(settings,'debugLights').name('Debug Lights').onChange((value)=>{
    directionalLightHelper.visible=value && settings.showLights
})

gui.add(settings,'showLights').name('Show Lights').onChange((value)=>{
    ambientLightDebug.visible=!value
    ambientLight.visible=value
    directionalLight.visible=value
    directionalLightHelper.visible=value && settings.debugLights
})

function animate(time){

    controls.update()
    directionalLight.target=plane
    directionalLightHelper.update()
    renderer.render(scene,camera)
    requestAnimationFrame(animate)
}

animate()


/**
 * Génère une carte de normales parfaite à partir d'un tableau 2D de hauteurs (0 à 1).
 * @param {number[][]} tab - Votre tableau 2D indexé par [x][y].
 * @param {number} intensity - Force du relief (recommandé : 1.0 à 3.0).
 * @returns {ImageData} Les données d'image prêtes pour Three.js.
 */
function createNormalMapFromTable(tab, intensity = 1.0) {
    // Détection automatique de la résolution à partir du tableau
    const width = tab.length;
    const height = tab[0].length;
    
    // Préparation du conteneur de pixels final pour Three.js
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const normalMapData = ctx.createImageData(width, height);
    const dst = normalMapData.data;

    const inverseWidth = 1.0 / width;
    const inverseHeight = 1.0 / height;

    // Fonction de lecture sécurisée qui gère les bords du tableau (clamp)
    function getHeight(x, y) {
        x = Math.max(0, Math.min(width - 1, x));
        y = Math.max(0, Math.min(height - 1, y));
        return tab[x][y]; // Utilisation directe de la valeur décimale précise (0.0 à 1.0)
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Algorithme de Sobel sur vos données haute précision
            const tl = getHeight(x - 1, y - 1);
            const  t = getHeight(x    , y - 1);
            const tr = getHeight(x + 1, y - 1);
            const  l = getHeight(x - 1, y    );
            const  r = getHeight(x + 1, y    );
            const bl = getHeight(x - 1, y + 1);
            const  b = getHeight(x    , y + 1);
            const br = getHeight(x + 1, y + 1);

            // Gradients de pentes
            const dX = (tr + (2 * r) + br) - (tl + (2 * l) + bl);
            const dY = (bl + (2 * b) + br) - (tl + (2 * t) + tr);

            // Échelle physique correcte basée sur la taille d'un pixel
            const nx = (-dX * intensity) / (inverseWidth * 8.0);
            const ny = (dY * intensity) / (inverseHeight * 8.0); 
            const nz = 1.0; 

            // Normalisation du vecteur dans l'espace 3D
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            
            // Calcul de l'index dans le tableau 1D d'ImageData (Format attendu par le Canvas)
            const index = (y * width + x) * 4;
            dst[index]     = ((nx / len) * 0.5 + 0.5) * 255; // Rouge (Axe X)
            dst[index + 1] = ((ny / len) * 0.5 + 0.5) * 255; // Vert (Axe Y)
            dst[index + 2] = ((nz / len) * 0.5 + 0.5) * 255; // Bleu (Axe Z)
            dst[index + 3] = 255;                            // Alpha (Opaque)
        }
    }

    return normalMapData;
}


function create3DTexture(imageDataHeight,imageData, tab, after){
    const textureHeight = new THREE.DataTexture(imageDataHeight, imageDataHeight.width, imageDataHeight.height, THREE.RGBAFormat)
    textureHeight.needsUpdate = true

    textureHeight.rotation = Math.PI
    textureHeight.center.set(0.5, 0.5)
    textureHeight.repeat.x = -1
    textureHeight.magFilter = THREE.LinearFilter
    textureHeight.minFilter = THREE.LinearFilter

    const texture = new THREE.DataTexture(imageData, imageData.width, imageData.height, THREE.RGBAFormat)
    texture.needsUpdate = true

    texture.rotation = Math.PI
    texture.center.set(0.5, 0.5)
    texture.repeat.x = -1
    // texture.magFilter = THREE.LinearFilter
    // texture.minFilter = THREE.LinearFilter
    texture.colorSpace = THREE.SRGBColorSpace;

    const imageDataNormal=createNormalMapFromTable(tab,1)
    const textureNormal = new THREE.DataTexture(imageDataNormal, imageDataNormal.width, imageDataNormal.height, THREE.RGBAFormat)
    textureNormal.needsUpdate = true

    textureNormal.rotation = Math.PI
    textureNormal.center.set(0.5, 0.5)
    textureNormal.repeat.x = -1
    textureNormal.magFilter = THREE.LinearFilter
    textureNormal.minFilter = THREE.LinearFilter

    mat.map = texture
    mat.normalMap = textureNormal
    mat.displacementMap = textureHeight
    matWireframe.displacementMap = textureHeight

    renderer.render(scene, camera);

    after(renderer.domElement.toDataURL('image/png'))
}