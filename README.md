# 我的代禱卡．小區代禱牆

**個人代禱卡**（同金香壇代禱卡：一週七天、每天一類人、點名字代禱、貼上名字、GIA1 名單代碼互通）＋**團體代禱牆**，兩邊互通，代禱卡的名字旁有信封，可以用「流通神聖的愛圖卡」的信紙寫信給他（常設活動 `PRAYCARD`，收信人先填好），存好後傳到他的 LINE；代禱卡的名字可以「放上代禱牆」，在代禱牆填的名字可以「同時加入我的代禱卡」。

在 LINE 群組發一張「代禱牆」圖卡，大家依自己的排填寫正在代禱的福音朋友，最新名單可以一鍵貼回群組。

- **建立者**：平台上填名稱、標語、經文、排的清單、色調 →「建立並發送到 LINE 群組」→ 選群組。
- **成員**：按圖卡上的「我也要填代禱名單」→ 選自己的排 → 填名字 → 送出；可選擇把最新的代禱牆圖卡貼回聊天室。自己填的名字可以自己刪除。
- **管理**：「已建立」裡可再次發送、編輯內容與排（改名會把名單一起搬過去）、停止填寫、複製文字名單、刪除名字或整面牆。

風格延續「金香壇代禱卡」（米白紙色、石榴紅、霞鶩文楷、石榴籽）。技術架構與「LINE簡易活動登記建立平台」相同：GitHub Pages（`index.html`）＋ LIFF ＋ Google Apps Script（`Code.gs`）＋ Google 試算表。

## 預覽

- 建立平台：`index.html?demo&notour`
- 成員填寫頁：`index.html?demo=wall`

## 目前的設定

- 網站：https://isaiahovercomer.github.io/line-prayer-wall/
- 入口（LIFF）：https://liff.line.me/2012412693-LFVpYPMf
- 試算表「代禱牆」：https://docs.google.com/spreadsheets/d/1VFTybOGvUi2nela3RJkbXl44PN1IMbQaRmUoHRW75cU/edit
- Apps Script「代禱牆後端」：https://script.google.com/home/projects/1g-qxKDvIzmuaRLDnfbktSXgve3HMUKJEoO0onObBpc9WHZar4-ss2Vjh/edit

## 設定

1. **試算表與後端**：新建 Google 試算表「代禱牆」→ 擴充功能 → Apps Script → 貼上 `Code.gs` → 執行 `setup` → 部署為網頁應用程式（執行身分：我；存取權：所有人）。
2. **LIFF**：LINE Developers → Provider「CITC」→ LINE Login channel `2012412693` → LIFF → Add：Size **Full**、Endpoint `https://isaiahovercomer.github.io/line-prayer-wall/`、Scopes **openid、profile、chat_message.write**、Share target picker **ON**。
3. **填回設定**：`index.html` 最上面的 `LIFF_ID`、`GAS_URL`。
4. **管理員**（選用）：把 LINE userId 加進試算表「發布者」工作表，就能看到並管理所有人建立的代禱牆。

## 試算表

| 工作表 | 內容 |
|---|---|
| 代禱牆 | 每面牆的名稱、標語、經文、說明、排（JSON）、是否允許成員新增排、色調、開放、建立者 |
| 代禱名單 | 每一個名字：排、名字、填寫者 LINE 名稱與 userId |
| 代禱卡 | 每人一份個人代禱卡（JSON） |
| 參與紀錄 | 打開過哪些代禱牆（代禱卡「放上代禱牆」用） |
| 發布者 | 管理員 userId |
| 登入（隱藏） | 60 天通行證 |

## 個資

只記錄填寫者的 LINE 名稱與 userId，以及填入的名字。填寫頁提醒可以只寫姓氏加稱呼；每個人可以在「我的個人資料」查看並刪除自己填過的名字。
