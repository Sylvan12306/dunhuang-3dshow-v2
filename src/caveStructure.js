/**
 * 洞窟空间结构模块（低模拼接版 - 左侧隔断墙体已删除）
 * 修复：删除所有展厅左侧竖向隔断墙体，彻底消除壁画遮挡问题
 * 保证游客WASD向前漫游时，左侧视野无实体遮挡，壁画、造像完整露出
 * 保留洞窟空间包裹感，仅删除左侧隔断墙体，维持洞窟纵深感
 */
import * as THREE from 'three'
import { getDunhuangPalette } from './materials.js'

const BASE_URL = import.meta.env.BASE_URL
const textureLoader = new THREE.TextureLoader()

// 洞窟位置数据（匹配 controls.js 中的 CAVE_POSITIONS）
const CAVE_POSITIONS = [
  { x: 8,  y: 0, z: 1.6, name: '285窟', dynasty: '西魏' },
  { x: 15, y: 0, z: 1.6, name: '45窟',  dynasty: '盛唐' },
  { x: 22, y: 0, z: 1.6, name: '217窟', dynasty: '盛唐' },
  { x: 29, y: 0, z: 1.6, name: '17窟',  dynasty: '晚唐' },
  { x: 36, y: 0, z: 1.6, name: '3窟',   dynasty: '元代' },
]

const CAVE_DEPTH = 8       // 洞窟纵深
const CAVE_WIDTH = 6       // 洞窟宽度
const CAVE_HEIGHT = 4.5    // 洞窟高度
const WALL_THICKNESS = 0.3 // 墙体厚度

/**
 * 构建洞窟空间结构
 * @param {THREE.Scene} scene - Three.js 场景
 * @returns {THREE.Group} 洞窟结构组
 */
export function buildCaveStructure(scene) {
  const palette = getDunhuangPalette()
  const caveGroup = new THREE.Group()
  caveGroup.name = '洞窟结构组'

  // === 材质定义（统一材质实例，减少WebGL绘制批次）===
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: palette.caveWall,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.15,
    emissive: 0x1a1410,
    emissiveIntensity: 0.06,
  })

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: palette.caveFloor,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.05,
    emissive: 0x1a1410,
    emissiveIntensity: 0.04,
  })

  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2e22,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.08,
    emissive: 0x1a1410,
    emissiveIntensity: 0.04,
  })

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: palette.darkGold,
    roughness: 0.45,
    metalness: 0.2,
    envMapIntensity: 0.4,
  })

  // === 1. 主走廊地面（中轴线参观步道）===
  const corridorLength = 45
  const corridorWidth = 3.5
  const corridorFloor = new THREE.Mesh(
    new THREE.BoxGeometry(corridorLength, 0.1, corridorWidth),
    floorMaterial
  )
  corridorFloor.position.set(22.5, -0.05, 1.6)
  corridorFloor.receiveShadow = true
  corridorFloor.name = '走廊地面'
  caveGroup.add(corridorFloor)

  // === 2. 仅保留右侧低矮导览墙（左侧删除，避免遮挡壁画和造像）===
  // 右侧导览墙（z轴负方向，不遮挡观赏视野）
  const guideWallHeight = 1.0  // 降低高度，减少视觉干扰
  const guideWallLength = corridorLength
  const rightGuideWall = new THREE.Mesh(
    new THREE.BoxGeometry(guideWallLength, guideWallHeight, WALL_THICKNESS),
    new THREE.MeshStandardMaterial({
      color: 0x4a3e2e,
      roughness: 0.88,
      metalness: 0.0,
      transparent: true,
      opacity: 0.6,           // 降低透明度，弱化视觉存在感
      envMapIntensity: 0.15,
      emissive: 0x1a1410,
      emissiveIntensity: 0.04,
    })
  )
  rightGuideWall.position.set(22.5, guideWallHeight / 2, 1.6 - corridorWidth / 2)
  rightGuideWall.receiveShadow = true
  rightGuideWall.castShadow = false  // 导览墙不投射阴影，减少阴影计算
  rightGuideWall.name = '右侧导览墙'
  caveGroup.add(rightGuideWall)

  // === 3. 走廊顶棚（洞窟纵深感）===
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(corridorLength, 0.2, corridorWidth + 1),
    ceilingMaterial
  )
  ceiling.position.set(22.5, CAVE_HEIGHT, 1.6)
  ceiling.receiveShadow = true
  ceiling.castShadow = false  // 顶棚不投射阴影
  ceiling.name = '走廊顶棚'
  caveGroup.add(ceiling)

  // === 4. 每个洞窟的独立空间结构 ===
  CAVE_POSITIONS.forEach((cave, index) => {
    buildSingleCave(caveGroup, cave, index, {
      wallMaterial,
      floorMaterial,
      ceilingMaterial,
      frameMaterial,
      palette,
    })
  })

  // === 5. 入口墙体（起点）===
  const entranceWall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, CAVE_HEIGHT, corridorWidth + 2),
    wallMaterial
  )
  entranceWall.position.set(2, CAVE_HEIGHT / 2, 1.6)
  entranceWall.receiveShadow = true
  entranceWall.castShadow = false
  entranceWall.name = '入口墙体'
  caveGroup.add(entranceWall)

  // 入口门框
  const doorFrameTop = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS + 0.1, 0.3, corridorWidth - 1),
    frameMaterial
  )
  doorFrameTop.position.set(2, 2.2, 1.6)
  doorFrameTop.name = '入口门框'
  caveGroup.add(doorFrameTop)

  // === 6. 终点观景墙 ===
  const endWall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, CAVE_HEIGHT, corridorWidth + 2),
    wallMaterial
  )
  endWall.position.set(43, CAVE_HEIGHT / 2, 1.6)
  endWall.receiveShadow = true
  endWall.castShadow = false
  endWall.name = '终点观景墙'
  caveGroup.add(endWall)

  // 终点观景平台
  const viewingPlatform = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.15, corridorWidth),
    floorMaterial
  )
  viewingPlatform.position.set(42, 0.075, 1.6)
  viewingPlatform.receiveShadow = true
  viewingPlatform.name = '终点观景平台'
  caveGroup.add(viewingPlatform)

  // === 7. 边界墙（仅保留右侧边界墙）===
  // 右边界墙
  const rightBoundaryWall = new THREE.Mesh(
    new THREE.BoxGeometry(corridorLength, CAVE_HEIGHT, WALL_THICKNESS),
    wallMaterial
  )
  rightBoundaryWall.position.set(22.5, CAVE_HEIGHT / 2, 1.6 - CAVE_WIDTH / 2)
  rightBoundaryWall.receiveShadow = true
  rightBoundaryWall.castShadow = false
  rightBoundaryWall.name = '右边界墙'
  caveGroup.add(rightBoundaryWall)

  scene.add(caveGroup)
  console.log('[洞窟结构] 空间结构构建完成（左侧隔断墙体已删除，壁画无遮挡）')
  return caveGroup
}

/**
 * 构建单个洞窟空间结构
 * 修复：删除左墙，彻底消除壁画遮挡；壁画框统一放在右墙内侧（游客面向方向）
 */
function buildSingleCave(parent, cave, index, materials) {
  const { wallMaterial, floorMaterial, frameMaterial, palette } = materials
  const caveX = cave.x
  const isMainCave = index === 1

  // 洞窟地面
  const caveFloor = new THREE.Mesh(
    new THREE.BoxGeometry(CAVE_DEPTH, 0.1, CAVE_WIDTH),
    floorMaterial
  )
  caveFloor.position.set(caveX + CAVE_DEPTH / 2, -0.05, cave.z)
  caveFloor.receiveShadow = true
  caveFloor.name = cave.name + '地面'
  parent.add(caveFloor)

  // 洞窟后墙（佛龛背景墙）
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, CAVE_HEIGHT, CAVE_WIDTH),
    wallMaterial
  )
  backWall.position.set(caveX + CAVE_DEPTH, CAVE_HEIGHT / 2, cave.z)
  backWall.receiveShadow = true
  backWall.castShadow = false
  backWall.name = cave.name + '后墙'
  parent.add(backWall)

  // 洞窟右墙：保持在原位（z轴负方向，不遮挡观赏视野）
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(CAVE_DEPTH, CAVE_HEIGHT, WALL_THICKNESS),
    wallMaterial
  )
  rightWall.position.set(caveX + CAVE_DEPTH / 2, CAVE_HEIGHT / 2, cave.z - CAVE_WIDTH / 2)
  rightWall.receiveShadow = true
  rightWall.castShadow = false
  rightWall.name = cave.name + '右墙'
  parent.add(rightWall)

  // 洞窟顶棚
  const caveCeiling = new THREE.Mesh(
    new THREE.BoxGeometry(CAVE_DEPTH, 0.2, CAVE_WIDTH),
    materials.ceilingMaterial
  )
  caveCeiling.position.set(caveX + CAVE_DEPTH / 2, CAVE_HEIGHT, cave.z)
  caveCeiling.receiveShadow = true
  caveCeiling.castShadow = false
  caveCeiling.name = cave.name + '顶棚'
  parent.add(caveCeiling)

  // === 壁画画框（统一放在右墙内侧，游客面向方向，不被遮挡）===
  // 右壁画框（z轴负方向墙面上，朝向洞窟内部）
  const muralFrameR = createMuralFrame(frameMaterial, palette)
  muralFrameR.position.set(caveX + CAVE_DEPTH / 2, 2.0, cave.z - CAVE_WIDTH / 2 + 0.15)
  muralFrameR.name = cave.name + '右壁画框'
  parent.add(muralFrameR)

  // 左壁画框：放在后墙左侧（x轴正方向墙面上），朝向洞窟内部
  // 不再放在左墙上（左墙已推到视野外），改为放在后墙偏左位置
  const muralFrameL = createMuralFrame(frameMaterial, palette)
  muralFrameL.position.set(caveX + CAVE_DEPTH - 0.15, 2.0, cave.z + 1.5)
  muralFrameL.rotation.y = -Math.PI / 2  // 朝向洞窟内部（面向入口方向）
  muralFrameL.name = cave.name + '左壁画框'
  parent.add(muralFrameL)

  // === 中央主尊佛龛（45窟盛唐，第一视觉焦点）===
  if (isMainCave) {
    const mainPedestalX = caveX + CAVE_DEPTH - 1.5
    const mainPedestalZ = cave.z

    // a) 分层须弥座（3层递减方形台基）
    // 须弥座底层
    const xumiBaseMat = new THREE.MeshStandardMaterial({
      color: palette.darkGold,
      roughness: 0.5,
      metalness: 0.18,
      envMapIntensity: 0.35,
    })
    const xumiBottom = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.15, 3.0),
      xumiBaseMat
    )
    xumiBottom.position.set(mainPedestalX, 0.075, mainPedestalZ)
    xumiBottom.receiveShadow = true
    xumiBottom.castShadow = true
    xumiBottom.name = '须弥座底层'
    parent.add(xumiBottom)

    // 须弥座中层（深金色）
    const xumiMidMat = new THREE.MeshStandardMaterial({
      color: 0x8B7225,
      roughness: 0.48,
      metalness: 0.2,
      envMapIntensity: 0.38,
    })
    const xumiMiddle = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.15, 2.6),
      xumiMidMat
    )
    xumiMiddle.position.set(mainPedestalX, 0.075 + 0.15 + 0.02, mainPedestalZ)
    xumiMiddle.receiveShadow = true
    xumiMiddle.castShadow = true
    xumiMiddle.name = '须弥座中层'
    parent.add(xumiMiddle)

    // 须弥座上层（金色 + emissive）
    const xumiTopMat = new THREE.MeshStandardMaterial({
      color: palette.darkGold,
      roughness: 0.45,
      metalness: 0.22,
      envMapIntensity: 0.4,
      emissive: palette.gold,
      emissiveIntensity: 0.08,
    })
    const xumiTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.2, 2.2),
      xumiTopMat
    )
    xumiTop.position.set(mainPedestalX, 0.075 + 0.15 + 0.02 + 0.15 + 0.02, mainPedestalZ)
    xumiTop.receiveShadow = true
    xumiTop.castShadow = true
    xumiTop.name = '须弥座上层'
    parent.add(xumiTop)

    // b) 多层背光光环
    const haloX = mainPedestalX
    const haloY = 2.0
    const haloZ = mainPedestalZ

    // 内环：金色 emissive发光
    const innerHaloMat = new THREE.MeshStandardMaterial({
      color: palette.gold,
      roughness: 0.35,
      metalness: 0.35,
      envMapIntensity: 0.5,
      emissive: palette.gold,
      emissiveIntensity: 0.3,
    })
    const innerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.04, 16, 64),
      innerHaloMat
    )
    innerHalo.position.set(haloX, haloY, haloZ)
    innerHalo.name = '背光内环'
    parent.add(innerHalo)

    // 中环：暗金色
    const midHaloMat = new THREE.MeshStandardMaterial({
      color: palette.darkGold,
      roughness: 0.42,
      metalness: 0.28,
      envMapIntensity: 0.45,
      emissive: 0x4a3814,
      emissiveIntensity: 0.1,
    })
    const midHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.03, 16, 64),
      midHaloMat
    )
    midHalo.position.set(haloX, haloY, haloZ)
    midHalo.name = '背光中环'
    parent.add(midHalo)

    // 外环：微光金色
    const outerHaloMat = new THREE.MeshStandardMaterial({
      color: palette.darkGold,
      roughness: 0.5,
      metalness: 0.2,
      envMapIntensity: 0.4,
      emissive: palette.gold,
      emissiveIntensity: 0.05,
    })
    const outerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.02, 16, 64),
      outerHaloMat
    )
    outerHalo.position.set(haloX, haloY, haloZ)
    outerHalo.name = '背光外环'
    parent.add(outerHalo)

    // 最外层光晕：半透明金色发光
    const glowHaloMat = new THREE.MeshStandardMaterial({
      color: palette.gold,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.18,
      emissive: palette.gold,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const glowHalo = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.2, 64),
      glowHaloMat
    )
    glowHalo.position.set(haloX, haloY, haloZ)
    glowHalo.name = '背光光晕'
    parent.add(glowHalo)

    // c) 佛龛拱顶（半圆拱）
    const archMat = new THREE.MeshStandardMaterial({
      color: palette.darkGold,
      roughness: 0.45,
      metalness: 0.2,
      envMapIntensity: 0.4,
      emissive: palette.gold,
      emissiveIntensity: 0.06,
    })
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2.0, 0.3, 32, 1, false, 0, Math.PI),
      archMat
    )
    // 旋转使半圆拱面向洞窟入口（z轴正方向）
    arch.rotation.x = Math.PI / 2
    arch.rotation.z = Math.PI
    arch.position.set(mainPedestalX, 3.2, mainPedestalZ)
    arch.name = '佛龛拱顶'
    parent.add(arch)
  }

  // === 两侧造像基座（双层莲瓣基座，错落排布）===
  // 莲瓣基座材质（复用，减少draw call）
  const lotusBaseMat = new THREE.MeshStandardMaterial({
    color: palette.caveWall,
    roughness: 0.75,
    metalness: 0.05,
    envMapIntensity: 0.2,
  })
  const lotusTopMat = new THREE.MeshStandardMaterial({
    color: palette.darkGold,
    roughness: 0.5,
    metalness: 0.18,
    envMapIntensity: 0.35,
  })
  const lotusPetalMat = new THREE.MeshStandardMaterial({
    color: palette.darkGold,
    roughness: 0.55,
    metalness: 0.15,
    envMapIntensity: 0.3,
    emissive: 0x3a2e1e,
    emissiveIntensity: 0.05,
  })

  // 辅助函数：创建双层莲瓣基座
  const createLotusPedestal = (baseX, baseZ, namePrefix) => {
    const group = new THREE.Group()
    // 底层：土色圆柱
    const bottomLayer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.8, 0.1, 8),
      lotusBaseMat
    )
    bottomLayer.position.y = 0.05
    bottomLayer.receiveShadow = true
    group.add(bottomLayer)

    // 上层：深金色圆柱
    const topLayer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.12, 8),
      lotusTopMat
    )
    topLayer.position.y = 0.1 + 0.06
    topLayer.receiveShadow = true
    group.add(topLayer)

    // 8个莲瓣（扁球缩放后环绕上层排列）
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        lotusPetalMat
      )
      // 缩放为扁椭球，模拟莲瓣
      petal.scale.set(1, 0.4, 0.6)
      const px = Math.cos(angle) * 0.55
      const pz = Math.sin(angle) * 0.55
      petal.position.set(px, 0.1 + 0.02, pz)
      // 旋转使莲瓣朝外
      petal.rotation.y = -angle
      group.add(petal)
    }

    group.position.set(baseX, 0, baseZ)
    group.name = namePrefix
    parent.add(group)
  }

  // 左侧造像基座：位置略前，z轴正方向（靠近后墙左侧）
  createLotusPedestal(caveX + CAVE_DEPTH / 2 - 0.5, cave.z + 1.5, cave.name + '左侧莲瓣基座')

  // 右侧造像基座：位置略后，z轴负方向
  createLotusPedestal(caveX + CAVE_DEPTH / 2 + 0.8, cave.z - CAVE_WIDTH / 2 + 1, cave.name + '右侧莲瓣基座')

  // === 洞窟入口装饰楣 ===
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.12, CAVE_WIDTH + 0.2),
    frameMaterial  // 复用画框金色材质
  )
  lintel.position.set(caveX, 3.0, cave.z)
  lintel.name = cave.name + '入口装饰楣'
  parent.add(lintel)

  // === 洞窟标题文字Sprite（已删除，不再显示洞窟名称标签）===
  // 标题格式：朝代 + 窟号（如"西魏 285窟"、"盛唐 45窟"）
  // const titleText = cave.dynasty + ' ' + cave.name
  // const titleSprite = createCaveTitleSprite(titleText, cave, index)
  // titleSprite.visible = false
  // parent.add(titleSprite)

  // const caveNumber = cave.name.replace('窟', '')
  // caveTitleSprites[caveNumber] = titleSprite
}

/**
 * 创建壁画展陈画框（半嵌入墙面）
 */
function createMuralFrame(frameMaterial, palette) {
  const frameGroup = new THREE.Group()
  const frameWidth = 2.4
  const frameHeight = 1.6
  const frameDepth = 0.1
  const borderThickness = 0.12

  // 画框四边
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameWidth, borderThickness, frameDepth),
    frameMaterial
  )
  topFrame.position.set(0, frameHeight / 2 - borderThickness / 2, 0)
  frameGroup.add(topFrame)

  const bottomFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameWidth, borderThickness, frameDepth),
    frameMaterial
  )
  bottomFrame.position.set(0, -frameHeight / 2 + borderThickness / 2, 0)
  frameGroup.add(bottomFrame)

  const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(borderThickness, frameHeight, frameDepth),
    frameMaterial
  )
  leftFrame.position.set(-frameWidth / 2 + borderThickness / 2, 0, 0)
  frameGroup.add(leftFrame)

  const rightFrame = new THREE.Mesh(
    new THREE.BoxGeometry(borderThickness, frameHeight, frameDepth),
    frameMaterial
  )
  rightFrame.position.set(frameWidth / 2 - borderThickness / 2, 0, 0)
  frameGroup.add(rightFrame)

  // 画框背板
  const backboard = new THREE.Mesh(
    new THREE.PlaneGeometry(frameWidth - borderThickness * 2, frameHeight - borderThickness * 2),
    new THREE.MeshStandardMaterial({
      color: palette.muralBase,
      roughness: 0.85,
      metalness: 0.0,
      envMapIntensity: 0.2,
      emissive: 0x3a2e1e,
      emissiveIntensity: 0.18,
    })
  )
  backboard.position.set(0, 0, -frameDepth / 2 + 0.01)
  backboard.receiveShadow = true
  backboard.name = '壁画背板'
  frameGroup.add(backboard)

  return frameGroup
}

/**
 * 创建真实壁画纹理覆盖层
 * 使用TextureLoader加载真实纹理图片，覆盖程序化绘制的壁画
 * @param {number} caveX - 洞窟X坐标
 * @param {number} caveZ - 洞窟Z坐标
 * @param {string} side - 壁画位置 'right'(右墙) / 'left'(后墙偏左) / 'back'(后墙中央)
 * @param {string} textureUrl - 纹理图片URL
 * @param {string} nameKey - raycaster匹配的文物key
 * @returns {THREE.Mesh} 壁画覆盖层mesh
 */
function createRealMuralOverlay(caveX, caveZ, side, textureUrl, nameKey) {
  const texture = textureLoader.load(textureUrl)
  texture.colorSpace = THREE.SRGBColorSpace

  const geometry = new THREE.PlaneGeometry(4.5, 3.5)
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.0,
    emissive: 0x3a2e1e,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  const mesh = new THREE.Mesh(geometry, material)

  // 根据墙面位置设置坐标和旋转
  if (side === 'right') {
    // 右墙: z轴负方向墙面，朝向洞窟内部
    mesh.position.set(caveX + CAVE_DEPTH / 2, 2.2, caveZ - CAVE_WIDTH / 2 + 0.16)
    mesh.rotation.y = Math.PI / 2
  } else if (side === 'left') {
    // 后墙偏左（左壁画框位置）: x轴正方向墙面，朝向洞窟内部
    mesh.position.set(caveX + CAVE_DEPTH - 0.16, 2.2, caveZ + 1.5)
    mesh.rotation.y = -Math.PI / 2
  } else if (side === 'back') {
    // 后墙中央: x轴正方向墙面，朝向洞窟内部
    mesh.position.set(caveX + CAVE_DEPTH - 0.16, 2.2, caveZ)
    mesh.rotation.y = -Math.PI / 2
  }

  mesh.name = nameKey
  mesh.castShadow = false
  mesh.receiveShadow = true

  return mesh
}

/**
 * 创建所有洞窟的真实壁画纹理覆盖层
 * 为5个洞窟的左右墙分别创建真实纹理覆盖
 * @returns {THREE.Mesh[]} 覆盖层mesh数组
 */
export function createAllMuralOverlays() {
  const overlays = []

  // 壁画配置: [caveIndex, side, textureFile, nameKey]
  const muralConfig = [
    // 285窟（西魏）
    { caveIdx: 0, side: 'right', tex: 'mural_285_right.png', key: '285_右墙_伎乐' },
    { caveIdx: 0, side: 'left',  tex: 'mural_285_left.png',  key: '285_左墙_飞天' },
    // 45窟（盛唐）
    { caveIdx: 1, side: 'right', tex: 'mural_45_right.png', key: '45_右墙_市井' },
    { caveIdx: 1, side: 'left',  tex: 'mural_45_left.png',  key: '45_左墙_供养人' },
    // 217窟（盛唐）
    { caveIdx: 2, side: 'right', tex: 'mural_217_right.png', key: '217_右墙_藻井' },
    { caveIdx: 2, side: 'left',  tex: 'mural_217_left.png',  key: '217_左墙_供养人' },
    // 17窟（晚唐）
    { caveIdx: 3, side: 'right', tex: 'mural_17_right.png', key: '17_右墙_绢画' },
    { caveIdx: 3, side: 'left',  tex: 'mural_17_left.png',  key: '17_左墙_绢画' },
    // 3窟（元代）- 右墙使用mural_3_right.png，与createYuanDynastyMuralOverlay共享纹理
    { caveIdx: 4, side: 'left',  tex: 'mural_3_left.png',   key: '3_左墙_密宗供养' },
  ]

  muralConfig.forEach(({ caveIdx, side, tex, key }) => {
    const cave = CAVE_POSITIONS[caveIdx]
    const textureUrl = BASE_URL + 'textures/' + tex
    const overlay = createRealMuralOverlay(cave.x, cave.z, side, textureUrl, key)
    overlays.push(overlay)
  })

  console.log('[洞窟结构] 已创建 ' + overlays.length + ' 个真实壁画纹理覆盖层')
  return overlays
}

/**
 * 创建元代3窟右墙密宗壁画覆盖层
 * 覆盖GLB模型中唐代风格的右墙壁画，替换为元代密宗壁画
 * 关键：z位置必须在原始壁画前方（更靠近洞窟中心），才能在视觉和射线检测中覆盖
 */
export function createYuanDynastyMuralOverlay() {
  const textureUrl = BASE_URL + 'textures/mural_3_right.png'
  const texture = textureLoader.load(textureUrl)
  texture.colorSpace = THREE.SRGBColorSpace

  const geometry = new THREE.PlaneGeometry(4.2, 3.2)
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0.0,
    emissive: 0x3a2e1e,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,   // 确保覆盖层在深度测试中优先于原始壁画
    polygonOffsetUnits: -1,
  })

  const mesh = new THREE.Mesh(geometry, material)
  // 3窟: caveX=36, CAVE_DEPTH=8, cave.z=1.6, CAVE_WIDTH=6
  // 右墙位置: z = 1.6 - 3 = -1.4
  // 覆盖层必须在原始壁画前方: z = -1.0（比原始壁画更靠内0.4米）
  // 右上侧壁画覆盖: x偏向后墙(x≈40), y偏上方(y≈2.5)
  mesh.position.set(40, 2.5, -1.0)
  mesh.name = '3_右墙_密宗主尊'
  mesh.castShadow = false
  mesh.receiveShadow = true

  console.log('[洞窟结构] 元代3窟右墙密宗壁画覆盖层已创建（使用真实纹理，z=-1.0，优先深度测试）')
  return mesh
}



/**
 * 获取洞窟位置数据
 */
export function getCaveStructurePositions() {
  return CAVE_POSITIONS
}

// 全局洞窟标题Sprite引用（用于场景切换时控制可见性）
const caveTitleSprites = {}

/**
 * 创建洞窟标题文字Sprite（已禁用，不再创建洞窟标题）
 * 根因修复：所有洞窟标题文字已删除，函数保留仅作向后兼容，直接返回 null
 * @param {string} text - 标题文字
 * @param {Object} cave - 洞窟位置数据
 * @param {number} index - 洞窟索引
 * @returns {null} 始终返回 null
 */
function createCaveTitleSprite(text, cave, index) {
  console.log('[洞窟结构] createCaveTitleSprite 已禁用，不创建标题:', text)
  return null
}

/**
 * 更新洞窟标题可见性（根据当前洞窟编号）
 * 仅显示当前所在洞窟的标题，隐藏其他洞窟标题
 * @param {string} caveNumber - 当前洞窟编号（'285', '45', '217', '17', '3'）
 */
export function updateCaveTitleVisibility(caveNumber) {
  const caveIndexMap = { '285': 0, '45': 1, '217': 2, '17': 3, '3': 4 }
  const activeIndex = caveIndexMap[caveNumber]

  Object.keys(caveTitleSprites).forEach(key => {
    const sprite = caveTitleSprites[key]
    if (sprite) {
      sprite.visible = (key === caveNumber)
    }
  })
}
