/**
 * 洞窟空间结构模块（低模拼接版 - 左侧隔断墙体已删除）
 * 修复：删除所有展厅左侧竖向隔断墙体，彻底消除壁画遮挡问题
 * 保证游客WASD向前漫游时，左侧视野无实体遮挡，壁画、造像完整露出
 * 保留洞窟空间包裹感，仅删除左侧隔断墙体，维持洞窟纵深感
 */
import * as THREE from 'three'
import { getDunhuangPalette } from './materials.js'

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
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.3, 2.5),
      new THREE.MeshStandardMaterial({
        color: palette.darkGold,
        roughness: 0.6,
        metalness: 0.15,
        envMapIntensity: 0.3,
      })
    )
    pedestal.position.set(caveX + CAVE_DEPTH - 1.5, 0.15, cave.z)
    pedestal.receiveShadow = true
    pedestal.castShadow = true
    pedestal.name = '主尊佛龛基座'
    parent.add(pedestal)

    const haloGeometry = new THREE.TorusGeometry(1.2, 0.05, 8, 32)
    const haloMaterial = new THREE.MeshStandardMaterial({
      color: palette.gold,
      roughness: 0.4,
      metalness: 0.3,
      envMapIntensity: 0.5,
      emissive: 0x4a3814,
      emissiveIntensity: 0.15,
    })
    const halo = new THREE.Mesh(haloGeometry, haloMaterial)
    halo.position.set(caveX + CAVE_DEPTH - 1.5, 2.0, cave.z)
    halo.name = '主尊背光'
    parent.add(halo)
  }

  // === 两侧造像基座（错落排布）===
  // 左侧造像基座：位置略前，z轴正方向（靠近后墙左侧）
  const leftPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.2, 1.2),
    wallMaterial  // 复用墙体材质，减少材质实例
  )
  leftPedestal.position.set(caveX + CAVE_DEPTH / 2 - 0.5, 0.1, cave.z + 1.5)
  leftPedestal.receiveShadow = true
  leftPedestal.castShadow = false
  leftPedestal.name = cave.name + '左侧造像基座'
  parent.add(leftPedestal)

  // 右侧造像基座：位置略后，z轴负方向
  const rightPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.2, 1.2),
    wallMaterial  // 复用墙体材质
  )
  rightPedestal.position.set(caveX + CAVE_DEPTH / 2 + 0.8, 0.1, cave.z - CAVE_WIDTH / 2 + 1)
  rightPedestal.receiveShadow = true
  rightPedestal.castShadow = false
  rightPedestal.name = cave.name + '右侧造像基座'
  parent.add(rightPedestal)

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
