# Changelog

本檔記錄 Personal Intelligence Studio 前端較大的變更。日期為實際變更日。

## 2026-06-26 — UI 重設計 + 命令面板 / 通知中心 + 載入優化

### 🎨 視覺重設計（全站）
- 中文字體改用 **Noto Sans TC**（`style.css` 字體堆疊 + `tailwind.config.js`），中文不再掉回各 OS 預設字。
- 設計系統：雙層卡片陰影（`shadow-card`/`card-hover`，新增 `shadow-glow`）、背景柔光暈、六色圖示色票 `.tint-*`（深色安全，用 `color/10` 透明度）。
- 側欄：毛玻璃底、active 改漸層膠囊＋左側漸層光條＋圖示上色、漸層頭像（`AppSidebar.vue`/`AppHeader.vue`）。
- 總覽 Hero：點陣紋理＋雙光暈＋ `rounded-3xl`；統計卡／快速操作多色化（`OverviewView.vue`）。
- 共用元件：`PageHeader` 加可選漸層圖示徽章；`ProgressCard` 漸層進度條；`StatCard`/`QuickActionButton` 加 `tint`。
- 各模組入口頁接上識別圖示頁首（生活/健康/知識/社交/旅遊/英文/作品/資料分析/股票/設定）。
- 四個 SubNav（旅遊/英文/知識/娛樂）改漸層膠囊；分段標籤 active 接品牌色。
- ChatWidget：launcher 漸層＋光暈、自己訊息氣泡（文字/語音）與送出鈕漸層。
- 圖表座標軸隨深淺色切換（`TrendChartCard`/`DataLabView`/`CandleChart`，由 `useTheme` 驅動）。
- `.btn-primary` 加細微漸層、`.input` hover/focus 加強。
- 修：`BaseModal` 原用寫死 `slate-*` 色（深色模式會壞）→ 改 `ink` token、補 Esc/焦點還原/`aria-modal`。

### ✨ 新功能
- **頭像上傳**（`SettingsView` + `utils/storage.ts` `uploadAvatar`）：壓縮至 512px 上傳 Firebase Storage `avatars/{uid}/`，即時更新側欄/頂欄/聊天。
  - ⚠️ 需在 Firebase Console → Storage → Rules 加：
    ```
    match /avatars/{uid}/{p=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    ```
- **命令面板 ⌘K**（`CommandPalette.vue` + `useCommandPalette`）：頂欄搜尋或 ⌘K/Ctrl+K 開啟，搜尋跳轉模組＋工具，含動作指令（切換主題/開訊息/登出），支援 ↑↓/Enter/Esc，焦點還原。
- **通知中心**（`NotificationBell.vue`，取代原裝飾性鈴鐺）：好友邀請可直接接受/拒絕、未讀對話一鍵進入；badge＝邀請數＋聊天未讀。

### ⚡ 優化
- 首屏體積：`vite.config.ts` 加 `manualChunks` 拆 firebase/vue/charts/leaflet，入口 chunk **651KB → 278KB**（gzip 198→94KB）。
- FCM 延後載入：`usePush` 改動態 import `firebase/messaging`，拆成獨立 ~26KB chunk，只在開推播時下載。
- 部署防呆：`main.ts` 監聽 `vite:preloadError`，抓不到改名 chunk 時自動 reload（10s 冷卻防迴圈）。
- 骨架屏：`StatCard` 加 `loading`；總覽統計卡、`FriendProfileView` 載入時顯示占位。
- 無障礙：頂欄圖示按鈕補 `aria-label`；命令面板/`BaseModal` 焦點還原 + Esc。
