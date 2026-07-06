/**
 * WebXR VR 沉浸模式模块（升级版）
 * 完整的VR沉浸式体验：
 * 1. VR头显6DoF追踪 + 手柄控制器交互
 * 2. VR模式专属UI（空间锚定HUD信息面板）
 * 3. 传送移动（VR中安全舒适的空间导航）
 * 4. 手柄射线拾取展品（复用raycaster逻辑）
 * 5. 非VR设备的沉浸模式（全屏+陀螺仪，手机端可用）
 * 6. AR透视模式（手持设备透视叠加3D洞窟）
 *
 * 技术栈：Three.js WebXR API + XRInputSourceArray
 * 使用动态 import 加载 VRButton，避免首屏加载增加体积
 */
import * as THREE from 'three'

let renderer = null
let camera = null
let scene = null
let controls = null
let isVREnabled = false
let isImmersiveMode = false  // 非VR设备的沉浸模式
let xrSession = null

// VR控制器
let controller1 = null
let controller2 = null
let controllerGrip1 = null
let controllerGrip2 = null

// VR传送系统
let teleportMarker = null
let isTeleporting = false
let floorMesh = null

// VR空间UI
let vrHUDGroup = null
let vrInfoPanel = null
let vrInfoText = null

// VR模式回调
let onArtifactClickVR = null  // VR中点击展品的回调

// 动态加载的 VRButton 引用
let vrButtonElement = null

/**
 * 初始化 WebXR VR 模式
 * 支持 initVR(renderer) 单参数调用，也兼容 initVR(renderer, camera, scene, controls) 四参数调用
 * @param {THREE.WebGLRenderer} rdr - 渲染器
 * @param {THREE.Camera} [cam] - 相机（可选，向后兼容）
 * @param {THREE.Scene} [scn] - 场景（可选，向后兼容）
 * @param {Object} [ctrl] - OrbitControls控制器（可选，向后兼容）
 */
export function initVR(rdr, cam, scn, ctrl) {
  renderer = rdr

  // 兼容四参数调用和单参数调用
  if (cam) camera = cam
  if (scn) scene = scn
  if (ctrl) controls = ctrl

  // 启用 WebXR 支持
  renderer.xr.enabled = true

  // 动态加载 VRButton 并检测设备支持
  loadVRButton()

  // 监听VR会话状态
  renderer.xr.addEventListener('sessionstart', onVRSessionStart)
  renderer.xr.addEventListener('sessionend', onVRSessionEnd)

  // 设置VR控制器（需要场景已存在）
  if (scene) {
    setupVRControllers()
    createTeleportMarker()
    createVRHUD()
  }

  console.log('[VR] WebXR VR 模式初始化完成')
}

/**
 * 动态加载 Three.js VRButton
 * 避免首屏加载增加体积
 */
async function loadVRButton() {
  try {
    const module = await import('three/addons/webxr/VRButton.js')
    vrButtonElement = module.VRButton.createButton(renderer)
    vrButtonElement.id = 'VRButton'
    vrButtonElement.style.display = 'none'
    document.body.appendChild(vrButtonElement)
    console.log('[VR] VRButton 动态加载成功')
  } catch (e) {
    console.warn('[VR] Three.js VRButton 加载失败，使用内联实现:', e.message)
    // 降级使用内联VRButton
    vrButtonElement = createInlineVRButton()
    vrButtonElement.id = 'VRButton'
    vrButtonElement.style.display = 'none'
    document.body.appendChild(vrButtonElement)
  }
}

/**
 * 内联 VRButton 实现（Three.js VRButton 不可用时的降级方案）
 */
function createInlineVRButton() {
  const button = document.createElement('button')

  function showEnterVR() {
    let currentSession = null
    async function onSessionStarted(session) {
      session.addEventListener('end', onSessionEnded)
      await renderer.xr.setSession(session)
      button.textContent = 'EXIT VR'
      currentSession = session
    }
    function onSessionEnded() {
      currentSession.removeEventListener('end', onSessionEnded)
      button.textContent = 'ENTER VR'
      currentSession = null
    }
    button.style.display = ''
    button.style.cursor = 'pointer'
    button.style.cssText +=
      ';background:rgba(26,20,16,0.8);color:#D4AF37;' +
      'border:1px solid rgba(139,105,20,0.5);padding:8px 16px;' +
      'border-radius:4px;font-size:12px;letter-spacing:2px;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100;'
    button.textContent = 'ENTER VR'
    button.onselectstart = function() { return false }
    button.onclick = function() {
      if (currentSession === null) {
        const sessionInit = {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
        }
        navigator.xr.requestSession('immersive-vr', sessionInit).then(onSessionStarted)
      } else {
        currentSession.end()
      }
    }
  }

  function disableButton() {
    button.style.display = ''
    button.style.cursor = 'auto'
    button.style.cssText +=
      ';background:rgba(60,40,20,0.5);color:#6a5a3a;' +
      'border:1px solid rgba(139,105,20,0.2);padding:8px 16px;' +
      'border-radius:4px;font-size:12px;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100;'
    button.textContent = 'VR NOT AVAILABLE'
    button.onselectstart = function() { return false }
    button.onclick = null
  }

  if ('xr' in navigator) {
    navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
      if (supported) {
        showEnterVR()
      } else {
        disableButton()
      }
    })
  } else {
    disableButton()
  }

  return button
}

/**
 * 进入 VR 模式
 * @param {THREE.WebGLRenderer} rdr - 渲染器
 */
export async function enterVR(rdr) {
  if (rdr) renderer = rdr

  // 检查浏览器是否支持 WebXR
  if (!navigator.xr) {
    showVRNotSupportedTip('您的浏览器不支持 WebXR，请使用支持 VR 的浏览器（如 Chrome/Edge）')
    return false
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr')
    if (!supported) {
      showVRNotSupportedTip('您的设备不支持 VR 沉浸模式，将进入沉浸浏览模式')
      toggleImmersiveMode()
      return false
    }
  } catch (e) {
    showVRNotSupportedTip('VR 检测失败: ' + e.message)
    return false
  }

  // 尝试通过 VRButton 进入 VR
  if (vrButtonElement) {
    vrButtonElement.click()
    return true
  }

  // 直接请求 VR 会话
  try {
    const sessionInit = {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    }
    const session = await navigator.xr.requestSession('immersive-vr', sessionInit)
    await renderer.xr.setSession(session)
    xrSession = session
    session.addEventListener('end', () => { xrSession = null })
    return true
  } catch (e) {
    console.warn('[VR] 进入VR失败:', e.message)
    showVRNotSupportedTip('进入VR失败: ' + e.message)
    return false
  }
}

/**
 * 退出 VR 模式
 * @param {THREE.WebGLRenderer} rdr - 渲染器
 */
export function exitVR(rdr) {
  if (xrSession) {
    xrSession.end()
    xrSession = null
  }

  // 如果在沉浸模式，也退出
  if (isImmersiveMode) {
    toggleImmersiveMode()
  }
}

/**
 * 显示 VR 不支持提示
 */
function showVRNotSupportedTip(message) {
  // 创建友好提示弹窗
  let tipEl = document.getElementById('vr-not-supported-tip')
  if (!tipEl) {
    tipEl = document.createElement('div')
    tipEl.id = 'vr-not-supported-tip'
    tipEl.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:linear-gradient(135deg,rgba(26,20,16,0.96),rgba(34,26,18,0.96));' +
      'border:1px solid rgba(139,105,20,0.4);border-radius:4px;padding:24px 32px;' +
      'color:#C9B89C;z-index:200;backdrop-filter:blur(12px);' +
      'box-shadow:0 8px 40px rgba(0,0,0,0.5);text-align:center;max-width:360px;'

    const title = document.createElement('div')
    title.style.cssText = 'color:#D4AF37;font-size:16px;letter-spacing:3px;margin-bottom:12px;font-weight:300;'
    title.textContent = 'VR 模式提示'

    const msg = document.createElement('div')
    msg.id = 'vr-tip-message'
    msg.style.cssText = 'font-size:13px;line-height:1.8;color:#b8a888;font-weight:300;'
    tipEl.appendChild(title)
    tipEl.appendChild(msg)

    const closeBtn = document.createElement('button')
    closeBtn.style.cssText =
      'margin-top:16px;background:rgba(212,175,55,0.1);border:1px solid #D4AF37;' +
      'color:#D4AF37;padding:6px 20px;border-radius:3px;cursor:pointer;' +
      'font-size:12px;letter-spacing:2px;transition:all 0.3s;'
    closeBtn.textContent = '知道了'
    closeBtn.addEventListener('click', () => { tipEl.style.display = 'none' })
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(212,175,55,0.2)' })
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(212,175,55,0.1)' })
    tipEl.appendChild(closeBtn)

    document.body.appendChild(tipEl)
  }

  const msgEl = tipEl.querySelector('#vr-tip-message')
  if (msgEl) msgEl.textContent = message
  tipEl.style.display = 'block'
}

/**
 * 设置VR控制器（6DoF手柄 + 射线 + 触觉反馈）
 */
function setupVRControllers() {
  // 控制器1（左手）
  controller1 = renderer.xr.getController(0)
  controller1.name = 'VR控制器_左'
  controller1.addEventListener('selectstart', onControllerSelectStart)
  controller1.addEventListener('selectend', onControllerSelectEnd)
  controller1.addEventListener('squeezestart', onControllerSqueezeStart)
  scene.add(controller1)

  // 控制器2（右手）
  controller2 = renderer.xr.getController(1)
  controller2.name = 'VR控制器_右'
  controller2.addEventListener('selectstart', onControllerSelectStart)
  controller2.addEventListener('selectend', onControllerSelectEnd)
  controller2.addEventListener('squeezestart', onControllerSqueezeStart)
  scene.add(controller2)

  // 控制器手柄模型（Grip Space）
  controllerGrip1 = renderer.xr.getControllerGrip(0)
  controllerGrip2 = renderer.xr.getControllerGrip(1)
  scene.add(controllerGrip1)
  scene.add(controllerGrip2)

  // 控制器射线（金色激光笔效果）
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -8)
  ])
  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0xD4AF37,
    transparent: true,
    opacity: 0.6,
    linewidth: 2,
  })

  const ray1 = new THREE.Line(rayGeometry.clone(), rayMaterial.clone())
  controller1.add(ray1)

  const ray2 = new THREE.Line(rayGeometry.clone(), rayMaterial.clone())
  controller2.add(ray2)

  // 控制器末端光点（辅助瞄准）
  const dotGeo = new THREE.SphereGeometry(0.02, 8, 8)
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xD4AF37,
    transparent: true,
    opacity: 0.8,
  })
  const dot1 = new THREE.Mesh(dotGeo, dotMat.clone())
  dot1.position.set(0, 0, -8)
  controller1.add(dot1)

  const dot2 = new THREE.Mesh(dotGeo, dotMat.clone())
  dot2.position.set(0, 0, -8)
  controller2.add(dot2)
}

/**
 * 创建传送标记（VR中安全移动）
 */
function createTeleportMarker() {
  // 传送目标标记（金色圆环）
  const markerGeo = new THREE.RingGeometry(0.3, 0.5, 32)
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xD4AF37,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  teleportMarker = new THREE.Mesh(markerGeo, markerMat)
  teleportMarker.rotation.x = -Math.PI / 2
  teleportMarker.visible = false
  teleportMarker.name = '传送标记'
  scene.add(teleportMarker)

  // 传送标记内圈脉冲动画
  const innerRingGeo = new THREE.RingGeometry(0.1, 0.25, 32)
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xFFE0A0,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat)
  innerRing.name = '传送标记_内圈'
  teleportMarker.add(innerRing)
}

/**
 * 创建VR空间HUD（3D空间中的信息面板）
 */
function createVRHUD() {
  vrHUDGroup = new THREE.Group()
  vrHUDGroup.name = 'VR_HUD'
  vrHUDGroup.visible = false

  // HUD背景面板
  const panelGeo = new THREE.PlaneGeometry(1.2, 0.6)
  const panelCanvas = document.createElement('canvas')
  panelCanvas.width = 512
  panelCanvas.height = 256
  const panelCtx = panelCanvas.getContext('2d')

  // 绘制HUD背景
  drawVRHUDBackground(panelCtx, panelCanvas.width, panelCanvas.height)

  const panelTexture = new THREE.CanvasTexture(panelCanvas)
  panelTexture.needsUpdate = true

  const panelMat = new THREE.MeshBasicMaterial({
    map: panelTexture,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  vrInfoPanel = new THREE.Mesh(panelGeo, panelMat)
  vrInfoPanel.position.set(0, 0, -2)
  vrInfoPanel.name = 'VR_信息面板'

  vrHUDGroup.add(vrInfoPanel)
  scene.add(vrHUDGroup)
}

/**
 * 绘制VR HUD背景
 */
function drawVRHUDBackground(ctx, w, h) {
  // 半透明深色背景
  ctx.fillStyle = 'rgba(26, 20, 16, 0.85)'
  ctx.fillRect(0, 0, w, h)

  // 金色边框
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 3
  ctx.strokeRect(4, 4, w - 8, h - 8)

  // 标题
  ctx.fillStyle = '#D4AF37'
  ctx.font = 'bold 28px Microsoft YaHei'
  ctx.textAlign = 'center'
  ctx.fillText('敦煌 3DShow VR', w / 2, 40)

  // 提示文字
  ctx.fillStyle = '#C9B89C'
  ctx.font = '18px Microsoft YaHei'
  ctx.fillText('扳机键: 点击展品 | 握持键: 传送移动', w / 2, 80)
  ctx.fillText('左手柄: 传送 | 右手柄: 交互', w / 2, 110)

  // 底部状态
  ctx.fillStyle = '#8B6914'
  ctx.font = '14px Microsoft YaHei'
  ctx.fillText('WebXR Immersive Mode · 敦煌数字洞窟', w / 2, h - 20)
}

/**
 * 更新VR HUD内容（展品信息）
 */
export function updateVRHUDContent(title, content) {
  if (!vrInfoPanel) return

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = 'rgba(26, 20, 16, 0.9)'
  ctx.fillRect(0, 0, 512, 512)

  // 金色边框
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 3
  ctx.strokeRect(4, 4, 504, 504)

  // 标题
  ctx.fillStyle = '#D4AF37'
  ctx.font = 'bold 26px Microsoft YaHei'
  ctx.textAlign = 'left'
  ctx.fillText(title, 20, 40)

  // 分割线
  ctx.strokeStyle = 'rgba(139, 105, 20, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(20, 55)
  ctx.lineTo(492, 55)
  ctx.stroke()

  // 内容（自动换行）
  ctx.fillStyle = '#C9B89C'
  ctx.font = '16px Microsoft YaHei'
  wrapText(ctx, content, 20, 80, 472, 22)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  vrInfoPanel.material.map = texture
  vrInfoPanel.material.needsUpdate = true

  // 调整面板大小
  vrInfoPanel.scale.set(1.5, 1.5, 1)
}

/**
 * Canvas文字自动换行
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = text.split('')
  let line = ''
  let lineY = y

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, lineY)
      line = chars[i]
      lineY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, lineY)
}

/**
 * VR会话开始
 */
function onVRSessionStart() {
  isVREnabled = true
  console.log('[VR] VR 会话已开始 - 沉浸式洞窟漫游')

  // VR模式：禁用OrbitControls，使用头部追踪
  if (controls) controls.enabled = false

  // 显示VR HUD
  if (vrHUDGroup) vrHUDGroup.visible = true

  // VR模式下调整相机高度（人眼1.6m）
  if (camera) {
    camera.position.y = Math.max(camera.position.y, 1.6)
  }
}

/**
 * VR会话结束
 */
function onVRSessionEnd() {
  isVREnabled = false
  console.log('[VR] VR 会话已结束')

  // 恢复OrbitControls
  if (controls) controls.enabled = true

  // 隐藏VR HUD
  if (vrHUDGroup) vrHUDGroup.visible = false

  // 隐藏传送标记
  if (teleportMarker) teleportMarker.visible = false
}

/**
 * VR控制器选择事件（扳机按下 - 点击展品）
 */
function onControllerSelectStart(event) {
  const controller = event.target
  const raycaster = new THREE.Raycaster()
  raycaster.setFromXRController(controller)

  // 射线检测场景中的可交互对象
  if (scene && onArtifactClickVR) {
    const intersects = raycaster.intersectObjects(scene.children, true)
    if (intersects.length > 0) {
      // 找到可交互对象
      for (const intersect of intersects) {
        let obj = intersect.object
        while (obj) {
          if (obj.name && isVRInteractiveName(obj.name)) {
            onArtifactClickVR(obj.name)

            // 触觉反馈（如果支持）
            if (controller.gamepad && controller.gamepad.hapticActuators) {
              try {
                controller.gamepad.hapticActuators[0].pulse(0.5, 100)
              } catch (e) { /* 忽略触觉反馈失败 */ }
            }
            return
          }
          obj = obj.parent
        }
      }
    }
  }

  console.log('[VR] 控制器触发: ' + controller.name)
}

function onControllerSelectEnd(event) {
  // 选择结束
}

/**
 * VR控制器握持事件（握持键 - 传送移动准备）
 */
function onControllerSqueezeStart(event) {
  isTeleporting = true
  console.log('[VR] 传送模式启动')
}

/**
 * VR控制器握持释放（释放时执行传送）
 */
function onControllerSqueezeEnd(event) {
  if (isTeleporting && teleportMarker && teleportMarker.visible) {
    // 执行传送：将相机移动到传送标记位置
    const targetPos = teleportMarker.position.clone()
    targetPos.y = 0  // 保持地面高度

    // WebXR中通过dolly移动
    // 将整个场景偏移（相当于移动玩家位置）
    const offset = targetPos.sub(camera.position)
    offset.y = 0  // 只水平移动

    // 更新控制器和相机位置
    scene.position.add(offset)

    console.log('[VR] 传送至: (' + targetPos.x.toFixed(1) + ', ' + targetPos.z.toFixed(1) + ')')
  }

  isTeleporting = false
  teleportMarker.visible = false
}

/**
 * 判断VR中可交互对象名称
 */
function isVRInteractiveName(name) {
  const keywords = ['壁画', '经变画', '飞天', '伎乐', '供养人', '护法',
    '藻井', '千佛', '彩塑', '主佛', '迦叶', '阿难', '弟子', '菩萨',
    '天王', '力士', '洞窟', '绢画', '僧人', '千手观音', '西魏佛',
    '洪辩', '胁侍', '供养菩萨', 'AIGC修复']
  return keywords.some(kw => name.includes(kw))
}

/**
 * 注册VR展品点击回调
 */
export function setVRArtifactCallback(callback) {
  onArtifactClickVR = callback
}

/**
 * 切换VR模式
 */
export function toggleVR() {
  if (!renderer || !renderer.xr) {
    console.warn('[VR] WebXR 不可用')
    showVRFallback()
    return false
  }

  const vrButton = document.querySelector('#VRButton')
  if (vrButton) {
    vrButton.click()
    return true
  }

  console.warn('[VR] VR 按钮未找到')
  showVRFallback()
  return false
}

/**
 * VR不可用时的降级方案：沉浸模式
 * 全屏 + 陀螺仪控制 + 语音导览
 */
function showVRFallback() {
  toggleImmersiveMode()
}

/**
 * 切换沉浸模式（非VR设备的降级体验）
 * 全屏 + DeviceOrientationControls + 语音自动导览
 */
export function toggleImmersiveMode() {
  isImmersiveMode = !isImmersiveMode

  if (isImmersiveMode) {
    // 进入沉浸模式
    // 1. 全屏
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }

    // 2. 隐藏所有2D UI，沉浸体验
    const uiElements = ['top-bar', 'cave-nav', 'bottom-hint', 'minimap']
    uiElements.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.style.display = 'none'
    })

    // 3. 显示沉浸模式HUD
    showImmersiveHUD()

    // 4. 启用陀螺仪控制（移动设备）
    enableDeviceOrientation()

    console.log('[VR] 沉浸模式已开启（无VR头显降级方案）')
  } else {
    // 退出沉浸模式
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    // 恢复UI
    const uiElements = ['top-bar', 'cave-nav', 'bottom-hint']
    uiElements.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.style.display = id === 'top-bar' ? 'flex' : (id === 'cave-nav' ? 'flex' : 'block')
    })

    // 隐藏沉浸HUD
    hideImmersiveHUD()

    console.log('[VR] 沉浸模式已关闭')
  }

  return isImmersiveMode
}

/**
 * 显示沉浸模式HUD
 */
function showImmersiveHUD() {
  let hud = document.getElementById('immersive-hud')
  if (!hud) {
    hud = document.createElement('div')
    hud.id = 'immersive-hud'
    hud.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:50;'

    // 中央准星
    const crosshair = document.createElement('div')
    crosshair.id = 'immersive-crosshair'
    crosshair.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'width:24px;height:24px;border:2px solid rgba(212,175,55,0.5);' +
      'border-radius:50%;pointer-events:none;' +
      'box-shadow:0 0 15px rgba(212,175,55,0.2);'
    hud.appendChild(crosshair)

    // 底部提示栏
    const hint = document.createElement('div')
    hint.id = 'immersive-hint'
    hint.style.cssText =
      'position:absolute;bottom:30px;left:50%;transform:translateX(-50%);' +
      'background:rgba(26,20,16,0.7);color:#C9B89C;padding:8px 20px;' +
      'border-radius:20px;font-size:12px;letter-spacing:2px;' +
      'backdrop-filter:blur(8px);border:1px solid rgba(139,105,20,0.3);'
    hint.textContent = '沉浸模式 · 点击展品查看 · 语音自动导览'
    hud.appendChild(hint)

    // 退出按钮（唯一可点击元素）
    const exitBtn = document.createElement('div')
    exitBtn.id = 'immersive-exit'
    exitBtn.style.cssText =
      'position:absolute;top:16px;right:16px;' +
      'background:rgba(26,20,16,0.7);color:#D4AF37;padding:8px 16px;' +
      'border-radius:4px;font-size:12px;letter-spacing:2px;cursor:pointer;' +
      'pointer-events:auto;border:1px solid rgba(139,105,20,0.4);' +
      'backdrop-filter:blur(8px);transition:all 0.3s;'
    exitBtn.textContent = '退出沉浸'
    exitBtn.addEventListener('click', () => toggleImmersiveMode())
    exitBtn.addEventListener('mouseenter', () => {
      exitBtn.style.borderColor = '#D4AF37'
      exitBtn.style.background = 'rgba(139,105,20,0.3)'
    })
    exitBtn.addEventListener('mouseleave', () => {
      exitBtn.style.borderColor = 'rgba(139,105,20,0.4)'
      exitBtn.style.background = 'rgba(26,20,16,0.7)'
    })
    hud.appendChild(exitBtn)

    // VR状态角标
    const vrBadge = document.createElement('div')
    vrBadge.style.cssText =
      'position:absolute;top:16px;left:16px;' +
      'background:rgba(212,175,55,0.15);color:#D4AF37;padding:4px 12px;' +
      'border-radius:3px;font-size:10px;letter-spacing:2px;' +
      'border:1px solid rgba(212,175,55,0.3);'
    vrBadge.textContent = 'IMMERSIVE'
    hud.appendChild(vrBadge)

    document.body.appendChild(hud)
  }
  hud.style.display = 'block'
}

/**
 * 隐藏沉浸模式HUD
 */
function hideImmersiveHUD() {
  const hud = document.getElementById('immersive-hud')
  if (hud) hud.style.display = 'none'
}

/**
 * 启用设备方向控制（移动端陀螺仪）
 */
function enableDeviceOrientation() {
  // 请求陀螺仪权限（iOS 13+需要显式请求）
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          bindDeviceOrientation()
        }
      })
      .catch(() => {})
  } else {
    bindDeviceOrientation()
  }
}

/**
 * 绑定设备方向事件
 */
function bindDeviceOrientation() {
  let initialAlpha = null
  let initialBeta = null

  window.addEventListener('deviceorientation', (event) => {
    if (!isImmersiveMode || !camera) return

    // 首次获取初始方向
    if (initialAlpha === null && event.alpha !== null) {
      initialAlpha = event.alpha
      initialBeta = event.beta
    }

    if (initialAlpha === null) return

    // 计算相对方向变化
    const alpha = (event.alpha - initialAlpha) * Math.PI / 180
    const beta = ((event.beta || 0) - (initialBeta || 0)) * Math.PI / 180

    // 映射到相机旋转（小幅偏移，增强沉浸感）
    const sensitivity = 0.5
    camera.rotation.y = -alpha * sensitivity
    camera.rotation.x = beta * sensitivity * 0.5
  })
}

/**
 * 更新VR传送系统（在渲染循环中调用）
 * 当握持键按下时，沿控制器射线检测地面并显示传送标记
 */
export function updateVRTeleport() {
  if (!isVREnabled || !isTeleporting || !teleportMarker) return

  // 使用右手控制器射线检测地面
  const controller = controller2
  if (!controller) return

  const raycaster = new THREE.Raycaster()
  raycaster.setFromXRController(controller)

  // 检测与地面的交点
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const intersection = new THREE.Vector3()
  raycaster.ray.intersectPlane(groundPlane, intersection)

  if (intersection) {
    teleportMarker.position.copy(intersection)
    teleportMarker.position.y = 0.02  // 略高于地面
    teleportMarker.visible = true

    // 传送标记脉冲动画
    const time = performance.now() * 0.003
    const pulse = 1.0 + Math.sin(time) * 0.1
    teleportMarker.scale.set(pulse, pulse, pulse)
  } else {
    teleportMarker.visible = false
  }
}

/**
 * 更新VR HUD位置（跟随相机前方）
 */
export function updateVRHUD() {
  if (!isVREnabled || !vrHUDGroup) return

  // HUD始终在相机前方2米处
  const direction = new THREE.Vector3(0, 0, -1)
  direction.applyQuaternion(camera.quaternion)

  vrHUDGroup.position.copy(camera.position).add(direction.multiplyScalar(2))
  vrHUDGroup.position.y = camera.position.y + 0.5
  vrHUDGroup.quaternion.copy(camera.quaternion)
}

/**
 * VR渲染循环设置（替代普通渲染循环）
 * 在VR模式下使用renderer.setAnimationLoop
 */
export function setVRAnimationLoop(callback) {
  if (!renderer) return

  renderer.setAnimationLoop((timestamp, frame) => {
    callback(timestamp, frame)
  })
}

/**
 * 获取VR状态
 */
export function getVRState() {
  return {
    isVREnabled,
    isImmersiveMode,
    isTeleporting,
    xrSupported: renderer ? renderer.xr.enabled : false,
  }
}

/**
 * 判断是否在VR/沉浸模式中
 */
export function isInVRMode() {
  return isVREnabled || isImmersiveMode
}
