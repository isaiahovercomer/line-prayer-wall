# 我的代禱卡．小區代禱牆

**個人代禱卡**（同金香壇代禱卡：一週七天、每天一類人、點名字代禱、貼上名字、GIA1 名單代碼互通）＋**團體代禱牆**，兩邊互通，代禱卡的名字旁有信封，可以用「流通神聖的愛圖卡」的信紙寫信給他（常設活動 `PRAYCARD`，收信人先填好），存好後傳到他的 LINE；代禱卡的名字可以「放上代禱牆」，在代禱牆填的名字可以「同時加入我的代禱卡」。

在 LINE 群組發一張「代禱牆」圖卡，大家依自己的排填寫正在代禱的福音朋友，最新名單可以一鍵貼回群組。

- **建立者**：平台上填名稱、標語、經文、排的清單、色調 →「建立並發送到 LINE 群組」→ 選群組。
- **成員**：按圖卡上的「我也要填代禱名單」→ 選自己的排 → 填名字 → 送出；可選擇把最新的代禱牆圖卡貼回聊天室。自己填的名字可以自己刪除。
- **管理**：「已建立」裡可再次發送、編輯內容與排（改名會把名單一起搬過去）、停止填寫、複製文字名單、刪除名字或整面牆。

風格延續「金香壇代禱卡」（米白紙色、石榴紅、霞鶩文楷、石榴籽）。技術架構與「LINE簡易活動登記建立平台」相同：GitHub Pages（`index.html`）＋ LIFF ＋ Google Apps Script（`Code.gs`）＋ Google 試算表。

## 誰看得到代禱牆

- 只有**建立者**、**總管理者**（「發布者」工作表裡的 LINE userId）和按了邀請圖卡上「加入」的**成員**看得到代禱牆和上面的名字。
- 群組裡的圖卡是邀請卡：只有名稱、經文和各排人數，不放任何名字。還沒加入的人打開只看到同樣的資訊和「加入代禱牆」按鈕。
- 代禱牆後台（建立者、協助管理）：成員名單可勾選移除、切換「成員／協助管理」；名單可搜尋、勾選移排或刪除、按 ✎ 修改。
- 總管理後台：整體統計、全部代禱牆，可勾選後停止、開放或刪除。個人代禱卡只算人數，不看內容。

## 預覽

- 建立平台：`index.html?demo&notour`
- 成員填寫頁：`index.html?demo=wall`
- 還沒加入的人看到的邀請頁：`index.html?demo=invite`
- 代禱牆與總管理後台：`index.html?demo&tab=walls`

## 目前的設定

- 網站：https://praywall.pages.dev/（Cloudflare Pages，連到這個 repo 的 main，推上去就自動部署；舊的 GitHub Pages 網址仍可用）
- 入口（LIFF）：https://liff.line.me/2012412693-LFVpYPMf
- 試算表「代禱牆」：https://docs.google.com/spreadsheets/d/1VFTybOGvUi2nela3RJkbXl44PN1IMbQaRmUoHRW75cU/edit
- Apps Script「代禱牆後端」：https://script.google.com/home/projects/1g-qxKDvIzmuaRLDnfbktSXgve3HMUKJEoO0onObBpc9WHZar4-ss2Vjh/edit

## 設定

1. **試算表與後端**：新建 Google 試算表「代禱牆」→ 擴充功能 → Apps Script → 貼上 `Code.gs` → 執行 `setup` → 部署為網頁應用程式（執行身分：我；存取權：所有人）。
2. **LIFF**：LINE Developers → Provider「CITC」→ LINE Login channel `2012412693` → LIFF → Add：Size **Full**、Endpoint `https://praywall.pages.dev/`、Scopes **openid、profile、chat_message.write**、Share target picker **ON**。
3. **填回設定**：`index.html` 最上面的 `LIFF_ID`、`GAS_URL`。
4. **管理員**（選用）：把 LINE userId 加進試算表「發布者」工作表，就能看到並管理所有人建立的代禱牆。

## 試算表

| 工作表 | 內容 |
|---|---|
| 代禱牆 | 每面牆的名稱、標語、經文、說明、排（JSON）、是否允許成員新增排、色調、開放、建立者 |
| 代禱名單 | 每一個名字：排、名字、填寫者 LINE 名稱與 userId |
| 代禱卡 | 每人一份個人代禱卡（JSON） |
| 參與紀錄 | 代禱牆成員：LINE userId、代禱牆、最後開啟、加入時間、LINE名稱、角色（member／admin） |
| 發布者 | 管理員 userId |
| 登入（隱藏） | 60 天通行證 |

## 從舊站「金香壇代禱卡」搬家

- 舊網址（shc5556-hsinhua.github.io/praycards/）換成轉址頁後，每次都會把手機上的名單用 `#n=`、同步碼用 `#s=` 帶來。新站一打開就存到這支手機（`pw.move`）並清掉網址上的 #。
- 還沒登入：只顯示一個大按鈕「同步代禱名單」→ 登入 LINE → 回來後**自動**合併（手機名單＋用同步碼從舊站雲端接回的名單），不用再按合併。
- 同步完成前 `pw.move` 一直保留，每次從舊網址進來都會再出現這個按鈕；同步到 LINE 帳號後才清掉，並記下這份資料（`pw.moved`），舊網址再帶來同一份就不再處理。
- 選「先不要登入」：名單先放在這支手機（`pw.guest.card`），畫面一直提示「同步代禱名單」；登入後也會自動合併。
- 一般瀏覽器打開、沒登入過：先用手機模式看代禱卡，不會一進來就要求登入；代禱牆、建立需要登入。這個瀏覽器登入過（`pw.ever`）就直接登入。
- 同步碼接回：後端 `claimOld`（可不登入）依舊站規則（正規化 → SHA-256 → 十六進位）先查舊站 Firestore，查不到再用「舊代禱卡」工作表的備份。代禱卡「名單代碼」裡也能手動輸入同步碼。
- 舊站匯出檔（2026-11-20，240 份有名字的名單、3,689 個名字）已匯入「舊代禱卡」工作表；總管理後台也能再上傳匯出檔（`importOld`）。

## 個資

只記錄填寫者的 LINE 名稱與 userId，以及填入的名字。填寫頁提醒可以只寫姓氏加稱呼；每個人可以在「我的個人資料」查看並刪除自己填過的名字。
