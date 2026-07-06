/**
 * 敦煌 3DShow 数字展馆 - 主入口
 * 负责：场景初始化、模块协调、渲染循环、UI 交互
 * 升级：WASD 自由漫游、洞窟导航、多预设机位、缩略导览地图、导览指引弹窗
 * 新增：AIGC壁画修复/飞天动画/语音解说
 * 优化：延迟加载非关键模块（粒子、音频、手势），优先渲染模型
 */
import * as THREE from 'three'
import { initScene, getScene, getCamera, getRenderer, onWindowResize } from './scene.js'
import { setupLighting } from './lighting.js'
import { loadModel, getLoadedModel } from './modelLoader.js'
import { enhancePBRMaterials } from './materials.js'
import { buildCaveStructure, createYuanDynastyMuralOverlay, createAllMuralOverlays } from './caveStructure.js'
import {
  initControls, getControls,
  updateWASDMove, flyToCave,
  getCurrentCave, getCavePositions, updateScrollOrbit,
} from './controls.js'
import { initRaycaster, bindRaycastToScene } from './raycaster.js'
import { exportModelToGLTF, exportModelToGLB } from './exportModel.js'
import { initVR, enterVR } from './vr.js'

// 全局状态
const state = {
  isLoaded: false,
  model: null,
  clock: null,
  minimapVisible: false,
}

// 延迟加载模块的引用
let particlesModule = null
let audioModule = null
let gestureModule = null
let aigcModule = null

/**
 * 应用主入口
 */
async function main() {
  console.log('[敦煌3DShow] 开始初始化...')

  const { scene, camera, renderer, clock } = initScene()
  state.clock = clock
  
  window.__THREE_SCENE__ = scene
  window.__THREE_CAMERA__ = camera
  window.__THREE_RENDERER__ = renderer
  window.__THREE__ = THREE

  setupLighting(scene)
  buildCaveStructure(scene)
  const controls = initControls(camera, renderer.domElement)

  try {
    const model = await loadModel(undefined, (progress) => {
      updateLoadingBar(progress)
    })

    state.model = model
    state.isLoaded = true

    enhancePBRMaterials(model)
    scene.add(model)
    bindRaycastToScene(camera, renderer.domElement, model)

    // 元代3窟右墙壁画覆盖层（覆盖GLB中不匹配的唐代壁画）
    const yuanMural = createYuanDynastyMuralOverlay()
    model.add(yuanMural)

    // 所有洞窟壁画真实纹理覆盖层
    const muralOverlays = createAllMuralOverlays()
    muralOverlays.forEach(overlay => model.add(overlay))

    // 从根源删除所有洞窟标题 Sprite（无论来自何处：旧缓存/其他模块）
    // 仅保留飞天动画 Sprite（名称以"飞天"开头）
    purgeCaveTitleSprites(scene)
    // 清理后墙文字mesh（模型加载后执行一次即可，不需要每帧检查）
    purgeBackWallTextMeshes(scene)

    hideLoading()
    showUI()

    // 初始化 WebXR VR 模式
    initVR(renderer)

    console.log('[敦煌3DShow] 初始化完成，模型已渲染')

    requestIdleCallback(() => {
      loadNonCriticalModules(scene, camera, renderer, model, controls)
    })

  } catch (err) {
    console.error('[敦煌3DShow] 模型加载失败:', err)
    document.getElementById('loading-text').textContent = '加载失败: ' + err.message
  }

  animate()
}

/**
 * 延迟加载非关键模块
 */
async function loadNonCriticalModules(scene, camera, renderer, model, controls) {
  // 粒子特效
  try {
    particlesModule = await import('./particles.js')
    particlesModule.initParticles(scene)
    console.log('[敦煌3DShow] 粒子特效已加载')
  } catch (e) {
    console.warn('[敦煌3DShow] 粒子模块加载失败:', e)
  }

  await new Promise(resolve => requestAnimationFrame(resolve))

  // 音频模块
  try {
    audioModule = await import('./audio.js')
    console.log('[敦煌3DShow] 音频模块已就绪')
  } catch (e) {
    console.warn('[敦煌3DShow] 音频模块加载失败:', e)
  }

  await new Promise(resolve => requestAnimationFrame(resolve))

  // 手势模块
  try {
    gestureModule = await import('./gesture.js')
    gestureModule.initGesture(camera, renderer.domElement, getControls(), scene)
    console.log('[敦煌3DShow] 手势模块已就绪')
  } catch (e) {
    console.warn('[敦煌3DShow] 手势模块加载失败:', e)
  }

  await new Promise(resolve => requestAnimationFrame(resolve))

  // AIGC 模块（壁画修复 + 飞天动画 + 语音解说）
  try {
    aigcModule = await import('./aigc.js')
    aigcModule.initAIGCMuralRestore(scene)
    aigcModule.initApsaraAnimation(scene)
    aigcModule.initVoiceGuide(camera)
    console.log('[敦煌3DShow] AIGC 模块已就绪（壁画修复 + 飞天动画 + 语音解说）')
  } catch (e) {
    console.warn('[敦煌3DShow] AIGC 模块加载失败:', e)
  }
}

/**
 * 渲染循环
 */
function animate() {
  requestAnimationFrame(animate)

  const delta = state.clock.getDelta()
  const elapsed = state.clock.getElapsedTime()

  // 自适应性能：FPS低于阈值时自动降级
  adaptivePerformance(delta)

  const controls = getControls()
  if (controls) controls.update()

  updateWASDMove()
  updateScrollOrbit()

  if (particlesModule) {
    particlesModule.updateParticles(delta, elapsed)
  }

  const model = getLoadedModel()
  if (model && model.animations && model.mixer) {
    model.mixer.update(delta)
  }

  // AIGC 模块更新
  if (aigcModule) {
    aigcModule.updateAIGCMuralRestore(delta, elapsed)
    aigcModule.updateApsaraAnimation(delta, elapsed)

    const currentCave = getCurrentCave()
    aigcModule.checkAutoGuide(currentCave)
  }

  // 更新缩略导览地图
  if (state.minimapVisible && frameCountMinimap++ % 5 === 0) {
    updateMinimap()
  }

  const renderer = getRenderer()
  const scene = getScene()
  const camera = getCamera()
  renderer.render(scene, camera)
}

let frameCountMinimap = 0

/**
 * 从场景中删除所有洞窟标题 Sprite
 * 仅保留飞天动画 Sprite（名称以"飞天"开头）
 * 这是根因修复：无论文字来自旧缓存、其他模块、还是未来代码变更，都会被清理
 */
function purgeCaveTitleSprites(scene) {
  const spritesToRemove = []
  scene.traverse((child) => {
    if (child.isSprite) {
      const name = child.name || ''
      // 仅保留飞天动画 Sprite
      if (name.startsWith('飞天')) return
      // 删除所有其他 Sprite（包括洞窟标题、窟号标签、立牌文字等）
      spritesToRemove.push(child)
    }
  })
  for (const sprite of spritesToRemove) {
    if (sprite.parent) {
      sprite.parent.remove(sprite)
      console.log('[敦煌3DShow] 删除洞窟标题 Sprite:', sprite.name || '(unnamed)')
    }
  }
  if (spritesToRemove.length > 0) {
    console.log('[敦煌3DShow] 共清理 ' + spritesToRemove.length + ' 个非飞天 Sprite')
  }
}

/**
 * 从场景中删除后墙区域所有非结构对象（核弹级清理）
 * 删除范围：5个洞窟后墙区域（x=15-17/22-24/29-31/36-38/43-45, y>0.5, |z|<1.5）
 * 保留：墙壁、地板、顶棚、雕塑、壁画、飞天等已知结构
 * 删除：任何其他对象（文字牌匾、立牌、标签、装饰等）
 * 由渲染循环每60帧调用一次，确保后墙绝无文字
 */
function purgeBackWallTextMeshes(scene) {
  const objectsToRemove = []
  const backWallRanges = [
    { xMin: 15, xMax: 17 },  // 285窟后墙
    { xMin: 22, xMax: 24 },  // 45窟后墙
    { xMin: 29, xMax: 31 },  // 217窟后墙
    { xMin: 36, xMax: 38 },  // 17窟后墙
    { xMin: 43, xMax: 45 },  // 3窟后墙
  ]

  scene.traverse((child) => {
    // 跳过非可视化对象
    if (!child.isMesh && !child.isSprite) return

    const name = child.name || ''

    // 保留已知的结构对象和交互对象
    if (name.includes('后墙') || name.includes('右墙') || name.includes('地面') ||
        name.includes('顶棚') || name.includes('走廊') || name.includes('入口') ||
        name.includes('终点') || name.includes('门框') || name.includes('导览') ||
        name.includes('边界') || name.includes('观景') || name.includes('平台') ||
        name.includes('壁画') || name.includes('经变画') || name.includes('飞天') ||
        name.includes('伎乐') || name.includes('藻井') || name.includes('千佛') ||
        name.includes('供养人') || name.includes('暗纹') || name.includes('绢画') ||
        name.includes('密宗') || name.includes('护法') ||
        name.includes('彩塑') || name.includes('主佛') || name.includes('菩萨') ||
        name.includes('佛龛') || name.includes('基座') || name.includes('背光') ||
        name.includes('迦叶') || name.includes('阿难') || name.includes('天王') ||
        name.includes('力士') || name.includes('弟子') || name.includes('僧人') ||
        name.includes('法师') || name.includes('金刚') || name.includes('胁侍')) {
      return
    }

    // 获取世界坐标
    child.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(child)
    const center = new THREE.Vector3()
    box.getCenter(center)

    // 检查是否在后墙位置
    const isNearBackWall = backWallRanges.some(
      r => center.x >= r.xMin && center.x <= r.xMax && center.y > 0.5 && center.y < 4.0 && Math.abs(center.z) < 1.5
    )

    if (isNearBackWall) {
      const size = new THREE.Vector3()
      box.getSize(size)
      // 删除所有非结构对象：
      // - 扁平牌匾（z薄）
      // - InstancedMesh（5个实例的立牌）
      // - 中等尺寸对象（可能是文字几何体）
      // - 任何不是墙壁厚度的对象
      const isThickWall = size.z > 0.25 && size.x > 2.0 && size.y > 2.0 // 真正的后墙厚度 > 0.25
      if (!isThickWall) {
        objectsToRemove.push({ child, name, pos: center.clone(), size: size.clone() })
      }
    }
  })

  for (const { child, name, pos, size } of objectsToRemove) {
    if (child.parent) {
      child.parent.remove(child)
      console.log('[敦煌3DShow] 清理后墙对象:', name || '(unnamed)',
        'type:', child.isSprite ? 'Sprite' : (child.isInstancedMesh ? 'InstancedMesh' : 'Mesh'),
        'pos:', `(${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)})`,
        'size:', `(${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)})`)
    }
  }
}

// ============================================================
// UI 辅助函数
// ============================================================

function updateLoadingBar(progress) {
  const bar = document.getElementById('loading-bar')
  const text = document.getElementById('loading-text')
  const percent = document.getElementById('loading-percent')
  const pct = Math.max(0, Math.min(Math.round(progress * 100), 100))
  if (bar) bar.style.width = pct + '%'
  if (text) text.textContent = '正在加载洞窟模型... ' + pct + '%'
  if (percent) percent.textContent = pct + '%'
}

function hideLoading() {
  const loading = document.getElementById('loading')
  if (loading) {
    loading.style.opacity = '0'
    setTimeout(() => { loading.style.display = 'none' }, 800)
  }
}

function showUI() {
  document.getElementById('top-bar').style.display = 'flex'
  document.getElementById('bottom-hint').style.display = 'block'
  document.getElementById('cave-nav').style.display = 'flex'

  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  })

  // 导出3D模型按钮（数实融合）
  document.getElementById('btn-export').addEventListener('click', () => {
    exportModelToGLB(scene)
  })

  // VR沉浸体验按钮
  const vrBtn = document.getElementById('btn-vr')
  if (vrBtn) {
    vrBtn.addEventListener('click', () => enterVR(renderer))
  }

  document.getElementById('btn-guide').addEventListener('click', () => {
    document.getElementById('guide-modal').style.display = 'flex'
  })

  document.getElementById('btn-minimap').addEventListener('click', () => {
    toggleMinimap()
  })

  // 洞窟导航按钮
  document.querySelectorAll('#cave-nav .cave-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const caveNumber = btn.getAttribute('data-cave')
      flyToCave(caveNumber)
      document.querySelectorAll('#cave-nav .cave-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      // 语音导览：切换洞窟时自动解说
      if (aigcModule) {
        const guideState = aigcModule.getAIGCState().voiceGuide
        if (guideState.enabled && guideState.autoGuide) {
          aigcModule.playCaveNarration(caveNumber)
        }
      }
    })
  })

  // 语音导览按钮
  document.getElementById('btn-voice')?.addEventListener('click', () => {
    if (aigcModule) {
      const enabled = aigcModule.toggleVoiceGuide()
      document.getElementById('btn-voice')?.classList.toggle('active', enabled)
      showToast(enabled ? '语音导览已开启' : '语音导览已关闭')
    }
  })

  // AIGC面板按钮
  document.getElementById('btn-aigc')?.addEventListener('click', () => {
    toggleAIGCPanel()
  })
}

function toggleMinimap() {
  const minimap = document.getElementById('minimap')
  state.minimapVisible = !state.minimapVisible
  minimap.style.display = state.minimapVisible ? 'block' : 'none'
  document.getElementById('btn-minimap').classList.toggle('active', state.minimapVisible)
  if (state.minimapVisible) {
    drawMinimap()
  }
}

function toggleAIGCPanel() {
  let panel = document.getElementById('aigc-panel')
  if (!panel) {
    createAIGCPanel()
    panel = document.getElementById('aigc-panel')
  }
  const isVisible = panel.style.display !== 'none'
  panel.style.display = isVisible ? 'none' : 'flex'
}

/**
 * 创建AIGC功能面板
 */
function createAIGCPanel() {
  const panel = document.createElement('div')
  panel.id = 'aigc-panel'
  panel.style.cssText =
    'position:fixed;right:24px;top:60px;width:280px;' +
    'background:linear-gradient(135deg,rgba(26,20,16,0.92),rgba(34,26,18,0.92));' +
    'border:1px solid rgba(139,105,20,0.4);border-radius:4px;padding:20px;' +
    'color:#C9B89C;display:none;z-index:50;' +
    'backdrop-filter:blur(12px);box-shadow:0 8px 40px rgba(0,0,0,0.5);flex-direction:column;gap:12px;'

  // 标题
  const title = document.createElement('h3')
  title.style.cssText = 'color:#D4AF37;font-size:15px;letter-spacing:3px;font-weight:300;margin:0;border-bottom:1px solid rgba(139,105,20,0.3);padding-bottom:10px;'
  title.textContent = 'AIGC 数字修复'
  panel.appendChild(title)

  // 2026主题标识
  const badge = document.createElement('div')
  badge.style.cssText = 'display:inline-block;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;padding:2px 8px;border-radius:2px;font-size:10px;letter-spacing:1px;margin-bottom:8px;'
  badge.textContent = 'AIGC 2026'
  panel.appendChild(badge)

  // 当前洞窟
  const currentCave = getCurrentCave()
  const caveName = currentCave ? currentCave + '窟' : '未进入洞窟'

  const caveInfo = document.createElement('div')
  caveInfo.id = 'aigc-cave-info'
  caveInfo.style.cssText = 'font-size:12px;color:#8a7a5a;letter-spacing:1px;'
  caveInfo.textContent = '当前洞窟: ' + caveName
  panel.appendChild(caveInfo)

  // 壁画修复按钮
  const restoreBtn = document.createElement('button')
  restoreBtn.style.cssText =
    'background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.4);' +
    'color:#D4AF37;padding:8px 16px;border-radius:3px;cursor:pointer;' +
    'font-size:12px;letter-spacing:2px;transition:all 0.3s;width:100%;'
  restoreBtn.textContent = '启动AI壁画修复'
  restoreBtn.addEventListener('mouseenter', () => {
    restoreBtn.style.background = 'rgba(212,175,55,0.2)'
  })
  restoreBtn.addEventListener('mouseleave', () => {
    restoreBtn.style.background = 'rgba(212,175,55,0.1)'
  })
  restoreBtn.addEventListener('click', () => {
    const cave = getCurrentCave()
    if (aigcModule && cave) {
      const caveIndexMap = { '285': 0, '45': 1, '217': 2, '17': 3, '3': 4 }
      const idx = caveIndexMap[cave]
      if (idx !== undefined) {
        aigcModule.triggerMuralRestore(idx)
        restoreBtn.textContent = '修复中...'
        restoreBtn.style.pointerEvents = 'none'
        const checkProgress = setInterval(() => {
          const progress = aigcModule.getRestoreProgress(idx)
          restoreBtn.textContent = '修复进度: ' + Math.round(progress * 100) + '%'
          // 更新进度条
          const bar = document.getElementById('aigc-progress-bar')
          if (bar) bar.style.width = Math.round(progress * 100) + '%'
          if (progress >= 1.0) {
            clearInterval(checkProgress)
            restoreBtn.textContent = '修复完成'
            restoreBtn.style.color = '#7BCC8A'
            restoreBtn.style.borderColor = 'rgba(123,204,138,0.4)'
            setTimeout(() => {
              restoreBtn.textContent = '启动AI壁画修复'
              restoreBtn.style.color = '#D4AF37'
              restoreBtn.style.borderColor = 'rgba(212,175,55,0.4)'
              restoreBtn.style.pointerEvents = 'auto'
            }, 3000)
          }
        }, 200)
      }
    } else {
      showToast('请先进入一个洞窟')
    }
  })
  panel.appendChild(restoreBtn)

  // 修复进度条
  const progressWrap = document.createElement('div')
  progressWrap.style.cssText = 'width:100%;height:3px;background:#2a2218;border-radius:1px;overflow:hidden;'
  const progressBar = document.createElement('div')
  progressBar.id = 'aigc-progress-bar'
  progressBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#8B6914,#D4AF37);transition:width 0.3s;'
  progressWrap.appendChild(progressBar)
  panel.appendChild(progressWrap)

  // 飞天动画开关
  const apsaraRow = document.createElement('div')
  apsaraRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:4px;'
  const apsaraLabel = document.createElement('span')
  apsaraLabel.style.cssText = 'font-size:12px;color:#8a7a5a;letter-spacing:1px;'
  apsaraLabel.textContent = '飞天动画'
  const apsaraToggle = document.createElement('button')
  apsaraToggle.id = 'apsara-toggle'
  apsaraToggle.style.cssText =
    'background:rgba(212,175,55,0.12);border:1px solid #D4AF37;color:#D4AF37;' +
    'padding:3px 10px;border-radius:2px;cursor:pointer;font-size:10px;letter-spacing:1px;'
  apsaraToggle.textContent = 'ON'
  apsaraToggle.addEventListener('click', () => {
    const isOn = apsaraToggle.textContent === 'ON'
    apsaraToggle.textContent = isOn ? 'OFF' : 'ON'
    apsaraToggle.style.color = isOn ? '#6a5a3a' : '#D4AF37'
    apsaraToggle.style.borderColor = isOn ? 'rgba(139,105,20,0.3)' : '#D4AF37'
    const scene = getScene()
    scene.traverse(child => {
      if (child.name && child.name.startsWith('飞天')) {
        child.visible = !isOn
      }
    })
  })
  apsaraRow.appendChild(apsaraLabel)
  apsaraRow.appendChild(apsaraToggle)
  panel.appendChild(apsaraRow)

  // 语音解说按钮
  const narrateBtn = document.createElement('button')
  narrateBtn.style.cssText =
    'background:rgba(91,140,106,0.1);border:1px solid rgba(91,140,106,0.4);' +
    'color:#7BCC8A;padding:8px 16px;border-radius:3px;cursor:pointer;' +
    'font-size:12px;letter-spacing:2px;transition:all 0.3s;width:100%;margin-top:4px;'
  narrateBtn.textContent = '播放AI语音解说'
  narrateBtn.addEventListener('mouseenter', () => {
    narrateBtn.style.background = 'rgba(91,140,106,0.2)'
  })
  narrateBtn.addEventListener('mouseleave', () => {
    narrateBtn.style.background = 'rgba(91,140,106,0.1)'
  })
  narrateBtn.addEventListener('click', () => {
    const cave = getCurrentCave()
    if (aigcModule && cave) {
      aigcModule.playCaveNarration(cave)
      showToast('正在播放AI语音解说...')
    } else {
      showToast('请先进入一个洞窟')
    }
  })
  panel.appendChild(narrateBtn)

  // 自动导览开关
  const autoGuideRow = document.createElement('div')
  autoGuideRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:4px;'
  const autoGuideLabel = document.createElement('span')
  autoGuideLabel.style.cssText = 'font-size:12px;color:#8a7a5a;letter-spacing:1px;'
  autoGuideLabel.textContent = '自动导览'
  const autoGuideToggle = document.createElement('button')
  autoGuideToggle.id = 'auto-guide-toggle'
  autoGuideToggle.style.cssText =
    'background:rgba(91,140,106,0.08);border:1px solid rgba(91,140,106,0.3);color:#6a8a6a;' +
    'padding:3px 10px;border-radius:2px;cursor:pointer;font-size:10px;letter-spacing:1px;transition:all 0.3s;'
  autoGuideToggle.textContent = 'OFF'
  autoGuideToggle.addEventListener('click', () => {
    if (aigcModule) {
      const enabled = aigcModule.toggleAutoGuide()
      autoGuideToggle.textContent = enabled ? 'ON' : 'OFF'
      autoGuideToggle.style.color = enabled ? '#7BCC8A' : '#6a8a6a'
      autoGuideToggle.style.borderColor = enabled ? 'rgba(91,140,106,0.5)' : 'rgba(91,140,106,0.3)'
    }
  })
  autoGuideRow.appendChild(autoGuideLabel)
  autoGuideRow.appendChild(autoGuideToggle)
  panel.appendChild(autoGuideRow)

  // 关闭按钮
  const closeBtn = document.createElement('span')
  closeBtn.style.cssText = 'position:absolute;top:10px;right:14px;cursor:pointer;color:#6a5a3a;font-size:18px;transition:color 0.2s;'
  closeBtn.textContent = '\u00d7'
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#D4AF37' })
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#6a5a3a' })
  closeBtn.addEventListener('click', () => { panel.style.display = 'none' })
  panel.appendChild(closeBtn)

  document.body.appendChild(panel)
}

function showToast(message) {
  let toast = document.getElementById('toast-notification')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'toast-notification'
    toast.style.cssText =
      'position:fixed;top:60px;left:50%;transform:translateX(-50%);' +
      'background:rgba(26,20,16,0.9);color:#C9B89C;padding:8px 20px;' +
      'border-radius:20px;font-size:12px;letter-spacing:1px;z-index:200;' +
      'backdrop-filter:blur(8px);border:1px solid rgba(139,105,20,0.3);' +
      'opacity:0;transition:opacity 0.3s;pointer-events:none;'
    document.body.appendChild(toast)
  }
  toast.textContent = message
  toast.style.opacity = '1'
  setTimeout(() => { toast.style.opacity = '0' }, 2500)
}

// ============================================================
// 缩略导览地图
// ============================================================

function drawMinimap() {
  const canvas = document.getElementById('minimap-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)

  const bgGradient = ctx.createLinearGradient(0, 0, w, h)
  bgGradient.addColorStop(0, '#2a1e14')
  bgGradient.addColorStop(1, '#1a1410')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, w, h)

  const cavePositions = getCavePositions()
  const caveKeys = Object.keys(cavePositions)

  const xMin = 6, xMax = 44
  const mapXMin = 20, mapXMax = w - 20
  const mapY = h / 2

  ctx.strokeStyle = '#5a4a32'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(mapXMin, mapY)
  ctx.lineTo(mapXMax, mapY)
  ctx.stroke()
  ctx.setLineDash([])

  caveKeys.forEach(key => {
    const cave = cavePositions[key]
    const x = mapXMin + ((cave.x - xMin) / (xMax - xMin)) * (mapXMax - mapXMin)

    ctx.fillStyle = '#c4a668'
    ctx.beginPath()
    ctx.arc(x, mapY, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(196, 166, 104, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, mapY, 8, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#8a7a5a'
    ctx.font = '9px Microsoft YaHei'
    ctx.textAlign = 'center'
    ctx.fillText(key + '窟', x, mapY - 12)
  })

  ctx.fillStyle = '#c4a668'
  ctx.font = 'bold 10px Microsoft YaHei'
  ctx.textAlign = 'left'
  ctx.fillText('展馆导览图', 8, 14)
}

function updateMinimap() {
  const canvas = document.getElementById('minimap-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  drawMinimap()

  const camera = getCamera()
  if (!camera) return

  const xMin = 6, xMax = 44
  const mapXMin = 20, mapXMax = w - 20
  const mapY = h / 2

  const camX = camera.position.x
  const dotX = mapXMin + ((camX - xMin) / (xMax - xMin)) * (mapXMax - mapXMin)
  const clampedX = Math.max(mapXMin - 10, Math.min(mapXMax + 10, dotX))

  const time = performance.now() * 0.003
  const pulseRadius = 4 + Math.sin(time) * 2

  ctx.strokeStyle = 'rgba(196, 69, 54, 0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(clampedX, mapY, pulseRadius + 4, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#C44536'
  ctx.beginPath()
  ctx.arc(clampedX, mapY, 4, 0, Math.PI * 2)
  ctx.fill()

  const currentCave = getCurrentCave()
  if (currentCave) {
    const cavePositions = getCavePositions()
    const cave = cavePositions[currentCave]
    if (cave) {
      const caveX = mapXMin + ((cave.x - xMin) / (xMax - xMin)) * (mapXMax - mapXMin)
      ctx.strokeStyle = '#C44536'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(caveX, mapY, 9, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

window.addEventListener('resize', onWindowResize)
main()

// ============================================================
// 自适应性能系统
// ============================================================

// FPS监测
const fpsMonitor = {
  frames: 0,
  lastCheck: performance.now(),
  currentFPS: 60,
  degraded: false,
}

/**
 * 自适应性能：FPS持续低于阈值时自动降级渲染质量
 * - FPS<30：降低像素比到1.0，隐藏粒子系统
 * - FPS恢复到45+：恢复原始质量
 */
function adaptivePerformance(delta) {
  fpsMonitor.frames++
  const now = performance.now()

  // 每1秒检测一次FPS
  if (now - fpsMonitor.lastCheck < 1000) return

  fpsMonitor.currentFPS = Math.round(fpsMonitor.frames * 1000 / (now - fpsMonitor.lastCheck))
  fpsMonitor.frames = 0
  fpsMonitor.lastCheck = now

  const renderer = getRenderer()
  if (!renderer) return

  if (fpsMonitor.currentFPS < 30 && !fpsMonitor.degraded) {
    // 降级：降低像素比，隐藏粒子
    fpsMonitor.degraded = true
    renderer.setPixelRatio(1.0)
    renderer.setSize(window.innerWidth, window.innerHeight)
    // 隐藏粒子系统
    const scene = getScene()
    scene.traverse((child) => {
      if (child.name === '花瓣飘落' || child.name === '金沙漂浮') {
        child.visible = false
      }
    })
    console.log('[性能] FPS过低(' + fpsMonitor.currentFPS + ')，已降级渲染质量')
  } else if (fpsMonitor.currentFPS >= 45 && fpsMonitor.degraded) {
    // 恢复
    fpsMonitor.degraded = false
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight)
    const scene = getScene()
    scene.traverse((child) => {
      if (child.name === '花瓣飘落' || child.name === '金沙漂浮') {
        child.visible = true
      }
    })
    console.log('[性能] FPS恢复(' + fpsMonitor.currentFPS + ')，已恢复渲染质量')
  }
}
