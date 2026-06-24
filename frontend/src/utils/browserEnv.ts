// 偵測「App 內建瀏覽器 / 內嵌 webview」。Google OAuth 在這些環境會回
// 403 disallowed_useragent（Use secure browsers 政策），導致 Google 登入失敗。
// 偵測到時前端引導使用者改用系統瀏覽器（Safari/Chrome）或 Email 登入。

export interface InAppBrowserInfo {
  /** 是否在已知的 App 內建瀏覽器 / webview 中 */
  isInApp: boolean
  /** 可讀的來源名稱（例：LINE、Instagram），無法辨識時為 undefined */
  app?: string
}

const NAMED_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'LINE', re: /\bLine\//i },
  { name: 'Facebook', re: /\bFB(AN|AV|_IAB)\b/i },
  { name: 'Messenger', re: /\bMessenger\b/i },
  { name: 'Instagram', re: /\bInstagram\b/i },
  { name: 'Threads', re: /\bBarcelona\b/i },
  { name: '微信', re: /\bMicroMessenger\b/i },
  { name: 'WeChat', re: /\bWeChat\b/i },
  { name: 'Telegram', re: /\bTelegram\b/i },
  { name: 'TikTok', re: /\b(musical_ly|BytedanceWebview|Bytedance)\b/i },
  { name: 'Twitter', re: /\bTwitter(Android|iPhone)?\b/i },
  { name: 'KakaoTalk', re: /\bKAKAOTALK\b/i },
  { name: 'Snapchat', re: /\bSnapchat\b/i },
  { name: 'Pinterest', re: /\bPinterest\b/i },
]

// 通用 Android WebView 標記（沒有具名 App 但仍是內嵌瀏覽器）
const GENERIC_WEBVIEW = [/;\s*wv\b/i, /\bWebView\b/i]

export function detectInAppBrowser(ua: string = navigator.userAgent): InAppBrowserInfo {
  for (const { name, re } of NAMED_PATTERNS) {
    if (re.test(ua)) return { isInApp: true, app: name }
  }
  if (GENERIC_WEBVIEW.some((re) => re.test(ua))) return { isInApp: true }
  return { isInApp: false }
}
