/**
 * AIGC 人工智能生成内容模块（2026主题·绝美体验版）
 *
 * 核心功能：
 * 1. AI壁画修复效果 — 戏剧性视觉变换：从破碎残损→裂缝愈合→碎片归位→矿物颜料绽放→绝美重生
 *    技术亮点：Voronoi裂纹 + FBM剥落 + 顶点位移（裂缝真实深度）+ 多阶段修复动画 + 金色光流 + 粒子特效
 * 2. 飞天动画 — 贝塞尔路径 + 粒子拖尾，纯程序化生成
 * 3. AI语音解说 — Web Speech API + 逐句自然配音 + 窟specific深度解说
 */
import * as THREE from 'three'

// ============================================================
// 1. AI壁画修复效果系统（绝美体验版）
// ============================================================

// 壁画修复顶点着色器（带裂缝深度位移）
const MURAL_RESTORE_VS = `
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uRestoreCenter;
  uniform float uRestoreRadius;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vDamage;

  // 噪声函数
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = hash2(i + neighbor);
        vec2 diff = neighbor + point - f;
        float dist = length(diff);
        minDist = min(minDist, dist);
      }
    }
    return minDist;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // 计算裂缝位移（让损坏区域有真实的凹陷深度）
    vec2 worldUV = (modelMatrix * vec4(pos, 1.0)).xz;
    float v = voronoi(worldUV * 3.5);
    float crackDepth = (1.0 - smoothstep(0.0, 0.07, v)) * 0.2;
    float flake = fbm(worldUV * 2.0);
    float flakeDepth = step(0.52, flake) * 0.06;

    // 综合损伤量
    float totalDamage = crackDepth + flakeDepth;
    vDamage = totalDamage;

    // 修复进度控制位移：裂缝随修复逐渐愈合（表面变平）
    vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
    float distFromCenter = distance(worldPos4.xyz, uRestoreCenter);
    float radialProgress = 1.0 - smoothstep(0.0, uRestoreRadius, distFromCenter);
    float healProgress = smoothstep(0.1, 0.55, uProgress);
    float healMask = smoothstep(0.0, healProgress, radialProgress);

    // 位移随修复减少
    float displacement = totalDamage * (1.0 - healMask);

    // 沿法线方向凹陷（裂缝向内凹）
    pos -= normal * displacement;

    // 修复中的微妙震动（魔法感）
    float wobble = sin(uTime * 8.0 + pos.x * 15.0 + pos.y * 12.0) * 0.004
                 * uProgress * (1.0 - uProgress) * 4.0 * radialProgress;
    pos += normal * wobble;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// 壁画修复片元着色器（绝美变换：破碎→愈合→绽放→重生）
const MURAL_RESTORE_FS = `
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uRestoreCenter;
  uniform float uRestoreRadius;
  uniform vec3 uWallColor;      // 裸墙底色
  uniform vec3 uMuralColor1;    // 壁画主色（矿物颜料1）
  uniform vec3 uMuralColor2;    // 壁画辅色（矿物颜料2）
  uniform vec3 uGoldColor;      // 金箔色
  uniform float uCaveSeed;      // 每窟随机种子

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vDamage;

  // 噪声函数族
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = hash2(i + neighbor);
        vec2 diff = neighbor + point - f;
        float dist = length(diff);
        minDist = min(minDist, dist);
      }
    }
    return minDist;
  }

  void main() {
    vec2 worldUV = vWorldPos.xz;
    float distFromCenter = distance(vWorldPos, uRestoreCenter);
    float radialProgress = 1.0 - smoothstep(0.0, uRestoreRadius, distFromCenter);
    float progress = uProgress;

    // =============================================
    // 第一层：损伤图案（Voronoi裂纹 + FBM剥落 + 孔洞 + 水渍）
    // =============================================

    // Voronoi裂纹（深色裂纹线）
    float v = voronoi(worldUV * 3.5 + uCaveSeed);
    float cracks = 1.0 - smoothstep(0.0, 0.065, v);

    // FBM剥落（大面积漆皮脱落）
    float flake = fbm(worldUV * 2.0 + uCaveSeed * 1.3);
    float flakeMask = step(0.52, flake);

    // 大面积孔洞（壁画完全缺失）
    float holes = fbm(worldUV * 0.7 + uCaveSeed * 2.1);
    float holeMask = step(0.62, holes);

    // 水渍/烟熏痕迹
    float stain = fbm(worldUV * vec2(0.4, 1.8) + uCaveSeed * 0.7);
    float stainMask = smoothstep(0.42, 0.58, stain);

    // 细裂纹网（更多细密裂纹）
    float fineV = voronoi(worldUV * 8.0 + uCaveSeed * 3.0);
    float fineCracks = 1.0 - smoothstep(0.0, 0.04, fineV);

    // 综合损伤
    float damage = max(cracks, max(flakeMask * 0.7, holeMask));
    damage = max(damage, fineCracks * 0.5);
    damage = max(damage, stainMask * 0.4);

    // =============================================
    // 第二层：损坏状态色彩（灰暗、残破、剥落）
    // =============================================

    // 裸墙底色（灰黄泥墙）
    vec3 wallColor = uWallColor;
    wallColor += noise(worldUV * 6.0) * 0.06;
    wallColor += fbm(worldUV * 1.5) * 0.04;

    // 残存壁画色（极其暗淡、几乎看不清）
    vec3 fadedMural = uMuralColor1 * 0.15 + uMuralColor2 * 0.08;
    fadedMural += vec3(0.12, 0.10, 0.08);
    fadedMural *= 0.6;
    fadedMural += noise(worldUV * 5.0) * 0.03;

    // 损坏状态颜色 = 孔洞处裸墙 + 裂纹处深黑 + 水渍处泛黄 + 残存壁画
    vec3 damagedColor = mix(fadedMural, wallColor, holeMask);
    damagedColor = mix(damagedColor, vec3(0.06, 0.04, 0.03), cracks * 0.9);
    damagedColor = mix(damagedColor, vec3(0.08, 0.06, 0.03), fineCracks * 0.4);
    // 水渍泛黄
    damagedColor = mix(damagedColor, vec3(0.22, 0.18, 0.10), stainMask * 0.3);
    // 整体灰暗
    damagedColor *= 0.7;

    // =============================================
    // 第三层：绝美修复状态色彩（矿物颜料绽放）
    // =============================================

    // 丰富的壁画色彩（多层矿物颜料）
    vec3 vividMural = uMuralColor1 * 0.7 + uMuralColor2 * 0.4;

    // 矿物颜料层变化（模拟真实壁画的颜料笔触）
    float pigment1 = noise(worldUV * 7.0 + uCaveSeed);
    float pigment2 = noise(worldUV * 14.0 + uCaveSeed + 100.0);
    float pigment3 = fbm(worldUV * 4.0 + uCaveSeed * 1.5);

    // 朱砂红/石青蓝/石绿色带
    vec3 cinnabarRed = vec3(0.82, 0.28, 0.15);   // 朱砂
    vec3 azuriteBlue = vec3(0.18, 0.38, 0.72);    // 石青
    vec3 malachiteGreen = vec3(0.15, 0.58, 0.35);  // 石绿
    vec3 leadWhite = vec3(0.88, 0.85, 0.80);       // 铅白

    // 根据窟色偏移混合矿物颜料
    vividMural = mix(vividMural, cinnabarRed, smoothstep(0.3, 0.5, pigment1) * 0.4);
    vividMural = mix(vividMural, azuriteBlue, smoothstep(0.5, 0.7, pigment1) * 0.3);
    vividMural = mix(vividMural, malachiteGreen, smoothstep(0.2, 0.4, pigment2) * 0.35);
    vividMural = mix(vividMural, leadWhite, smoothstep(0.6, 0.8, pigment3) * 0.2);

    // 金箔纹样（Voronoi边缘+曼荼罗圆环）
    float goldV = voronoi(worldUV * 10.0 + uCaveSeed + 50.0);
    float goldMask = 1.0 - smoothstep(0.0, 0.025, goldV);
    // 曼荼罗同心圆
    float mandalaRings = abs(sin(length(worldUV - uRestoreCenter.xz) * 8.0));
    float mandalaMask = step(0.96, mandalaRings) * 0.3;
    float totalGold = max(goldMask * 0.5, mandalaMask);
    vividMural = mix(vividMural, uGoldColor, totalGold);

    // 饱和度提升（修复后色彩更加鲜艳）
    float lum = dot(vividMural, vec3(0.299, 0.587, 0.114));
    vividMural = mix(vec3(lum), vividMural, 1.35);

    // 微妙的光泽
    vividMural += noise(worldUV * 20.0) * 0.02;

    // =============================================
    // 第四层：多阶段修复动画（戏剧性变换）
    // =============================================

    // 阶段1 (0-0.12): AI扫描 — 金色光环从中心扩散
    float scanWave = smoothstep(progress - 0.12, progress - 0.02, radialProgress)
                   - smoothstep(progress - 0.02, progress + 0.04, radialProgress);
    vec3 scanLight = vec3(1.0, 0.85, 0.3) * scanWave * 5.0;

    // 阶段2 (0.12-0.45): 裂缝愈合 — 金色液流填充裂纹
    float healProgress = smoothstep(0.12, 0.45, progress);
    float healMask = smoothstep(0.0, healProgress, radialProgress);
    // 裂纹中的金色光流（液态金填充效果）
    float crackGlow = cracks * (1.0 - healMask) * step(0.1, progress);
    float crackHealGlow = cracks * healMask * step(healProgress, radialProgress + 0.05)
                        * (1.0 - step(healProgress, radialProgress - 0.05));
    vec3 crackGoldLight = vec3(0.9, 0.75, 0.2) * (crackGlow * 2.0 + crackHealGlow * 4.0);

    // 阶段3 (0.35-0.7): 碎片归位 — 剥落区域重新显现
    float reformProgress = smoothstep(0.35, 0.7, progress);
    float reformMask = smoothstep(0.0, reformProgress, radialProgress);
    // 碎片从虚无中凝聚显现（dissolve-in效果）
    float dissolveNoise = fbm(worldUV * 5.0 + uTime * 0.5);
    float dissolveMask = smoothstep(0.0, reformProgress * 1.2, dissolveNoise * radialProgress);

    // 阶段4 (0.6-0.9): 颜色绽放 — 矿物颜料从底层绽放
    float bloomProgress = smoothstep(0.6, 0.9, progress);
    float bloomMask = smoothstep(0.0, bloomProgress, radialProgress);
    // 颜色从中心向外绽放（花朵般的展开）
    float bloomWave = smoothstep(bloomProgress - 0.08, bloomProgress, radialProgress)
                    - smoothstep(bloomProgress, bloomProgress + 0.08, radialProgress);
    vec3 bloomLight = uMuralColor1 * bloomWave * 2.0;

    // 阶段5 (0.9-1.0): 绝美重生 — 最终闪耀
    float revealProgress = smoothstep(0.9, 1.0, progress);
    float revealMask = smoothstep(0.0, revealProgress, radialProgress);

    // =============================================
    // 第五层：合成最终色彩
    // =============================================

    // 损坏→愈合中的颜色
    vec3 healingColor = mix(damagedColor, fadedMural * 2.5, healMask);
    // 裂纹处先填入金色
    healingColor += crackGoldLight;

    // 碎片归位
    vec3 reformingColor = mix(healingColor, vividMural * 0.6, dissolveMask * reformMask);

    // 颜色绽放
    vec3 bloomingColor = mix(reformingColor, vividMural, bloomMask);

    // 最终重生（更加鲜艳 + 金色微光）
    vec3 finalColor = mix(bloomingColor, vividMural * 1.15, revealMask);

    // 添加扫描光
    finalColor += scanLight;

    // 添加绽放光
    finalColor += bloomLight;

    // 修复中的闪烁微粒效果
    float sparkle = hash(floor(worldUV * 80.0) + floor(uTime * 8.0));
    sparkle = pow(sparkle, 25.0);
    float sparkleZone = healMask * (1.0 - bloomMask) * 0.5 + bloomMask * 0.2;
    finalColor += vec3(1.0, 0.95, 0.6) * sparkle * sparkleZone * 3.0;

    // 修复完成后的金色微光呼吸
    float breathe = sin(uTime * 2.0 + distFromCenter * 4.0) * 0.025 * revealMask;
    finalColor += uGoldColor * breathe;

    // 修复完成后的全息微光（显示这是AI修复的痕迹）
    float holographic = sin(uTime * 1.5 + worldUV.x * 30.0) * sin(uTime * 2.3 + worldUV.y * 25.0);
    finalColor += vec3(0.02, 0.015, 0.005) * max(0.0, holographic) * revealMask;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// 壁画修复区域配置（匹配洞窟壁画位置）
const MURAL_RESTORE_CONFIGS = [
  {
    caveNumber: '285',
    name: '西魏飞天壁画',
    center: { x: 14.5, y: 0, z: 2.8 },
    radius: 3.5,
    wallColor: new THREE.Color(0x5a4a3a),       // 泥墙底色
    muralColor1: new THREE.Color(0x4a9a7a),      // 石绿主色
    muralColor2: new THREE.Color(0x8a5a3a),      // 赭石辅色
    goldColor: new THREE.Color(0xd4af37),         // 金箔
    caveSeed: 1.0,
    width: 4.0,
    height: 2.5,
  },
  {
    caveNumber: '45',
    name: '盛唐观无量寿经变',
    center: { x: 21.5, y: 0, z: 2.8 },
    radius: 3.5,
    wallColor: new THREE.Color(0x5a4a32),
    muralColor1: new THREE.Color(0xc47858),      // 朱砂红
    muralColor2: new THREE.Color(0x4a6aaa),      // 石青
    goldColor: new THREE.Color(0xe8c840),
    caveSeed: 2.5,
    width: 4.0,
    height: 2.5,
  },
  {
    caveNumber: '217',
    name: '盛唐法华经变化城喻品',
    center: { x: 28.5, y: 0, z: 2.8 },
    radius: 3.5,
    wallColor: new THREE.Color(0x4a3a2a),
    muralColor1: new THREE.Color(0x3a8a6a),      // 石绿
    muralColor2: new THREE.Color(0x3a5aaa),      // 石青
    goldColor: new THREE.Color(0xd4b040),
    caveSeed: 4.0,
    width: 4.0,
    height: 2.5,
  },
  {
    caveNumber: '17',
    name: '藏经洞绢画修复',
    center: { x: 35.5, y: 0, z: 2.5 },
    radius: 3.0,
    wallColor: new THREE.Color(0x4a3a28),
    muralColor1: new THREE.Color(0xd4a060),      // 金绢
    muralColor2: new THREE.Color(0x8a4a3a),      // 朱砂
    goldColor: new THREE.Color(0xf0d060),
    caveSeed: 5.5,
    width: 3.5,
    height: 2.2,
  },
  {
    caveNumber: '3',
    name: '元代千手观音壁画',
    center: { x: 42.5, y: 0, z: 2.8 },
    radius: 3.5,
    wallColor: new THREE.Color(0x3a2a1a),
    muralColor1: new THREE.Color(0x3aaa8a),      // 密宗翠绿
    muralColor2: new THREE.Color(0xaa6a4a),      // 朱红
    goldColor: new THREE.Color(0xc8a838),
    caveSeed: 7.0,
    width: 4.0,
    height: 2.5,
  },
]

// 修复系统状态
let muralRestoreMeshes = []
let restoreProgress = {}
let isRestoring = false
let activeRestoreIndex = -1
let sceneRef = null
let restoreParticles = []   // 修复粒子系统
let restoreLights = []      // 修复点光源

/**
 * 初始化AIGC壁画修复效果
 */
export function initAIGCMuralRestore(scene) {
  sceneRef = scene

  MURAL_RESTORE_CONFIGS.forEach((config, index) => {
    // 高细分平面（顶点位移需要足够网格密度）
    const geometry = new THREE.PlaneGeometry(config.width, config.height, 80, 80)

    const material = new THREE.ShaderMaterial({
      vertexShader: MURAL_RESTORE_VS,
      fragmentShader: MURAL_RESTORE_FS,
      uniforms: {
        uProgress: { value: 0.0 },
        uTime: { value: 0.0 },
        uRestoreCenter: { value: new THREE.Vector3(config.center.x, config.center.y, config.center.z) },
        uRestoreRadius: { value: config.radius },
        uWallColor: { value: config.wallColor },
        uMuralColor1: { value: config.muralColor1 },
        uMuralColor2: { value: config.muralColor2 },
        uGoldColor: { value: config.goldColor },
        uCaveSeed: { value: config.caveSeed },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(config.center.x, 2.0, config.center.z - 0.05)
    mesh.name = 'AIGC修复_' + config.name
    mesh.userData.restoreIndex = index
    mesh.userData.config = config
    mesh.visible = false

    scene.add(mesh)
    muralRestoreMeshes.push(mesh)
    restoreProgress[index] = 0

    // 创建修复粒子系统（金色星尘）
    const particleCount = 120
    const particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const speeds = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      // 粒子初始位置在壁画周围
      positions[i * 3] = config.center.x + (Math.random() - 0.5) * config.width * 1.5
      positions[i * 3 + 1] = 2.0 + (Math.random() - 0.5) * config.height * 1.5
      positions[i * 3 + 2] = config.center.z + (Math.random() - 0.5) * 0.5

      const goldColor = config.goldColor
      colors[i * 3] = goldColor.r
      colors[i * 3 + 1] = goldColor.g
      colors[i * 3 + 2] = goldColor.b

      sizes[i] = 0.02 + Math.random() * 0.04
      speeds[i] = 0.5 + Math.random() * 1.5
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const particleSystem = new THREE.Points(particleGeo, particleMat)
    particleSystem.name = '修复粒子_' + config.caveNumber
    particleSystem.userData.speeds = speeds
    particleSystem.userData.basePositions = positions.slice() // 保存初始位置
    particleSystem.visible = false
    scene.add(particleSystem)
    restoreParticles.push(particleSystem)

    // 创建修复点光源
    const light = new THREE.PointLight(config.goldColor, 0, 5)
    light.position.set(config.center.x, 2.5, config.center.z + 0.5)
    light.name = '修复光源_' + config.caveNumber
    scene.add(light)
    restoreLights.push(light)
  })

  console.log('[AIGC] 壁画修复效果系统初始化完成（' + MURAL_RESTORE_CONFIGS.length + ' 个修复区域 + 粒子 + 光源）')
}

/**
 * 触发壁画修复动画
 */
export function triggerMuralRestore(caveIndex) {
  if (caveIndex < 0 || caveIndex >= muralRestoreMeshes.length) return false
  if (restoreProgress[caveIndex] >= 1.0) return false

  const mesh = muralRestoreMeshes[caveIndex]
  mesh.visible = true
  isRestoring = true
  activeRestoreIndex = caveIndex

  // 激活粒子和光源
  const particles = restoreParticles[caveIndex]
  if (particles) {
    particles.visible = true
    particles.material.opacity = 0
  }

  console.log('[AIGC] 启动壁画修复: ' + MURAL_RESTORE_CONFIGS[caveIndex].name)
  return true
}

/**
 * 重置壁画修复
 */
export function resetMuralRestore(caveIndex) {
  if (caveIndex < 0 || caveIndex >= muralRestoreMeshes.length) return
  restoreProgress[caveIndex] = 0
  const mesh = muralRestoreMeshes[caveIndex]
  if (mesh) {
    mesh.material.uniforms.uProgress.value = 0
    mesh.visible = false
  }
  const particles = restoreParticles[caveIndex]
  if (particles) {
    particles.visible = false
    particles.material.opacity = 0
  }
  const light = restoreLights[caveIndex]
  if (light) light.intensity = 0
}

/**
 * 更新壁画修复动画（每帧调用）
 */
export function updateAIGCMuralRestore(delta, elapsed) {
  muralRestoreMeshes.forEach((mesh, index) => {
    if (!mesh.visible) return

    mesh.material.uniforms.uTime.value = elapsed

    if (isRestoring && index === activeRestoreIndex) {
      // 修复速度：前期慢（细品破损）→中期加速（戏剧性愈合）→后期慢（欣赏绝美）
      const currentP = restoreProgress[index]
      let speed = 0.12
      if (currentP > 0.1 && currentP < 0.5) speed = 0.18   // 裂缝愈合阶段加速
      if (currentP > 0.5 && currentP < 0.85) speed = 0.15   // 颜色绽放适中
      if (currentP > 0.9) speed = 0.08                       // 最终重生放慢

      restoreProgress[index] = Math.min(1.0, restoreProgress[index] + delta * speed)
      mesh.material.uniforms.uProgress.value = restoreProgress[index]

      // 更新粒子系统
      const particles = restoreParticles[index]
      if (particles) {
        const progress = restoreProgress[index]
        // 粒子透明度：修复中渐显，完成后渐隐
        if (progress < 0.9) {
          particles.material.opacity = Math.min(0.7, progress * 2.0)
        } else {
          particles.material.opacity = Math.max(0, 0.7 * (1.0 - (progress - 0.9) / 0.1))
        }

        // 粒子动画：螺旋上升 + 向壁画中心聚拢
        const posAttr = particles.geometry.attributes.position
        const basePos = particles.userData.basePositions
        const speeds = particles.userData.speeds

        for (let i = 0; i < posAttr.count; i++) {
          const bx = basePos[i * 3]
          const by = basePos[i * 3 + 1]
          const bz = basePos[i * 3 + 2]
          const sp = speeds[i]

          // 螺旋运动
          const angle = elapsed * sp + i * 0.5
          const radius = 0.3 + Math.sin(elapsed * sp * 0.7 + i) * 0.2

          posAttr.array[i * 3] = bx + Math.cos(angle) * radius * progress
          posAttr.array[i * 3 + 1] = by + Math.sin(elapsed * sp * 1.2) * 0.3
          posAttr.array[i * 3 + 2] = bz + Math.sin(angle) * radius * progress * 0.3
        }
        posAttr.needsUpdate = true
      }

      // 更新点光源
      const light = restoreLights[index]
      if (light) {
        const progress = restoreProgress[index]
        if (progress < 0.9) {
          light.intensity = Math.min(2.0, progress * 4.0)
        } else {
          light.intensity = Math.max(0, 2.0 * (1.0 - (progress - 0.9) / 0.1))
        }
        // 光源闪烁
        light.intensity += Math.sin(elapsed * 8) * 0.2 * (1.0 - progress)
      }

      // 修复完成
      if (restoreProgress[index] >= 1.0) {
        isRestoring = false
        activeRestoreIndex = -1

        // 隐藏粒子和光源
        if (particles) {
          setTimeout(() => { particles.visible = false }, 500)
        }
        if (light) {
          light.intensity = 0
        }

        console.log('[AIGC] 壁画修复完成: ' + MURAL_RESTORE_CONFIGS[index].name)
      }
    }
  })
}

/**
 * 获取壁画修复进度
 */
export function getRestoreProgress(caveIndex) {
  return restoreProgress[caveIndex] || 0
}

/**
 * 获取所有修复配置
 */
export function getMuralRestoreConfigs() {
  return MURAL_RESTORE_CONFIGS
}


// ============================================================
// 2. 飞天动画系统（程序化骨骼动画 + 粒子拖尾）
// ============================================================

const APSARA_CONFIGS = [
  {
    caveNumber: '285',
    count: 3,
    path: [
      { x: 10, y: 0.5, z: 3.2 },
      { x: 12, y: -0.5, z: 3.6 },
      { x: 14, y: 0.3, z: 3.4 },
      { x: 13, y: -0.3, z: 3.0 },
    ],
    scale: 0.6,
    speed: 0.3,
    color: 0x88ccaa,
    trailColor: 0x66aa88,
  },
  {
    caveNumber: '45',
    count: 4,
    path: [
      { x: 17, y: 0.6, z: 3.4 },
      { x: 19, y: -0.4, z: 3.8 },
      { x: 21, y: 0.5, z: 3.6 },
      { x: 20, y: -0.5, z: 3.0 },
    ],
    scale: 0.7,
    speed: 0.25,
    color: 0xeebb77,
    trailColor: 0xcc9955,
  },
  {
    caveNumber: '217',
    count: 3,
    path: [
      { x: 24, y: 0.4, z: 3.3 },
      { x: 26, y: -0.6, z: 3.7 },
      { x: 28, y: 0.3, z: 3.5 },
      { x: 27, y: -0.4, z: 3.1 },
    ],
    scale: 0.65,
    speed: 0.28,
    color: 0x77bbaa,
    trailColor: 0x55aa88,
  },
  {
    caveNumber: '17',
    count: 2,
    path: [
      { x: 31, y: 0.3, z: 3.2 },
      { x: 33, y: -0.3, z: 3.5 },
      { x: 35, y: 0.4, z: 3.3 },
    ],
    scale: 0.55,
    speed: 0.22,
    color: 0xccaa66,
    trailColor: 0xaa8844,
  },
  {
    caveNumber: '3',
    count: 2,
    path: [
      { x: 38, y: 0.5, z: 3.3 },
      { x: 40, y: -0.5, z: 3.6 },
      { x: 42, y: 0.3, z: 3.4 },
    ],
    scale: 0.6,
    speed: 0.2,
    color: 0x66aa99,
    trailColor: 0x448866,
  },
]

let apsaraSprites = []
let apsaraTrails = []
let apsaraAnimData = []

/**
 * 初始化飞天动画系统
 */
export function initApsaraAnimation(scene) {
  APSARA_CONFIGS.forEach((config) => {
    for (let i = 0; i < config.count; i++) {
      const texture = createApsaraTexture(config.color, i)

      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      })

      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(config.scale, config.scale * 1.5, 1)
      sprite.name = '飞天_' + config.caveNumber + '_' + i

      const offset = (i - config.count / 2) * 1.5
      sprite.position.set(
        config.path[0].x + offset,
        config.path[0].y,
        config.path[0].z,
      )

      scene.add(sprite)
      apsaraSprites.push(sprite)

      apsaraAnimData.push({
        sprite,
        config,
        pathOffset: i * 0.3,
        pathProgress: i * 0.25,
        speed: config.speed * (0.8 + Math.random() * 0.4),
        bobPhase: Math.random() * Math.PI * 2,
        bobAmplitude: 0.15 + Math.random() * 0.1,
      })

      // 飞天粒子拖尾
      const trailCount = 30
      const trailGeo = new THREE.BufferGeometry()
      const trailPositions = new Float32Array(trailCount * 3)
      const trailColors = new Float32Array(trailCount * 3)
      const trailSizes = new Float32Array(trailCount)
      const trailColor = new THREE.Color(config.trailColor)

      for (let j = 0; j < trailCount; j++) {
        trailPositions[j * 3] = sprite.position.x
        trailPositions[j * 3 + 1] = sprite.position.y
        trailPositions[j * 3 + 2] = sprite.position.z

        const alpha = 1.0 - j / trailCount
        trailColors[j * 3] = trailColor.r * alpha
        trailColors[j * 3 + 1] = trailColor.g * alpha
        trailColors[j * 3 + 2] = trailColor.b * alpha

        trailSizes[j] = (0.12 - j * 0.003) * config.scale
      }

      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
      trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1))

      const trailMat = new THREE.PointsMaterial({
        size: 0.1 * config.scale,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })

      const trailPoints = new THREE.Points(trailGeo, trailMat)
      trailPoints.name = '飞天拖尾_' + config.caveNumber + '_' + i
      scene.add(trailPoints)
      apsaraTrails.push(trailPoints)
    }
  })

  console.log('[AIGC] 飞天动画系统初始化完成（' + apsaraSprites.length + ' 个飞天精灵）')
}

/**
 * 程序化绘制飞天精灵纹理
 */
function createApsaraTexture(color, variant) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, size, size)

  const c = new THREE.Color(color)
  const r = Math.floor(c.r * 255)
  const g = Math.floor(c.g * 255)
  const b = Math.floor(c.b * 255)

  ctx.save()
  ctx.translate(size / 2, size / 2)

  // 中心光晕
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.4)
  glow.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0.8)')
  glow.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',0.3)')
  glow.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)')
  ctx.fillStyle = glow
  ctx.fillRect(-size / 2, -size / 2, size, size)

  // 飞天身姿
  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(0, 0, size * 0.12, size * 0.3, variant * 0.5, 0, Math.PI * 2)
  ctx.stroke()

  // 头部
  ctx.fillStyle = 'rgba(' + Math.min(255, r + 40) + ',' + Math.min(255, g + 30) + ',' + Math.min(255, b + 20) + ',0.9)'
  ctx.beginPath()
  ctx.arc(0, -size * 0.2, size * 0.06, 0, Math.PI * 2)
  ctx.fill()

  // 飘带
  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.7)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-size * 0.08, -size * 0.1)
  ctx.bezierCurveTo(-size * 0.3, -size * 0.2, -size * 0.35, size * 0.1, -size * 0.15, size * 0.25)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(size * 0.08, -size * 0.1)
  ctx.bezierCurveTo(size * 0.3, -size * 0.15, size * 0.35, size * 0.15, size * 0.2, size * 0.3)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, size * 0.05)
  ctx.bezierCurveTo(-size * 0.1, size * 0.2, size * 0.15, size * 0.3, size * 0.05, size * 0.4)
  ctx.stroke()

  // 花饰
  ctx.fillStyle = 'rgba(255, 230, 180, 0.6)'
  for (let i = 0; i < 5; i++) {
    const px = (Math.random() - 0.5) * size * 0.5
    const py = (Math.random() - 0.5) * size * 0.5
    ctx.beginPath()
    ctx.ellipse(px, py, 3, 1.5, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * 更新飞天动画
 */
export function updateApsaraAnimation(delta, elapsed) {
  apsaraAnimData.forEach((data, index) => {
    const { sprite, config, speed, bobPhase, bobAmplitude } = data

    data.pathProgress += delta * speed
    if (data.pathProgress > 1.0) data.pathProgress -= 1.0

    const pos = catmullRomInterpolate(config.path, data.pathProgress)
    const bobOffset = Math.sin(elapsed * 2.5 + bobPhase) * bobAmplitude

    sprite.position.set(pos.x, pos.y + bobOffset, pos.z + bobOffset * 0.3)
    sprite.material.rotation = Math.sin(elapsed * 1.5 + data.pathOffset) * 0.15
    sprite.material.opacity = 0.7 + Math.sin(elapsed * 3 + bobPhase) * 0.15

    const trail = apsaraTrails[index]
    if (trail) {
      const trailPos = trail.geometry.attributes.position.array
      const trailCount = trailPos.length / 3

      for (let j = trailCount - 1; j > 0; j--) {
        trailPos[j * 3] = trailPos[(j - 1) * 3]
        trailPos[j * 3 + 1] = trailPos[(j - 1) * 3 + 1]
        trailPos[j * 3 + 2] = trailPos[(j - 1) * 3 + 2]
      }
      trailPos[0] = sprite.position.x
      trailPos[1] = sprite.position.y
      trailPos[2] = sprite.position.z
      trail.geometry.attributes.position.needsUpdate = true
    }
  })
}

function catmullRomInterpolate(points, t) {
  const n = points.length
  const totalT = t * n
  const index = Math.floor(totalT)
  const frac = totalT - index

  const p0 = points[((index - 1) % n + n) % n]
  const p1 = points[index % n]
  const p2 = points[(index + 1) % n]
  const p3 = points[(index + 2) % n]

  const t2 = frac * frac
  const t3 = t2 * frac

  const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * frac + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
  const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * frac + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * frac + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)

  return { x, y, z }
}


// ============================================================
// 3. AI语音解说系统（窟specific深度解说 + 自然配音）
// ============================================================

let speechSynth = null
let currentUtterance = null
let isSpeaking = false
let voiceGuideEnabled = false
let autoGuideActive = false
let lastGuideCave = null
let utteranceQueue = []    // 逐句播放队列
let isProcessingQueue = false

// 洞窟深度解说文案（每窟针对具体壁画的详细讲解）
const VOICE_GUIDE_SCRIPTS = {
  '285': {
    title: '西魏第285窟',
    sentences: [
      '您正在参观的，是莫高窟第285窟，西魏大统四年，公元五三八年营建。',
      '这是莫高窟现存最早有明确纪年的洞窟，被誉为敦煌艺术的分水岭。',
      '请抬头仰望窟顶。四披之上，伏羲女娲手持规矩、身披羽衣，与佛教天人共舞苍穹。',
      '这是中原神话与西域信仰的千年对话，世界文明史上的珍贵瞬间。',
      '南壁的五百强盗成佛图，是敦煌最早的因缘经变画。',
      '画面中，五百强盗被王军俘虏、受挖眼之刑，在黑暗中痛苦呼号。',
      '佛以神力使他们复明，强盗们皈依佛法，最终成佛。',
      '这幅画传达的，是放下屠刀、立地成佛的慈悲精神。',
      '而您面前的飞天，面容清瘦秀朗，飘带凌空飞舞，正是西魏秀骨清像风格的典型代表。',
    ],
  },
  '45': {
    title: '盛唐第45窟',
    sentences: [
      '欢迎来到盛唐第45窟，这是敦煌彩塑艺术的巅峰之作。',
      '请看佛龛内的七身彩塑，这是莫高窟最完整的盛唐彩塑群，历经千年仍栩栩如生。',
      '主尊释迦牟尼佛结跏趺坐，面相丰腴庄严，衣纹流畅，体现了盛唐造像圆润饱满的黄金时代风范。',
      '左侧的迦叶，眉头紧锁，面容苍老，是一位饱经风霜的苦行僧。',
      '右侧的阿难，面如满月，眉目清秀，是佛陀最年轻的弟子。',
      '一老一少，一动一静，盛唐匠师对人物性格的刻画力令人叹为观止。',
      '外侧的天王像，脚踏恶鬼，怒目圆睁，铠甲鳞片清晰可数，是大唐帝国尚武精神的化身。',
      '南壁的观无量寿经变，描绘了阿弥陀佛西方净土的壮丽景象。',
      '楼阁重重，飞天穿梭，乐队演奏，舞者翩跹——这是大唐盛世的极乐想象。',
    ],
  },
  '217': {
    title: '盛唐第217窟',
    sentences: [
      '您所在的是盛唐第217窟，此窟以法华经变闻名于世。',
      '南壁的化城喻品，是敦煌壁画中青绿山水的巅峰之作。',
      '画中群山叠嶂，层峦耸翠，以石青石绿为主色调，辅以朱砂点缀。',
      '山间楼阁掩映，溪流蜿蜒，行旅之人穿行其间——这并非单纯的经变图，更是盛唐画家心中的理想山水。',
      '这幅画比王维的水墨山水更早，开创了中式青绿山水的全新范式，在中国美术史上地位崇高。',
      '窟顶藻井的团花图案，以石青为底，朱砂勾勒花瓣，金箔点缀花心，色彩浓烈饱满。',
      '这是盛唐装饰艺术的最高水准，一千三百年后依然光彩夺目。',
    ],
  },
  '17': {
    title: '晚唐第17窟·藏经洞',
    sentences: [
      '您面前的是举世闻名的藏经洞，第17窟。',
      '公元一九零零年，道士王圆箓在此偶然发现了秘藏千年的五万余件文献。',
      '这个发现，催生了敦煌学这门国际显学。',
      '洞中端坐的洪辩法师像，是晚唐河西都僧统的写真肖像。',
      '他身着袈裟，手持经卷，眉目之间流露出高僧的沉稳与智慧。',
      '藏经洞出土的绢画，以矿物颜料绘制，历经千年色彩依旧鲜艳。',
      '这些绢画是研究唐代绘画技法与颜料工艺的珍贵实物。',
      '五万余件文献涵盖了从四世纪到十一世纪的宗教典籍、官府文书、民间契约、诗词歌赋。',
      '它是一部写在纸上的中古社会百科全书，其价值无法估量。',
    ],
  },
  '3': {
    title: '元代第3窟',
    sentences: [
      '欢迎来到元代第3窟，这是莫高窟千年营建的终章之作。',
      '南壁的千手千眼观音，是元代壁画艺术的巅峰代表。',
      '观音面容端庄，千手如光环展开，每只手心各绘一眼，象征法力无边、普度众生。',
      '整幅画采用铁线描技法，线条精细如丝、流畅如水，一笔到底绝无迟滞。',
      '这种功力，代表了元代画家对线条的极致追求。',
      '画面中的服饰纹样，融合了藏传佛教的曼荼罗元素和中原的祥云纹饰。',
      '胁侍菩萨头戴五佛冠，身披璎珞，是汉藏艺术交融的典范。',
      '第3窟是莫高窟的封笔之作，自此之后，敦煌千年营建画上句号。',
    ],
  },
}

/**
 * 初始化AI语音解说系统
 */
export function initVoiceGuide(camera) {
  speechSynth = window.speechSynthesis

  if (!speechSynth) {
    console.warn('[AIGC] 浏览器不支持 Web Speech API')
    return false
  }

  // 预加载语音列表（某些浏览器异步加载）
  speechSynth.getVoices()
  if (speechSynth.onvoiceschanged !== undefined) {
    speechSynth.onvoiceschanged = () => {
      speechSynth.getVoices()
    }
  }

  console.log('[AIGC] AI语音解说系统初始化完成')
  return true
}

/**
 * 播放洞窟完整解说（逐句自然配音）
 */
export function playCaveNarration(caveNumber) {
  if (!speechSynth) return
  const script = VOICE_GUIDE_SCRIPTS[caveNumber]
  if (!script) return

  stopNarration()

  // 逐句入队，实现自然语速停顿
  utteranceQueue = [...script.sentences]
  processUtteranceQueue()

  console.log('[AIGC] 播放解说: ' + script.title)
}

/**
 * 逐句播放队列（自然配音：句间停顿 + 微调语速）
 */
function processUtteranceQueue() {
  if (isProcessingQueue || utteranceQueue.length === 0) return

  isProcessingQueue = true
  const sentence = utteranceQueue.shift()

  const utterance = new SpeechSynthesisUtterance(sentence)
  utterance.lang = 'zh-CN'

  // 选择最佳中文语音
  const voices = speechSynth.getVoices()
  // 优先选择：Xiaoxiao > Huihui > 其他中文
  const preferredVoices = [
    'Microsoft Xiaoxiao',
    'Microsoft Huihui',
    'Google 中文',
    'Ting-Ting',
    'Zhengyu',
  ]
  let selectedVoice = null
  for (const preferred of preferredVoices) {
    selectedVoice = voices.find(v => v.name.includes(preferred))
    if (selectedVoice) break
  }
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.includes('zh'))
  }
  if (selectedVoice) {
    utterance.voice = selectedVoice
  }

  // 自然语速微调（每句随机微变，避免机械感）
  utterance.rate = 0.88 + Math.random() * 0.08
  utterance.pitch = 1.0 + Math.random() * 0.05
  utterance.volume = 0.9

  currentUtterance = utterance

  utterance.onend = () => {
    isProcessingQueue = false
    isSpeaking = utteranceQueue.length > 0

    // 句间自然停顿（300-600ms，模拟真人思考停顿）
    if (utteranceQueue.length > 0) {
      const pause = 300 + Math.random() * 300
      setTimeout(() => processUtteranceQueue(), pause)
    }
  }

  utterance.onerror = () => {
    isProcessingQueue = false
    isSpeaking = false
  }

  isSpeaking = true
  speechSynth.speak(utterance)
}

/**
 * 播放文物解说
 */
export function playArtifactNarration(title, content) {
  if (!voiceGuideEnabled || !speechSynth) return
  stopNarration()
  utteranceQueue = [title, content]
  processUtteranceQueue()
}

/**
 * 停止解说
 */
export function stopNarration() {
  if (speechSynth) {
    speechSynth.cancel()
  }
  isSpeaking = false
  isProcessingQueue = false
  utteranceQueue = []
}

/**
 * 切换语音导览
 */
export function toggleVoiceGuide() {
  voiceGuideEnabled = !voiceGuideEnabled
  if (!voiceGuideEnabled) stopNarration()
  console.log('[AIGC] 语音导览: ' + (voiceGuideEnabled ? '开启' : '关闭'))
  return voiceGuideEnabled
}

/**
 * 获取语音导览状态
 */
export function isVoiceGuideEnabled() {
  return voiceGuideEnabled
}

/**
 * 切换自动导览
 */
export function toggleAutoGuide() {
  autoGuideActive = !autoGuideActive
  console.log('[AIGC] 自动导览: ' + (autoGuideActive ? '开启' : '关闭'))
  return autoGuideActive
}

/**
 * 检查自动导览
 */
export function checkAutoGuide(currentCave) {
  if (!autoGuideActive || !voiceGuideEnabled || isSpeaking) return
  if (!currentCave || currentCave === lastGuideCave) return
  lastGuideCave = currentCave
  playCaveNarration(currentCave)
}

/**
 * 获取语音是否正在播放
 */
export function isNarrating() {
  return isSpeaking
}

/**
 * 获取洞窟解说文案
 */
export function getVoiceGuideScripts() {
  return VOICE_GUIDE_SCRIPTS
}

/**
 * 获取所有AIGC模块状态
 */
export function getAIGCState() {
  return {
    muralRestore: {
      isRestoring,
      activeRestoreIndex,
      progress: { ...restoreProgress },
    },
    apsara: {
      count: apsaraSprites.length,
    },
    voiceGuide: {
      enabled: voiceGuideEnabled,
      autoGuide: autoGuideActive,
      isSpeaking,
    },
  }
}
