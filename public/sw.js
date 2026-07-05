/**
 * Service Worker - 敦煌 3DShow 数字洞窟
 * 缓存策略：模型文件使用 Cache First（优先缓存），其他资源使用 Network First
 * 二次访问时模型从本地缓存加载，实现秒开
 * 适配 GitHub Pages 子路径部署，使用相对路径
 */

// 缓存版本号（更新资源时修改此版本号）
// v2 站点使用独立缓存名，避免与 v1 站点缓存冲突
const CACHE_NAME = 'dunhuang-3dshow-v2-v1'

// 获取基础路径（适配 GitHub Pages 子路径部署）
// 通过 self.registration.scope 获取作用域，提取相对路径
const SCOPE_PATH = new URL(self.registration.scope).pathname

// 需要预缓存的资源列表（使用相对路径）
const PRECACHE_URLS = [
  SCOPE_PATH,
  SCOPE_PATH + 'index.html',
]

// 模型文件路径（使用相对路径，适配 GitHub Pages 子路径部署）
const MODEL_PATH = SCOPE_PATH + 'models/dunhuang_museum_v3.glb'

// 安装事件：预缓存关键资源
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 安装中... 作用域:', SCOPE_PATH)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存关键资源')
      return cache.addAll(PRECACHE_URLS)
    })
  )
  // 立即激活，不等待旧 SW 关闭
  self.skipWaiting()
})

// 激活事件：清理旧版本缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 已激活')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 清理旧缓存:', name)
            return caches.delete(name)
          })
      )
    })
  )
  // 立即控制所有页面
  self.clients.claim()
})

// 请求拦截：根据资源类型选择缓存策略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 模型文件：Cache First 策略（优先从缓存读取，缓存未命中再请求网络）
  if (url.pathname.endsWith('.glb') || url.pathname.endsWith('.gltf')) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  // 其他资源：Network First 策略（优先网络，失败则从缓存读取）
  event.respondWith(networkFirst(event.request))
})

/**
 * Cache First 策略：优先从缓存读取
 * 适用于大体积模型文件和 CDN 静态资源
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      // 模型文件在后台缓存，不阻塞响应
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    // 网络失败，尝试返回缓存
    const fallback = await caches.match(request)
    if (fallback) return fallback
    return new Response('Network error', { status: 503 })
  }
}

/**
 * Network First 策略：优先网络请求
 * 适用于 HTML、JS 等需要最新版本的资源
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse
    return new Response('Offline', { status: 503 })
  }
}
