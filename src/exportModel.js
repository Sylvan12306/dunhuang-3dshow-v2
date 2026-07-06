/**
 * 数实融合 - 3D模型导出模块
 * 将当前场景中的模型导出为 glTF / GLB 格式，自动触发浏览器下载
 * 使用动态 import 避免首屏加载增加体积
 */
import * as THREE from 'three'

/**
 * 导出场景为 glTF 格式（JSON + 外部二进制资源）
 * @param {THREE.Scene} scene - 要导出的场景
 */
export async function exportModelToGLTF(scene) {
  try {
    const exporter = await loadGLTFExporter()
    const result = await exporter.parseAsync(scene, {
      binary: false,
      maxTextureSize: 2048,
    })

    // result 是包含 json 和 buffers 的对象
    const jsonStr = JSON.stringify(result, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    downloadBlob(blob, 'dunhuang_3dshow.gltf')

    console.log('[导出] glTF 格式导出成功')
  } catch (err) {
    console.error('[导出] glTF 导出失败:', err)
    // 降级使用原生实现
    await exportModelNative(scene, false)
  }
}

/**
 * 导出场景为 GLB 格式（单一二进制文件，数实融合首选）
 * @param {THREE.Scene} scene - 要导出的场景
 */
export async function exportModelToGLB(scene) {
  try {
    const exporter = await loadGLTFExporter()
    const result = await exporter.parseAsync(scene, {
      binary: true,
      maxTextureSize: 2048,
    })

    // binary 模式返回 ArrayBuffer
    const blob = new Blob([result], { type: 'application/octet-stream' })
    downloadBlob(blob, 'dunhuang_3dshow.glb')

    console.log('[导出] GLB 格式导出成功（数实融合）')
  } catch (err) {
    console.error('[导出] GLB 导出失败:', err)
    // 降级使用原生实现
    await exportModelNative(scene, true)
  }
}

/**
 * 动态加载 Three.js GLTFExporter
 * 避免首屏加载增加体积
 */
async function loadGLTFExporter() {
  try {
    const module = await import('three/addons/exporters/GLTFExporter.js')
    return new module.GLTFExporter()
  } catch (e) {
    console.warn('[导出] Three.js GLTFExporter 加载失败，使用原生实现:', e)
    return null
  }
}

/**
 * 原生 glTF 导出（Three.js GLTFExporter 不可用时的降级方案）
 * 手动构建 glTF JSON + Binary buffer
 * @param {THREE.Scene} scene
 * @param {boolean} binary - true 输出 GLB，false 输出 glTF
 */
async function exportModelNative(scene, binary) {
  console.log('[导出] 使用原生 glTF 构建器导出...')

  const gltf = {
    asset: {
      generator: '敦煌3DShow 数实融合导出',
      version: '2.0',
    },
    scene: 0,
    scenes: [],
    nodes: [],
    meshes: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  }

  const buffers = [] // 存放所有二进制数据块

  // 遍历场景收集 Mesh 数据
  const sceneNodeIndices = []

  scene.traverse((child) => {
    if (!child.isMesh) return

    const nodeIndex = gltf.nodes.length
    sceneNodeIndices.push(nodeIndex)

    // 写入变换矩阵
    const node = { mesh: gltf.meshes.length }
    child.updateMatrixWorld(true)
    const m = child.matrixWorld.elements
    node.matrix = [
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15],
    ]

    gltf.nodes.push(node)

    // 处理几何体
    const geometry = child.geometry
    const meshEntry = { primitives: [] }

    if (geometry.index) {
      // 索引缓冲
      const indexData = geometry.index.array
      const indexBuffer = new Uint32Array(indexData)
      const indexByteLen = indexBuffer.byteLength
      const indexBufferViewIdx = gltf.bufferViews.length
      gltf.bufferViews.push({
        buffer: 0,
        byteOffset: getTotalBufferSize(buffers),
        byteLength: indexByteLen,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      })
      buffers.push(indexBuffer.buffer.slice(0))

      const indexAccessorIdx = gltf.accessors.length
      gltf.accessors.push({
        bufferView: indexBufferViewIdx,
        byteOffset: 0,
        componentType: 5125, // UNSIGNED_INT
        count: indexBuffer.length,
        type: 'SCALAR',
      })

      const primitive = { indices: indexAccessorIdx, attributes: {} }

      // 位置属性
      if (geometry.attributes.position) {
        const accessorIdx = addAttributeAccessor(geometry.attributes.position, buffers, gltf, 0)
        primitive.attributes.POSITION = accessorIdx
      }

      // 法线属性
      if (geometry.attributes.normal) {
        const accessorIdx = addAttributeAccessor(geometry.attributes.normal, buffers, gltf, 0)
        primitive.attributes.NORMAL = accessorIdx
      }

      // UV属性
      if (geometry.attributes.uv) {
        const accessorIdx = addAttributeAccessor(geometry.attributes.uv, buffers, gltf, 0)
        primitive.attributes.TEXCOORD_0 = accessorIdx
      }

      meshEntry.primitives.push(primitive)
    } else if (geometry.attributes.position) {
      const primitive = { attributes: {} }
      const accessorIdx = addAttributeAccessor(geometry.attributes.position, buffers, gltf, 0)
      primitive.attributes.POSITION = accessorIdx

      if (geometry.attributes.normal) {
        const accessorIdx = addAttributeAccessor(geometry.attributes.normal, buffers, gltf, 0)
        primitive.attributes.NORMAL = accessorIdx
      }

      if (geometry.attributes.uv) {
        const accessorIdx = addAttributeAccessor(geometry.attributes.uv, buffers, gltf, 0)
        primitive.attributes.TEXCOORD_0 = accessorIdx
      }

      meshEntry.primitives.push(primitive)
    }

    gltf.meshes.push(meshEntry)
  })

  gltf.scenes.push({ nodes: sceneNodeIndices })

  if (buffers.length === 0) {
    console.warn('[导出] 场景中没有可导出的 Mesh')
    return
  }

  // 合并所有二进制数据
  const totalSize = getTotalBufferSize(buffers)
  const mergedBuffer = new Uint8Array(totalSize)
  let offset = 0
  for (const buf of buffers) {
    mergedBuffer.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }

  if (binary) {
    // GLB 格式：JSON chunk + BIN chunk
    const jsonStr = JSON.stringify(gltf)
    const jsonEncoder = new TextEncoder()
    const jsonData = jsonEncoder.encode(jsonStr)

    // 4字节对齐
    const jsonPadding = (4 - (jsonData.byteLength % 4)) % 4
    const binPadding = (4 - (mergedBuffer.byteLength % 4)) % 4

    const jsonChunkLength = jsonData.byteLength + jsonPadding
    const binChunkLength = mergedBuffer.byteLength + binPadding

    const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength
    const glb = new ArrayBuffer(totalLength)
    const view = new DataView(glb)

    // GLB 头部
    view.setUint32(0, 0x46546C67, true) // magic: "glTF"
    view.setUint32(4, 2, true) // version
    view.setUint32(8, totalLength, true) // total length

    // JSON chunk
    view.setUint32(12, jsonChunkLength, true) // chunk length
    view.setUint32(16, 0x4E4F534A, true) // chunk type: "JSON"
    const jsonView = new Uint8Array(glb, 20, jsonChunkLength)
    jsonView.set(jsonData)
    // 填充空格对齐
    for (let i = 0; i < jsonPadding; i++) {
      jsonView[jsonData.byteLength + i] = 0x20
    }

    // BIN chunk
    const binOffset = 20 + jsonChunkLength
    view.setUint32(binOffset, binChunkLength, true) // chunk length
    view.setUint32(binOffset + 4, 0x004E4942, true) // chunk type: "BIN\0"
    const binView = new Uint8Array(glb, binOffset + 8, binChunkLength)
    binView.set(mergedBuffer)

    // 更新 gltf 中的 buffer 引用
    gltf.buffers = [{ byteLength: mergedBuffer.byteLength }]

    const blob = new Blob([glb], { type: 'application/octet-stream' })
    downloadBlob(blob, 'dunhuang_3dshow.glb')

    console.log('[导出] 原生 GLB 导出成功（数实融合）')
  } else {
    // glTF 格式：JSON + data URI buffer
    const base64 = arrayBufferToBase64(mergedBuffer.buffer)
    gltf.buffers = [{
      uri: 'data:application/octet-stream;base64,' + base64,
      byteLength: mergedBuffer.byteLength,
    }]

    const jsonStr = JSON.stringify(gltf, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    downloadBlob(blob, 'dunhuang_3dshow.gltf')

    console.log('[导出] 原生 glTF 导出成功')
  }
}

/**
 * 添加顶点属性 Accessor
 */
function addAttributeAccessor(attribute, buffers, gltf, bufferIndex) {
  const data = attribute.array
  const byteLen = data.byteLength
  const bufferViewIdx = gltf.bufferViews.length

  gltf.bufferViews.push({
    buffer: bufferIndex,
    byteOffset: getTotalBufferSize(buffers),
    byteLength: byteLen,
    target: 34962, // ARRAY_BUFFER
  })

  buffers.push(data.buffer.slice(0))

  const accessorIdx = gltf.accessors.length
  const componentType = getComponentType(data)
  const type = getAccessorType(attribute.itemSize)

  gltf.accessors.push({
    bufferView: bufferViewIdx,
    byteOffset: 0,
    componentType: componentType,
    count: attribute.count,
    type: type,
  })

  return accessorIdx
}

/**
 * 计算当前所有 buffer 的总字节数
 */
function getTotalBufferSize(buffers) {
  let total = 0
  for (const buf of buffers) {
    total += buf.byteLength
  }
  return total
}

/**
 * 获取 TypedArray 的 glTF componentType
 */
function getComponentType(array) {
  if (array instanceof Float32Array) return 5126  // FLOAT
  if (array instanceof Uint32Array) return 5125   // UNSIGNED_INT
  if (array instanceof Uint16Array) return 5123   // UNSIGNED_SHORT
  if (array instanceof Int16Array) return 5122    // SHORT
  if (array instanceof Uint8Array) return 5121    // UNSIGNED_BYTE
  if (array instanceof Int8Array) return 5120     // BYTE
  return 5126 // 默认 FLOAT
}

/**
 * 根据 itemSize 获取 glTF attribute type
 */
function getAccessorType(itemSize) {
  switch (itemSize) {
    case 1: return 'SCALAR'
    case 2: return 'VEC2'
    case 3: return 'VEC3'
    case 4: return 'VEC4'
    default: return 'SCALAR'
  }
}

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 触发浏览器下载 Blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // 延迟清理，确保下载已启动
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 100)
}
