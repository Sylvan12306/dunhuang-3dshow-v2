/**
 * 粒子特效模块（合并优化版）
 * 所有粒子合并为1个 Points 对象（1个draw call），大幅减少GPU开销
 * 三种效果：花瓣飘落、佛像光晕、金沙漂浮
 */
import * as THREE from 'three'

let mergedParticleSystem = null
let petalData = []
let haloData = []
let sandData = []

// 粒子参数（性能优化版）
const PETAL_COUNT = 80       // 花瓣数量
const HALO_COUNT = 20        // 光晕粒子数量
const SAND_COUNT = 60        // 金沙粒子数量
const TOTAL_COUNT = PETAL_COUNT + HALO_COUNT + SAND_COUNT
const UPDATE_INTERVAL = 3    // 更新间隔（每N帧更新一次）
let frameCount = 0

const PETAL_AREA = {
  xMin: 8, xMax: 40,
  yMin: -6, yMax: 6,
  zMin: 2, zMax: 5,
}

const HALO_POSITIONS = [
  { x: 14.5, y: 0, z: 2.5 },
  { x: 21.5, y: 0, z: 2.5 },
  { x: 28.5, y: 0, z: 2.5 },
  { x: 35.5, y: 0, z: 2.5 },
  { x: 42.5, y: 0, z: 2.5 },
]

const CORE_EXHIBIT_POSITIONS = [
  { x: 21.5, y: 0, z: 1.8, radius: 2.0 },
  { x: 12.0, y: 0, z: 3.5, radius: 2.5 },
  { x: 35.5, y: 0, z: 1.5, radius: 2.0 },
  { x: 42.5, y: 0, z: 2.0, radius: 2.5 },
]

const CAISSON_POSITIONS = [
  { x: 12, y: 0, z: 3.8 },
  { x: 19, y: 0, z: 3.8 },
  { x: 26, y: 0, z: 3.8 },
  { x: 33, y: 0, z: 3.8 },
  { x: 40, y: 0, z: 3.8 },
]

/**
 * 初始化粒子特效（合并为1个draw call）
 */
export function initParticles(scene) {
  // 统一纹理
  const texture = createParticleTexture()

  const positions = new Float32Array(TOTAL_COUNT * 3)
  const colors = new Float32Array(TOTAL_COUNT * 3)

  // --- 花瓣 ---
  const petalColors = [
    new THREE.Color(0xffd6a5),
    new THREE.Color(0xffc080),
    new THREE.Color(0xffe0b0),
    new THREE.Color(0xd4a060),
  ]
  petalData = []
  for (let i = 0; i < PETAL_COUNT; i++) {
    const i3 = i * 3
    positions[i3] = PETAL_AREA.xMin + Math.random() * (PETAL_AREA.xMax - PETAL_AREA.xMin)
    positions[i3 + 1] = PETAL_AREA.yMin + Math.random() * (PETAL_AREA.yMax - PETAL_AREA.yMin)
    positions[i3 + 2] = PETAL_AREA.zMin + Math.random() * (PETAL_AREA.zMax - PETAL_AREA.zMin)
    const c = petalColors[Math.floor(Math.random() * petalColors.length)]
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
    petalData.push({
      velocityX: (Math.random() - 0.5) * 0.02,
      velocityY: (Math.random() - 0.5) * 0.01,
      velocityZ: -0.01 - Math.random() * 0.02,
      swayAmplitude: 0.3 + Math.random() * 0.5,
      swayPhase: Math.random() * Math.PI * 2,
    })
  }

  // --- 光晕 ---
  const haloColor = new THREE.Color(0xffe0a0)
  haloData = []
  const particlesPerBuddha = Math.floor(HALO_COUNT / HALO_POSITIONS.length)
  for (let i = 0; i < HALO_COUNT; i++) {
    const idx = PETAL_COUNT + i
    const i3 = idx * 3
    const buddhaIdx = Math.floor(i / particlesPerBuddha)
    const pos = HALO_POSITIONS[buddhaIdx % HALO_POSITIONS.length]
    const angle = Math.random() * Math.PI * 2
    const radius = 0.3 + Math.random() * 0.8
    positions[i3] = pos.x + Math.cos(angle) * radius
    positions[i3 + 1] = pos.y + Math.sin(angle) * radius
    positions[i3 + 2] = pos.z + Math.random() * 0.5
    colors[i3] = haloColor.r; colors[i3 + 1] = haloColor.g; colors[i3 + 2] = haloColor.b
    haloData.push({ centerIdx: buddhaIdx % HALO_POSITIONS.length })
  }

  // --- 金沙 ---
  const sandColors = [
    new THREE.Color(0xffd700),
    new THREE.Color(0xffc04a),
    new THREE.Color(0xe8a040),
    new THREE.Color(0xffe080),
  ]
  sandData = []
  const coreCount = Math.floor(SAND_COUNT * 0.5)
  const caissonCount = Math.floor(SAND_COUNT * 0.3)
  const ambientCount = SAND_COUNT - coreCount - caissonCount

  for (let i = 0; i < SAND_COUNT; i++) {
    const idx = PETAL_COUNT + HALO_COUNT + i
    const i3 = idx * 3
    let cx, cy, cz, maxR, type

    if (i < coreCount) {
      const exhibit = CORE_EXHIBIT_POSITIONS[i % CORE_EXHIBIT_POSITIONS.length]
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const r = exhibit.radius * (0.3 + Math.random() * 0.7)
      positions[i3] = exhibit.x + r * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = exhibit.y + r * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = exhibit.z + r * Math.cos(phi)
      cx = exhibit.x; cy = exhibit.y; cz = exhibit.z; maxR = exhibit.radius; type = 'core'
    } else if (i < coreCount + caissonCount) {
      const caisson = CAISSON_POSITIONS[i % CAISSON_POSITIONS.length]
      const angle = Math.random() * Math.PI * 2
      const radius = 0.5 + Math.random() * 1.5
      positions[i3] = caisson.x + Math.cos(angle) * radius
      positions[i3 + 1] = caisson.y + Math.sin(angle) * radius
      positions[i3 + 2] = caisson.z - 0.3 + (Math.random() - 0.5) * 0.8
      cx = caisson.x; cy = caisson.y; cz = caisson.z; maxR = 2.0; type = 'caisson'
    } else {
      positions[i3] = 6 + Math.random() * 38
      positions[i3 + 1] = -4 + Math.random() * 8
      positions[i3 + 2] = 0.5 + Math.random() * 4
      cx = 0; cy = 0; cz = 0; maxR = 0; type = 'ambient'
    }

    const c = sandColors[Math.floor(Math.random() * sandColors.length)]
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
    sandData.push({
      velocityX: (Math.random() - 0.5) * 0.005,
      velocityY: (Math.random() - 0.5) * 0.003,
      velocityZ: (Math.random() - 0.5) * 0.004,
      swayAmplitude: 0.2 + Math.random() * 0.3,
      swayPhase: Math.random() * Math.PI * 2,
      centerX: cx, centerY: cy, centerZ: cz, maxRadius: maxR, type,
    })
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.12,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })

  mergedParticleSystem = new THREE.Points(geometry, material)
  mergedParticleSystem.name = '花瓣飘落'
  scene.add(mergedParticleSystem)

  console.log('[粒子] 合并粒子系统初始化完成（' + TOTAL_COUNT + ' 粒子，1 draw call）')
}

/**
 * 更新粒子（优化版：降低刷新频率）
 */
export function updateParticles(delta, elapsed) {
  if (!mergedParticleSystem) return
  frameCount++
  if (frameCount % UPDATE_INTERVAL !== 0) return

  const positions = mergedParticleSystem.geometry.attributes.position.array

  // 花瓣
  for (let i = 0; i < PETAL_COUNT; i++) {
    const i3 = i * 3
    const d = petalData[i]
    positions[i3 + 2] += d.velocityZ * UPDATE_INTERVAL
    positions[i3] += d.velocityX * UPDATE_INTERVAL + Math.sin(elapsed + d.swayPhase) * 0.005 * d.swayAmplitude
    positions[i3 + 1] += d.velocityY * UPDATE_INTERVAL + Math.cos(elapsed + d.swayPhase) * 0.005 * d.swayAmplitude
    if (positions[i3 + 2] < 0) {
      positions[i3] = PETAL_AREA.xMin + Math.random() * (PETAL_AREA.xMax - PETAL_AREA.xMin)
      positions[i3 + 1] = PETAL_AREA.yMin + Math.random() * (PETAL_AREA.yMax - PETAL_AREA.yMin)
      positions[i3 + 2] = PETAL_AREA.zMax
    }
  }

  // 金沙
  for (let i = 0; i < SAND_COUNT; i++) {
    const idx = PETAL_COUNT + HALO_COUNT + i
    const i3 = idx * 3
    const d = sandData[i]
    positions[i3]     += d.velocityX * UPDATE_INTERVAL + Math.sin(elapsed * 0.5 + d.swayPhase) * 0.003 * d.swayAmplitude
    positions[i3 + 1] += d.velocityY * UPDATE_INTERVAL + Math.cos(elapsed * 0.7 + d.swayPhase) * 0.003 * d.swayAmplitude
    positions[i3 + 2] += d.velocityZ * UPDATE_INTERVAL + Math.sin(elapsed * 0.3 + d.swayPhase) * 0.002 * d.swayAmplitude

    if (d.type === 'core' || d.type === 'caisson') {
      const dx = positions[i3] - d.centerX
      const dy = positions[i3 + 1] - d.centerY
      const dz = positions[i3 + 2] - d.centerZ
      if (dx * dx + dy * dy + dz * dz > d.maxRadius * d.maxRadius) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        const r = d.maxRadius * 0.3
        positions[i3]     = d.centerX + r * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = d.centerY + r * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = d.centerZ + r * Math.cos(phi)
      }
    } else if (d.type === 'ambient') {
      if (positions[i3] < 6) positions[i3] = 44
      if (positions[i3] > 44) positions[i3] = 6
      if (positions[i3 + 1] < -4) positions[i3 + 1] = 4
      if (positions[i3 + 1] > 4) positions[i3 + 1] = -4
    }
  }

  // 光晕呼吸
  if (mergedParticleSystem.material) {
    mergedParticleSystem.material.opacity = 0.45 + Math.sin(elapsed * 1.5) * 0.2
  }

  mergedParticleSystem.geometry.attributes.position.needsUpdate = true
}

/**
 * 创建粒子纹理（统一：花瓣+光晕+金沙）
 */
function createParticleTexture() {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 230, 160, 1)')
  gradient.addColorStop(0.4, 'rgba(255, 210, 130, 0.7)')
  gradient.addColorStop(1, 'rgba(255, 190, 100, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}
