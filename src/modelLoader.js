/**
 * glTF 模型加载模块
 * 读取从 dunhuang_museum.blend 导出的 glb 文件
 * 实现异步加载、加载进度提示、塑像自带动画播放
 * 优化：meshopt 压缩（比 Draco 更快解码）、WebP 纹理、渐进式渲染
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

// 全局模型引用
let loadedModel = null

// glb 模型路径（使用 Vite base 路径，适配 GitHub Pages 部署）
const BASE = import.meta.env.BASE_URL
const MODEL_URL = BASE + 'models/dunhuang_museum_v3.glb'

/**
 * 异步加载 glb 模型
 * @param {string} url - glb 文件路径
 * @param {Function} onProgress - 加载进度回调 (0~1)
 * @returns {Promise<THREE.Group>} 加载完成的模型
 */
export function loadModel(url = MODEL_URL, onProgress) {
  return new Promise((resolve, reject) => {
    // --- glTF 加载器 ---
    const loader = new GLTFLoader()
    // meshopt 解码器（WASM，解码速度比 Draco 快 2-3 倍）
    loader.setMeshoptDecoder(MeshoptDecoder)

    console.log('[模型] 开始加载 glb: ' + url)
    console.log('%c[模型] ⚠️ 重要：当前加载的是 v3.glb（已删除洞窟文字标签）', 'background:#D4AF37;color:#1a1410;padding:2px 6px;border-radius:2px;font-weight:bold;')
    console.log('[模型] 如果仍看到洞窟文字，请检查：1) 浏览器是否缓存了旧 JS 2) 是否有旧 Service Worker')
    console.log('[模型] 提示：按 Ctrl+Shift+R 强制刷新，或在 DevTools 中 Disable cache')

    // 记录开始时间，用于估算进度
    let lastLoaded = 0
    let estimatedTotal = 0

    loader.load(
      url,
      // 加载完成回调
      (gltf) => {
        const model = gltf.scene

        // 加载完成时强制进度为 100%（彻底解决进度条超过 100% 问题）
        if (onProgress) {
          onProgress(1.0)
        }

        // 遍历模型，设置阴影和材质，删除文字对象
        const meshesToRemove = []
        model.traverse((child) => {
          if (child.isMesh) {
            // 删除模型自带的文字对象（名称匹配）
            if (isTextObject(child.name)) {
              meshesToRemove.push(child)
              return
            }
            // 删除模型自带的标签板/框（几何特征匹配）
            if (isTextByGeometry(child)) {
              meshesToRemove.push(child)
              return
            }
            // 删除洞窟入口前的"窟号立牌"（InstancedMesh，5个实例位于5个洞窟入口前1.5米）
            if (child.isInstancedMesh && isCaveNumberSignage(child)) {
              meshesToRemove.push(child)
              return
            }
            // 删除后墙"窟号牌匾"（InstancedMesh，5个实例位于5个洞窟后墙中央，文字与洞窟不对应）
            if (child.isInstancedMesh && isBackWallPlaque(child)) {
              meshesToRemove.push(child)
              return
            }
            // 删除后墙文字牌匾（普通 Mesh，位于洞窟后墙中央的非结构对象）
            if (isBackWallTextMesh(child)) {
              meshesToRemove.push(child)
              return
            }

            child.castShadow = true
            child.receiveShadow = true

            if (!child.name || child.name === '' || child.name.startsWith('立方体') || child.name.startsWith('平面') || child.name.startsWith('柱体') || child.name.startsWith('棱角球')) {
              assignStatueName(child)
            }

            child.userData.interactive = isInteractiveObject(child.name)
          }
        })

        // 移除文字对象
        for (const mesh of meshesToRemove) {
          if (mesh.parent) {
            mesh.parent.remove(mesh)
            console.log('[模型] 删除文字/立牌对象:', mesh.name)
          }
        }

        // === 调试日志：dump 所有非实例化 mesh 的世界坐标和包围盒 ===
        console.log('[模型调试] === 所有非实例化 mesh 列表 ===')
        model.traverse((child) => {
          if (child.isMesh && !child.isInstancedMesh) {
            child.updateWorldMatrix(true, true)
            const box = new THREE.Box3().setFromObject(child)
            const size = new THREE.Vector3()
            box.getSize(size)
            const center = new THREE.Vector3()
            box.getCenter(center)
            console.log(`[Mesh] name="${child.name}" center=(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}) size=(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`)
          }
        })
        console.log('[模型调试] === dump 完成 ===')

        // --- 动画混合器（如果 glb 模型自带动画）---
        if (gltf.animations && gltf.animations.length > 0) {
          model.mixer = new THREE.AnimationMixer(model)
          // 播放第一个动画
          const action = model.mixer.clipAction(gltf.animations[0])
          action.play()
          console.log('[模型] 检测到 ' + gltf.animations.length + ' 个动画，已播放第一个')
        }

        // --- 相机适配：根据模型包围盒调整相机 ---
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        console.log('[模型] 模型尺寸:', size.x.toFixed(1) + 'x' + size.y.toFixed(1) + 'x' + size.z.toFixed(1))
        console.log('[模型] 模型中心:', center.x.toFixed(1) + ', ' + center.y.toFixed(1) + ', ' + center.z.toFixed(1))

        loadedModel = model
        console.log('[模型] glb 加载完成')
        resolve(model)
      },
      // 加载进度回调
      (xhr) => {
        if (onProgress) {
          let progress = 0
          if (xhr.lengthComputable) {
            // 服务器返回了 Content-Length，可以精确计算进度
            estimatedTotal = xhr.total
            progress = xhr.loaded / Math.max(xhr.total, 1)
          } else if (estimatedTotal > 0) {
            // 使用之前估算的总大小计算进度
            progress = xhr.loaded / estimatedTotal
          } else {
            // 首次收到数据但不知道总大小，根据已下载量估算
            // 模型约 13MB，首次收到数据时估算总大小
            if (xhr.loaded > 0 && lastLoaded === 0) {
              estimatedTotal = 13 * 1024 * 1024 // 13MB 估算值
            }
            if (estimatedTotal > 0) {
              progress = xhr.loaded / estimatedTotal
            } else {
              // 完全无法估算时，显示最低进度表示正在下载
              progress = 0.05
            }
          }
          // 进度限制在 0~0.95 之间（加载完成时才到 100%，彻底解决进度超过 100%）
          progress = Math.max(0, Math.min(progress, 0.95))
          onProgress(progress)
          lastLoaded = xhr.loaded
        }
      },
      // 加载错误回调
      (error) => {
        console.error('[模型] glb 加载失败:', error)
        reject(error)
      }
    )
  })
}

/**
 * 洞窟雕塑位置映射表
 * 坐标映射：Blender(X,Y,Z) → Three.js(X,Y_up,-Z_forward)
 * 即 Blender Y轴(左右) 映射为 Three.js -Z轴(取反)
 * cx=深度, cz=左右(取反Blender Y)
 * 位置信息来自 Blender 脚本 create_dunhuang_museum.py
 * CAVE_DEPTH=8, x_start: 285=8, 45=15, 217=22, 17=29, 3=36
 * niche_x = x_start + CAVE_DEPTH - 1.5
 */
const STATUE_POSITIONS = [
  // 285窟 (x_start=8, niche_x=14.5)
  [13.5, 16, -0.8, 0.8, '彩塑285_西魏佛'],
  [13.5, 16, 0.8, 2.3, '彩塑285_左胁侍'],
  [13.5, 16, -2.3, -0.8, '彩塑285_右胁侍'],

  // 45窟 (x_start=15, niche_x=21.5)
  // 修正：观众左侧(+Z)为阿难，观众右侧(-Z)为迦叶
  [20, 23, -0.8, 0.8, '彩塑45_主佛'],
  [20, 23, 0.8, 1.8, '彩塑45_阿难'],
  [20, 23, -1.8, -0.8, '彩塑45_迦叶'],
  [20, 23, 1.8, 2.6, '彩塑45_左菩萨'],
  [20, 23, -2.6, -1.8, '彩塑45_右菩萨'],
  [20, 23, 2.6, 3.5, '彩塑45_天王'],
  [20, 23, -3.5, -2.6, '彩塑45_力士'],

  // 217窟 (x_start=22, niche_x=28.5)
  [27, 30, -0.8, 0.8, '彩塑217_主佛'],
  [27, 30, 0.8, 2.1, '彩塑217_左菩萨'],
  [27, 30, -2.1, -0.8, '彩塑217_右菩萨'],
  [27, 30, 2.1, 3.5, '彩塑217_左供养菩萨'],
  [27, 30, -3.5, -2.1, '彩塑217_右供养菩萨'],

  // 17窟 (x_start=29, niche_x=35.5)
  [34, 37, -0.8, 0.8, '彩塑17_洪辩法师'],
  [34, 37, 0.8, 2.1, '彩塑17_左弟子'],
  [34, 37, -2.1, -0.8, '彩塑17_右弟子'],
  [34, 37, 2.1, 3.5, '彩塑17_左僧人'],
  [34, 37, -3.5, -2.1, '彩塑17_右僧人'],

  // 3窟 (x_start=36, niche_x=42.5)
  [41, 44, -0.8, 0.8, '彩塑3_密宗千手观音'],
  [41, 44, 0.8, 2.3, '彩塑3_密宗左胁侍'],
  [41, 44, -2.3, -0.8, '彩塑3_密宗右胁侍'],
  [41, 44, 2.3, 3.5, '彩塑3_密宗左护法金刚'],
  [41, 44, -3.5, -2.3, '彩塑3_密宗右护法金刚'],
]

/**
 * 根据世界坐标匹配雕塑名称
 * @param {number} cx - X轴坐标（深度/洞穴方向）
 * @param {number} cz - Z轴坐标（左右，Blender Y取反）
 * @param {number} height - 高度（用于主佛区分）
 * @returns {string|null} 匹配的雕塑名称
 */
function matchStatueByPosition(cx, cz, height) {
  for (const [xMin, xMax, zMin, zMax, name] of STATUE_POSITIONS) {
    if (cx >= xMin && cx <= xMax && cz >= zMin && cz <= zMax) {
      if (name.includes('主佛') && name !== '彩塑285_西魏佛' && height < 1.5) continue
      if (name === '彩塑285_西魏佛' && height < 1.0) continue
      return name
    }
  }
  return null
}

/**
 * 为无名雕塑节点分配名称
 * 支持两种类型：
 * - InstancedMesh（GPU实例化）：从instanceMatrix读取每个实例的位置
 * - 普通Mesh：从包围盒中心读取位置
 */
function assignStatueName(mesh) {
  // === InstancedMesh：从实例矩阵获取每个实例的世界坐标 ===
  if (mesh.isInstancedMesh) {
    const instanceNames = {}
    const tempMatrix = new THREE.Matrix4()
    const tempPos = new THREE.Vector3()
    const tempQuat = new THREE.Quaternion()
    const tempScale = new THREE.Vector3()

    mesh.updateWorldMatrix(true, true)

    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, tempMatrix)
      tempMatrix.decompose(tempPos, tempQuat, tempScale)

      // GLTFLoader的InstancedMesh实例矩阵已经是世界坐标（已预乘node变换）
      // 不需要再乘以matrixWorld，直接使用tempPos即可
      const cx = tempPos.x
      const cz = tempPos.z
      const estimatedHeight = tempScale.y
      const name = matchStatueByPosition(cx, cz, estimatedHeight)
      if (name) {
        instanceNames[i] = name
      }
    }

    const namedCount = Object.keys(instanceNames).length
    if (namedCount > 0) {
      mesh.userData.instanceNames = instanceNames
      // 名称包含具体窟号关键词，方便raycaster匹配
      mesh.name = '彩塑群组'
      console.log('[模型] InstancedMesh命名 ' + namedCount + '/' + mesh.count + ' 实例')
    }
    return
  }

  // === 普通Mesh：从包围盒中心获取世界坐标 ===
  mesh.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(mesh)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = new THREE.Vector3()
  box.getSize(size)

  // 过滤非雕塑mesh（墙壁、地板等）
  if (size.y < 0.3 || size.y > 4.0 || size.x > 3.0 || size.z > 3.0) return

  const name = matchStatueByPosition(center.x, center.z, size.y)
  if (name) {
    mesh.name = name
  }
}

/**
 * 判断对象是否为文字对象（模型自带的文字标签）
 * 根据名称模式和几何特征综合判断
 */
function isTextObject(name) {
  if (!name) return false
  // 精确匹配标签/文字相关命名
  if (name.startsWith('标签') || name.startsWith('立牌文字')) return true
  // 匹配洞窟编号组合（如"西魏285"、"盛唐45"等）
  const textPatterns = ['西魏285', '西魏 285', '盛唐45', '盛唐 45', '盛唐217', '盛唐 217', '晚唐17', '晚唐 17', '元代3', '元代 3']
  if (textPatterns.some(pattern => name.includes(pattern))) return true
  return false
}

/**
 * 根据几何特征判断mesh是否为文字标签
 * 文字标签特征：位于洞窟入口上方(z>2.5)、很薄(depth<0.1)、且不是壁画/雕塑
 */
function isTextByGeometry(mesh) {
  mesh.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)

  // 文字标签板：位于洞窟入口上方，深度很薄
  if (center.z > 2.0 && center.z < 4.0 &&
      size.x < 3.0 && size.y < 3.0 &&
      size.z < 0.15 &&
      7 < center.x && center.x < 43) {
    // 排除已知的非文字对象
    const name = mesh.name
    if (name.includes('壁画') || name.includes('经变画') || name.includes('伎乐') ||
        name.includes('飞天') || name.includes('供养人') || name.includes('藻井') ||
        name.includes('千佛') || name.includes('护法') || name.includes('彩塑') ||
        name.includes('暗纹') || name.includes('绢画') || name.includes('密宗')) {
      return false
    }
    // 匹配标签板和标签框
    if (name.includes('标签')) return true
    return false
  }
  return false
}

/**
 * 判断 InstancedMesh 是否为"窟号立牌"
 * 立牌特征：5个实例，分别位于5个洞窟入口前1.5米处
 * 洞窟入口前1.5米位置：x = 6.5, 13.5, 20.5, 27.5, 34.5（即 x_start - 1.5）
 * 立牌底座：y≈0.6, z=±3.6, scale≈0.6（贴墙）
 * 立牌板：y≈1.2, z=±3.55, scale≈0.35（贴墙）
 * 区别于门框底座：y≈0.55, z=±3.2, scale≈0.5（靠中央）
 * 综合判断：实例位于 x∈[4,46], y∈[0.3,1.8], |z|∈[3.4,4.2]（贴墙），且 scale 小（<1.5）
 */
function isCaveNumberSignage(mesh) {
  if (!mesh.isInstancedMesh || mesh.count < 5) return false
  const tempMatrix = new THREE.Matrix4()
  const tempPos = new THREE.Vector3()
  const tempQuat = new THREE.Quaternion()
  const tempScale = new THREE.Vector3()
  let signageCount = 0
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, tempMatrix)
    tempMatrix.decompose(tempPos, tempQuat, tempScale)
    const tx = tempPos.x, ty = tempPos.y, tz = tempPos.z
    // 立牌位置特征：x在洞窟入口前（4-46），y低（0.3-1.8），z贴墙（|z|>3.4）
    // 立牌scale特征：小尺寸（<1.5），排除大尺寸门柱/门框（scale>1.5）
    const isSignagePos = tx > 4 && tx < 46 && ty > 0.2 && ty < 2.0 && Math.abs(tz) > 3.4 && Math.abs(tz) < 4.2
    const isSignageScale = tempScale.x < 1.5 && tempScale.y < 1.5 && tempScale.z < 1.5
    if (isSignagePos && isSignageScale) {
      signageCount++
    }
  }
  // 如果大多数实例位于立牌位置，则判定为立牌
  if (signageCount >= 5) {
    console.log('[模型] 检测到窟号立牌 InstancedMesh:', mesh.name, '匹配实例数:', signageCount)
    return true
  }
  return false
}

/**
 * 判断 InstancedMesh 是否为"后墙窟号牌匾"
 * 牌匾特征：5个实例，位于洞窟后墙中央（x=15.88/22.88/29.88/36.88/43.88, y=2.00, z=0.00）
 * scale=(3.00,3.00,3.00)，材质为 PaletteMaterial001，显示窟号文字
 * 问题：所有实例共享同一纹理，导致文字和洞窟不对应
 */
function isBackWallPlaque(mesh) {
  if (!mesh.isInstancedMesh || mesh.count < 5) return false
  const tempMatrix = new THREE.Matrix4()
  const tempPos = new THREE.Vector3()
  const tempQuat = new THREE.Quaternion()
  const tempScale = new THREE.Vector3()
  let plaqueCount = 0
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, tempMatrix)
    tempMatrix.decompose(tempPos, tempQuat, tempScale)
    const tx = tempPos.x, ty = tempPos.y, tz = tempPos.z
    // 后墙牌匾位置特征：x在洞窟后墙（15-45），y≈2.0（高度），z≈0（中央）
    // scale特征：大尺寸（约3.0），排除小尺寸对象
    const isPlaquePos = tx > 14 && tx < 46 && ty > 1.5 && ty < 2.5 && Math.abs(tz) < 0.5
    const isPlaqueScale = tempScale.x > 2.5 && tempScale.y > 2.5 && tempScale.z > 2.5
    if (isPlaquePos && isPlaqueScale) {
      plaqueCount++
    }
  }
  // 如果大多数实例位于后墙牌匾位置，则判定为牌匾
  if (plaqueCount >= 5) {
    console.log('[模型] 检测到后墙窟号牌匾 InstancedMesh:', mesh.name, '匹配实例数:', plaqueCount)
    return true
  }
  return false
}

/**
 * 判断普通 Mesh 是否为后墙文字牌匾
 * 特征：位于洞窟后墙中央（x对齐洞窟后墙, y≈2, z≈0），尺寸中等，不是墙壁/雕塑
 */
function isBackWallTextMesh(mesh) {
  if (mesh.isInstancedMesh) return false // InstancedMesh 由 isBackWallPlaque 处理
  mesh.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)

  // 后墙文字牌匾：位于洞窟后墙区域，y在中上部，z靠近中轴线
  const isBackWallPos = center.x > 14 && center.x < 45 &&
                        center.y > 1.0 && center.y < 3.5 &&
                        Math.abs(center.z) < 1.0
  // 排除墙壁（很厚）、雕塑（人形）、地板（很矮）等
  const isPlaqueSize = size.x > 0.5 && size.x < 5.0 &&
                       size.y > 0.3 && size.y < 4.0 &&
                       size.z < 1.0 // 牌匾是扁平的
  // 排除已知非文字对象
  const name = mesh.name || ''
  if (name.includes('壁画') || name.includes('经变画') || name.includes('伎乐') ||
      name.includes('飞天') || name.includes('供养人') || name.includes('藻井') ||
      name.includes('千佛') || name.includes('护法') || name.includes('彩塑') ||
      name.includes('暗纹') || name.includes('绢画') || name.includes('密宗') ||
      name.includes('地面') || name.includes('后墙') || name.includes('右墙') ||
      name.includes('顶棚') || name.includes('佛龛') || name.includes('基座') ||
      name.includes('背光') || name.includes('门框') || name.includes('走廊')) {
    return false
  }

  if (isBackWallPos && isPlaqueSize) {
    console.log('[模型] 检测到后墙文字 Mesh:', name, 'center=(', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2), ')')
    return true
  }
  return false
}

/**
 * 判断对象是否为可交互对象（壁画、彩塑、洞窟构件）
 * 根据 Blender 中的命名规则识别
 */
function isInteractiveObject(name) {
  if (!name) return false
  if (name.includes('壁画') || name.includes('经变画') || name.includes('飞天') ||
      name.includes('伎乐') || name.includes('供养人') || name.includes('护法') ||
      name.includes('藻井') || name.includes('千佛')) {
    return true
  }
  if (name.includes('彩塑') || name.includes('主佛') || name.includes('迦叶') ||
      name.includes('阿难') || name.includes('菩萨') || name.includes('天王') ||
      name.includes('力士')) {
    return true
  }
  if (name.includes('洞窟') || name.includes('佛龛') || name.includes('门洞')) {
    return true
  }
  return false
}

/**
 * 获取已加载的模型
 */
export function getLoadedModel() { return loadedModel }

/**
 * 获取雕塑位置映射表
 */
export function getStatuePositions() {
  return STATUE_POSITIONS.map(([xMin, xMax, zMin, zMax, name]) => ({
    xMin, xMax, zMin, zMax, name
  }))
}
