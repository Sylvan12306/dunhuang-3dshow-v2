/**
 * 粒子特效模块（升级版）
 * 生成花瓣飘落、佛像光晕、金沙漂浮三种粒子效果
 * 新增：金沙粒子烘托石窟意境，控制透明度、飘落速度
 * 特效空间贴合 Blender 洞窟空间坐标
 */
import * as THREE from 'three'

let particleSystem = null
let haloSystem = null
let sandSystem = null    // 金沙粒子系统
let particleData = []
let sandData = []        // 金沙粒子运动数据

// 粒子参数（性能优化版：大幅减少粒子数量，降低GPU渲染开销）
const PETAL_COUNT = 100      // 花瓣数量
const HALO_COUNT = 30        // 光晕粒子数量
const SAND_COUNT = 80        // 金沙粒子数量
const PETAL_UPDATE_INTERVAL = 3  // 花瓣更新间隔（每N帧更新一次）
const SAND_UPDATE_INTERVAL = 4  // 金沙更新间隔
let frameCount = 0           // 帧计数器（控制粒子更新频率）
const PETAL_AREA = {         // 花瓣飘落区域（匹配洞窟空间坐标）
  xMin: 8, xMax: 40,        // X 轴范围（洞窟区）
  yMin: -6, yMax: 6,        // Y 轴范围
  zMin: 2, zMax: 5,         // Z 轴范围（高度）
}

// 佛像光晕位置（匹配洞窟佛龛坐标，佛龛在洞窟后部）
const HALO_POSITIONS = [
  { x: 14.5, y: 0, z: 2.5 },   // 285 窟主佛（西魏瘦骨清像）
  { x: 21.5, y: 0, z: 2.5 },   // 45 窟主佛（盛唐七身彩塑核心）
  { x: 28.5, y: 0, z: 2.5 },   // 217 窟主佛（盛唐丰腴胁侍）
  { x: 35.5, y: 0, z: 2.5 },   // 17 窟供养人塑像（藏经洞）
  { x: 42.5, y: 0, z: 2.5 },   // 3 窟千手观音（元代密宗核心）
]

// 镇馆核心文物位置（金沙粒子集中环绕）
const CORE_EXHIBIT_POSITIONS = [
  { x: 21.5, y: 0, z: 1.8, radius: 2.0, name: '45窟盛唐主佛' },
  { x: 12.0, y: 0, z: 3.5, radius: 2.5, name: '285窟飞天藻井' },
  { x: 35.5, y: 0, z: 1.5, radius: 2.0, name: '17窟藏经绢画' },
  { x: 42.5, y: 0, z: 2.0, radius: 2.5, name: '3窟千手观音' },
]

// 窟顶藻井位置（金沙粒子环绕）
const CAISSON_POSITIONS = [
  { x: 12, y: 0, z: 3.8 },   // 285 窟藻井
  { x: 19, y: 0, z: 3.8 },   // 45 窟藻井
  { x: 26, y: 0, z: 3.8 },   // 217 窟藻井
  { x: 33, y: 0, z: 3.8 },   // 17 窟藻井
  { x: 40, y: 0, z: 3.8 },   // 3 窟藻井
]

/**
 * 初始化粒子特效
 * @param {THREE.Scene} scene - 场景
 */
export function initParticles(scene) {
  createPetals(scene)
  createHalos(scene)
  createSand(scene)
  console.log('[粒子] 粒子特效初始化完成（' + PETAL_COUNT + ' 花瓣 + ' + HALO_COUNT + ' 光晕 + ' + SAND_COUNT + ' 金沙）')
}

/**
 * 创建花瓣飘落粒子
 */
function createPetals(scene) {
  // 花瓣纹理（程序化生成）
  const petalTexture = createPetalTexture()

  // 花瓣几何体（使用 BufferGeometry 提高性能）
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(PETAL_COUNT * 3)
  const colors = new Float32Array(PETAL_COUNT * 3)
  const sizes = new Float32Array(PETAL_COUNT)

  // 花瓣颜色（敦煌暖色调）
  const petalColors = [
    new THREE.Color(0xffd6a5),  // 暖橙
    new THREE.Color(0xffc080),  // 橙黄
    new THREE.Color(0xffe0b0),  // 浅金
    new THREE.Color(0xd4a060),  // 土金
  ]

  particleData = []

  for (let i = 0; i < PETAL_COUNT; i++) {
    const i3 = i * 3

    // 随机位置
    positions[i3] = PETAL_AREA.xMin + Math.random() * (PETAL_AREA.xMax - PETAL_AREA.xMin)
    positions[i3 + 1] = PETAL_AREA.yMin + Math.random() * (PETAL_AREA.yMax - PETAL_AREA.yMin)
    positions[i3 + 2] = PETAL_AREA.zMin + Math.random() * (PETAL_AREA.zMax - PETAL_AREA.zMin)

    // 随机颜色
    const color = petalColors[Math.floor(Math.random() * petalColors.length)]
    colors[i3] = color.r
    colors[i3 + 1] = color.g
    colors[i3 + 2] = color.b

    // 随机大小
    sizes[i] = 0.05 + Math.random() * 0.1

    // 存储粒子运动数据
    particleData.push({
      velocityX: (Math.random() - 0.5) * 0.02,   // 水平飘移速度
      velocityY: (Math.random() - 0.5) * 0.01,   // 水平飘移速度
      velocityZ: -0.01 - Math.random() * 0.02,   // 下落速度
      rotationSpeed: (Math.random() - 0.5) * 0.02, // 旋转速度
      swayAmplitude: 0.3 + Math.random() * 0.5,    // 摆动幅度
      swayPhase: Math.random() * Math.PI * 2,      // 摆动相位
    })
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  // 花瓣材质（使用 PointsMaterial 简化实现）
  const material = new THREE.PointsMaterial({
    size: 0.15,
    map: petalTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,      // 不写入深度缓冲（避免遮挡）
    blending: THREE.NormalBlending,
    sizeAttenuation: true,  // 透视大小衰减
  })

  particleSystem = new THREE.Points(geometry, material)
  particleSystem.name = '花瓣飘落'
  scene.add(particleSystem)
}

/**
 * 创建佛像光晕粒子
 */
function createHalos(scene) {
  const haloTexture = createHaloTexture()
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(HALO_COUNT * 3)
  const colors = new Float32Array(HALO_COUNT * 3)

  // 每个佛像位置分配光晕粒子
  const particlesPerBuddha = Math.floor(HALO_COUNT / HALO_POSITIONS.length)
  const haloColor = new THREE.Color(0xffe0a0)  // 金色光晕

  for (let i = 0; i < HALO_COUNT; i++) {
    const i3 = i * 3
    const buddhaIdx = Math.floor(i / particlesPerBuddha)
    const pos = HALO_POSITIONS[buddhaIdx % HALO_POSITIONS.length]

    // 在佛像周围随机分布
    const angle = Math.random() * Math.PI * 2
    const radius = 0.3 + Math.random() * 0.8

    positions[i3] = pos.x + Math.cos(angle) * radius
    positions[i3 + 1] = pos.y + Math.sin(angle) * radius
    positions[i3 + 2] = pos.z + Math.random() * 0.5

    colors[i3] = haloColor.r
    colors[i3 + 1] = haloColor.g
    colors[i3 + 2] = haloColor.b
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.3,
    map: haloTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,  // 加法混合（发光效果）
    sizeAttenuation: true,
  })

  haloSystem = new THREE.Points(geometry, material)
  haloSystem.name = '佛像光晕'
  scene.add(haloSystem)
}

/**
 * 创建金沙漂浮粒子（烘托石窟意境）
 * 金沙集中环绕镇馆核心文物与窟顶藻井，普通区域弱化粒子效果
 */
function createSand(scene) {
  const sandTexture = createSandTexture()
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(SAND_COUNT * 3)
  const colors = new Float32Array(SAND_COUNT * 3)
  const sizes = new Float32Array(SAND_COUNT)

  // 金沙颜色（金色到暖橙渐变）
  const sandColors = [
    new THREE.Color(0xffd700),  // 金色
    new THREE.Color(0xffc04a),  // 暖金
    new THREE.Color(0xe8a040),  // 土金
    new THREE.Color(0xffe080),  // 浅金
  ]

  // 粒子分配比例：50% 镇馆文物，30% 窟顶藻井，20% 环境氛围
  const coreCount = Math.floor(SAND_COUNT * 0.5)   // 镇馆文物粒子
  const caissonCount = Math.floor(SAND_COUNT * 0.3) // 窟顶藻井粒子
  const ambientCount = SAND_COUNT - coreCount - caissonCount // 环境氛围粒子

  sandData = []

  // --- 镇馆核心文物周围金沙（高密度）---
  for (let i = 0; i < coreCount; i++) {
    const i3 = i * 3
    const exhibit = CORE_EXHIBIT_POSITIONS[i % CORE_EXHIBIT_POSITIONS.length]

    // 在镇馆文物周围球形分布
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI
    const r = exhibit.radius * (0.3 + Math.random() * 0.7)

    positions[i3] = exhibit.x + r * Math.sin(phi) * Math.cos(theta)
    positions[i3 + 1] = exhibit.y + r * Math.sin(phi) * Math.sin(theta)
    positions[i3 + 2] = exhibit.z + r * Math.cos(phi)

    const color = sandColors[Math.floor(Math.random() * sandColors.length)]
    colors[i3] = color.r
    colors[i3 + 1] = color.g
    colors[i3 + 2] = color.b

    sizes[i] = 0.03 + Math.random() * 0.05  // 镇馆文物粒子稍大

    sandData.push({
      velocityX: (Math.random() - 0.5) * 0.006,
      velocityY: (Math.random() - 0.5) * 0.004,
      velocityZ: (Math.random() - 0.5) * 0.005,
      swayAmplitude: 0.3 + Math.random() * 0.5,
      swayPhase: Math.random() * Math.PI * 2,
      centerX: exhibit.x, centerY: exhibit.y, centerZ: exhibit.z,
      maxRadius: exhibit.radius,
      type: 'core',
    })
  }

  // --- 窟顶藻井周围金沙（中密度）---
  for (let i = 0; i < caissonCount; i++) {
    const idx = coreCount + i
    const i3 = idx * 3
    const caisson = CAISSON_POSITIONS[i % CAISSON_POSITIONS.length]

    // 在藻井下方环形分布
    const angle = Math.random() * Math.PI * 2
    const radius = 0.5 + Math.random() * 1.5
    const heightOffset = (Math.random() - 0.5) * 0.8

    positions[i3] = caisson.x + Math.cos(angle) * radius
    positions[i3 + 1] = caisson.y + Math.sin(angle) * radius
    positions[i3 + 2] = caisson.z - 0.3 + heightOffset

    const color = sandColors[Math.floor(Math.random() * sandColors.length)]
    colors[i3] = color.r
    colors[i3 + 1] = color.g
    colors[i3 + 2] = color.b

    sizes[idx] = 0.02 + Math.random() * 0.03

    sandData.push({
      velocityX: (Math.random() - 0.5) * 0.004,
      velocityY: (Math.random() - 0.5) * 0.003,
      velocityZ: (Math.random() - 0.5) * 0.004,
      swayAmplitude: 0.2 + Math.random() * 0.3,
      swayPhase: Math.random() * Math.PI * 2,
      centerX: caisson.x, centerY: caisson.y, centerZ: caisson.z,
      maxRadius: 2.0,
      type: 'caisson',
    })
  }

  // --- 环境氛围金沙（低密度，弱化效果）---
  const AMBIENT_AREA = {
    xMin: 6, xMax: 44,
    yMin: -4, yMax: 4,
    zMin: 0.5, zMax: 4.5,
  }
  for (let i = 0; i < ambientCount; i++) {
    const idx = coreCount + caissonCount + i
    const i3 = idx * 3

    positions[i3] = AMBIENT_AREA.xMin + Math.random() * (AMBIENT_AREA.xMax - AMBIENT_AREA.xMin)
    positions[i3 + 1] = AMBIENT_AREA.yMin + Math.random() * (AMBIENT_AREA.yMax - AMBIENT_AREA.yMin)
    positions[i3 + 2] = AMBIENT_AREA.zMin + Math.random() * (AMBIENT_AREA.zMax - AMBIENT_AREA.zMin)

    const color = sandColors[Math.floor(Math.random() * sandColors.length)]
    colors[i3] = color.r
    colors[i3 + 1] = color.g
    colors[i3 + 2] = color.b

    sizes[idx] = 0.015 + Math.random() * 0.02  // 环境粒子较小

    sandData.push({
      velocityX: (Math.random() - 0.5) * 0.003,
      velocityY: (Math.random() - 0.5) * 0.002,
      velocityZ: (Math.random() - 0.5) * 0.003,
      swayAmplitude: 0.15 + Math.random() * 0.25,
      swayPhase: Math.random() * Math.PI * 2,
      area: AMBIENT_AREA,
      type: 'ambient',
    })
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.PointsMaterial({
    size: 0.08,
    map: sandTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })

  sandSystem = new THREE.Points(geometry, material)
  sandSystem.name = '金沙漂浮'
  scene.add(sandSystem)
}

/**
 * 更新粒子特效（优化版：降低刷新频率，减少每帧计算量）
 * @param {number} delta - 帧间隔时间
 * @param {number} elapsed - 总运行时间
 */
export function updateParticles(delta, elapsed) {
  if (!particleSystem) return

  frameCount++

  // 花瓣粒子：每PETAL_UPDATE_INTERVAL帧更新一次位置
  if (frameCount % PETAL_UPDATE_INTERVAL === 0) {
    const positions = particleSystem.geometry.attributes.position.array

    for (let i = 0; i < PETAL_COUNT; i++) {
      const i3 = i * 3
      const data = particleData[i]

      // 下落
      positions[i3 + 2] += data.velocityZ * PETAL_UPDATE_INTERVAL

      // 水平飘移 + 摆动
      positions[i3] += data.velocityX * PETAL_UPDATE_INTERVAL + Math.sin(elapsed + data.swayPhase) * 0.005 * data.swayAmplitude
      positions[i3 + 1] += data.velocityY * PETAL_UPDATE_INTERVAL + Math.cos(elapsed + data.swayPhase) * 0.005 * data.swayAmplitude

      // 花瓣落到地面后重置到顶部
      if (positions[i3 + 2] < 0) {
        positions[i3] = PETAL_AREA.xMin + Math.random() * (PETAL_AREA.xMax - PETAL_AREA.xMin)
        positions[i3 + 1] = PETAL_AREA.yMin + Math.random() * (PETAL_AREA.yMax - PETAL_AREA.yMin)
        positions[i3 + 2] = PETAL_AREA.zMax
      }
    }

    particleSystem.geometry.attributes.position.needsUpdate = true
  }

  // 光晕粒子缓慢旋转（低频更新）
  if (haloSystem && frameCount % 4 === 0) {
    haloSystem.rotation.z += delta * 0.1
    // 光晕呼吸效果
    haloSystem.material.opacity = 0.3 + Math.sin(elapsed * 2) * 0.2
  }

  // 金沙粒子：每SAND_UPDATE_INTERVAL帧更新一次位置
  if (sandSystem && frameCount % SAND_UPDATE_INTERVAL === 0) {
    const sandPositions = sandSystem.geometry.attributes.position.array

    for (let i = 0; i < SAND_COUNT; i++) {
      const i3 = i * 3
      const data = sandData[i]
      if (!data) continue

      // 三维飘移 + 摆动
      sandPositions[i3]     += data.velocityX * SAND_UPDATE_INTERVAL + Math.sin(elapsed * 0.5 + data.swayPhase) * 0.003 * data.swayAmplitude
      sandPositions[i3 + 1] += data.velocityY * SAND_UPDATE_INTERVAL + Math.cos(elapsed * 0.7 + data.swayPhase) * 0.003 * data.swayAmplitude
      sandPositions[i3 + 2] += data.velocityZ * SAND_UPDATE_INTERVAL + Math.sin(elapsed * 0.3 + data.swayPhase) * 0.002 * data.swayAmplitude

      if (data.type === 'core' || data.type === 'caisson') {
        // 镇馆文物和藻井粒子：超出最大半径后拉回中心
        const dx = sandPositions[i3] - data.centerX
        const dy = sandPositions[i3 + 1] - data.centerY
        const dz = sandPositions[i3 + 2] - data.centerZ
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist > data.maxRadius) {
          // 拉回中心附近
          const theta = Math.random() * Math.PI * 2
          const phi = Math.random() * Math.PI
          const r = data.maxRadius * 0.3
          sandPositions[i3]     = data.centerX + r * Math.sin(phi) * Math.cos(theta)
          sandPositions[i3 + 1] = data.centerY + r * Math.sin(phi) * Math.sin(theta)
          sandPositions[i3 + 2] = data.centerZ + r * Math.cos(phi)
        }
      } else if (data.type === 'ambient') {
        // 环境粒子：超出边界后从另一侧重生
        const area = data.area
        if (sandPositions[i3] < area.xMin)     sandPositions[i3] = area.xMax
        if (sandPositions[i3] > area.xMax)     sandPositions[i3] = area.xMin
        if (sandPositions[i3 + 1] < area.yMin) sandPositions[i3 + 1] = area.yMax
        if (sandPositions[i3 + 1] > area.yMax) sandPositions[i3 + 1] = area.yMin
        if (sandPositions[i3 + 2] < area.zMin) sandPositions[i3 + 2] = area.zMax
        if (sandPositions[i3 + 2] > area.zMax) sandPositions[i3 + 2] = area.zMin
      }
    }

    sandSystem.geometry.attributes.position.needsUpdate = true
    // 金沙透明度呼吸效果
    sandSystem.material.opacity = 0.4 + Math.sin(elapsed * 0.8) * 0.2
  }
}

/**
 * 创建花瓣纹理（程序化生成）
 */
function createPetalTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 绘制花瓣形状
  ctx.fillStyle = 'rgba(255, 255, 255, 1)'
  ctx.beginPath()
  ctx.ellipse(size / 2, size / 2, size / 3, size / 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // 边缘渐变
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

/**
 * 创建光晕纹理（程序化生成）
 */
function createHaloTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 径向渐变光晕
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 240, 200, 1)')
  gradient.addColorStop(0.3, 'rgba(255, 220, 160, 0.6)')
  gradient.addColorStop(1, 'rgba(255, 200, 100, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

/**
 * 创建金沙纹理（程序化生成）
 * 小颗粒发光金沙，中心亮、边缘渐隐
 */
function createSandTexture() {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 径向渐变金沙颗粒
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 230, 150, 1)')
  gradient.addColorStop(0.4, 'rgba(255, 200, 100, 0.7)')
  gradient.addColorStop(1, 'rgba(255, 180, 80, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}
