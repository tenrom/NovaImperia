
Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};


let tileSize=Math.round(800/(102/2*Math.sqrt(3)))
let gridTiles
let selectedTile
let mapSpriteLeft
let mapSprite
let mapSpriteRight
let pixels
let imageDataMap
let pixelsMountain

let pointsOut=[]
let pointsHitBox=[]
let points=[]
let p
for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2
    pointsHitBox.push(Math.round(276 * Math.cos(angle)))
    pointsHitBox.push(Math.round(276 * Math.sin(angle)))
    points.push(Math.round(250 * Math.cos(angle)))
    points.push(Math.round(250 * Math.sin(angle)))
    pointsOut.push(264.5 * Math.cos(angle))
    pointsOut.push(264.5 * Math.sin(angle))
}

let selectedUnit
let moveTiles=[]

const createNoise2D=window.createNoise2D

const app = new PIXI.Application({
    width: document.getElementById('game').clientWidth,
    height: document.getElementById('game').clientHeight,
    backgroundColor: "#1099bb"
});

app.stage.eventMode='static'

window.addEventListener('resize',()=>{
    document.querySelector('#game canvas').width=document.getElementById('game').clientWidth
    document.querySelector('#game canvas').height=document.getElementById('game').clientHeight
})

document.getElementById('game').appendChild(app.view);

let world = new PIXI.Container()
app.stage.addChild(world)
world.eventMode='static'
world.scale.set(Math.max(app.screen.width/(tileSize*Math.sqrt(3)/2*102),2));

app.stage.hitArea = app.screen;

const pointers = new Map();

let lastCenter = null;
let lastDistance = null;
let isDrag=false
let isPress=false
let coordPressStart

app.stage.on('pointerdown', (e) => {
    isPress=true
    coordPressStart=[e.global.x,e.global.y]

    pointers.set(e.pointerId, {
        x: e.global.x,
        y: e.global.y
    })
})

function removePointer(e) {
    pointers.delete(e.pointerId)

    lastCenter = null
    lastDistance = null

    isPress=false
}

app.stage.on('pointerup', removePointer);
app.stage.on('pointerupoutside', removePointer);
app.stage.on('pointercancel', removePointer);

app.stage.on('pointermove', (e) => {

    if (coordPressStart && isPress && distanceEucl([e.global.x,e.global.y],coordPressStart)>20){
        isDrag=true
    }

    if (!pointers.has(e.pointerId)) return

    pointers.set(e.pointerId, {
        x: e.global.x,
        y: e.global.y
    });

    const active = [...pointers.values()]

    if (active.length === 1) {
        const p = active[0]

        if (!lastCenter) {
            lastCenter = { ...p }
            return
        }

        world.x += p.x - lastCenter.x
        world.y += p.y - lastCenter.y

        lastCenter = { ...p }
        return
    }

    if (active.length === 2) {
        const p1 = active[0]
        const p2 = active[1]

        const center = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        }

        const distance = Math.hypot(
            p2.x - p1.x,
            p2.y - p1.y
        )

        if (!lastCenter || !lastDistance) {
            lastCenter = center
            lastDistance = distance
            return
        }

        world.x += center.x - lastCenter.x
        world.y += center.y - lastCenter.y

        const worldBefore = {
            x: (center.x - world.x) / world.scale.x,
            y: (center.y - world.y) / world.scale.y
        }

        let scale = world.scale.x * (distance / lastDistance)
        scale=scale.clamp(Math.max(app.screen.width/(tileSize*Math.sqrt(3)/2*102),2),20)
        world.scale.set(scale)

        const worldAfter = {
            x: (center.x - world.x) / world.scale.x,
            y: (center.y - world.y) / world.scale.y
        }

        world.x += (worldAfter.x - worldBefore.x) * world.scale.x
        world.y += (worldAfter.y - worldBefore.y) * world.scale.y

        lastCenter = center
        lastDistance = distance
    }
});

app.stage.on('wheel', (e) => {
    const mouse = e.global;

    const worldPosBefore = {
        x: (mouse.x - world.x) / world.scale.x,
        y: (mouse.y - world.y) / world.scale.y
    };

    let scale = world.scale.x;
    const zoomSpeed = 0.1;

    scale *= (e.deltaY < 0) ? (1 + zoomSpeed) : (1 - zoomSpeed);
    scale=scale.clamp(Math.max(app.screen.width/(tileSize*Math.sqrt(3)/2*102),2),20)

    world.scale.set(scale);

    const worldPosAfter = {
        x: (mouse.x - world.x) / world.scale.x,
        y: (mouse.y - world.y) / world.scale.y
    };

    world.x += (worldPosAfter.x - worldPosBefore.x) * world.scale.x;
    world.y += ((worldPosAfter.y - worldPosBefore.y) * world.scale.y)

});

let offsetTile=0
// const WORLD_WIDTH = 12000;
app.ticker.add(() => {
    // let o=app.screen.width+tileSize
    // if (world.x < -WORLD_WIDTH+o) world.x += WORLD_WIDTH-o;
    // if (world.x > 0) world.x -= WORLD_WIDTH-o;
    world.y=world.y.clamp(-tileSize*world.scale.x*75+app.screen.height,0)
    world.x=world.x.clamp(-2*tileSize*Math.sqrt(3)/2*102*world.scale.x+app.screen.width,tileSize*Math.sqrt(3)/2*102*world.scale.x)

    let offsetWorld=Math.round(world.x/(tileSize*Math.sqrt(3)/2*world.scale.x))
    let lastOffsetTile=offsetTile
    if (world.scale.x > app.screen.width/(tileSize*Math.sqrt(3)/2*101)){
        offsetTile=-offsetWorld-1
    }else{
        offsetTile=-offsetWorld
    }

    warpTiles(lastOffsetTile,offsetTile)

    if (app.screen.width-world.x<=0 || world.x<=-tileSize*Math.sqrt(3)/2*102*world.scale.x){
        resetWrap()
    }
});

let map = new PIXI.Container()
world.addChild(map)

let grid = new PIXI.Container()
world.addChild(grid)

//Moves Border
let maskLeft = new PIXI.Graphics()
maskLeft.beginFill("0000ff")
maskLeft.drawRect(-tileSize*Math.sqrt(3)/2*102, 0, tileSize*Math.sqrt(3)/2*102, 800)
maskLeft.endFill()
world.addChild(maskLeft)

let maskRight = new PIXI.Graphics()
maskRight.beginFill("ff0000")
maskRight.drawRect(tileSize*Math.sqrt(3)/2*102, 0, 800, 800)
maskRight.endFill()
world.addChild(maskRight)

let mask = new PIXI.Graphics()
mask.beginFill("ffffff")
mask.drawRect(0, 0, tileSize*Math.sqrt(3)/2*102, 800)
mask.endFill()
world.addChild(mask)

polyBorderMoves = new PIXI.Graphics()
polyBorderMoves.mask=mask

polyBorderMovesLeft = new PIXI.Graphics(polyBorderMoves.geometry)
polyBorderMovesLeft.mask=maskLeft

polyBorderMovesRight = new PIXI.Graphics(polyBorderMoves.geometry)
polyBorderMovesRight.mask=maskRight

world.addChild(polyBorderMovesLeft)
world.addChild(polyBorderMoves)
world.addChild(polyBorderMovesRight)

//Selected Border
polyBorderSelected = new PIXI.Graphics()
polyBorderSelected.lineStyle(26, 0xffffff, 1, 0.5);
polyBorderSelected.drawPolygon(points)
polyBorderSelected.alpha=0

world.addChild(polyBorderSelected)

let units = new PIXI.Container()
world.addChild(units)

let icons = new PIXI.Container()
world.addChild(icons)

let sizeCanvas=1000
const canvas = document.getElementById("perlinNoise");
canvas.width=sizeCanvas
canvas.height=sizeCanvas
const ctx = canvas.getContext("2d");

function setPixel(imageData, x, y, color, a = 255) {
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = color[0];     // R
    imageData.data[index + 1] = color[1]; // G
    imageData.data[index + 2] = color[2]; // B
    imageData.data[index + 3] = a; // A
}

function getPixel(imageData, x, y, returnAlpha=false) {
    const index = (y * imageData.width + x) * 4;
    if (returnAlpha) return [imageData.data[index],imageData.data[index + 1],imageData.data[index + 2],imageData.data[index + 3]]
    return [imageData.data[index],imageData.data[index + 1],imageData.data[index + 2]]
}

function DebugTile(imageData){
    const texture = PIXI.Texture.fromBuffer(
        imageData.data,
        imageData.width,
        imageData.height
    )

    mapSpriteLeft.texture=texture
    mapSprite.texture=texture
    mapSpriteRight.texture=texture
}

function distanceEucl(c1,c2){
    return Math.sqrt((c2[0]-c1[0])**2+(c2[1]-c1[1])**2)
}

class PerlinNoise{
    constructor(seed,config){
        this.seed=seed
        const rng=new Math.seedrandom(seed+" 1")
        const rng2=new Math.seedrandom(seed+" 2")
        const rng3=new Math.seedrandom(seed+" 3")
        this.n=createNoise2D(rng)
        this.n2=createNoise2D(rng2)
        this.n3=createNoise2D(rng3)

        //// Parameters
        const defaults={
            // Main
            scale:0.005,
            octaves:4,
            lacunarity:2,
            persistence:0.5,
            ridged:true,
            inversed:false,

            // Warp
            warp:true,
            warpOctaves:3,
            warpLacunarity:2,
            warpPersistence:0.5,
            warpStrength:0.1,

            //Color
            colorised:true,
            //steps:[0.25,0.30,0.35,0.55,0.70,0.85]
            //steps:[0.20,0.25,0.29,0.5,0.6,0.8]
            steps:[0.14,0.19,0.24,0.35,0.5,0.6],
            centralized:true,
            circleDistance:200,
            decentralized:false,
            extendCenter:false,
            distance:200
        }

        const cfg = {...defaults,...config}
        this.scale=cfg.scale
        this.octaves=cfg.octaves
        this.lacunarity=cfg.lacunarity
        this.persistence=cfg.persistence
        this.ridged=cfg.ridged
        this.inversed=cfg.inversed
        this.warp=cfg.warp
        this.warpOctaves=cfg.warpOctaves
        this.warpLacunarity=cfg.warpLacunarity
        this.warpPersistence=cfg.warpPersistence
        this.warpStrength=cfg.warpStrength
        this.colorised=cfg.colorised
        this.steps=cfg.steps
        this.centralized=cfg.centralized
        this.circleDistance=cfg.circleDistance
        this.decentralized=cfg.decentralized
        this.extendCenter=cfg.extendCenter
        this.distance=cfg.distance

        this.cfg=cfg
    }
    createPerlinNoise(x1,x2,y1,y2){
        this.imageData = ctx.createImageData(x2,y2)
        let sizeImage=x2

        let mapPixels=[]
        this.size=[x2-x1,y2-y1]
        for (let x=Math.max(0,x1);x<sizeImage;x++){
            let col=new Float32Array(this.size[1])
            for (let y=Math.max(0,y1);y<sizeImage;y++){
                let coordX=x*this.scale
                let coordY=y*this.scale

                let dx=0
                let dy=0
                let warpAmplitude=1
                let warpFrequency=1
                for (let i=0;i<this.warpOctaves+1;i++){
                    dx+=this.n2(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude
                    dy+=this.n3(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude

                    warpFrequency *= this.warpLacunarity
                    warpAmplitude *= this.warpPersistence
                }

                if (!this.warp){
                    this.warpStrength=0
                }
                dx*=this.warpStrength
                dy*=this.warpStrength

                let s=0
                let d=0
                let amplitude=1
                let frequency=1
                for (let i=0;i<this.octaves+1;i++){
                    let v=this.n(coordX*frequency+dx,coordY*frequency+dy)*amplitude

                    s+=v
                    d+=amplitude
                    frequency *= this.lacunarity
                    amplitude *= this.persistence
                }
                let alphaDistance=1
                if (this.centralized){
                    alphaDistance=1-(distanceEucl([sizeImage/2,sizeImage/2],[x,y])/(this.circleDistance/(this.scale*100))).clamp(0,1)
                }

                if (this.decentralized && this.centralized){
                    if (this.extendCenter){
                        alphaDistance=Math.min((Math.abs(sizeImage/2-y)/(this.distance/(this.scale*100))-1).clamp(0,1),alphaDistance)
                    }else{
                        alphaDistance=Math.min((distanceEucl([sizeImage/2,sizeImage/2],[x,y])/(this.distance/(this.scale*100))-1).clamp(0,1),alphaDistance)
                    }
                }else if (this.decentralized){
                    if (this.extendCenter){
                        alphaDistance=(Math.abs(sizeImage/2-y)/(this.distance/(this.scale*100))-1).clamp(0,1)
                    }else{
                        alphaDistance=(distanceEucl([sizeImage/2,sizeImage/2],[x,y])/(this.distance/(this.scale*100))-1).clamp(0,1)
                    }
                }
                
                let value=(s/d)*alphaDistance
                if (this.ridged){
                    value=Math.abs(value)
                }else{
                    value=value*0.5+0.5
                }
                if (this.inversed){
                    value=1-value
                }
                let color
                let ci
                if (this.colorised){
                    let factor=1
                    if (value < this.steps[0]) {
                        ci=0
                        color = [11, 29, 58]      // deep ocean
                        factor=((value-0)/(this.steps[0]-0)*alphaDistance*0.2+0.8)
                    } else if (value < this.steps[1]) {
                        ci=1
                        color = [18, 63, 107]     // ocean
                        factor=(value-this.steps[0])/(this.steps[1]-this.steps[0])*0.3+0.7
                    } else if (value < this.steps[2]) {
                        ci=2
                        color = [217, 194, 138]   // sand
                        factor=((value-this.steps[1])/(this.steps[2]-this.steps[1])*0.2+0.85).clamp(0,1)
                    } else if (value < this.steps[3]) {
                        ci=3
                        color = [79, 139, 58]     // plain
                        //hills 63, 111, 47
                        factor=(1-(value-this.steps[2])/(this.steps[3]-this.steps[2]))*0.3+0.7
                    } else if (value < this.steps[4]) {
                        ci=4
                        color = [148,128,119]   // mountain [110, 106, 99]
                        factor=(value-this.steps[3])/(this.steps[4]-this.steps[3])*0.3+0.7
                    } else {
                        ci=5
                        color = [242, 246, 251]  // snow
                        factor=(value-this.steps[4])/(1-this.steps[4])*0.3+0.9
                    }
                    color=[color[0]*factor,color[1]*factor,color[2]*factor]
                }else{
                    const a=value*255
                    color=[a,a,a]
                    ci=value
                }
                setPixel(this.imageData,x,y,color)
                col[y]=ci
            }
            mapPixels.push(col)
        }

        return [mapPixels,this.imageData]
    }
}

function getTextureFromImageData(imgData){
    const texture = PIXI.Texture.fromBuffer(
        imgData.data,
        imgData.width,
        imgData.height
    )
    return texture
}

function mixColor(a,b){
    return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]
}

function mergeImageData(imgData1,imgData2,pixels1,pixels2){
    for (let x=0;x<pixels2.length;x++){
        for (let y=0;y<pixels2[x].length;y++){
            if (pixels2[x][y]!==0){
                // if (pixels1[x][y]===1 && pixels2[x][y]===1){
                //     setPixel(imgData1,x,y,mixColor(getPixel(imgData1,x,y),getPixel(imgData2,x,y)))
                // }else 
                if (pixels1[x][y]===3){
                    setPixel(imgData1,x,y,getPixel(imgData2,x,y))
                } 
            }
        }
    }
    return imgData1
}

let tileTexture = PIXI.Texture.from("data/tileHex.png")

function getCoordHex(coord,size){
    return [size*Math.sqrt(3)*(coord[0]/2+(coord[1]%2)/4),size*coord[1]*3/4]
}

function getCoordNeighbors(coord){
    let x=coord[0]
    let y=coord[1]
    let even=[[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]]
    let odd=[[1,-1],[1,0],[1,1],[0,1],[-1,0],[0,-1]]
    let r
    if (coord[1]%2===0){
        r=even
    }else{
        r=odd
    }
    let ns=[]
    for (let n in r){
        let nx=(r[n][0]+x)%102
        let ny=r[n][1]+y

        if (ny>0 && ny<100){
            if (nx<0) {nx+=102}
            ns.push([nx,ny])
        }
    }
    return ns
}

function getTileFromCoord(coord){
    return gridTiles[coord[0]][coord[1]]
}

function getTypeFromPixels(p){
    n=[0,0,0,0,0,0,0]
    max=0
    for (let i in p){
        n[p[i]]+=1
        if (n[p[i]]>n[max]){
            max=p[i]
        }
    }
    return max
}

class GridTile extends PIXI.Sprite{
    constructor(parentPos,coord,size) {
        super(tileTexture)

        this.origCoord=coord
        this.coord=this.origCoord
        this.size=size
        this.parentPos=parentPos
        this.width=this.size
        this.height=this.size

        this.UpdatePosition(true)

        this.anchor.set(0.5,0.5)
        this.hitArea = new PIXI.Polygon(pointsHitBox);

        //Debug Border
        // this.polyBorderDebug = new PIXI.Graphics();
        // this.polyBorderDebug.lineStyle(26, 0xff0000, 1);
        // this.polyBorderDebug.drawPolygon(points)
        // this.polyBorderDebug.alpha=0
        // this.addChild(this.polyBorderDebug)

        // this.debugLabel = new PIXI.Text(`${this.origCoord[0]},${this.origCoord[1]}`,{
        //         fontSize: 80,
        //         fill: "#ffffff",
        //         stroke: "#000000",
        //         strokeThickness:2
        //     }
        // )

        // this.debugLabel.x = -this.debugLabel.width/2
        // this.debugLabel.y = -this.debugLabel.height/2

        // this.addChild(this.debugLabel)
        // this.debugLabel.visible=false
        // this.debugLabel.eventMode="none"

        // this.debugLabel = new PIXI.Text(`${this.coord[0]},${this.coord[1]}`,{
        //         fontSize: size/5,
        //         fill: "#ffffff",
        //         stroke: "#000000",
        //         strokeThickness:2
        //     }
        // )

        // this.debugLabel.x = this.x + this.width / 2 - this.debugLabel.width/2
        // this.debugLabel.y = this.y + this.height / 2- this.debugLabel.height/2

        // world.addChild(this.debugLabel)

        this.eventMode='static'

        // this.on('pointerover',()=>{
        //     gsap.to(this.polyBorderHover, {
        //         alpha:1,
        //         duration: 0.1,
        //         ease: "power2.inOut"
        //     });
        // })

        // const pointerOut=()=>{
        //     gsap.to(this.polyBorderHover, {
        //         alpha:0,
        //         duration: 0.1,
        //         ease: "power2.inOut"
        //     });
        // }
        // this.on('pointerout', pointerOut);
        // this.on('pointercancel', pointerOut);

        this.unitSprite
        this.walkable

        this.on('pointertap',()=>{
            if (!isDrag){
                this.Select()

                // this.pixelsTile=[]
                // let ig=["0;0","8;8","0;8","8;0","1;0","7;8","1;8","7;0","0;1","8;7","0;7","8;1"]
                // for (let x=0;x<9;x++){
                //     for (let y=0;y<9;y++){
                //         if (!ig.includes(`${x};${y}`)){
                //             setPixel(imageDataMap,(Math.floor(this.origCoordHex[0])+x)%795,Math.floor(this.origCoordHex[1])+y+Math.round((800-tileSize*75)/2),[255,255,0])
                //             let gridX=(Math.floor(this.origCoordHex[0])+x)%795
                //             let gridY=Math.floor(this.origCoordHex[1])+y+Math.round((800-tileSize*75)/2)
                //             this.pixelsTile.push(pixels[gridX][gridY])
                //         }
                //     }
                // }
                // DebugTile(imageDataMap)

                let type=['deep ocean','ocean','sand','plain','mountain','snow']
                console.log(this.origCoord,type[this.typeIndex])
            }else{
                isDrag=false
            }
        })
    }
    UpdatePosition(f=false){
        this.origCoordHex=getCoordHex(this.origCoord,this.size)

        let coordHex = getCoordHex(this.coord,this.size)
        this.coordHex=coordHex
        this.x=this.parentPos[0]+coordHex[0]
        this.y=this.parentPos[1]+coordHex[1]

        if (this.unitSprite){
            this.unitSprite.x=this.x
            this.unitSprite.y=this.y
            this.unitSprite.flag.x=this.x
            this.unitSprite.flag.y=this.y-5
        }

        if (f){
            this.typeIndex=0
            this.pixelsTile=[]
            let ig=["0;0","8;8","0;8","8;0","1;0","7;8","1;8","7;0","0;1","8;7","0;7","8;1"]
            for (let x=0;x<9;x++){
                for (let y=0;y<9;y++){
                    if (!ig.includes(`${x};${y}`)){
                        let gridX=(Math.floor(this.origCoordHex[0])+x)%795
                        let gridY=Math.floor(this.origCoordHex[1])+y+Math.round((800-tileSize*75)/2)
                        this.pixelsTile.push(pixels[gridX][gridY])
                    }
                }
            }
            this.typeIndex=getTypeFromPixels(this.pixelsTile)

            if (this.typeIndex>3){
                this.walkable=false
            }else{
                this.walkable=true
            }
        }
    }
    Select(){
        //Case
        selectedTile=this

        polyBorderSelected.position.copyFrom(this.position)
        polyBorderSelected.scale.copyFrom(this.scale)
        polyBorderSelected.alpha=1

        //Unité
        console.log(isInList(this.origCoord,moveTiles))
        if (isInList(this.origCoord,moveTiles)){
            //Move unit
            moveTiles=[]
            selectedUnit.moveTo(this.origCoord)
            //Hide
            polyBorderMoves.clear()
            selectedTile=null
            polyBorderSelected.alpha=0
        }else{
            selectedUnit=null
            moveTiles=[]

            if (this.unitSprite){
                selectedUnit=this.unitSprite
                moveTiles=this.unitSprite.getMovesTiles()
                this.updateBorderMoveArea(this.origCoord,moveTiles)
            }else{
                polyBorderMoves.clear()
            }
        }

        
    }
    addUnit(u){
        this.unitSprite=u
        this.UpdatePosition()
        this.unitSprite.tileCoord=this.origCoord
    }
    removeUnit(u){
        this.unitSprite=null
    }
    updateBorderMoveArea(o,group){
        
        let newGroup=[]
        for (let g of group){
            newGroup.push(g)
            if (g[0]===0){
                newGroup.push([102,g[1]])
            }else if (g[0]===101){
                newGroup.push([-1,g[1]])
            }
        }

        polyBorderMoves.clear()
        polyBorderMoves.lineStyle(26, "#19d1f1", 1, 1)

        let allPoints=[]

        //Add points of the origin hexagon
        let psO=[]
        for (let p=0;p<pointsOut.length;p+=2){
            psO.push([pointsOut[p],pointsOut[p+1],o])
        }
        allPoints.push(psO)

        for (let g=0;g<newGroup.length;g++){
            //Get center of the Hexagon
            let cg=getCenterTranslation(o,newGroup[g])
            let ps=[]

            //Get all points
            for (let p=0;p<pointsOut.length;p+=2){
                let x=cg[0]+pointsOut[p]
                let y=cg[1]+pointsOut[p+1]

                //Merge by distance
                for (let i=0;i<g+1;i++){
                    for (let q=0;q<6;q++){
                        if (Math.round(Math.abs(allPoints[i][q][0]-x))<3 && Math.round(Math.abs(allPoints[i][q][1]-y))<3){
                            x=allPoints[i][q][0]
                            y=allPoints[i][q][1]
                        }
                    }
                }

                //Add Point
                ps.push([x,y])
            }

            //Add hexagon points
            allPoints.push(ps)
        }

        let allEdges={}
        for (let g in allPoints){
            for (let e=0;e<6;e++){
                let nedge=normalizeEdge(allPoints[g][e],allPoints[g][(e+1)%6])
                let edge=formatEdge(allPoints[g][e],allPoints[g][(e+1)%6])

                if (allEdges[nedge]){
                    delete allEdges[nedge]
                }else{
                    allEdges[nedge]=edge
                }
            }
        }

        let dedge={}
        for (let d in allEdges){
            dedge[allEdges[d][0]]=allEdges[d][1]
        }

        let start=Object.keys(dedge)[0]
        polyBorderMoves.moveTo(Number(start.split(';')[0]),Number(start.split(';')[1]))
        let current=null
        while (Object.keys(dedge).length!==0){
            if (current===null){
                current = dedge[start]
                delete dedge[start]
            }else{
                let newCurrent = dedge[current]
                //If cycle not finish
                if (dedge[current]){
                    delete dedge[current]
                    current = newCurrent
                }else{
                    //Move to new cycle
                    polyBorderMoves.closePath()
                    start=Object.keys(dedge)[0]
                    polyBorderMoves.moveTo(Number(start.split(';')[0]),Number(start.split(';')[1]))

                    current = dedge[start]
                    delete dedge[start]
                }
            }
            
            polyBorderMoves.lineTo(Number(current.split(';')[0]),Number(current.split(';')[1]))
        }

        polyBorderMoves.closePath()

        polyBorderMoves.x=this.parentPos[0]+this.origCoordHex[0]
        polyBorderMoves.y=this.parentPos[1]+this.origCoordHex[1]
        polyBorderMoves.scale.copyFrom(this.scale)

        polyBorderMovesLeft.x=polyBorderMoves.x-tileSize*Math.sqrt(3)/2*102
        polyBorderMovesLeft.y=polyBorderMoves.y
        polyBorderMovesLeft.scale.copyFrom(this.scale)

        polyBorderMovesRight.x=polyBorderMoves.x+tileSize*Math.sqrt(3)/2*102
        polyBorderMovesRight.y=polyBorderMoves.y
        polyBorderMovesRight.scale.copyFrom(this.scale)

    }
}

function normalizeEdge(a, b) {
    let ax=a[0]
    let ay=a[1]
    let bx=b[0]
    let by=b[1]
    return ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

function formatEdge(a, b) {
    return [`${a[0]};${a[1]}`,`${b[0]};${b[1]}`]
}

function getCenterTranslation(o,g){
    let c=[]
    let dx=(g[0]-o[0])
    let dy=g[1]-o[1]

    let h=264.5*Math.sqrt(3)
    let s=h*dx
    if (dy%2!==0){
        dx=dx*2+1
        if (o[1]%2==0){
            s=h/2*dx
        }else{
            s=h/2*(dx-2)
        }
    }
    return [s,264.5*3/2*dy]
}

function isInList(a,b){
    for (let c in b){
        if (a[0]===b[c][0] && a[1]===b[c][1]){
            return true
        }
    }
    return false
}

function isEqual(a,b){
    return a[0]===b[0] && a[1]===b[1]
}

function warpTiles(l,n){
    let index
    let d=n-l
    if (d<0){
        for (let i=0;i<-d;i++){
            if (l-i<=0){
                index=101+l-i
            }else{
                index=l-i-1
            }
            for (let t in gridTiles[index]){
                let tile=gridTiles[index][t]
                tile.coord=[tile.coord[0]-102,tile.coord[1]]
                tile.UpdatePosition()
            }
        }
    }else if (d>0){
        for (let i=0;i<d;i++){
            if (l+i>=0){
                index=l+i
            }else{
                index=102+l+i
            }
            for (let t in gridTiles[index]){
                let tile=gridTiles[index][t]
                tile.coord=[tile.coord[0]+102,tile.coord[1]]
                tile.UpdatePosition()
            }
        }
    }
}

function resetWrap(){
    let lastOffsetTile=offsetTile
    offsetTile=0
    warpTiles(lastOffsetTile,offsetTile)

    if (lastOffsetTile>0){
        world.x+=tileSize*Math.sqrt(3)/2*102*world.scale.x
    }else{
        world.x-=tileSize*Math.sqrt(3)/2*102*world.scale.x
    }
}

function createGrid(container,coord,size){
    let seed="1782128928507"
    //let seed="1782128973226" //Snow
    //let seed="1782128973226"
    // let seed=Date.now()
    let config={
    //Default
        scale:0.005,
        octaves:4,
        ridged:true,
        inversed:false,
        warp:true,
        colorised:true,
        steps:[0.14,0.19,0.24,0.5,0.6],
        centralized:true,
        circleDistance:200
    }

    let perlinNoise= new PerlinNoise(seed,config)
    const result=perlinNoise.createPerlinNoise(0,800,0,800)
    pixels=result[0]
    imageDataMap=result[1]

    //Mountains
    let seedMountain=seed+"Mountain"
    let configMountain={
        scale:0.02,
        octaves:4,
        ridged:true,
        inversed:false,
        warp:true,
        colorised:true,
        steps:[0.3,0.3,0.3,0.3,0.5],
        centralized:false,
        circleDistance:300,
    }

    let perlinNoiseMountain = new PerlinNoise(seedMountain,configMountain)
    const resultMountain=perlinNoiseMountain.createPerlinNoise(0,800,0,800)
    pixelsMountain=resultMountain[0]
    imageDataMountain=resultMountain[1]

    //Generate Texture
    //mergeImageData(imageDataMap,imageDataMountain,pixels,pixelsMountain)
    const mapTexture=getTextureFromImageData(imageDataMap)

    mapSpriteLeft = new PIXI.Sprite(mapTexture)
    map.addChild(mapSpriteLeft)

    mapSpriteLeft.width=800
    mapSpriteLeft.height=800
    mapSpriteLeft.x=-tileSize*Math.sqrt(3)/2*102
    mapSpriteLeft.y=-(800-tileSize*75)/2

    mapSprite = new PIXI.Sprite(mapTexture)
    map.addChild(mapSprite)

    mapSprite.width=800
    mapSprite.height=800
    mapSprite.x=0
    mapSprite.y=-(800-tileSize*75)/2


    mapSpriteRight = new PIXI.Sprite(mapTexture)
    map.addChild(mapSpriteRight)

    mapSpriteRight.width=800
    mapSpriteRight.height=800
    mapSpriteRight.x=tileSize*Math.sqrt(3)/2*102
    mapSpriteRight.y=-(800-tileSize*75)/2


    mapMountain = new PIXI.Sprite(getTextureFromImageData(imageDataMountain))
    //map.addChild(mapMountain)

    mapMountain.width=500
    mapMountain.height=500
    mapMountain.x=0
    mapMountain.y=-(800-tileSize*75)/2

    let gridTiles=[]
    for (let x=0;x<size[0];x++){
        let col=[]
        for (let y=0;y<size[1];y++){
            let tile=new GridTile([coord[0]+tileSize/2*Math.sqrt(3)/2,coord[1]+tileSize/2],[x,y],tileSize)
            container.addChild(tile)
            col.push(tile)
        }
        gridTiles.push(col)
    }

    return gridTiles
}


gridTiles = createGrid(grid,[0,0],[102,100])



///////// CREATE TEXTURE TILE /////////
// const g = new PIXI.Graphics();
// g.lineStyle(1, "#ffffff", 0.25);
// const r = 200;

// for (let i = 0; i < 6; i++) {
//     const angle = (Math.PI / 3) * i - Math.PI / 2;
//     const x = r * Math.cos(angle);
//     const y = r * Math.sin(angle);

//     if (i === 0) g.moveTo(x, y);
//     else g.lineTo(x, y);
// }
// g.closePath();

// const hexTexture = app.renderer.generateTexture(g);

// let sprite = new PIXI.Sprite(hexTexture)
// grid.addChild(sprite)
// sprite.x = 50;
// sprite.y = 50;

// const canvas2 = app.renderer.extract.canvas(sprite);
// const url = canvas2.toDataURL("image/png");

// const a = document.createElement("a");
// a.href = url;
// a.download = "tile.png";
// a.click();


class Unit extends PIXI.Sprite{
    constructor(type,civ){
        
        let text=unitsTexture.get(type)
        if (!text){
            text=PIXI.Texture.from("data/textures/units/"+type.slice(5)+"_TEXTURE.png")
            text.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            unitsTexture.set(type,text)
        }
        super(text)

        this.width=7
        this.height=7
        this.anchor.set(0.5,0.5)
        this.tileCoord=[-1,-1]
        this.civ=civ

        this.eventMode='none'
        
        //Property
        this.BaseMoves=Number(unitsDB.get(type).getAttribute('BaseMoves'))
        this.moveCount

        this.baseSightRange=Number(unitsDB.get(type).getAttribute('BaseSightRange'))

        //Flag
        let textIcon=unitsIcons.get(type)
        if (!textIcon){
            textIcon=PIXI.Texture.from("data/icons/units/"+type.slice(5)+"_ICON.png")
            unitsIcons.set(type,textIcon)
        }
        this.flag=new PIXI.Sprite(textIcon)
        this.flag.width=4
        this.flag.height=4
        this.flag.anchor.set(0.5,0.5)
        this.flag.tint=civilisationsColor[this.civ]
        
        icons.addChild(this.flag)

        //Ability
    }
    getMovesTiles(){
        let moveT=[]
        let openL=[this.tileCoord]
        for (let i=0;i<this.BaseMoves+1;i++){
            console.log("Distance:",i)
            let l=[]
            for (let t=0;t<openL.length;t++){
                let c=openL[t]
                moveT.push(c)
                for (let e of getCoordNeighbors(c)){
                    if (!isInList(e,moveT.concat(openL,l)) && getTileFromCoord(e).walkable) l.push(e)
                }
            }
            openL=l
        }
        moveT.splice(moveT.indexOf(this.tileCoord),1)

        console.log(moveT)

        return moveT
    }
    moveTo(c){
        getTileFromCoord(this.tileCoord).removeUnit()
        getTileFromCoord(c).addUnit(this)
    }
}

let doc
let unitsDB = new Map()
let unitType = ["Éclaireur","Colon","Bâtisseur","Guerrier","Négociant"]
let unitsTexture = new Map()
let unitsIcons = new Map()
let civilisations=["César","Alexandre III"]
let civilisationsColor={"César":"#ff0000","Alexandre III":"#f8a25b"}
let civilisationsUnits={"César":[],"Alexandre III":[]}

fetch("data/xmls/units.xml")
    .then(res => res.text())
    .then(text => {
        const parser = new DOMParser();
        doc = parser.parseFromString(text, "text/xml")
        doc.querySelectorAll('Units > Row').forEach(row => {
            unitsDB.set(row.getAttribute("UnitType"), row);
        })
        spawnUnits()
    })


function spawnUnits(){

    let scout = new Unit("UNIT_SCOUT","César")
    units.addChild(scout)
    getTileFromCoord([47,34]).addUnit(scout)

    let settler = new Unit("UNIT_SETTLER","César")
    units.addChild(settler)
    getTileFromCoord([48,40]).addUnit(settler)

    let builder = new Unit("UNIT_BUILDER","César")
    units.addChild(builder)
    getTileFromCoord([40,34]).addUnit(builder)

    let warrior = new Unit("UNIT_WARRIOR","César")
    units.addChild(warrior)
    getTileFromCoord([41,34]).addUnit(warrior)

    let trader = new Unit("UNIT_TRADER","César")
    units.addChild(trader)
    getTileFromCoord([40,30]).addUnit(trader)

    let scout2 = new Unit("UNIT_SCOUT","Alexandre III")
    units.addChild(scout2)
    getTileFromCoord([42,34]).addUnit(scout2)

    let builder2 = new Unit("UNIT_BUILDER","Alexandre III")
    units.addChild(builder2)
    getTileFromCoord([43,34]).addUnit(builder2)

    let warrior2 = new Unit("UNIT_WARRIOR","Alexandre III")
    units.addChild(warrior2)
    getTileFromCoord([44,34]).addUnit(warrior2)
}

let mountainText=PIXI.Texture.from("data/mountain.png")
let mountain=new PIXI.Sprite(mountainText)
units.addChild(mountain)

let tileMo=getTileFromCoord([51,50])

mountain.x=tileMo.x-5
mountain.y=tileMo.y-4
mountain.width=10
mountain.height=8

let mountain2=new PIXI.Sprite(mountainText)
units.addChild(mountain2)

let tileMo2=getTileFromCoord([51,51])

mountain2.x=tileMo2.x-5
mountain2.y=tileMo2.y-4
mountain2.width=10
mountain2.height=8

function distanceManhattan(c1, c2) {
    return Math.abs(c2[0] - c1[0]) + Math.abs(c2[1] - c1[1]);
}

function distanceChebyshev(c1, c2) {
    return Math.max(Math.abs(c2[0] - c1[0]), Math.abs(c2[1] - c1[1]));
}

function distanceMinkowski(c1, c2, p = 3) {
    return (Math.abs(c2[0] - c1[0]) ** p + Math.abs(c2[1] - c1[1]) ** p) ** (1 / p);
}

function distanceMinkowskiChebyshev(c1, c2) {
    const dx = Math.abs(c2[0] - c1[0]);
    const dy = Math.abs(c2[1] - c1[1]);
    return (dx ** 3 + dy ** 3) ** (1 / 3) + Math.max(dx, dy);
}

function distanceCanberra(c1, c2) {
    const numX = Math.abs(c2[0] - c1[0]);
    const denX = Math.abs(c1[0]) + Math.abs(c2[0]) || 1;
    const numY = Math.abs(c2[1] - c1[1]);
    const denY = Math.abs(c1[1]) + Math.abs(c2[1]) || 1;
    return (numX / denX) + (numY / denY);
}

function distanceAnisotropic(c1, c2) {
    return Math.sqrt(((c2[0] - c1[0]) * 3.0) ** 2 + (c2[1] - c1[1]) ** 2);
}

function distanceSquaredEucl(c1, c2) {
    return (c2[0] - c1[0]) ** 2 + (c2[1] - c1[1]) ** 2;
}

function distanceHybrid(c1, c2) {
    const dx = Math.abs(c2[0] - c1[0]);
    const dy = Math.abs(c2[1] - c1[1]);
    return (dx + dy + Math.max(dx, dy)) * 0.5;
}


function createCellularNoise(rng,size,n,radius,Worley=false,WorleyOptimisation=false,LloydAlg=false,LloydIteration=3,distF=distanceEucl,Voronoi=false){
    let points=[]
    let WorleyC=new Map()
    let gw
    let gh
    let w
    let voronoiC=new Map()
    let voronoiColors=[]
    if (Voronoi){
        for (let c=1;c<n+1;c++){
            voronoiColors.push(c/n)
        }
    }
    if (Worley){
        let nextSquare=Math.ceil(Math.sqrt(n))**2
        w=Math.ceil(Math.sqrt(n))
        gw=size[0]/w
        gh=size[1]/w
        let l=[]
        for (let x=0;x<w;x++){
            for (let y=0;y<w;y++){
                l.push([[x*gw+gw/2+(rng()*gw-gw/2),y*gh+gh/2+(rng()*gh-gh/2)],[x,y]])
            }
        }
        for (let i=0;i<n;i++){
            point= l.splice(Math.floor(rng()*l.length),1)[0]
            points.push(point[0])
            WorleyC.set(JSON.stringify(point[1]),point[0])
            if (Voronoi){
                voronoiC.set(point[0],voronoiColors.splice(Math.floor(Voronoi()*voronoiColors.length),1))
            }
        }
    }else{
        radius=Math.floor(Math.min(radius,1.0746*Math.sqrt(size[0]*size[1]/n)))
        for (let i=0;i<n;i++){
            let point
            let minDist
            do{
                point=[Math.round(rng()*size[0]),Math.round(rng()*size[1])]
                if (points[0]){
                    minDist=distanceEucl(points[0],point)
                    for (let p of points){
                        let dist=distanceEucl(p,point)
                        if (dist<minDist){
                            minDist=dist
                        }
                    }
                }
            }while(minDist<radius)
            
            points.push(point)
            if (Voronoi){
                voronoiC.set(point,voronoiColors.splice(Math.floor(Voronoi()*voronoiColors.length),1))
            }
        }
    }
    console.log(points)
    console.log(gw)
    console.log(WorleyC)
    console.log(voronoiC)
    let tab
    let maxDist
    let nb=0
    let cells
    do{
        if (nb>0){
            Worley=false
            if (Voronoi){
                voronoiC=new Map()
                voronoiColors=[]
                for (let c=1;c<n+1;c++){
                    voronoiColors.push(c/n)
                }
            }
            console.log(cells)
            newPoints=[]
            for (p of points){
                let centroid=[cells.get(p)[0]/cells.get(p)[2],cells.get(p)[1]/cells.get(p)[2]]
                newPoints.push(centroid)
                if (Voronoi){
                    voronoiC.set(centroid,voronoiColors.splice(Math.floor(Voronoi()*voronoiColors.length),1))
                }
            }
            points=newPoints
            console.log(points)
        }
        nb+=1
        tab=[]
        maxDist=0
        cells=new Map()
        for (let x=0;x<size[0];x++){
            let col=[]
            for (let y=0;y<size[1];y++){
                let ps
                if (WorleyOptimisation){
                    let tile=[Math.floor(x/gw),Math.floor(y/gh)]
                    if (WorleyC.get(JSON.stringify(tile))){
                        ps=[]
                        let adj=[[0,0],[0,1],[0,-1],[1,0],[-1,0],[-1,-1],[1,1],[-1,1],[1,-1]]
                        for (let a of adj){
                            let px=tile[0]+a[0]
                            let py=tile[1]+a[1]
                            if (px>=0 && px<w && py>=0 && py<w){
                                let k=WorleyC.get(JSON.stringify([px,py]))
                                if (k) ps.push(k)
                            } 
                        }
                    }else{
                        ps=points
                    }
                    
                }else{
                    ps=points
                }
                
                let F1=10000
                let F2=10000
                let F3=10000
                let P1
                let P2
                let P3
                for (let p of ps){
                    let dist=distF(p,[x,y])
                    if (dist<F1){
                        F1=dist
                        P1=p
                    }else if (dist<F2){
                        F2=dist
                        P2=p
                    }else if (dist<F3){
                        F3=dist
                        P3=p
                    }
                }
                let distance=F1
                let choosePoint=P1
                
                if (cells.get(choosePoint)){
                    cells.get(choosePoint)[0]+=x
                    cells.get(choosePoint)[1]+=y
                    cells.get(choosePoint)[2]++
                }else{
                    cells.set(choosePoint,[x,y,1])
                }
                
                if (Voronoi){
                    col.push(voronoiC.get(choosePoint))
                }else{
                    if (distance>maxDist) maxDist=distance
                    col.push(distance)
                }
            }
            tab.push(col)
        }
    }while(nb<LloydIteration+1 && LloydAlg)
    return (x,y)=>{
        if (Voronoi) return tab[x][y]
        return tab[x][y]/maxDist
    }
}

function lerpRGB(color1, color2, t) {
    return [Math.round(color1[0] + (color2[0] - color1[0]) * t), Math.round(color1[1] + (color2[1] - color1[1]) * t), Math.round(color1[2] + (color2[2] - color1[2]) * t)]
}

class Warper{
    constructor(config){
        let seed="Thomas"
        this.rng=new Math.seedrandom(seed)
        this.rng1=new Math.seedrandom(seed+"1")
        this.rng2=new Math.seedrandom(seed+"2")
        this.n=createNoise2D(this.rng)
        this.n1=createNoise2D(this.rng1)
        this.n2=createNoise2D(this.rng2)

        //// Parameters
        const defaults={
            // Main
            scale:0.005,
            warpOctaves:3,
            warpLacunarity:2,
            warpPersistence:0.5,
            warpStrength:20,
            masked:true,
            centralized:true,
            innerCircleDistance:200,
            outerCircleDistance:240,
            debugCircle:false,
            cutOut:false,
            clampPixel:true,
            colorReplace:[255,255,255,0]
        }

        const cfg = {...defaults,...config}
        console.log(cfg)
        this.scale=cfg.scale
        this.warpOctaves=cfg.warpOctaves
        this.warpLacunarity=cfg.warpLacunarity
        this.warpPersistence=cfg.warpPersistence
        this.warpStrength=cfg.warpStrength
        this.masked=cfg.masked
        this.centralized=cfg.centralized
        this.innerCircleDistance=cfg.innerCircleDistance.clamp(0,265)
        this.outerCircleDistance=cfg.outerCircleDistance.clamp(this.innerCircleDistance,265)
        this.debugCircle=cfg.debugCircle
        this.cutOut=cfg.cutOut
        this.clampPixel=cfg.clampPixel
        this.colorReplace=cfg.colorReplace

        this.cfg=cfg
    }
    warpImage(refImageData,maskImageData){
        let imageData = ctxTest.createImageData(refImageData.width,refImageData.height)

        for (let x=0;x<refImageData.width;x++){
            for (let y=0;y<refImageData.height;y++){
                let coordX=x*this.scale
                let coordY=y*this.scale

                let dx=0
                let dy=0
                let r=0
                let warpAmplitude=1
                let warpFrequency=1
                for (let i=0;i<this.warpOctaves+1;i++){
                    dx+=this.n1(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude
                    dy+=this.n2(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude
                    r+=this.n(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude

                    warpFrequency *= this.warpLacunarity
                    warpAmplitude *= this.warpPersistence
                }

                let w=this.warpStrength
                dx*=w
                dy*=w

                let alphaDistance=1
                if(this.centralized) alphaDistance=1-((distanceEucl([264.5,264.5],[x,y])-this.innerCircleDistance)/(this.outerCircleDistance-this.innerCircleDistance)).clamp(0,1)
                
                let opacity=getPixel(refImageData,x,y,true)[3]
                let color
                if (this.clampPixel) color=getPixel(refImageData,Math.round(x+dx*alphaDistance).clamp(0,refImageData.width-1),Math.round(y+dy*alphaDistance).clamp(0,refImageData.height-1))
                else {
                    let newX=Math.round(x+dx*alphaDistance)
                    let newY=Math.round(y+dy*alphaDistance)
                    if (newX<0 || newX>refImageData.width-1 || newY<0 || newY>refImageData.height-1) {
                        color=this.colorReplace
                        opacity=this.colorReplace[3]
                    }
                    else color=getPixel(refImageData,newX,newY)
                }

                // Debug Circle
                if (this.debugCircle) color=[alphaDistance*255,alphaDistance*255,alphaDistance*255]

                //Mask
                let alpha=255
                if (this.masked) alpha=getPixel(maskImageData,x,y)[0]
                color=[color[0]*alpha/255,color[1]*alpha/255,color[2]*alpha/255]
                
                if (this.cutOut && color[0]+color[1]+color[2]===0) opacity=0
                
                //color=[r*255,r*255,r*255]
                //color=[(dx/this.warpStrength*0.5+0.5)*255,(dx/this.warpStrength*0.5+0.5)*255,(dx/this.warpStrength*0.5+0.5)*255]
                setPixel(imageData,x,y,color,opacity)
            }
        }

        return imageData
    }
    softenImage(refImageData,maskImageData){
        let imageData = ctxTest.createImageData(refImageData.width,refImageData.height)
        for (let x=0;x<refImageData.width;x++){
            for (let y=0;y<refImageData.height;y++){
                let l=[0,0,0]
                for (let i of [[0,0],[0,1],[0,-1],[1,0],[-1,0],[-1,-1],[1,1],[-1,1],[1,-1]]){
                    if (x+i[0]>0 && x+i[0]<refImageData.width && y+i[1]>0 && y+i[1]<refImageData.height){
                        let color=getPixel(refImageData,x+i[0],y+i[1])
                        
                        l[0]+=color[0]**2
                        l[1]+=color[1]**2
                        l[2]+=color[2]**2
                    }
                }
                let color=[Math.sqrt(l[0]/9),Math.sqrt(l[1]/9),Math.sqrt(l[2]/9)]

                //Mask
                let alpha=255
                if (this.masked) alpha=getPixel(maskImageData,x,y)[0]
                color=[color[0]*alpha/255,color[1]*alpha/255,color[2]*alpha/255]

                let opacity=getPixel(refImageData,x,y,true)[3]
                if (this.cutOut && color[0]+color[1]+color[2]===0) opacity=0

                setPixel(imageData,x,y,color,opacity)
            }
        }
        return imageData
    }
    ScaleUp(refImageData){
        let imageData = ctxTest.createImageData(refImageData.width*2,refImageData.height*2)
        let corresp=[[[-1,-1],[0,-1],[-1,0],[0,0]],[[0,-1],[1,-1],[0,0],[1,0]],[[-1,0],[0,0],[-1,1],[0,1]],[[0,0],[1,0],[0,1],[1,1]]]
        let coeffs=[[15,25,25,35],[25,15,35,25],[25,35,15,25],[35,25,25,15]]

        for (let x=0;x<refImageData.width*2;x++){
            for (let y=0;y<refImageData.height*2;y++){
                let s=0
                let n=0
                let point=[Math.floor(x/2),Math.floor(y/2)]
                let indexType
                let xIsPeer=x%2===0
                let yIsPeer=y%2===0
                if (xIsPeer && yIsPeer) indexType=0
                else if (!xIsPeer && yIsPeer) indexType=1
                else if (xIsPeer && !yIsPeer) indexType=2
                else indexType=3
                
                let co=corresp[indexType]
                let coeff=coeffs[indexType]
                for (let c in co){
                    let cx=point[0]+co[c][0]
                    let cy=point[1]+co[c][1]
                    if (cx>=0 && cy>=0 && cx<refImageData.width && cy<refImageData.height){
                        s+=getPixel(refImageData,cx,cy)[0]*coeff[c]
                        n+=coeff[c]
                    }
                }
                    
                setPixel(imageData,x,y,[s/n,s/n,s/n])
            }
        }
        return imageData
    }
    getChannel(refImageData,c){
        let imageData = ctxTest.createImageData(refImageData.width,refImageData.height)
        let index
        if (c==='R'){
            index=0 
        }else if (c==='G'){
            index=1
        }else if (c==='B'){
            index=2
        }else{
            return refImageData
        }

        for (let x=0;x<refImageData.width;x++){
            for (let y=0;y<refImageData.height;y++){
                let color=getPixel(refImageData,x,y)[index]
                setPixel(imageData,x,y,[color,color,color])
            }
        }

        return imageData
    }
    putTextureAtChannel(refImageData,maskImageData,texture,c){
        let imageData = ctxTest.createImageData(refImageData.width,refImageData.height)
        let index
        if (c==='R'){
            index=0 
        }else if (c==='G'){
            index=1
        }else if (c==='B'){
            index=2
        }else{
            return refImageData
        }

        for (let x=0;x<refImageData.width;x++){
            for (let y=0;y<refImageData.height;y++){
                let alpha=getPixel(maskImageData,x,y)[index]
                setPixel(imageData,x,y,lerpRGB(getPixel(refImageData,x,y),getPixel(texture,x,y),alpha/255))
            }
        }

        return imageData
    }
}

function ScaleUp(tab){
    let newTab=[]
    let corresp=[[[-1,-1],[0,-1],[-1,0],[0,0]],[[0,-1],[1,-1],[0,0],[1,0]],[[-1,0],[0,0],[-1,1],[0,1]],[[0,0],[1,0],[0,1],[1,1]]]
    let coeffs=[[15,25,25,35],[25,15,35,25],[25,35,15,25],[35,25,25,15]]

    for (let x=0;x<tab.length*2;x++){
        let col=[]
        for (let y=0;y<tab.length*2;y++){
            let s=0
            let n=0
            let point=[Math.floor(x/2),Math.floor(y/2)]
            let indexType
            let xIsPeer=x%2===0
            let yIsPeer=y%2===0
            if (xIsPeer && yIsPeer) indexType=0
            else if (!xIsPeer && yIsPeer) indexType=1
            else if (xIsPeer && !yIsPeer) indexType=2
            else indexType=3
            
            let co=corresp[indexType]
            let coeff=coeffs[indexType]
            for (let c in co){
                let cx=point[0]+co[c][0]
                let cy=point[1]+co[c][1]
                if (cx>=0 && cy>=0 && cx<tab.length && cy<tab.length){
                    s+=tab[cx][cy]*coeff[c]
                    n+=coeff[c]
                }
            }
                
            col.push(s/n)
        }
        newTab.push(col)
    }
    return newTab
}

function SmoothBlur(tab){
    let newTab=[]
    for (let x=0;x<tab.length;x++){
        let col=[]
        for (let y=0;y<tab[x].length;y++){
            let co=[[0,0],[1,0],[0,1],[-1,0],[0,-1]]
            let s=0
            let n=0
            for (let c of co){
                if (x+c[0]>=0 && y+c[1]>=0 && x+c[0]<tab.length && y+c[1]<tab[x].length){
                    n++
                    s+=tab[x+c[0]][y+c[1]]
                }
            }
            col.push(s/n)
        }
        newTab.push(col)
    }
    return newTab
}

function ScaleUpBlur(tab){
    return SmoothBlur(ScaleUp(tab))
}

function ScaleUpCrisp(centerPoint,structure,rng){
    let newCenterPoint=[centerPoint[0]*2,centerPoint[1]*2]
    let newStructure=new Map()
    let newPointsStuck=[newCenterPoint]

    for (let [coord1,list] of structure){
        const [x1,y1]= JSON.parse(coord1)
        const c1=[x1*2,y1*2]
        const key1=JSON.stringify(c1)

        for (let coord2 of list){
            const c2=[coord2[0]*2,coord2[1]*2]
            newPointsStuck.push(c2)
            const c3=[(c1[0]+c2[0])/2,(c1[1]+c2[1])/2]
            newPointsStuck.push(c3)

            let c4
            if (c1[0]+c2[0]){
                c4=[c3[0]+(rng() < 0.5 ? -1 : 1),c3[1]]
            }else{
                c4=[c3[0],c3[1]+(rng() < 0.5 ? -1 : 1)]
            }

            //newPointsStuck.push(c4)
            console.log(c4)

            const key3=JSON.stringify(c3)

            if (newStructure.has(key1)){
                newStructure.get(key1).push(c3)
            }else{
                newStructure.set(key1,[c3])
            }
            if (newStructure.has(key3)){
                newStructure.get(key3).push(c2)
            }else{
                newStructure.set(key3,[c2])
            }

            //newStructure.get(key3).push(c4)
        }
    }

    console.log(structure)

    return [
        newCenterPoint,
        newStructure,
        newPointsStuck
    ]
}

function isInList(a,l){
    for (let b of l){
        if (a[0]===b[0] && a[1]===b[1]) return true
    }
    return false
}

function createDLATrick(rng, steps, nb){
    let centerPoint=[3,3]
    let centerDistance=3
    let pointsFree=[]
    let structure= new Map()
    let pointsStuck=[]
    let tabDetails=[]
    let oldTabDetails=[]
    let tabMerge=[]
    let tabBlur=[]
    let maxHeight=1

    for (let x=0;x<centerDistance*2+1;x++){
        let col=[]
        for (let y=0;y<centerDistance*2+1;y++){
            if (!(x===centerPoint[0] && y===centerPoint[1])){
                if (x>0 && y>0 && x<centerDistance*2 && y<centerDistance*2) pointsFree.push([x,y])
                col.push(0)
            }else{
                pointsStuck.push([x,y])
                col.push(1)
            }
        }
        tabDetails.push(col)
    }

    console.log({...pointsFree})

    const directions = [
        [ 0, -1],
        [ 0,  1],
        [-1,  0],
        [ 1,  0]
    ]
    
    for (let step=1;step<steps+1;step++){

        // ADD DETAILS
        for (let n=0;n<nb*3**(step-1);n++){
            console.log(n)
            //Choose a free coord randomly
            let point=pointsFree[Math.floor(rng() * pointsFree.length)]
            let x=point[0]
            let y=point[1]
            let stuck=false

            //Tant qu'il n'est pas stuck
            do{
                //S'il est dans la grille
                let limit=step>1 ? (centerDistance*2)*2*(step-1) : (centerDistance*2)
                if (x>0 && y>0 && x<limit && y<limit){
                    //Si un de ses neighbors est stuck on le stuck
                    let dn=[[ x, y-1],[ x, y+1],[x-1, y],[ x+1, y]]
                    
                    for (let [ndx,ndy] of dn){
                        for (let [nx,ny] of pointsStuck){
                            if (ndx===nx && ndy===ny) {
                                stuck=true 
                                let key=JSON.stringify([ndx,ndy])
                                if (structure.get(key)) {structure.get(key).push([x,y])}
                                else {structure.set(JSON.stringify([ndx,ndy]),[[x,y]]) }
                                break

                                // CAN MAKE RANDOM THE CHOICE
                            } 
                        }
                        if(stuck) break
                    }
                    
                    //S'il est pas stuck on lui applique un Brownian Motion
                    if (!stuck){
                        const [dx, dy] = directions[Math.floor(rng() * directions.length)]
                        x+=dx
                        y+=dy
                    }
                    
                }else {
                    //S'il s'éloigne on recrée un point
                    let point=pointsFree[Math.floor(rng() * pointsFree.length)]
                    x=point[0]
                    y=point[1]
                }
            }while(!stuck)

            //Remove from Free
            pointsFree.splice(pointsFree.findIndex(item => item[0] === x && item[1] === y),1)[0]
            //Add to Stuck
            pointsStuck.push([x,y])

            tabDetails[x][y]=1
        }

        if (step>1){
            let size=(centerDistance*2+1)*2**(step-1)

            //ADD HEIGHT TO CRISP
            let heightTab=[]
            let explore=[centerPoint]
            do{
                heightTab.push(explore)
                let newExplore=[]
                for (let e of explore){
                    const key=JSON.stringify(e)
                    if (structure.has(key)) newExplore=newExplore.concat(structure.get(key))
                }
                explore=newExplore
            }while(explore.length)

            let heightMap=new Map()
            let maximumHeight=0
            for (let h of heightTab.toReversed()){
                for (let e of h){
                    const key=JSON.stringify(e)
                    if (structure.has(key)){
                        let maxH=1
                        for (let c of structure.get(key)){
                            let H=heightMap.get(JSON.stringify(c))
                            if (H>maxH) maxH=H
                        }
                        heightMap.set(key,maxH+1)
                        if (maxH+1>maximumHeight) maximumHeight=maxH+1
                    }else{
                        heightMap.set(key,1)
                    }
                }
            }

            //MERGE CRISP AND BLUR
            maxHeight=0
            tabMerge=[]
            for (let x=0;x<size;x++){
                let col=[]
                for (let y=0;y<size;y++){
                    let isStuck=false
                    for (let [sx,sy] of pointsStuck){
                        if (sx===x && sy===y) isStuck=true
                    }

                    let value=tabBlur[x][y]
                    if (isStuck) value+=1-1/(1+heightMap.get(JSON.stringify([x,y]))/maximumHeight*3)
                    
                    if (value>maxHeight){
                        maxHeight=value
                    }

                    col.push(value)
                }
                tabMerge.push(col)
            }
        }else{
            tabMerge=tabDetails
        }

        //SCALE UP
        tabBlur=ScaleUpBlur(tabMerge)
        let scaleUpCrisp=ScaleUpCrisp(centerPoint,structure,rng)
        centerPoint=scaleUpCrisp[0]
        structure=scaleUpCrisp[1]
        pointsStuck=scaleUpCrisp[2]
        pointsFree=[]
        let size=(centerDistance*2+1)*2**step
        for (let x=1;x<size-1;x++){
            for (let y=1;y<size-1;y++){
                if (!isInList([x,y],pointsStuck)) pointsFree.push([x,y])
            }
        }

        console.log(pointsFree)
        console.log(pointsStuck)

        oldTabDetails=tabDetails

        tabDetails=[]
        for (let x=0;x<size;x++){
            let col=[]
            for (let y=0;y<size;y++){
                if (isInList([x,y],pointsStuck)){
                    col.push(1)
                }else{
                    col.push(0)
                }
            }
            tabDetails.push(col)
        }

    }

    return [
        (x,y)=>{
            //return oldTabDetails[x][y]
            //return tabMerge[x][y]/maxHeight
            return tabBlur[x][y]/maxHeight
        },
        tabBlur,
        maxHeight
    ]
}


// Canvas Warp
let size=[document.getElementById("blendImg").width,document.getElementById("blendImg").height]
let canvasWarp=document.getElementById("canvasWarp");
let numberIteration=3
let dlaSize=(2**(numberIteration))*7
canvasWarp.width=dlaSize*16
canvasWarp.height=dlaSize*16
const ctxTest = canvasWarp.getContext("2d");
ctxTest.imageSmoothingEnabled = false
ctxTest.drawImage(document.getElementById("blendMask"),0,0)
let maskImageData=ctxTest.getImageData(0,0,size[0],size[1])
ctxTest.drawImage(document.getElementById("grasslandTexture"),0,0)
let grasslandTexture=ctxTest.getImageData(0,0,size[0],size[1])
ctxTest.drawImage(document.getElementById("sandTexture"),0,0)
let sandTexture=ctxTest.getImageData(0,0,size[0],size[1])
ctxTest.drawImage(document.getElementById("oceanTexture"),0,0)
let oceanTexture=ctxTest.getImageData(0,0,size[0],size[1])
ctxTest.drawImage(document.getElementById("blendImg"),0,0)
let refImageData=ctxTest.getImageData(0,0,size[0],size[1])


//DLA

let DLASeed="1786110195696"
//1786034241025 / 1786034324050 / 1786034347718 / 1786110195696 / 1786116084034
console.log("DLA Seed",DLASeed)
let rngDLA = new Math.seedrandom(DLASeed)
let [dlaTrick,dlaTab,dlaHeight] = createDLATrick(rngDLA,numberIteration,10)

dlaTab=ScaleUpBlur(dlaTab)
dlaTab=ScaleUpBlur(dlaTab)
dlaTab=ScaleUpBlur(dlaTab)
dlaTab=ScaleUpBlur(dlaTab)

let cfgDLA={
    scale:0.01,
    warpOctaves:3,
    warpLacunarity:2,
    warpPersistence:0.5,
    warpStrength:20,
    masked:false,
    centralized:false,
    debugCircle:false,
    clampPixel:false,
    colorReplace:[0,255,0,0]
}
warpDLA=new Warper(cfgDLA)

let dlaTexture = ctxTest.createImageData(dlaTab.length,dlaTab.length)
let dlaTextureColor=ctxTest.createImageData(dlaTab.length,dlaTab.length)

let textureMountain=ctxTest.createImageData(dlaTab.length,dlaTab.length)

let cfgMountain1={
    scale:0.005,
    octaves:3,
    ridged:false,
    inversed:false,
    warp:false,
    colorised:false,
    centralized:false,
    circleDistance:300,
}
let noiseMountain1 = new PerlinNoise("mountain texture1",cfgMountain1)
const resultMountain1=noiseMountain1.createPerlinNoise(0,dlaTab.length,0,dlaTab.length)

let cfgMountain2={
    scale:0.05,
    octaves:3,
    ridged:false,
    inversed:false,
    warp:false,
    colorised:false,
    centralized:false,
    circleDistance:300,
}
let noiseMountain2 = new PerlinNoise("mountain texture2",cfgMountain2)
const resultMountain2=noiseMountain2.createPerlinNoise(0,dlaTab.length,0,dlaTab.length)

function ValueRamp(v,p1,p2,v1,v2){
    if (v<p1) return v1
    else if (v>p2) return v2
    else return (v-p1)/(p2-p1)
}

function darken(c1,c2){
    return [Math.min(c1[0],c2[0]),Math.min(c1[1],c2[1]),Math.min(c1[2],c2[2])]
}

function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  return [parseInt(cleanHex.substring(0, 2), 16), parseInt(cleanHex.substring(2, 4), 16), parseInt(cleanHex.substring(4, 6), 16)];
}

let c1=hexToRgb("#948077")//"#948077" "#68605d"
let c2=hexToRgb("#c09f90")//"#c09f90" "#948077"

for (let x=0;x<dlaTab.length;x++){
    for (let y=0;y<dlaTab.length;y++){
        let v1=resultMountain1[0][x][y]
        let color1=lerpRGB(c1,c2,ValueRamp(v1,0.45,0.65,0,1))
        
        let v2=resultMountain2[0][x][y]
        let color2=lerpRGB(c1,c2,ValueRamp(v2,0.4,0.6,0,1))

        let factor=0.8
        setPixel(textureMountain,x,y,lerpRGB(color1,darken(color1,color2),factor))
    }
}

textureMountain=warpDLA.softenImage(textureMountain)
textureMountain=warpDLA.softenImage(textureMountain)

for (let x=0;x<dlaTab.length;x++){
    for (let y=0;y<dlaTab.length;y++){
        let v=dlaTab[x][y]/dlaHeight
        let color=[v*255,v*255,v*255]
        setPixel(dlaTexture,x,y,color)

        let baseColor
        let factor=1
        let alpha=1
        if (v<0.05){
            // let firstColor=[79, 139, 58]
            // let secondColor=[63, 111, 47]//[148,128,119]
            // baseColor=lerpRGB(firstColor,secondColor,v/0.05)
            baseColor=[148,128,119]//[0,255,0]//[148,128,119]
            factor=0.5
            alpha=v/0.05
        }else if(v<0.5){
            baseColor=getPixel(textureMountain,x,y)//[255,0,0]//[148,128,119]
            factor=(v-0.05)/0.4*0.5+0.5
        }else{
            baseColor=[242, 246, 251]//[0,0,255]
            factor=(v-0.5)/0.5*0.2+0.8
        }
        let colorTexture=[baseColor[0]*factor,baseColor[1]*factor,baseColor[2]*factor]
        
        setPixel(dlaTextureColor,x,y,colorTexture,alpha*255)
    }
}

dlaTextureColor=warpDLA.warpImage(dlaTextureColor)

ctxTest.putImageData(textureMountain,0,0)

create3DTexture(dlaTexture,dlaTextureColor,dlaTab,(dataURL)=>{
    const text = PIXI.Texture.from(dataURL)

    let mountain=new PIXI.Sprite(text)
    map.addChild(mountain)

    let tileMo=getTileFromCoord([51,52])

    mountain.width=15
    mountain.height=15
    mountain.x=tileMo.x-mountain.width/2
    mountain.y=tileMo.y-mountain.height/2

    mountain.eventMode='none'
    
})


grasslandTexture = ctxTest.createImageData(529,529)
sandTexture = ctxTest.createImageData(529,529)

let seed="Grassland"
let cfgGrass={
    scale:0.005,
    octaves:3,
    ridged:false,
    inversed:false,
    warp:false,
    colorised:false,
    centralized:false,
    circleDistance:300,
}
let noiseGrassland = new PerlinNoise(seed,cfgGrass)
const resultGrassland=noiseGrassland.createPerlinNoise(0,800,0,800)

seed="Sand"
cfg={
    scale:0.005,
    octaves:3,
    ridged:true,
    inversed:true,
    warp:true,
    colorised:false,
    centralized:false,
    circleDistance:300,
}
let noiseSand = new PerlinNoise(seed,cfg)
const resultSand=noiseSand.createPerlinNoise(0,800,0,800)

for (let x=0;x<grasslandTexture.width;x++){
    for (let y=0;y<grasslandTexture.height;y++){
        let v=Math.floor(resultGrassland[0][x][y]*10)/10*255
        setPixel(grasslandTexture,x,y,[v,v,v])
        setPixel(sandTexture,x,y,lerpRGB([243, 193, 124],[222, 165, 96],resultSand[0][x][y]))
    }
}


let rgbMask
let config={
    scale:0.5,
    warpOctaves:3,
    warpLacunarity:2,
    warpPersistence:0.5,
    warpStrength:20,
    masked:false,
    centralized:false,
    innerCircleDistance:200,
    outerCircleDistance:240,
    debugCircle:false,
}
warp1=new Warper({masked:false,warpStrength:20})
warp2=new Warper(config)
warp3=new Warper({masked:true,cutOut:true})
rgbMask=warp1.warpImage(refImageData,maskImageData)
rgbMask=warp2.warpImage(rgbMask,maskImageData)

let tile=ctxTest.createImageData(refImageData.width,refImageData.height)
tile=warp3.putTextureAtChannel(tile,rgbMask,sandTexture,'R')
tile=warp3.putTextureAtChannel(tile,rgbMask,sandTexture,'G')
tile=warp3.putTextureAtChannel(tile,rgbMask,grasslandTexture,'B')
//tile=warp3.softenImage(tile,maskImageData)


let rng = new Math.seedrandom("test")
let rngColor = new Math.seedrandom("color")
let ite=0

let f=()=>{
    ite++
    if (ite>5) clearInterval(idInterval)
    //distanceEucl,distanceManhattan,distanceChebyshev,distanceMinkowski,distanceMinkowskiChebyshev,distanceCanberra,distanceAnisotropic,distanceSquaredEucl,distanceHybrid

    let cn = createCellularNoise(rng,[529,529],200,30,true,false,false,3,distanceEucl)

    let voronoiColors=new Map()
    for (let c=1;c<500+1;c++){
        let r=Math.round(rngColor()*255)
        let g=Math.round(rngColor()*255)
        let b=Math.round(rngColor()*255)
        voronoiColors.set(c/500,[r,g,b])
    }
    console.log(voronoiColors)

    let celullarNoise = ctxTest.createImageData(529,529)

    for (let x=0;x<celullarNoise.width;x++){
        for (let y=0;y<celullarNoise.height;y++){
            let v=cn(x,y)*255
            let color=[v,v,v]
            // if (v<5){
            //     color=[255,0,0]
            // }
            setPixel(celullarNoise,x,y,color)
        }
    }

    ctxTest.putImageData(celullarNoise,0,0)
}

//let idInterval=setInterval(f,1000)



