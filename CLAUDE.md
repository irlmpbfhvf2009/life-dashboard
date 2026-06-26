# Personal Intelligence Studio — 專案交接（CLAUDE.md）

> 給新 session 的 Claude 與作者本人。讀完這份就能接手。本檔在 repo 根目錄，
> Claude Code 會自動載入為背景知識。**繁體中文 UI、台股紅漲綠跌。**

## 一句話定位
**Personal Intelligence Studio（個人智慧工作台）**——模組化、商業質感的個人 OS / SaaS，
整合生活管理、健康減脂、財務分析、AI 實驗室（含 AI 股票研究）、知識庫、作品展示。
由原本的「life-dashboard 生活儀表板」升級而來（repo 目錄名仍叫 `life-dashboard`）。

## 線上 / 資源
- 網站（正式）：https://life-dashboard-blue-omega.vercel.app
- 後端 API：https://life-dashboard-backend-463356502015.asia-southeast1.run.app
- GitHub：https://github.com/irlmpbfhvf2009/life-dashboard （公開）
- 全部在同一個 GCP/Firebase 專案 `life-dashboard-17faa`（專案編號 463356502015，owner ws794613@gmail.com）

## 技術棧
- 前端：Vue 3 + Vite + TypeScript + Pinia + Vue Router + Tailwind + lucide-vue-next + Chart.js + Firebase Web SDK
- 後端：Java 21 + Spring Boot 3 + Spring Security + Spring Data JPA + Firebase Admin SDK
- DB：Neon PostgreSQL（Singapore, ap-southeast-1，免費方案，pooled host、jdbc、sslmode=require）
- 部署：前端 Vercel（**prebuilt** 手動部署）、後端 Cloud Run（min=0/max=1/512Mi）、Auth=Firebase（Google + Email/密碼）
- 成本守門：Cloud Function `billing-guard` 在花費超過預算（NT$1）時自動關閉專案計費（見 `infra/billing-guard/`）

## 認證
Google 與 Email/密碼**都走 Firebase**；前端拿 Firebase ID Token，後端用 Admin SDK 驗證、依 firebase uid 在 `users` 表建立/查詢使用者；每筆查詢都以 `user_id` 限定。Email/密碼供應商已在 Firebase 啟用。

## 專案結構
```
frontend/   Vue 3 SPA
  src/config/navigation.ts   側邊欄 9 大類 navGroups + studioApps 清單（後者僅供 /ai 落地頁；lucide 圖示）
  src/components/layout/      AppShell / AppSidebar / AppHeader / AuthLayout
  src/components/ui/          設計系統元件（StatCard/AppCard/ProgressCard/SectionCard/狀態元件…）
  src/components/stock/       AiPickCard / RadarStockCard / StockAnalysisCard / StockTrackTable / CandleChart(自製SVG K線)
  src/views/                  OverviewView(總覽) / LifeView(含財務分頁) / ModuleLandingView / StockResearchView / knowledge/* / fun/* / SettingsView / auth/*
  src/composables/useTheme.ts 深色/淺色（CSS 變數 ink 整組反轉；class 策略；index.html 有 no-flash 腳本）
  src/api/                    http.ts(Axios+Firebase token 攔截器) / index.ts / stockResearch.ts
  src/data/mock.ts            Dashboard 等用的 mock（結構對齊未來 DTO）
backend/    Spring Boot（package-by-feature：user/todo/weight/food/expense/mood/note/dashboard/usage/security/config/common）
stock-radar/  整合進來的台股 AI 分析管線（Python scripts + public/*.json 資料）
.github/workflows/stock_scan.yml  每日掃描（working-directory: stock-radar）
.claude/commands/             /analyze-stocks、/review-failures（路徑已指向 stock-radar/public）
infra/billing-guard/          費用自動關閉的 Cloud Function
```

## 側邊欄導航結構（IA，2026-06 整併後）
側邊欄只放 **9 個大類**（`src/config/navigation.ts` 的 `navGroups`），大模組用「自有二級導航」收納、不污染側邊欄：
1. **總覽 `/`**　2. **生活管理 `/life`**（待辦／心情日記／財務分析 三分頁）　3. **健康減脂 `/health`**　4. **AI 實驗室 `/ai`**（其下 `/ai/stock`、`/ai/english`、`/ai/data-lab`）　5. **旅遊 `/travel`**（`TravelSubNav`）　6. **社交 `/social`**　7. **知識 `/knowledge`**（筆記＋書庫，`KnowledgeSubNav`）　8. **娛樂 `/fun`**（命運＋食物輪盤，`FunSubNav`；玩家另顯示「遊戲」→ `/play`）　9. **作品展示 `/portfolio`**。＋角色限定：管理後台 `/admin`（admin）。
- **整併前→後對照**：`/finance`→`/life?tab=finance`、`/library*`→`/knowledge/*`、`/fate`+`/roulette`→`/fun/*`；舊路由全部保留為**轉址**，深連與既有連結不斷。
- 子導航元件命名慣例：`<模組>SubNav.vue` + `<模組>Layout.vue`（Layout＝`<SubNav/> + <RouterView/>`）。新增頁＝加一條 route + 一個 SubNav item。

## 進度（phased）
- **Phase 1 已完成並上線**：設計系統、雙登入、AppShell/Sidebar/Header、總覽 Dashboard、App Center、AI 股票研究（完整）、設定、深色模式。
- **舊功能頁已刪除**（Todos/Weights/Foods/Expenses/Moods/Notes 的舊 CRUD 頁）。
- **AI 股票研究已完整**：今日 AI 精選（合併行情+K線+AI八面向）、雷達選股、AI 預判追蹤、過往分析；資料即時讀 GitHub raw。
- **Phase 2 進行中**：已完成並上線 5 個模組——
  - **健康減脂 `/health`**（OtterLife 風，完整）。
  - **生活管理 `/life`**（個人生活中樞，三個分頁；`LifeView` in-page tabs）：待辦（todoApi）+ 心情日記（moodApi）+ **財務分析**（深連 `/life?tab=finance`）。財務內容抽成 `components/finance/FinancePanel.vue`（收入/支出/結餘、支出分類甜甜圈、近 6 月趨勢、收支列表；後端 `Expense` 有 `type` INCOME/EXPENSE，接 `expenseApi` 存 Neon）。**舊 `/finance` 路由保留並轉址到 `/life?tab=finance`**（原 `FinanceView.vue` 已刪）。
  - **知識 `/knowledge`**（筆記＋書庫合併，自有子導航 `KnowledgeSubNav`／`KnowledgeLayout`）：`/knowledge`＝筆記（master-detail，搜尋/新增/編輯/Ctrl⌘+S/刪除，接 `noteApi`，`KnowledgeView`）、`/knowledge/books`＝書庫、閱讀器 `/knowledge/read/:source/:id`（route name 仍叫 `library`／`library-read`，故 `router.push({name})` 不斷；書庫後端見下方原「書庫」bullet）。**舊 `/library*` 全部轉址到 `/knowledge/*`**。
  - **娛樂 `/fun`**（命運＋食物輪盤，自有子導航 `FunSubNav`／`FunLayout`）：`/fun/fate`＝命運（YES/NO 擲骰，`FateView.vue`）、`/fun/roulette`＝食物輪盤（「今天吃什麼」SVG 轉盤，`FoodRouletteView.vue`，清單存 localStorage）；玩家身分另在子導航顯示「遊戲」連到既有 `/play` 獨立入口（自有登入的全頁 casino）。**舊 `/fate`、`/roulette` 轉址到 `/fun/*`**。
  - **作品展示 `/portfolio`**：靜態卡片展示（資料在 `src/data/portfolio.ts`），無後端。
  - **旅遊助手 `/travel`**（**多國**：泰/日/韓/越，目的地驅動；含自有子導航 `TravelSubNav`，側邊欄大類「旅遊」）：
    - **目的地資料集中在 `src/data/destinations.ts`**：**每國一個 `CountryProfile`**（countryId/country/flag、`ttsLang`、`translateLangName`、`currency{code,symbol,defaultRate}`、5 大情境短句 `categories`、`cheatSheet`）＋一份 **`regions[]`**（熱門地區/縣市，各帶 `slug/city/lat/lon/timezone`）。`expand()` 把每國攤平成「每地區一筆 `Destination`」（共用該國語句包/幣別/小抄，只覆寫 city/座標/時區）；**主地區 `slug:''` 的 id＝countryId**（如 `thailand`），其餘加後綴（`thailand-chiangmai`）→ 舊的同步資料（wallet/itinerary/journal 皆 keyed by destinationId）不會斷。泰=7、日=7、韓=5、越=6、**台灣=全 22 縣市**。**加一地區＝regions 加一行；加一國＝加一個 profile**。`destinationGroups`（按國分組）給 **兩層 `DestinationPicker`**（先選國、再選地區；寫進同步狀態，全頁面連動、跨裝置）。**`DestinationPicker` 只放在模組殼層 `TravelLayout.vue` 頂端一次**（選一次目的地→下方子導航＋各子頁全部跟著變），各子頁不再各自嵌 picker；少數頁保留與功能相關的小標註（記帳/換算頁顯示幣別）。
    - **旅遊用語包 `/travel/phrasebook`**（`PhrasebookPage.vue`）：選國家→該國情境短句（中/當地文字/拼音）＋一鍵發音＋ AI 即時翻譯（中→當地語言，`destination.translateLangName`）。
    - **發音＝雲端 TTS**：後端 `com.lifedashboard.tts.TtsController`（`GET /api/tts?text=&lang=`，`lang`=th/ja/ko/vi…）server-side 代理 Google 翻譯免費 TTS（免金鑰、回 mp3、避 CORS），前端 `ttsApi.objectUrl` 播放 blob（`PhraseAudioButton`，吃 `lang` prop）。**抓不到後端時自動降級**回瀏覽器原生 `useSpeechSynthesis(lang)`（裝置沒裝該語言語音會沒聲音，所以才改雲端）。要有聲音 → 後端要跑/部署得到。
    - **旅遊記帳 `/travel/expense`**：**每國各自幣別＋可調匯率**（記帳明細存當地貨幣＋幣別碼，依國家分開統計、換算台幣）；**跨裝置綁帳號**——`useTravelWallet` 照 `useEnglishStore` 模式（localStorage 即時快取 + 背景同步後端 `travel_state`、雲端優先、失敗靜默降級）。同步文件含 `items[]`(含 currency)、`rates{}`(per 幣別)、`departDate`、`destinationId`；`normalize()` 會把舊的 THB-only 格式（`amountThb`/`thbToTwd`）自動升級。後端 `com.lifedashboard.travel`：`travel_state` 表（per-user JSON）+ `GET/PUT /api/travel/state`。刻意與正式財務（expenses 表）分開。
    - **行程表 `/travel/itinerary`** + **打包清單 `/travel/packing`**：都存進 `travel_state` 同步文件（`itinerary{}`/`packing{}` 皆 per-destinationId）；行程地點附 Google Maps 連結，打包有常用模板。composable `useItinerary`/`useTravelPacking` 與 wallet 共用同一份 `state`（`useTravelState()` 為共用載入/同步 plumbing）。
    - **換算/小費 `/travel/tools`**：當地貨幣⇄台幣雙向換算、小費/分帳（共用 wallet 的當地幣別與匯率）。
    - **自動匯率**：後端 `com.lifedashboard.fx.FxController`（`GET /api/fx/rate?from=&to=TWD`）代理免費 open.er-api.com、快取 6h，前端 `fxApi`＋`wallet.refreshRate()`（記帳/換算頁有「更新」鈕，匯率仍為預設時自動抓一次）。
    - **收據拍照記帳**：`GeminiClient.generateJsonWithImage`（vision）+ `ReceiptService` + `POST /api/ai/receipt`（body 含 base64 image）；前端 `utils/image.ts` 壓縮後上傳，回填記帳表單。
    - **天氣 + 當地時間**：`useWeather`（Open-Meteo 免金鑰、CORS、快取 30 分）+ `useLocalTime`（IANA 時區 vs 台灣，Intl 計算）；`DestinationWeather.vue` 顯示在旅遊首頁，行程表每日卡片對齊出發日顯示當天天氣。目的地座標/時區在 `destinations.ts`（`lat/lon/timezone`）。
    - **AI 景點建議**：`SpotSuggestService` + `POST /api/ai/spots`（body `{place,days}`，回每個景點含建議天數、依距離分天）；行程表「AI 景點建議」卡片，點一下加進行程。
    - **美食推薦 `/travel/food`**（`FoodPage.vue`，完成）：`FoodSuggestService` + `POST /api/ai/food`（body `{place}`，回 6–8 道在地必吃，每道含 `name`/`nativeName`(當地語言)/`category`/`where`/`reason`）；前端依目的地產生推薦，每道菜的 `nativeName` 可用 `PhraseAudioButton`（`lang=destination.ttsLang`）念給店家聽，`where` 連 Google Maps。切目的地自動清空舊推薦。i18n `tv.food`/`tv.nav.food` 已補 6 語。
    - **預算追蹤**：`useTravelWallet` 的 `budget`（per destinationId、台幣，存同步文件 `budgets{}`）+ `remainingTwd/budgetPct/overBudget`；記帳頁有預算進度條（已花/剩餘/超支轉紅）。
    - **行程總覽 Dashboard**：`TripSummary.vue`（首頁）整合預算/打包進度/今日行程（依 `departDate` 算「今天第幾天」），每塊可點進對應頁。
    - **行程地圖 `/travel/map`**：`MapPage.vue` 用 **Leaflet + OSM**（免金鑰，套件 `leaflet`）把行程景點以「分天數字」標記、自動框景、popup。地理編碼走後端 `com.lifedashboard.geo.GeoController`（`GET /api/geo?q=`）代理 **Nominatim**（合規 User-Agent + 快取）；前端**抽英文名查詢**（`大皇宮 (Grand Palace)`→`Grand Palace, Bangkok`）、**節流 1 req/s**，座標寫回 `ItineraryItem.lat/lon`（同步）。地圖下方有景點清單顯示「在地圖上/找不到位置」。
    - **PWA 自動更新**：`main.ts` 監聽 `controllerchange` + 定期 `reg.update()`，部署新版自動 reload（`registerType:autoUpdate`），不用手動硬重整。
    - 後端 AI：`com.lifedashboard.ai`：`PhraseCoachService`（`/api/ai/phrase/translate`）、`ReceiptService`（`/api/ai/receipt` vision）、`SpotSuggestService`（`/api/ai/spots`）；比照 EnglishCoach，共用 `GeminiClient` 與 `GEMINI_API_KEY`，無金鑰回 503。**模型用 `gemini-2.5-flash`**（2.0-flash 此 key free tier=0、回 429，見踩過的坑 7）。
    - **i18n 已完成**：UI 字串抽到 `tv` namespace（`src/i18n/locales/travel/*.ts`，6 語）；內容（短句/小抄/國名）刻意保留中文＋當地語言。新增字串記得 6 語都補。
    - **離線緊急卡 `/travel/emergency`**（`EmergencyCardPage.vue`，完成）：大字卡＝當地報案電話（取自 cheatSheet 的 Phone 項）＋使用者填的飯店名/地址/訂房代號/保險/大使館/血型/備註（存 `travel_state` 新欄位 `trip{}` per destinationId，composable `useTripInfo`）＋求助句（取 phrasebook `emergency` 分類）。飯店地址與求助句可用 `PhraseAudioButton` 念當地語言給司機/警察；保險/大使館電話有 `tel:` 撥號鈕。localStorage→離線可讀。
    - **行程分享 `/travel/share`**（`TravelSharePage.vue` + 公開唯讀頁 `PublicTripView.vue`，完成）：後端 `shared_trip` 表（token/userId/snapshot JSON/createdAt，`ddl-auto:update` 自動建表）+ `POST /api/travel/share`（回 token）/`GET /api/travel/shares`/`DELETE /api/travel/share/{token}`，**公開** `GET /api/public/trip/{token}`（`SecurityConfig` 已加 `/api/public/**` permitAll）。前端公開頁 `/t/:token`（`meta.open`：guard 早退、免登入也不被導去 overview、無 AppShell），渲染行程表＋共用地圖 `TripMap.vue`，有「列印 / 存 PDF」(`window.print()`＋`@media print`)。snapshot 只含 destination/departDate/itinerary(含 lat/lon)。
    - **旅遊日記 `/travel/journal`**（`JournalPage.vue`，完成）：每日照片＋心得時間軸。照片真存 **Firebase Storage**（`firebase.ts` 加 `storage`＋`storageBucket` 預設 `${projectId}.appspot.com`；`utils/storage.ts` `uploadJournalPhoto`→`fileToCompressedBlob` 壓縮→傳 `journal/{uid}/{destId}/...`→回 download URL）。entry `{id,date,text,photoUrls[]}` 存 `travel_state` 的 `journal{}` per destinationId（composable `useTravelJournal`，只存文字＋URL）。
    - **共用元件 `TripMap.vue`**：把 Leaflet marker 渲染抽成 presentational（props `stops`/`center`），公開分享頁用它（MapPage 仍自帶 geocoding）。
    - **這三個功能的使用者待辦**：① 後端重新部署（`gcloud run deploy --source backend`，自動建 `shared_trip` 表）；② Firebase Console 啟用 **Storage** 並設規則允許登入者讀寫自己的 `journal/{uid}/**`（例：`match /journal/{uid}/{p=**} { allow read, write: if request.auth.uid == uid; }`），否則日記上傳失敗（頁面已優雅顯示錯誤）；③ 前端重新部署（`deploy-frontend.ps1`）。Storage 有免費層，留意 billing-guard（NT$1）。
  - **書庫（公版書站內閱讀，完成）**：已併入「知識」大類，路徑 `/knowledge/books`（route name 仍 `library`）。後端 `com.lifedashboard.library.BookController`（`/api/books`）代理兩個免金鑰來源——Gutendex(Project Gutenberg 英文經典) 與 zh.wikisource.org(中文古籍)；端點 `search`/`text`(全文)/`zh/search`/`zh/page`。全文抓取限定 `gutenberg.org` 網域(防 SSRF)、自動去除 Gutenberg 版權前後文。前端 `views/library/`：`LibraryHomePage`(英/中分頁、搜尋、熱門) + `ReaderPage`(站內閱讀器：字級、襯線切換、來源連結)；Gutenberg 純文字分段渲染，維基文庫 HTML 經 **DOMPurify** 清毒後 v-html。**Gutendex 一定要帶結尾斜線**(見踩過的坑 8)。
  - **總覽 `/`（OverviewView）已改用真實資料**：讀後端 `/api/dashboard`(今日待辦、本月支出、近7天體重、最近心情/筆記/飲食)，移除所有 mock；沒資料顯示空狀態。**「工具中心」`/apps` 已移除**(側邊欄+路由+AppCenterView；`studioApps` 清單保留給 `/ai` 落地頁)。`src/data/mock.ts` 已刪。
  - **社交 `/social`**（好友 + 隱私可控的互相查看，完成）：側邊欄大類「社交」。後端 `com.lifedashboard.social`：`Friendship` 表（requesterId/addresseeId/status PENDING|ACCEPTED，pair 唯一，decline＝刪列）+ `SocialPrivacy` 表（per-user 布林：shareHealth/shareMood/shareLife，預設全 false＝隱藏；無列也視為全隱藏）。端點 `/api/social`：`search?q=`(名稱/Email，≥2字，附對我的 relation)、`friends`、`requests/incoming`、`requests/outgoing`、`POST requests {targetUserId}`(已收到對方邀請會自動接受)、`requests/{id}/accept`、`requests/{id}/decline`(拒絕或取消都刪列)、`DELETE friends/{userId}`、`GET/PUT privacy`、`GET profile/{userId}`。**Profile 必須是好友才回**(否則 403)；基本檔案（名稱/頭像/Email/加入時間）對好友一律可見，健康/心情/生活三區塊**只在 owner 開啟時**才回（健康＝近30天體重趨勢+最新體重+近期飲食、心情＝近30天紀錄+平均、生活＝待辦計數），資料查詢全部 scope 到 targetUserId、重用既有 Weight/Food/Mood/Todo repo。前端 `views/social/`：`SocialHubView`(分頁：好友/探索/邀請(紅點badge)/隱私設定，搜尋 350ms debounce) + `FriendProfileView`(`/social/u/:userId`，依 visibility 顯示區塊，重用 StatCard/TrendChartCard/SectionCard)。`relation` 列舉＝NONE/REQUEST_SENT/REQUEST_RECEIVED/FRIEND。**使用者待辦：後端重新部署**(`gcloud run deploy --source backend`，`ddl-auto:update` 自動建 `friendships`/`social_privacy` 表) + 前端重新部署。核心頁刻意用 zh-TW 字面字串（非 i18n）。
  - **聊天 `ChatWidget`（右下角浮動聊天室，完成）**：常駐在 `AppShell`（登入後每頁都在），點右下角泡泡展開。後端 `com.lifedashboard.chat`：`Conversation`(type DM|GROUP|PUBLIC、name、lastMessageAt 供排序) + `ConversationMember`(conversationId/userId/lastReadAt，pair 唯一) + `ChatMessage`(conversationId/senderId/content)。端點 `/api/chat`：`conversations`(我的對話清單，附最後訊息/未讀數/成員數，DM 解析對方名稱頭像)、`unread`(總未讀，給泡泡 badge)、`POST conversations/dm {userId}`(find-or-create)、`POST conversations/group {name,memberIds}`、`POST conversations/{id}/members`、`POST conversations/{id}/leave`、`GET conversations/{id}/messages?beforeId=&afterId=`(beforeId 往前翻頁、afterId 增量輪詢)、`POST conversations/{id}/messages`、`POST conversations/{id}/read`。**存取要 membership**(否則 403)；**PUBLIC 公開聊天室是單例**(type=PUBLIC，`ensurePublicMembership` lazy 建室+自動入會，Cloud Run max=1 故 `synchronized` 安全)。未讀＝訊息 createdAt > 我的 lastReadAt(null 時用 joinedAt) 且非自己發。前端 `composables/useChat.ts`(**module-scope 單例**，狀態跨路由保留) + `components/chat/ChatWidget.vue`(清單/對話/新對話三態，新對話可挑好友私訊或多選建群組，好友來自 `socialApi.friends()`)。**即時＝輪詢**(無 WebSocket，配合 Cloud Run min=0/billing-guard)：收合每 15s 抓未讀、清單每 6s、對話開著每 3s 抓新訊息(afterId)。
    - **已讀回條（TG 式雙勾，完成）**：後端 `GET conversations/{id}/read-state` 回 `{readAt}`＝**其他成員 `lastReadAt` 的最大值**(TG 式：**任一人看過就算已讀**；都沒讀＝null)。前端 `useChat` 每 3s 連同新訊息一起刷新 `peerReadAt`，`ChatWidget` 在**自己發的**訊息時間旁顯示單勾 `Check`(已送出) / 雙勾 `CheckCheck`(已讀，靛色)。只在 DM/GROUP 顯示，PUBLIC 不顯示(人多無意義)。**群組「誰已讀」名單**：`GET conversations/{id}/readers?messageId=` 回該訊息已讀成員(name/photo/readAt，排除自己)；點自己發的群組訊息(時間列變 button)彈出「已讀成員」底部 sheet。
    - **群組加人（完成）**：群組對話 header 的 `UserPlus` 鈕開「邀請好友」overlay(複用好友勾選清單)→ `chatApi.addMembers` → 後端 `addGroupMembers`(已存在)。建群仍走「新訊息→群組」流程。
    - **收回／清除／刪除（完成）**：`ConversationMember` 加 `clearedAt`(per-user 清除水位)＋`hidden`(Boolean，刪除聊天時隱藏，null 視為 false；`ddl-auto:update` 自動加欄)。端點：`DELETE conversations/{id}/messages/{messageId}`＝**收回**(僅本人，硬刪、對所有人消失)；`DELETE conversations/{id}/messages`＝**清除歷史**(只設本人 `clearedAt=now`，他人不受影響)；`DELETE conversations/{id}`＝**刪除聊天**(DM＝隱藏，有新訊息自動重現；GROUP＝退出；PUBLIC 擋)。`getMessages`/清單預覽/未讀都以 `clearedAt` 過濾(`visible()`)。前端：**長按／右鍵**自己訊息 → 底部 sheet「收回訊息／查看已讀」；header `MoreVertical` 選單「清除歷史紀錄／刪除聊天(群組顯示退出)」。
    - **訊息氣泡版面（TG 式，完成）**：時間移到**訊息內右下**——文字氣泡用 `float-right` 把時間+勾勾浮到最後一行右下(`block w-fit`)；圖片/GIF 時間**疊在右下角**(黑底膠囊)；語音時間在播放器下方右對齊。
    - **完整訊息選單（TG 式，完成）**：長按/右鍵任一訊息開底部 sheet——**回覆/編輯/置頂/複製文字/轉發/選取/查看已讀/收回**(編輯、收回、查看已讀僅本人)。後端 `ChatMessage` 加 `replyToId`/`editedAt`/`forwardedFrom`，`Conversation` 加 `pinnedMessageId`(皆 `ddl-auto:update` 自動加欄)。端點：`PATCH conversations/{id}/messages/{messageId}`(編輯，僅本人 TEXT，記 `editedAt`)、`POST conversations/{id}/pin {messageId}`(messageId=null 取消置頂)；**回覆**＝`POST messages` body 帶 `replyToId`(MessageDto 回 `replyToSender`/`replyToPreview`)；**轉發**＝對目標對話 `POST messages` 帶 `forwardedFrom`(原作者名)；**複製**＝前端 clipboard；**選取**＝多選模式批次收回。`MessageDto`/`ConversationDto` 各加回覆預覽/`pinnedMessage`。前端：置頂橫幅(點擊捲到該訊息)、回覆/編輯 banner(在輸入框上方)、轉發目標挑選頁、選取模式底部刪除列、氣泡內「轉發自/已編輯/引用」標示。
    - **聊天 i18n（完成）**：整個 ChatWidget 字串抽到 **`chat` namespace**(`src/i18n/locales/chat/*.ts`，6 語)，跟著網站語言切換；訊息預覽的媒體佔位字(`[圖片]`等)仍由後端 `preview()` 產生(zh)。新增字串記得 6 語都補。
    - **多媒體訊息（emoji/GIF/照片/語音，完成）**：`ChatMessage` 加 `kind`(TEXT|IMAGE|GIF|AUDIO，enum 存 STRING)＋`attachmentUrl`(text，nullable)；`ddl-auto:update` 自動加欄，舊列 kind=null 視為 TEXT。`POST messages` body 改 `{content,kind,attachmentUrl}`。對話清單/推播預覽：非文字顯示 `[圖片]`/`[GIF]`/`[語音訊息]`。
      - **Emoji**：自製 `EmojiPicker.vue`(無套件、分類 grid)，插入草稿文字。
      - **GIF**：GIPHY 代理 `com.lifedashboard.gif.GifController`(`/api/gif/search?q=&pos=`、`/api/gif/featured`(=GIPHY trending)，回 trimmed `{url,preview,dims}`，上游錯誤都收斂成 503)；`app.giphy.api-key=${GIPHY_API_KEY:}` 空＝503。前端 `GifPicker.vue`(trending + debounce 搜尋、標註 Powered by GIPHY)，選 GIF 送 `kind=GIF`(只存遠端 URL，不佔 Storage)。**註：原想用 Tenor，但 Tenor API 在此 GCP 專案無法啟用(serviceusage 回 110002 PERMISSION_DENIED、Console 程式庫頁也載不出)，故改 GIPHY。**
      - **照片/語音**：重用 **Firebase Storage**(`utils/storage.ts` 加 `uploadChatImage`(壓縮 jpg)、`uploadChatAudio`，路徑 `chat/{uid}/img|audio/...`)。錄音用 `composables/useRecorder.ts`(MediaRecorder，webm/opus，Safari 退 mp4，含計時)。訊息泡泡依 kind 渲染圖片/`<audio>` 播放器。
    - **訊息音效 + 推播（完成）**：`composables/useNotify.ts`(Web Audio 合成「叮」聲，無音檔、可靜音、`localStorage` `chat-sound`)——`useChat` 在輪詢/開著對話偵測到他人新訊息時 `playPing()`。**背景推播＝FCM Web Push**：`composables/usePush.ts`(`getToken`＋VAPID，token 註冊到後端) + `public/firebase-messaging-sw.js`(compat SDK，config 由註冊 URL query 帶入，`onBackgroundMessage` 顯示通知、`notificationclick` 聚焦分頁)；後端 `com.lifedashboard.push`：`PushToken` 表 + `POST/DELETE /api/push/token`，`PushService` 在 `sendMessage` 後用 Admin SDK `FirebaseMessaging.sendEachForMulticastAsync` 推給其他成員(fire-and-forget、自動清除失效 token)。`FirebaseConfig` 加 `FirebaseMessaging` bean。ChatWidget header 有音效🔊與推播🔔兩個切換(推播須使用者手勢開啟＝要權限)。
    - **使用者待辦（多媒體＋推播）**：① **後端重新部署**(`gcloud run deploy --source backend`，`ddl-auto:update` 自動建 `push_tokens`、加 `chat_messages.kind/attachment_url`)；② **設 `GIPHY_API_KEY`**(developers.giphy.com 申請 → 存 Secret Manager `giphy-api-key` → `gcloud run services update ... --update-secrets GIPHY_API_KEY=giphy-api-key:latest`)否則 GIF 顯示「未啟用」；③ **FCM 設定**：Firebase Console→專案設定→Cloud Messaging→Web Push certificates 產生金鑰；前端 `.env.production.local` 補 `VITE_FIREBASE_MESSAGING_SENDER_ID`(=專案編號 463356502015)、`VITE_FIREBASE_VAPID_KEY`、(選)`VITE_FIREBASE_STORAGE_BUCKET`(後端 FCM 送出走既有 `FIREBASE_SERVICE_ACCOUNT_JSON`，免額外金鑰)；④ **Firebase Storage 規則**允許登入者寫自己的 `chat/{uid}/**`、登入者可讀(下載 URL 帶 token，跨使用者讀沒問題)；⑤ **前端重新部署**(`deploy-frontend.ps1`)。Service Worker/通知需 HTTPS(prod 已是)。
  - i18n：旅遊/英文家教/健康/財務/知識/生活 模組 6 語系皆已翻譯；總覽、書庫等核心頁刻意用 zh-TW 字面字串（非 i18n）。
  - 仍佔位（ModuleLandingView）：**AI 實驗室 `/ai`** 落地頁（其下 `/ai/stock` 已完整；英文家教、資料分析待做）。
- **Phase 3 未做**：習慣/目標/斷食/日記長文 等需要新資料表的功能（habits/habit_records/goals/journals/fasting_records/portfolio_projects…）對應的 Entity/Repository/Service/Controller；users 加 provider 欄。

## 旅遊：三個進階功能（已完成上線）
緊急卡 / 行程分享 / 旅遊日記三個皆已實作完成，細節見上方 `/travel` 模組各 bullet。
**加分未做（可選）**：日記接「行程分享」一起公開、緊急卡列印版、分享 snapshot 帶天氣。

## AI 股票管線（重要）
- 每日免費層（GitHub Actions `stock_scan.yml`）：掃描/評分/籌碼/命中率 → 寫 `stock-radar/public/*.json` → commit。
- AI 八面向分析（**手動**，吃 Claude 訂閱、不進 CI）：在本 repo 跑 `/analyze-stocks`（指令在 `.claude/commands/`，已指向 `stock-radar/public/`）。產出 `analysis.json` + 併入 `analysis_archive.json`、git push。
- 前端**執行階段直接讀 GitHub raw**（`https://raw.githubusercontent.com/irlmpbfhvf2009/life-dashboard/main/stock-radar/public/*.json`），**push 後約 1 分鐘自動顯示，不用重新部署前端**。
- 舊的獨立 stock-radar repo / Vercel 已（或即將）刪除；本機 `Desktop/Claude/money` 是原始備份。

## 本機工具（都不在 PATH，要用完整路徑）
- Maven：`C:\Users\ws794\tools\apache-maven-3.9.9\bin\mvn.cmd`（編譯後端時 `JAVA_HOME` 指向下面的 JDK21）
- JDK 21：`C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
- Node：`C:\Program Files\nodejs`（npm 子程序找不到 node 時，把它前置到 PATH）
- gcloud：`C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`
- vercel：`C:\Users\ws794\AppData\Roaming\npm\vercel.cmd`

## 部署
- 前端（**只能用 prebuilt，勿用雲端 build**）：`frontend/deploy-frontend.ps1`，流程＝`npm run build`（值來自 gitignored 的 `frontend/.env.production.local`）→ 組 `.vercel/output` → `vercel deploy --prebuilt --prod`。
- 後端：`gcloud run deploy life-dashboard-backend --source backend --region asia-southeast1`（Cloud Build，免本機 Docker）。後端 env/secret 用 `gcloud run services update`；Firebase 金鑰存在 Secret Manager `firebase-sa`。

## 踩過的坑（別重蹈）
1. **Vercel `vercel env add` 在 Windows PowerShell 管線會在值開頭塞 BOM**，弄壞 Firebase API key（auth/network-request-failed）。→ 改用「本機 build 烤入值 + `--prebuilt` 部署」，雲端 env vars 不可靠、別依賴。
2. **PowerShell 沙箱誤判**：指令裡同時有 `rm`/`Remove-Item` 與字串 `C:\Program...` 會被擋（"Remove-Item on system path"）。→ 用 `[System.IO.Directory]::Delete()` 取代 Remove-Item，或別讓 `C:\Program` 字面值與 rm 同段；必要時 `dangerouslyDisableSandbox`。
3. **git commit -m 用 PowerShell here-string 時，訊息內含半形雙引號 `"` 會把參數截斷** → commit message 別用 `"`。
4. **GitHub raw 有 404 負快取**（曾請求過不存在的路徑）；App 抓取一律帶 `?t=時間戳` 繞過（已內建於 stockResearch.ts）。
5. **vercel CLI 在這環境的互動/管線常卡住**（env add 空值、project rm 卡住）；能避則避，改網頁操作。
6. **台股顏色**：漲=紅、跌=綠（`utils/format.ts` 的 `twPriceClass`），與一般西方相反；關鍵字highlight刻意用靛/琥珀，不用紅綠以免衝突。
7. **Gemini 模型 free tier=0**：現用金鑰對 `gemini-2.0-flash` 免費額度是 0（呼叫回 429 `limit: 0`，所有 in-app AI 都會降級成「尚未啟用」）。改用 **`gemini-2.5-flash`** 即正常。已在線上 `GEMINI_MODEL=gemini-2.5-flash`（`gcloud run services update`）並改 `application.yml`/`GeminiClient` 預設。換 key 或模型壞掉時先用 `models/{model}:generateContent` 直接打 API 看 429/200。
8. **Gutendex(Project Gutenberg) 一定要帶結尾斜線**：`/books` 與 `/books/{id}` 都會 **301 轉址**到帶斜線版本，而 Spring `RestClient` 預設**不跟隨轉址**→回傳空 body、JSON 解析失敗。改用 `/books/`、`/books/{id}/` 才直接拿 200。書庫的全文抓取也只允許 `*.gutenberg.org` 網域（防 SSRF）。

## 待辦 / 使用者要做的
- 確認 **life-dashboard** repo 的 GitHub Actions 寫入權限已開（Settings → Actions → General → Read and write），每日股票掃描才會自動 commit。
- （選用）在 life-dashboard repo 設 `FINMIND_TOKEN` secret（基本面資料用，沒設會略過）。
- **AI 英文家教要能對話，需注入 `GEMINI_API_KEY`**（見下方「in-app AI」）。沒注入時前端會顯示「尚未啟用」提示、不會壞。

## in-app AI（Gemini）
- 後端 `com.lifedashboard.ai`：`GeminiClient`（呼叫 Gemini `generateContent`，JSON schema 結構化輸出，**可重用**）+ `EnglishCoachService`（`chat()` 回 reply/correction；`correct()` 回結構化 `CorrectionReply`）+ `AiController`（`GET /api/ai/status`、`POST /api/ai/english/chat`、`POST /api/ai/english/correct`）。
- 設定在 `application.yml` 的 `app.gemini`：`api-key=${GEMINI_API_KEY:}`、`model=${GEMINI_MODEL:gemini-2.5-flash}`（**注意：2.0-flash 此 key free tier=0、回 429**，見踩過的坑 7）、`base-url`。**金鑰留空時自動降級**：回 503、`/status` 回 `enabled:false`，前端顯示提示。
- 旅遊模組的 AI 端點也都掛在 `AiController`：`POST /api/ai/phrase/translate`（翻譯）、`/api/ai/receipt`（收據 vision）、`/api/ai/spots`（景點建議）。
- 注入金鑰（建議走 Secret Manager）：
  ```
  gcloud run services update life-dashboard-backend --region asia-southeast1 \
    --update-secrets GEMINI_API_KEY=gemini-api-key:latest
  ```
  （或臨時用 `--set-env-vars GEMINI_API_KEY=xxx` 測試）。Gemini 有免費層，對 billing-guard 較安全。

## AI 英文家教（`/ai/english`，商業化學習模組，Phase 1+2 完成）
- 四層架構：基礎學習 / AI 練習 / 口說 / 複習成長。巢狀路由掛在 `EnglishLayout`（含自有二級導航 `EnglishSubNav`，側邊欄只保留「AI 實驗室」大類）。
- **13 頁中 12 頁已真實**：Home、對話室（三欄）、口說、句子修正、情境、單字、句型、文法、常錯庫、複習、學習進度。**唯一佔位剩**：學習路徑、程度檢測、每日任務獨立頁（用 `EnglishComingSoonPage` 讀 route meta）。
- **語音全用瀏覽器原生、零成本**：`composables/useSpeechSynthesis`（TTS 慢/正常）、`useSpeechRecognition`（STT）、`utils/pronunciation.compareSentence`（文字相似度，非音素級；UI 預留升級）。不支援時 `VoiceUnsupportedNotice` 降級成文字輸入。
- **狀態 + 持久化**：`useEnglishStore`（localStorage 即時快取 + **背景同步到後端 `english_state`**，跨裝置；cloud 優先、失敗靜默降級）管 streak/任務/常錯庫/簡化 SM-2 複習。`api/english.ts` 內容走 mock、對話/修正走免費 Gemini（無金鑰 fallback mock 教練）。
- **後端** `com.lifedashboard.english`：`english_state` 表（per-user JSON 文件）+ `GET/PUT /api/english/state`。內容（單字/句型/文法/情境）仍前端 mock（靜態、不需 per-user）。
- **i18n 已完成**：所有 UI chrome 抽到 `ec` namespace（`src/i18n/locales/english/*.ts`，6 語），切語言整個模組翻譯。學習「內容」（單字意思/例句/文法解析/情境目標/程度檢測建議）刻意保留 zh-TW（教學內容，非 UI）。
- **程度檢測/學習路徑已完成**；唯一佔位剩「每日任務」獨立頁（Home 已涵蓋）。
- **待辦**：內容若要動態化或多語內容，再建細粒度後端表。

## 建議下一步
1. **英文家教收尾**：i18n 抽 key 回填 6 語；程度檢測頁（影響個人化路徑）；學習路徑頁。
2. **資料分析工具 `/ai/data-lab`**：唯一還沒做的 AI app（上傳 CSV→Gemini 洞察），重用 `GeminiClient`。
3. **Phase 3 後端**：習慣/目標/斷食/日記長文 等需要新資料表的功能。
