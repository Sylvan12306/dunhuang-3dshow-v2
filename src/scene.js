/**
 * 场景搭建模块 - Scene / Camera / Renderer 初始化
 * 适配洞窟大空间视野，包含窗口自适应、抗锯齿、画布适配
 */
import * as THREE from 'three'

// 全局场景对象
let scene = null
let camera = null
let renderer = null
let clock = null

/**
 * 初始化 Three.js 基础场景
 * @returns {Object} { scene, camera, renderer, clock }
 */
export function initScene() {
  // --- Scene 场景 ---
  scene = new THREE.Scene()
  // 背景色：暖棕（提亮，融入敦煌低饱和配色体系，营造石窟展陈环境）
  scene.background = new THREE.Color(0x3a2e22)
  // 雾效：增强洞窟空间纵深感，暖棕雾，降低密度避免远端全黑
  scene.fog = new THREE.FogExp2(0x3a2e22, 0.015)

  // --- Camera 相机 ---
  // 透视相机，FOV 60 度适配洞窟大空间视野
  camera = new THREE.PerspectiveCamera(
    60,                                    // 视场角
    window.innerWidth / window.innerHeight, // 宽高比
    0.1,                                   // 近裁剪面
    2000                                   // 远裁剪面（洞窟纵深大）
  )
  // 初始相机位置：入口处，人眼高度 1.6m
  camera.position.set(2, 0, 1.6)
  camera.lookAt(20, 0, 1.6)

  // --- Renderer 渲染器 ---
  renderer = new THREE.WebGLRenderer({
    antialias: true,           // 抗锯齿
    alpha: false,               // 不透明背景
    powerPreference: 'high-performance', // 高性能模式
    stencil: false,             // 关闭模板缓冲（节省内存）
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  // 限制像素比至1.5，兼顾清晰度与性能（移动设备2x渲染开销翻倍）
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace  // 正确的色彩空间
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 电影级色调映射（暗部提亮）
  renderer.toneMappingExposure = 1.15                  // 提升曝光，暗部提亮，消除死黑
  renderer.shadowMap.enabled = true                     // 启用阴影
  renderer.shadowMap.type = THREE.PCFSoftShadowMap      // 柔和阴影
  renderer.sortObjects = true                           // 按距离排序，减少过度绘制
  renderer.info.autoReset = true                        // 自动重置渲染信息

  // 视锥体剔除优化：遍历场景中所有对象，启用剔除以跳过视域外模型渲染
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.frustumCulled = true  // 开启视锥体剔除（Three.js默认开启，显式确保）
    }
  })

  // 将 canvas 添加到 DOM
  const app = document.getElementById('app')
  app.appendChild(renderer.domElement)

  // --- Clock 时钟 ---
  clock = new THREE.Clock()

  console.log('[场景] Scene/Camera/Renderer 初始化完成')
  return { scene, camera, renderer, clock }
}

/**
 * 获取场景对象
 */
export function getScene() { return scene }

/**
 * 获取相机
 */
export function getCamera() { return camera }

/**
 * 获取渲染器
 */
export function getRenderer() { return renderer }

/**
 * 窗口大小变化自适应
 */
export function onWindowResize() {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
