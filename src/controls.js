/**
 * OrbitControls 轨道视角控制器模块（升级版）
 * 新增：WASD 自由移动 + Q/E 上升下降 + 多预设观赏机位 + 洞窟飞行跳转
 * 新增：滚轮多维视角环绕观赏模式（水平+垂直双维度滚动）
 * 限制观赏最小距离防穿模，模拟实体展馆玻璃护栏规则
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { updateCaveTitleVisibility } from './caveStructure.js'

let controls = null
let camera = null
let domElement = null

// WASD 移动状态
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
}
const moveSpeed = 0.12  // 移动速度（米/帧，降低以提升流畅度）
const moveVector = new THREE.Vector3()

// 平滑缓动插值状态（优化WASD漫游流畅度，消除顿挫感）
const velocity = new THREE.Vector3()    // 当前速度向量
const targetVelocity = new THREE.Vector3() // 目标速度向量
const smoothFactor = 0.15  // 缓动因子（0~1，越小越平滑）
const decelerationFactor = 0.08  // 减速衰减因子（松开按键后平滑减速）

// 滚动环绕模式状态
let scrollOrbitActive = false
let scrollOrbitAngleH = 0      // 当前水平环绕角度（弧度）
let scrollOrbitTargetAngleH = 0 // 目标水平环绕角度
let scrollOrbitAngleV = 0      // 当前垂直环绕角度（弧度）
let scrollOrbitTargetAngleV = 0 // 目标垂直环绕角度
const scrollOrbitSpeed = 0.10  // 环绕插值速度

// 洞窟位置数据（匹配 Blender 模型坐标）
// cave.x 是洞窟入口墙位置（x_start），后墙在 cave.x + CAVE_DEPTH
// 中心在 cave.x + 4，佛龛造像在 cave.x + 6.5
const CAVE_POSITIONS = {
  '285': { x: 8,  y: 0, z: 1.6, name: '西魏285窟' },
  '45':  { x: 15, y: 0, z: 1.6, name: '盛唐45窟' },
  '217': { x: 22, y: 0, z: 1.6, name: '盛唐217窟' },
  '17':  { x: 29, y: 0, z: 1.6, name: '晚唐17窟' },
  '3':   { x: 36, y: 0, z: 1.6, name: '元代3窟' },
}

let currentCave = null

/**
 * 初始化 OrbitControls + WASD 键盘控制
 * @param {THREE.Camera} cam - 相机
 * @param {HTMLElement} dom - 渲染目标 DOM 元素
 * @returns {OrbitControls} 控制器实例
 */
export function initControls(cam, dom) {
  camera = cam
  domElement = dom
  controls = new OrbitControls(camera, domElement)

  // --- 旋转/缩放/平移速度 ---
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.8
  controls.panSpeed = 0.6

  // --- 距离限制（模拟玻璃护栏规则）---
  controls.minDistance = 1.2   // 最小距离 1.2 米
  controls.maxDistance = 60    // 最大距离 60 米

  // --- 垂直角度限制 ---
  controls.minPolarAngle = Math.PI * 0.05   // 约 9 度（允许仰视窟顶）
  controls.maxPolarAngle = Math.PI * 0.95   // 约 171 度（允许俯瞰地面）

  // --- 阻尼效果（提升平滑度，减少顿挫感）---
  controls.enableDamping = true
  controls.dampingFactor = 0.12  // 提升阻尼系数，旋转更平滑

  // 初始注视点
  controls.target.set(20, 0, 1.6)
  controls.update()

  // --- 绑定 WASD 键盘事件 ---
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)

  // --- 绑定滚轮多维视角环绕事件 ---
  // 普通滚轮：水平环绕观赏（多维视角）
  // Shift + 滚轮：垂直环绕观赏（仰视/俯视）
  // Ctrl + 滚轮：缩放（拉近/拉远）
  domElement.addEventListener('wheel', onWheelScroll, { passive: false })

  console.log('[控制器] OrbitControls + WASD + 滚轮多维环绕初始化完成')
  return controls
}

/**
 * 滚轮事件处理：多维视角环绕观赏
 * 普通滚轮：相机围绕当前注视点水平旋转（左右多维视角）
 * Shift + 滚轮：相机围绕当前注视点垂直旋转（仰视/俯视多维视角）
 * Ctrl + 滚轮：缩放（保持原有拉近/拉远功能）
 */
function onWheelScroll(event) {
  if (event.ctrlKey) {
    // Ctrl + 滚轮：缩放，保持 OrbitControls 默认行为
    return
  }
  // 拦截滚轮事件，阻止默认缩放
  event.preventDefault()
  const delta = event.deltaY > 0 ? 1 : -1

  if (event.shiftKey) {
    // Shift + 滚轮：垂直环绕（仰视/俯视）
    scrollOrbitTargetAngleV += delta * 0.25  // 每次滚动约 14 度
  } else {
    // 普通滚轮：水平环绕（多维视角）
    scrollOrbitTargetAngleH += delta * 0.30  // 每次滚动约 17 度
  }
  scrollOrbitActive = true
}

/**
 * 更新滚动环绕（在渲染循环中调用）
 * 平滑插值相机位置，实现多维视角环绕观赏
 * 水平维度：围绕注视点水平旋转
 * 垂直维度：围绕注视点垂直旋转
 */
export function updateScrollOrbit() {
  if (!scrollOrbitActive || !controls || !camera) return

  const target = controls.target
  const offset = new THREE.Vector3().subVectors(camera.position, target)

  // 当前距离和角度
  const distance = offset.length()
  const currentAngleH = Math.atan2(offset.y, offset.x)
  const currentAngleV = Math.asin(Math.max(-1, Math.min(1, offset.z / distance)))

  // 水平角度平滑插值
  const diffH = scrollOrbitTargetAngleH - scrollOrbitAngleH
  if (Math.abs(diffH) > 0.001) {
    scrollOrbitAngleH += diffH * scrollOrbitSpeed
  }

  // 垂直角度平滑插值
  const diffV = scrollOrbitTargetAngleV - scrollOrbitAngleV
  if (Math.abs(diffV) > 0.001) {
    scrollOrbitAngleV += diffV * scrollOrbitSpeed
  }

  // 计算新的相机位置（球坐标）
  const newAngleH = currentAngleH + diffH * scrollOrbitSpeed
  const newAngleV = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45,
    currentAngleV + diffV * scrollOrbitSpeed))

  const cosV = Math.cos(newAngleV)
  camera.position.x = target.x + distance * cosV * Math.cos(newAngleH)
  camera.position.y = target.y + distance * cosV * Math.sin(newAngleH)
  camera.position.z = target.z + distance * Math.sin(newAngleV)

  // 检查是否完成插值
  if (Math.abs(diffH) < 0.001 && Math.abs(diffV) < 0.001) {
    scrollOrbitActive = false
  }

  controls.update()
}

/**
 * 键盘按下事件
 */
function onKeyDown(event) {
  switch (event.code) {
    case 'KeyW': case 'ArrowUp':
      moveState.forward = true; break
    case 'KeyS': case 'ArrowDown':
      moveState.backward = true; break
    case 'KeyA': case 'ArrowLeft':
      moveState.left = true; break
    case 'KeyD': case 'ArrowRight':
      moveState.right = true; break
    case 'KeyQ':
      moveState.up = true; break
    case 'KeyE':
      moveState.down = true; break
  }
}

/**
 * 键盘释放事件
 */
function onKeyUp(event) {
  switch (event.code) {
    case 'KeyW': case 'ArrowUp':
      moveState.forward = false; break
    case 'KeyS': case 'ArrowDown':
      moveState.backward = false; break
    case 'KeyA': case 'ArrowLeft':
      moveState.left = false; break
    case 'KeyD': case 'ArrowRight':
      moveState.right = false; break
    case 'KeyQ':
      moveState.up = false; break
    case 'KeyE':
      moveState.down = false; break
  }
}

/**
 * 更新 WASD 自由移动（在渲染循环中调用）
 * 优化：增加平滑缓动插值，消除移动顿挫感，松开按键后平滑减速
 */
export function updateWASDMove() {
  if (!controls || !camera) return

  // 基于相机朝向计算移动方向
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0  // 水平移动，忽略垂直分量
  forward.normalize()

  const right = new THREE.Vector3()
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

  // 计算目标速度（按键输入）
  targetVelocity.set(0, 0, 0)
  if (moveState.forward)  targetVelocity.add(forward)
  if (moveState.backward) targetVelocity.sub(forward)
  if (moveState.left)    targetVelocity.sub(right)
  if (moveState.right)   targetVelocity.add(right)
  if (moveState.up)      targetVelocity.y += 1
  if (moveState.down)    targetVelocity.y -= 1

  if (targetVelocity.length() > 0) {
    targetVelocity.normalize().multiplyScalar(moveSpeed)
    // 平滑加速：当前速度向目标速度插值
    velocity.lerp(targetVelocity, smoothFactor)
  } else {
    // 平滑减速：当前速度向零衰减
    velocity.multiplyScalar(1 - decelerationFactor)
    // 速度极小时归零，避免永远微小漂移
    if (velocity.length() < 0.001) {
      velocity.set(0, 0, 0)
    }
  }

  // 应用速度到相机位置
  if (velocity.length() > 0.001) {
    camera.position.add(velocity)
    // 同步控制器目标点
    controls.target.add(velocity)
    controls.update()
  }
}

/**
 * 获取控制器实例
 */
export function getControls() { return controls }

/**
 * 飞行到指定洞窟
 * cave.x 是洞窟入口墙位置（x_start），后墙在 cave.x + 8
 * 相机定位在洞窟入口内侧 1.5m（cave.x + 1.5），注视佛龛造像方向（cave.x + 6.5）
 * @param {string} caveNumber - 洞窟编号（'285', '45', '217', '17', '3'）
 * @param {number} duration - 过渡时间（毫秒）
 */
export function flyToCave(caveNumber, duration = 2000) {
  const cave = CAVE_POSITIONS[caveNumber]
  if (!cave || !controls) return

  currentCave = caveNumber
  // 同步更新洞窟标题可见性（仅显示当前洞窟标题）
  updateCaveTitleVisibility(caveNumber)
  // 相机定位在洞窟入口内侧 1.5m，注视佛龛造像方向
  const targetPos = new THREE.Vector3(cave.x + 1.5, cave.y, cave.z)
  const targetLook = new THREE.Vector3(cave.x + 6.5, cave.y, cave.z)

  flyTo(targetPos, targetLook, duration)
  console.log('[控制器] 飞行至: ' + cave.name)
}

/**
 * 飞行到指定位置（平滑过渡，镜头平滑缓动，切换无突兀跳转）
 * @param {THREE.Vector3} position - 目标相机位置
 * @param {THREE.Vector3} target - 目标注视点
 * @param {number} duration - 过渡时间（毫秒）
 */
export function flyTo(position, target, duration = 1800) {
  if (!controls) return

  const startPos = controls.object.position.clone()
  const startTarget = controls.target.clone()
  const startTime = performance.now()

  function animateFly() {
    const elapsed = performance.now() - startTime
    const t = Math.min(elapsed / duration, 1)
    // 缓动函数：ease-in-out cubic（更平滑的镜头缓动，切换无突兀跳转）
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    controls.object.position.lerpVectors(startPos, position, eased)
    controls.target.lerpVectors(startTarget, target, eased)
    controls.update()

    if (t < 1) {
      requestAnimationFrame(animateFly)
    }
  }

  animateFly()
}

/**
 * 切换自动旋转
 */
export function toggleAutoRotate() {
  if (!controls) return
  controls.autoRotate = !controls.autoRotate
  return controls.autoRotate
}

/**
 * 获取当前洞窟编号
 */
export function getCurrentCave() { return currentCave }

/**
 * 获取所有洞窟位置数据
 */
export function getCavePositions() { return CAVE_POSITIONS }
