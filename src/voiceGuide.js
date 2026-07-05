/**
 * 语音交互导览模块（Web Speech API）
 * 核心功能：
 * 1. 语音识别（SpeechRecognition）- 语音命令控制场景
 * 2. 语音合成（SpeechSynthesis）- 语音导览解说
 * 3. 语音命令词库 - 自然语言交互控制洞窟漫游
 * 4. 语音反馈视觉指示器 - 实时显示语音识别状态
 *
 * 对比点击文字卡片的优势：
 * - 免手持操作，沉浸式体验
 * - 支持自然语言（"带我去45窟" 比 点击按钮更直觉）
 * - 视障用户友好
 * - 线下大屏场景适配（隔空语音控制）
 */
import * as THREE from 'three'

// ============================================================
// 语音识别系统
// ============================================================

let recognition = null
let isListening = false
let voiceControlEnabled = false
let onCommandCallback = null  // 命令执行回调

// 语音识别状态UI元素
let voiceIndicator = null
let voiceTranscript = null

// 语音命令词库（自然语言 -> 动作映射）
const VOICE_COMMANDS = {
  // 洞窟导航
  '去285窟': { action: 'flyToCave', params: ['285'] },
  '去45窟': { action: 'flyToCave', params: ['45'] },
  '去217窟': { action: 'flyToCave', params: ['217'] },
  '去17窟': { action: 'flyToCave', params: ['17'] },
  '去3窟': { action: 'flyToCave', params: ['3'] },
  '带我去285窟': { action: 'flyToCave', params: ['285'] },
  '带我去45窟': { action: 'flyToCave', params: ['45'] },
  '带我去217窟': { action: 'flyToCave', params: ['217'] },
  '带我去17窟': { action: 'flyToCave', params: ['17'] },
  '带我去3窟': { action: 'flyToCave', params: ['3'] },
  '西魏洞窟': { action: 'flyToCave', params: ['285'] },
  '盛唐洞窟': { action: 'flyToCave', params: ['45'] },
  '藏经洞': { action: 'flyToCave', params: ['17'] },
  '千手观音': { action: 'flyToCave', params: ['3'] },

  // 视角控制
  '放大': { action: 'zoom', params: ['in'] },
  '缩小': { action: 'zoom', params: ['out'] },
  '拉近': { action: 'zoom', params: ['in'] },
  '拉远': { action: 'zoom', params: ['out'] },
  '向上看': { action: 'look', params: ['up'] },
  '向下看': { action: 'look', params: ['down'] },
  '向左看': { action: 'look', params: ['left'] },
  '向右看': { action: 'look', params: ['right'] },
  '抬头': { action: 'look', params: ['up'] },
  '低头': { action: 'look', params: ['down'] },

  // 功能控制
  '修复壁画': { action: 'restoreMural', params: [] },
  'AI修复': { action: 'restoreMural', params: [] },
  '开始修复': { action: 'restoreMural', params: [] },
  '语音导览': { action: 'toggleVoiceGuide', params: [] },
  '自动导览': { action: 'toggleAutoGuide', params: [] },
  '讲解': { action: 'narrateCurrent', params: [] },
  '介绍一下': { action: 'narrateCurrent', params: [] },
  '讲讲这个洞窟': { action: 'narrateCurrent', params: [] },
  '停止讲解': { action: 'stopNarration', params: [] },
  '安静': { action: 'stopNarration', params: [] },

  // VR/沉浸模式
  '进入VR': { action: 'toggleVR', params: [] },
  '沉浸模式': { action: 'toggleImmersive', params: [] },
  '退出VR': { action: 'exitVR', params: [] },

  // 粒子特效
  '花瓣': { action: 'toggleParticles', params: [] },
  '金沙': { action: 'toggleParticles', params: [] },

  // 地图/导览
  '打开地图': { action: 'toggleMinimap', params: [] },
  '导览指引': { action: 'showGuide', params: [] },
  '帮助': { action: 'showGuide', params: [] },

  // 全屏
  '全屏': { action: 'toggleFullscreen', params: [] },
  '退出全屏': { action: 'exitFullscreen', params: [] },
}

// 模糊匹配关键词（支持更自然的说法）
const FUZZY_COMMANDS = [
  { keywords: ['285', '西魏'], action: 'flyToCave', params: ['285'] },
  { keywords: ['45', '盛唐', '四十五'], action: 'flyToCave', params: ['45'] },
  { keywords: ['217', '二一七'], action: 'flyToCave', params: ['217'] },
  { keywords: ['17', '藏经', '十七'], action: 'flyToCave', params: ['17'] },
  { keywords: ['3', '元代', '千手'], action: 'flyToCave', params: ['3'] },
  { keywords: ['修复', 'AI', '还原'], action: 'restoreMural', params: [] },
  { keywords: ['讲解', '介绍', '解说', '导览'], action: 'narrateCurrent', params: [] },
  { keywords: ['停止', '安静', '闭嘴'], action: 'stopNarration', params: [] },
  { keywords: ['放大', '拉近', '近一点'], action: 'zoom', params: ['in'] },
  { keywords: ['缩小', '拉远', '远一点'], action: 'zoom', params: ['out'] },
  { keywords: ['VR', '沉浸'], action: 'toggleVR', params: [] },
  { keywords: ['地图', '导览图'], action: 'toggleMinimap', params: [] },
  { keywords: ['全屏'], action: 'toggleFullscreen', params: [] },
  { keywords: ['帮助', '指引', '怎么用'], action: 'showGuide', params: [] },
]

/**
 * 初始化语音交互系统
 * @param {Function} commandCallback - 命令执行回调 (action, params) => void
 */
export function initVoiceInteraction(commandCallback) {
  onCommandCallback = commandCallback

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) {
    console.warn('[语音交互] 浏览器不支持 Web Speech API')
    return false
  }

  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true        // 持续识别
  recognition.interimResults = true    // 返回中间结果
  recognition.maxAlternatives = 3      // 最多3个候选结果

  // 识别结果回调
  recognition.onresult = onSpeechResult
  recognition.onerror = onSpeechError
  recognition.onend = onSpeechEnd

  // 创建语音状态指示器UI
  createVoiceIndicator()

  console.log('[语音交互] Web Speech API 语音交互系统初始化完成')
  return true
}

/**
 * 创建语音状态指示器（浮动UI）
 */
function createVoiceIndicator() {
  // 主容器
  voiceIndicator = document.createElement('div')
  voiceIndicator.id = 'voice-indicator'
  voiceIndicator.style.cssText =
    'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);' +
    'display:none;flex-direction:column;align-items:center;gap:8px;z-index:60;'

  // 麦克风图标 + 脉冲动画
  const micBtn = document.createElement('div')
  micBtn.id = 'voice-mic-btn'
  micBtn.style.cssText =
    'width:56px;height:56px;border-radius:50%;' +
    'background:rgba(26,20,16,0.85);border:2px solid rgba(139,105,20,0.4);' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
    'backdrop-filter:blur(8px);transition:all 0.3s;position:relative;'

  // 麦克风SVG图标
  micBtn.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="2">' +
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
    '<line x1="12" y1="19" x2="12" y2="23"/>' +
    '<line x1="8" y1="23" x2="16" y2="23"/>' +
    '</svg>'

  // 脉冲动画容器
  const pulseRing = document.createElement('div')
  pulseRing.id = 'voice-pulse'
  pulseRing.style.cssText =
    'position:absolute;top:-4px;left:-4px;width:64px;height:64px;' +
    'border-radius:50%;border:2px solid rgba(212,175,55,0);' +
    'animation:voicePulse 2s ease-out infinite;display:none;'
  micBtn.appendChild(pulseRing)

  micBtn.addEventListener('click', toggleVoiceControl)
  voiceIndicator.appendChild(micBtn)

  // 识别文本显示
  voiceTranscript = document.createElement('div')
  voiceTranscript.id = 'voice-transcript'
  voiceTranscript.style.cssText =
    'background:rgba(26,20,16,0.85);color:#C9B89C;padding:6px 14px;' +
    'border-radius:16px;font-size:12px;max-width:300px;text-align:center;' +
    'backdrop-filter:blur(8px);border:1px solid rgba(139,105,20,0.3);' +
    'letter-spacing:1px;opacity:0;transition:opacity 0.3s;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
  voiceTranscript.textContent = '等待语音指令...'
  voiceIndicator.appendChild(voiceTranscript)

  // 注入CSS动画
  const style = document.createElement('style')
  style.textContent =
    '@keyframes voicePulse {' +
    '  0% { transform: scale(1); border-color: rgba(212,175,55,0.6); }' +
    '  100% { transform: scale(1.5); border-color: rgba(212,175,55,0); }' +
    '}' +
    '@keyframes voiceListening {' +
    '  0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.4); }' +
    '  50% { box-shadow: 0 0 0 12px rgba(212,175,55,0); }' +
    '}'
  document.head.appendChild(style)

  document.body.appendChild(voiceIndicator)
}

/**
 * 切换语音控制
 */
export function toggleVoiceControl() {
  if (isListening) {
    stopVoiceControl()
  } else {
    startVoiceControl()
  }
  return isListening
}

/**
 * 启动语音控制
 */
function startVoiceControl() {
  if (!recognition) return

  try {
    recognition.start()
    isListening = true
    voiceControlEnabled = true

    // 更新UI
    if (voiceIndicator) voiceIndicator.style.display = 'flex'
    const micBtn = document.getElementById('voice-mic-btn')
    if (micBtn) {
      micBtn.style.borderColor = '#D4AF37'
      micBtn.style.boxShadow = '0 0 15px rgba(212,175,55,0.3)'
      micBtn.style.animation = 'voiceListening 1.5s ease-in-out infinite'
    }
    const pulse = document.getElementById('voice-pulse')
    if (pulse) pulse.style.display = 'block'

    if (voiceTranscript) {
      voiceTranscript.textContent = '正在聆听...'
      voiceTranscript.style.opacity = '1'
    }

    console.log('[语音交互] 语音控制已启动')
  } catch (e) {
    console.warn('[语音交互] 启动失败: ' + e.message)
  }
}

/**
 * 停止语音控制
 */
function stopVoiceControl() {
  if (!recognition) return

  try {
    recognition.stop()
  } catch (e) { /* 忽略 */ }

  isListening = false
  voiceControlEnabled = false

  // 更新UI
  const micBtn = document.getElementById('voice-mic-btn')
  if (micBtn) {
    micBtn.style.borderColor = 'rgba(139,105,20,0.4)'
    micBtn.style.boxShadow = 'none'
    micBtn.style.animation = 'none'
  }
  const pulse = document.getElementById('voice-pulse')
  if (pulse) pulse.style.display = 'none'

  if (voiceTranscript) {
    voiceTranscript.textContent = '语音控制已暂停'
    voiceTranscript.style.opacity = '0.5'
  }

  console.log('[语音交互] 语音控制已停止')
}

/**
 * 语音识别结果处理
 */
function onSpeechResult(event) {
  const last = event.results.length - 1
  const result = event.results[last]
  const transcript = result[0].transcript.trim()

  // 显示识别文本
  if (voiceTranscript) {
    voiceTranscript.textContent = transcript
    voiceTranscript.style.opacity = '1'
  }

  // 只有最终结果才执行命令
  if (result.isFinal) {
    processVoiceCommand(transcript)
  }
}

/**
 * 语音识别错误处理
 */
function onSpeechError(event) {
  if (event.error === 'no-speech') {
    // 没有检测到语音，静默忽略
    return
  }
  if (event.error === 'aborted') {
    return
  }
  console.warn('[语音交互] 识别错误: ' + event.error)

  if (voiceTranscript) {
    const errorMessages = {
      'not-allowed': '请授权麦克风访问',
      'network': '网络错误，请检查连接',
      'audio-capture': '未检测到麦克风',
    }
    voiceTranscript.textContent = errorMessages[event.error] || '识别出错，请重试'
  }
}

/**
 * 语音识别结束（自动重启持续识别）
 */
function onSpeechEnd() {
  // 持续识别模式：自动重启
  if (voiceControlEnabled && isListening) {
    setTimeout(() => {
      try {
        recognition.start()
      } catch (e) { /* 忽略重启失败 */ }
    }, 300)
  }
}

/**
 * 处理语音命令
 * 策略：精确匹配 -> 模糊匹配 -> 默认提示
 */
function processVoiceCommand(transcript) {
  // 1. 精确匹配
  const exactMatch = VOICE_COMMANDS[transcript]
  if (exactMatch) {
    executeCommand(exactMatch.action, exactMatch.params)
    showCommandFeedback(transcript, exactMatch.action)
    return
  }

  // 2. 模糊匹配（关键词命中）
  for (const fuzzy of FUZZY_COMMANDS) {
    const matched = fuzzy.keywords.some(kw => transcript.includes(kw))
    if (matched) {
      executeCommand(fuzzy.action, fuzzy.params)
      showCommandFeedback(transcript, fuzzy.action)
      return
    }
  }

  // 3. 未识别命令
  if (voiceTranscript) {
    voiceTranscript.textContent = '未识别: "' + transcript + '"'
    voiceTranscript.style.opacity = '0.7'
  }
  console.log('[语音交互] 未识别命令: ' + transcript)
}

/**
 * 执行命令
 */
function executeCommand(action, params) {
  if (onCommandCallback) {
    onCommandCallback(action, params)
  }
}

/**
 * 显示命令执行反馈
 */
function showCommandFeedback(transcript, action) {
  if (voiceTranscript) {
    const actionNames = {
      'flyToCave': '正在飞往洞窟...',
      'zoom': '调整视角...',
      'look': '调整视角...',
      'restoreMural': '启动AI壁画修复...',
      'toggleVoiceGuide': '切换语音导览...',
      'toggleAutoGuide': '切换自动导览...',
      'narrateCurrent': '开始讲解...',
      'stopNarration': '已停止讲解',
      'toggleVR': '切换VR模式...',
      'toggleImmersive': '切换沉浸模式...',
      'toggleParticles': '切换粒子特效...',
      'toggleMinimap': '切换导览地图...',
      'showGuide': '显示导览指引...',
      'toggleFullscreen': '切换全屏...',
      'exitVR': '退出VR模式...',
      'exitFullscreen': '退出全屏...',
    }
    voiceTranscript.textContent = (actionNames[action] || '执行中...') + ' (' + transcript + ')'
    voiceTranscript.style.opacity = '1'
  }
}


// ============================================================
// 语音合成导览系统（增强版）
// ============================================================

let speechSynth = null
let currentUtterance = null
let isSpeaking = false
let voiceGuideEnabled = false
let autoGuideActive = false
let lastGuideCave = null

// 洞窟解说文案（丰富的专业级讲解）
const VOICE_NARRATIONS = {
  '285': {
    title: '西魏第285窟 - 最早纪年洞窟',
    intro: '欢迎来到西魏第285窟，建于公元538年，是莫高窟现存最早有明确纪年的洞窟。此窟被誉为敦煌艺术的分水岭，见证了从西域风格向中原风格的转变。',
    highlights: [
      '您面前的飞天壁画，面容清瘦秀朗，飘带飞扬，融合了伏羲女娲等中国传统神话题材，体现了西魏时期中西文化交融的艺术特色。',
      '窟顶四披绘制的伏羲女娲图，体现了佛教传入后与本土传统文化的深度融合，是中西文化交融的珍贵见证。',
      '后墙的五百强盗成佛图，是敦煌最早的因缘经变画之一，传递宽容与救赎精神，至今仍具有深刻的伦理启示。',
    ],
  },
  '45': {
    title: '盛唐第45窟 - 彩塑巅峰之作',
    intro: '欢迎来到盛唐第45窟，这是敦煌彩塑艺术的巅峰代表作。佛龛内七身完整彩塑留存至今，是莫高窟最完整的盛唐彩塑群。',
    highlights: [
      '主尊释迦牟尼佛面相丰腴庄严，体现了盛唐造像圆润饱满的黄金时代特征。',
      '两侧的迦叶与阿难弟子像，一老一少，展现了盛唐匠师对人物性格的精湛刻画力。',
      '胁侍菩萨体态婀娜，璎珞华美，体现了大唐盛世以胖为美的审美风尚。',
      '天王与力士像气势威武，是大唐帝国尚武雄健精神的化身。',
    ],
  },
  '217': {
    title: '盛唐第217窟 - 法华经变之冠',
    intro: '欢迎来到盛唐第217窟，此窟以法华经变闻名，南壁的化城喻品是盛唐青绿山水壁画的巅峰之作。',
    highlights: [
      '化城喻品描绘山峦叠嶂的佛国净土，以石青石绿为主色调，开创了中式青绿山水的全新范式。',
      '窟顶藻井团花图案，色彩饱满浓烈，是盛唐洞窟装饰艺术的最高水准。',
      '飞天形象体态丰腴，飘带流畅，体现了盛唐佛教艺术的高度成熟。',
    ],
  },
  '17': {
    title: '晚唐第17窟 - 藏经洞',
    intro: '欢迎来到举世闻名的藏经洞，第17窟。1900年，王圆箓道士在此发现了五万余件秘藏文献，催生了敦煌学。',
    highlights: [
      '洪辩法师真容像端坐于此，他是晚唐河西都僧统。此像写实传神，是晚唐彩塑的佳作。',
      '藏经洞出土的绢画色彩鲜艳，历经千年仍保存完好，体现了古代绘画工艺的高超水平。',
      '五万余件文献是中古社会的百科全书，涵盖了宗教、历史、文学、艺术等各领域。',
    ],
  },
  '3': {
    title: '元代第3窟 - 千年营建的终结',
    intro: '欢迎来到元代第3窟，这是莫高窟营建千年最后的杰作，以千手千眼观音像闻名。',
    highlights: [
      '千手千眼观音壁画，采用铁线描技法，线条精细流畅，是元代壁画艺术的代表作。',
      '壁画融合藏传佛教曼荼罗元素与中原装饰传统，体现了元代多元文化的交融。',
      '胁侍菩萨头戴五佛冠，融合藏传佛教造型特点，呈现元代特有的刚柔并济风格。',
    ],
  },
}

/**
 * 初始化语音导览
 */
export function initVoiceNarration() {
  speechSynth = window.speechSynthesis
  if (!speechSynth) {
    console.warn('[语音导览] 浏览器不支持 SpeechSynthesis')
    return false
  }
  console.log('[语音导览] 语音导览系统初始化完成')
  return true
}

/**
 * 播放洞窟完整解说
 */
export function playCaveNarration(caveNumber) {
  if (!speechSynth) return
  const script = VOICE_NARRATIONS[caveNumber]
  if (!script) return

  stopNarration()

  let fullText = script.intro + '。'
  script.highlights.forEach(h => {
    fullText += h + '。'
  })

  speakText(fullText)
  console.log('[语音导览] 播放解说: ' + script.title)
}

/**
 * 播放文物解说
 */
export function playArtifactNarration(title, content) {
  if (!voiceGuideEnabled || !speechSynth) return
  stopNarration()
  speakText(title + '。' + content)
}

/**
 * 底层语音播放
 */
function speakText(text) {
  if (!speechSynth) return

  // 长文本分段播放（浏览器单次播放有长度限制）
  const chunks = splitTextForSpeech(text, 200)

  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 0.85

    // 选择中文语音
    const voices = speechSynth.getVoices()
    const zhVoice = voices.find(v => v.lang.includes('zh'))
    if (zhVoice) utterance.voice = zhVoice

    if (index === 0) {
      currentUtterance = utterance
    }

    utterance.onend = () => {
      if (index === chunks.length - 1) {
        isSpeaking = false
      }
    }
    utterance.onerror = () => {
      isSpeaking = false
    }

    isSpeaking = true
    speechSynth.speak(utterance)
  })
}

/**
 * 分段文本（避免浏览器语音合成长度限制）
 */
function splitTextForSpeech(text, maxLen) {
  const chunks = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    // 在句号处分割
    let splitIdx = remaining.lastIndexOf('。', maxLen)
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      splitIdx = remaining.lastIndexOf('，', maxLen)
    }
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      splitIdx = maxLen
    }
    chunks.push(remaining.substring(0, splitIdx + 1))
    remaining = remaining.substring(splitIdx + 1)
  }
  return chunks.length > 0 ? chunks : [text]
}

/**
 * 停止解说
 */
export function stopNarration() {
  if (speechSynth) {
    speechSynth.cancel()
  }
  isSpeaking = false
}

/**
 * 切换语音导览
 */
export function toggleVoiceGuide() {
  voiceGuideEnabled = !voiceGuideEnabled
  if (!voiceGuideEnabled) stopNarration()
  console.log('[语音导览] ' + (voiceGuideEnabled ? '开启' : '关闭'))
  return voiceGuideEnabled
}

/**
 * 切换自动导览
 */
export function toggleAutoGuide() {
  autoGuideActive = !autoGuideActive
  console.log('[语音导览] 自动导览: ' + (autoGuideActive ? '开启' : '关闭'))
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
 * 获取语音导览状态
 */
export function getVoiceGuideState() {
  return {
    enabled: voiceGuideEnabled,
    autoGuide: autoGuideActive,
    isSpeaking,
    isListening,
    voiceControlEnabled,
  }
}

/**
 * 获取语音导览文案
 */
export function getVoiceNarrations() {
  return VOICE_NARRATIONS
}

/**
 * 显示/隐藏语音指示器
 */
export function showVoiceIndicator(show) {
  if (voiceIndicator) {
    voiceIndicator.style.display = show ? 'flex' : 'none'
  }
}

/**
 * 销毁语音交互系统
 */
export function destroyVoiceInteraction() {
  stopVoiceControl()
  stopNarration()

  if (voiceIndicator) {
    voiceIndicator.remove()
    voiceIndicator = null
  }

  recognition = null
  speechSynth = null
}
