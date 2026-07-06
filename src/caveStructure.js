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
 * 创建元代3窟右墙密宗壁画覆盖层
 * 覆盖GLB模型中唐代风格的右墙壁画，替换为元代密宗壁画
 * 位置：3窟右墙内侧（z≈-1.24），面朝洞窟内部
 */
export function createYuanDynastyMuralOverlay() {
  const texture = createYuanDynastyMuralTexture()

  const geometry = new THREE.PlaneGeometry(3.8, 2.6)
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0.0,
    emissive: 0x3a2e1e,
    emissiveIntensity: 0.18,
    side: THREE.FrontSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  // 3窟: caveX=36, CAVE_DEPTH=8, cave.z=1.6, CAVE_WIDTH=6
  // 右墙内侧: z = 1.6 - 3 + 0.16 = -1.24
  // 右上侧壁画: x偏向后墙(x≈41), y偏上方(y≈2.8)
  mesh.position.set(41, 2.8, -1.24)
  mesh.name = '3_右墙_密宗主尊'
  mesh.castShadow = false
  mesh.receiveShadow = true

  console.log('[洞窟结构] 元代3窟右墙密宗壁画覆盖层已创建')
  return mesh
}

/**
 * 创建元代密宗壁画纹理（程序化Canvas绘制）
 * 以千手千眼观音为核心，融合密宗曼荼罗、莲台、五佛冠等元素
 * 色彩体系：石绿、朱砂、土黄、金色 —— 元代敦煌壁画典型矿物颜料
 */
function createYuanDynastyMuralTexture() {
  const W = 512, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // === 背景：土黄底色 + 龟裂纹理模拟古壁 ===
  ctx.fillStyle = '#2a1f14'
  ctx.fillRect(0, 0, W, H)

  // 龟裂纹理
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    ctx.fillStyle = `rgba(${160 + Math.random()*40}, ${130 + Math.random()*30}, ${80 + Math.random()*30}, ${Math.random() * 0.08})`
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1)
  }

  // 细裂纹
  ctx.strokeStyle = 'rgba(80, 60, 30, 0.12)'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 30; i++) {
    ctx.beginPath()
    let sx = Math.random() * W, sy = Math.random() * H
    ctx.moveTo(sx, sy)
    for (let j = 0; j < 5; j++) {
      sx += (Math.random() - 0.5) * 60
      sy += (Math.random() - 0.5) * 40
      ctx.lineTo(sx, sy)
    }
    ctx.stroke()
  }

  // === 边框：金色 + 朱砂双层边框（密宗唐卡风格）===
  const bw = 20
  // 外框 - 金色
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 3
  ctx.strokeRect(bw, bw, W - bw * 2, H - bw * 2)
  // 内框 - 朱砂
  ctx.strokeStyle = '#C04851'
  ctx.lineWidth = 2
  ctx.strokeRect(bw + 8, bw + 8, W - (bw + 8) * 2, H - (bw + 8) * 2)

  // 边框角花（密宗几何纹样）
  const corners = [[bw+4, bw+4], [W-bw-4, bw+4], [bw+4, H-bw-4], [W-bw-4, H-bw-4]]
  corners.forEach(([cx, cy]) => {
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#D4AF37'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#C04851'
    ctx.fill()
  })

  // === 曼荼罗外环 ===
  const cx = W / 2, cy = H / 2 - 10

  // 外层光晕
  const outerGlow = ctx.createRadialGradient(cx, cy, 80, cx, cy, 160)
  outerGlow.addColorStop(0, 'rgba(58, 125, 92, 0.08)')
  outerGlow.addColorStop(1, 'rgba(58, 125, 92, 0)')
  ctx.fillStyle = outerGlow
  ctx.beginPath()
  ctx.arc(cx, cy, 160, 0, Math.PI * 2)
  ctx.fill()

  // 外环
  ctx.beginPath()
  ctx.arc(cx, cy, 140, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 中环
  ctx.beginPath()
  ctx.arc(cx, cy, 110, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(58, 125, 92, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 内环
  ctx.beginPath()
  ctx.arc(cx, cy, 85, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(192, 72, 81, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  // === 千手观音 - 放射状手臂 ===
  const armCount = 36
  for (let i = 0; i < armCount; i++) {
    const angle = (i / armCount) * Math.PI * 2 - Math.PI / 2
    const armLen = 95 + Math.sin(i * 0.7) * 20
    const endX = cx + Math.cos(angle) * armLen
    const endY = cy + Math.sin(angle) * armLen

    // 手臂线条（铁线描风格）
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * 22, cy + Math.sin(angle) * 22)
    ctx.lineTo(endX, endY)
    const green = 58 + Math.floor(Math.random() * 40)
    ctx.strokeStyle = `rgba(${green}, ${125 + Math.floor(Math.random()*30)}, ${92 + Math.floor(Math.random()*20)}, ${0.5 + Math.random()*0.3})`
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 手掌（圆形 + 眼睛）
    ctx.beginPath()
    ctx.arc(endX, endY, 5, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(201, 168, 76, ${0.6 + Math.random()*0.3})`
    ctx.fill()
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)'
    ctx.lineWidth = 0.8
    ctx.stroke()

    // 眼睛（手心眼）
    ctx.beginPath()
    ctx.arc(endX, endY, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#C04851'
    ctx.fill()
  }

  // === 主尊身体 ===
  // 身光（椭圆形背光）
  ctx.beginPath()
  ctx.ellipse(cx, cy, 35, 50, 0, 0, Math.PI * 2)
  const bodyGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 50)
  bodyGlow.addColorStop(0, 'rgba(58, 125, 92, 0.5)')
  bodyGlow.addColorStop(0.7, 'rgba(58, 125, 92, 0.2)')
  bodyGlow.addColorStop(1, 'rgba(58, 125, 92, 0)')
  ctx.fillStyle = bodyGlow
  ctx.fill()

  // 身体
  ctx.beginPath()
  ctx.ellipse(cx, cy, 18, 35, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#3A7D5C'
  ctx.fill()
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 璎珞装饰（胸前）
  for (let i = 0; i < 5; i++) {
    const ny = cy - 10 + i * 6
    ctx.beginPath()
    ctx.moveTo(cx - 12, ny)
    ctx.quadraticCurveTo(cx, ny + 3, cx + 12, ny)
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  // === 头部 ===
  ctx.beginPath()
  ctx.arc(cx, cy - 48, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#C9A84C'
  ctx.fill()
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 面部特征（简化的慈悲面容）
  ctx.fillStyle = '#2a1f14'
  // 眉毛
  ctx.beginPath()
  ctx.moveTo(cx - 7, cy - 52)
  ctx.quadraticCurveTo(cx - 3, cy - 55, cx - 1, cy - 52)
  ctx.strokeStyle = '#2a1f14'
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + 1, cy - 52)
  ctx.quadraticCurveTo(cx + 3, cy - 55, cx + 7, cy - 52)
  ctx.stroke()
  // 眼睛
  ctx.beginPath()
  ctx.ellipse(cx - 4, cy - 49, 2, 1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 4, cy - 49, 2, 1, 0, 0, Math.PI * 2)
  ctx.fill()
  // 嘴
  ctx.beginPath()
  ctx.moveTo(cx - 3, cy - 42)
  ctx.quadraticCurveTo(cx, cy - 40, cx + 3, cy - 42)
  ctx.strokeStyle = '#2a1f14'
  ctx.lineWidth = 0.6
  ctx.stroke()

  // === 五佛冠（元代密宗标志性头冠）===
  const crownY = cy - 62
  // 冠基
  ctx.beginPath()
  ctx.moveTo(cx - 16, cy - 55)
  ctx.lineTo(cx - 18, crownY + 5)
  ctx.lineTo(cx + 18, crownY + 5)
  ctx.lineTo(cx + 16, cy - 55)
  ctx.fillStyle = '#C04851'
  ctx.fill()
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 1
  ctx.stroke()

  // 五佛（冠上五小佛）
  for (let i = 0; i < 5; i++) {
    const fx = cx - 14 + i * 7
    ctx.beginPath()
    ctx.arc(fx, crownY, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#D4AF37'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(fx, crownY, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = '#C04851'
    ctx.fill()
  }

  // === 莲台 ===
  const lotusY = cy + 50
  // 莲花底座
  ctx.beginPath()
  ctx.ellipse(cx, lotusY, 40, 12, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#C9A84C'
  ctx.fill()
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 1
  ctx.stroke()

  // 莲花瓣
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    const px = cx + Math.cos(angle) * 30
    const py = lotusY + Math.sin(angle) * 8
    ctx.beginPath()
    ctx.ellipse(px, py, 10, 5, angle, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(192, 72, 81, ${0.4 + Math.random()*0.2})`
    ctx.fill()
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  // === 两侧胁侍菩萨（简化轮廓）===
  // 左胁侍
  drawAttendantBodhisattva(ctx, cx - 80, cy + 10, false)
  // 右胁侍
  drawAttendantBodhisattva(ctx, cx + 80, cy + 10, true)

  // === 底部题记区域 ===
  ctx.fillStyle = 'rgba(42, 31, 20, 0.85)'
  ctx.fillRect(bw + 12, H - bw - 45, W - (bw + 12) * 2, 35)
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)'
  ctx.lineWidth = 0.8
  ctx.strokeRect(bw + 12, H - bw - 45, W - (bw + 12) * 2, 35)

  // 模拟藏文题记
  ctx.font = '9px serif'
  ctx.fillStyle = 'rgba(212, 175, 55, 0.5)'
  for (let i = 0; i < 12; i++) {
    const tx = bw + 20 + i * 35
    ctx.fillText('ༀཨོཾ', tx, H - bw - 25)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 绘制胁侍菩萨（简化轮廓）
 */
function drawAttendantBodhisattva(ctx, x, y, mirror) {
  const dir = mirror ? -1 : 1

  // 身体
  ctx.beginPath()
  ctx.ellipse(x, y, 10, 22, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(58, 125, 92, 0.5)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  // 头
  ctx.beginPath()
  ctx.arc(x, y - 30, 7, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(201, 168, 76, 0.6)'
  ctx.fill()

  // 五佛冠
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 33)
  ctx.lineTo(x, y - 42)
  ctx.lineTo(x + 6, y - 33)
  ctx.fillStyle = 'rgba(192, 72, 81, 0.5)'
  ctx.fill()

  // 飘带
  ctx.beginPath()
  ctx.moveTo(x, y - 20)
  ctx.quadraticCurveTo(x + dir * 25, y - 10, x + dir * 30, y + 5)
  ctx.strokeStyle = 'rgba(58, 125, 92, 0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x, y - 15)
  ctx.quadraticCurveTo(x + dir * 20, y, x + dir * 25, y + 15)
  ctx.strokeStyle = 'rgba(192, 72, 81, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 莲花供养
  ctx.beginPath()
  ctx.arc(x - dir * 5, y + 28, 5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(192, 72, 81, 0.4)'
  ctx.fill()
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
