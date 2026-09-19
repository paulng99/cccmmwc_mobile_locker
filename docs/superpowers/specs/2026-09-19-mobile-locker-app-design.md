# 手機櫃資訊應用 — 設計規格（已按你的回覆修訂）

> 日期：2026-09-19  
> 狀態：**規格已按 Q&A 更新；session 格式已對上 sessionStorage；第 11 節仍待確認**  
> 範圍：校內專用；今期不寫公開雲、不做 Google 登入  
> 語言：`zh-HK` + `en` 對照；日期 `yyyy-mm-dd`；時間 `HH:mm:ss`；時區 `Asia/Hong_Kong`

確認第 11 節後才開始寫程式。

---

## 1. 產品目標

校內職員系統，用來看學生手機櫃**最後使用**與**歷史開門紀錄**。

| 檢視 | 顯示 |
|------|------|
| 學生 | 班別（所屬部門）、學號（用戶編號）、姓名（用戶名，空白則不顯示）、最後開門日期時間、最後箱門。無最後時間則該欄顯示「空置」。 |
| 箱門 | A–G 各櫃。每格：櫃名（例如「A 櫃」）、格號（例如 `003`）、學生姓名（空白則不寫）、最後使用日期時間、按鈕「以往記錄」。該格從未有紀錄 → 整格狀態「空置」。 |
| 歷史 | 該學生或該箱門全部開門列（Excel 各欄入庫後可查）。 |

**最後使用判定：** 不論 `开箱类型` 是什麼（存入／取出／其他），該次開門都更新「該生最後箱門」與「該格最後使用者」。取出後仍顯示該學生，不改為空置。

資料來源：內聯網 `http://10.127.7.200:17789/#/Logs/OpenLog` 導出 Excel。無廠商 API 文件，由本系統用 **session id** 代為搜尋日期範圍並導出。

---

## 2. 已鎖定的架構

**只供校內使用。** 整套系統跑在能開啟 `10.127.7.200:17789` 的 **Windows** 主機（Docker：`app` + PostgreSQL）。不放 Railway／公有雲。

本雲端環境已證實連不到該 IP。開發時用樣本 Excel 與測試；**真同步必須在校內 Windows 上跑**。

| 服務 | 角色 | 端口 |
|------|------|------|
| `app` | 網頁、登入、設定、查詢、排程同步、人手同步 | 校內 `:3000` |
| `db` | PostgreSQL 16 | 僅 Docker 內網 |

建議職員網址：`http://<該Windows之內網IP>:3000`。若裝在與手機櫃同一部 `10.127.7.200`，則用 `http://10.127.7.200:3000`（與 `:17789` 並存）。見第 11 節。

人手上傳 Excel 僅作後備（session 失效或導出 API 對不到時）。

---

## 3. 技術棧

| 層 | 選擇 |
|----|------|
| 網頁 + API | Next.js（App Router）+ TypeScript |
| UI | 專業、多色彩、藍色主色；`next-intl`：`zh-HK` / `en` |
| DB | PostgreSQL 16 + Prisma |
| Excel | 解析欄名（簡體，與原廠導出一致） |
| 同步 | 設定頁貼上 sessionStorage JSON；校內主機用 Playwright 注入後導出 Excel。純 Cookie 可能不夠，因原廠把值放在 sessionStorage 而非 Set-Cookie |
| 排程 | 行程內 `node-cron`，`Asia/Hong_Kong`：每日 **09:45**、**18:30** |
| 認證第一期 | `admin` / `000000`（只存 bcrypt）；第二期 Google 電郵，不做 |

---

## 4. Excel 欄位對應

導出檔表頭（簡體，必須對得上）：

| Excel 欄 | 系統用途 |
|----------|----------|
| 用户名 | 學生姓名；空則畫面不顯示姓名 |
| 用户编号 | 學號 |
| 所属部门 | 班別 |
| 箱门 | 例如 `B-032号箱` → 櫃 `B`、格 `032` |
| 开箱类型 | 原文入庫；不影響「最後 locker」 |
| 验证方式 | 入庫；歷史頁可顯示 |
| 管理员 | 入庫 |
| 备注 | 入庫 |
| 开箱时间 | 最後使用時間；解析後存 `timestamptz` |

箱門解析：`^([A-Ga-g])-(\d{1,3})\s*号箱$`  
正規化：`cabinet = 大寫字母`，`door_no = 三位補零`（`32` → `032`），`locker_code = B-032`。

只處理櫃 **A–G**。其他櫃號列仍入 `open_events` 但箱門總覽不建頁。

去重指紋：`开箱时间` + `用户编号` + 正規化 `locker_code` + `开箱类型`。重複匯入不插第二筆。

---

## 5. 同步規則

1. **探測** `http://10.127.7.200:17789`（短 timeout）。失敗 → 不寫假成功；畫面中英提示仍可查已存紀錄。
2. **認證（你提供的 sessionStorage）**  
   原廠不是普通 cookie 名稱 `session_id`，而是瀏覽器 **Session Storage**：

   | 項目 | 值 |
   |------|-----|
   | 鍵名 | `__tea_session_id_586864` |
   | 值 | JSON：`{"sessionId":"<uuid>","timestamp":<毫秒>}` |

   設定頁可貼：整段 JSON，或只貼 `sessionId` UUID（系統會補上當前 timestamp）。  
   **不要把真實 UUID 寫進 Git。** 只存在 `app_settings`。

   同步時校內主機打開 `http://10.127.7.200:17789`，執行  
   `sessionStorage.setItem('__tea_session_id_586864', json)`，再進入 `#/Logs/OpenLog`、填日期、導出 Excel。

   **風險：** `__tea_session_id_*` 常見於統計 SDK（Tea／Rangers），關分頁或閒置約 30 分鐘就失效，**09:45／18:30 排程可能經常失敗**。若 Local Storage 還有 `token`／`Authorization`／`userInfo` 之類，應一併貼到設定頁，排程才穩。見第 11 節 C。
3. **日期範圍**
   - 首次：`from = 設定的首次匯入日`，`to = 今天（香港）`。
   - 其後：`from = last_success_open_date`（重疊 1 日），`to = 今天`。
   - 內聯網**不清舊 log**；本系統亦不刪歷史。
4. 下載 Excel → 解析 → 插入新事件 → 重算 `student_current`、`locker_current` → 更新 `sync_state`。
5. **排程**：09:45、18:30（香港）。主機需在該時段開機。
6. **人手按鈕**：任何已登入管理員可立即跑同一流程。
7. Session 無效（401／導出頁跳登入）：設定頁提示「請由內聯網系統複製新的 session id」。

提示文案：

- zh-HK：`未能連接校內手機櫃系統（10.127.7.200）。請確認已連接學校網絡後再同步。已保存的歷史紀錄仍可查閱。`
- en：`Cannot reach the school locker system (10.127.7.200). Connect to the school network and try again. Saved history remains available.`

---

## 6. 畫面（尚未實作，僅規格）

右上：`繁體中文（香港）` / `English`。日期 `yyyy-mm-dd`。

### 6.1 登入

`admin` / `000000`。錯誤不區分帳號或密碼。

### 6.2 設定頁（你要求新增）

已登入才能開。

| 欄位 | 說明 |
|------|------|
| 內聯網網址 | 預設 `http://10.127.7.200:17789` |
| Session Storage 鍵名 | 預設 `__tea_session_id_586864`（可改） |
| Session 內容 | 多行文字框，貼 JSON 或 UUID。存資料庫，不進 Git／log。畫面只顯示「已保存」與 timestamp 日期。 |
| （可選）登入 Token | 若你從 Local Storage／Cookie 另複製 `token`，貼在這裡作排程用 |
| 連線測試 | 注入 storage 後嘗試開 OpenLog／導出；成功或提示失效 |
| 首次匯入日起 | 見第 11 節 |
| 每櫃格數 | 用於產生 001…N 的空置格；見第 11 節 |
| 排程說明 | 只讀：每日 09:45、18:30 |

Session 只給本系統伺服器向 `10.127.7.200` 用，不下發到其他用戶瀏覽器。

### 6.3 首頁 — 學生

表格：班別、學號、姓名（無則留空不寫「空」）、最後箱門、最後使用日期時間（無則「空置」）。搜尋班別／學號／姓名。每列有「以往記錄」。

只列出 **log 裡出現過的學號**。無名冊、不列從未開門的學生。

### 6.4 首頁 — 箱門

分櫃 **A 櫃 … G 櫃**。每格一卡：

- 格號 `003`（三位）
- 學生姓名（無則不寫該行）
- 最後使用時間（`yyyy-mm-dd HH:mm:ss`）
- 按鈕：以往記錄

該格完全無事件：**空置**（不顯示姓名與時間）。

有事件：即使最後一次是取出，仍顯示該學生 + 最後時間。

### 6.5 以往記錄頁

來自學生列或箱門按鈕。表列：开箱时间、用户名、用户编号、所属部门、箱门、开箱类型、验证方式、管理员、备注。可再篩日期。分頁。

### 6.6 頁首同步列

最後成功同步時間、內聯網狀態、按鈕「立即同步」。可保留「上傳 Excel」後備。

### 6.7 第一期不做

Google 登入、校外存取、遙距開箱、學生自助、推播、改原廠 `:17789` 系統。

---

## 7. 資料庫

### 7.1 `users`

`login_name=admin`，`password_hash`，`email` 可空（第二期），`role=admin`。

### 7.2 `app_settings`（單列）

`intranet_base_url`，`session_storage_key` 預設 `__tea_session_id_586864`，`session_payload`（敏感 JSON），`login_token`（可空、敏感），`first_import_date`，`doors_per_cabinet`，`updated_at`。

### 7.3 `sync_state`（單列）

`last_attempt_at`，`last_success_at`，`last_success_open_date`，`last_error`，`last_row_count`。

### 7.4 `open_events`

`opened_at`，`student_name`，`student_no`，`class_code`，`cabinet`，`door_no`，`locker_code`，`open_type`，`verify_method`，`admin_name`，`remark`，`source`（`intranet_export` / `manual_upload` / `scheduled`），`row_fingerprint` unique，`raw_json`。

### 7.5 `student_current` / `locker_current`

由事件重算。箱門總覽以設定的每櫃格數產生 A–G × `001`…`N`；無對應事件則畫面「空置」。

---

## 8. 安全

- 本系統密碼 bcrypt；內聯網 session 只存設定表，不進版控、不寫 info log。
- Cookie session：`httpOnly`、`sameSite=lax`；校內 HTTP 不強制 `secure`。
- 同步與改設定必須已登入。
- 上傳限 `.xlsx`／`.xls`、20 MB。
- 不提供刪改單筆開門事實；不去清舊 log。
- PostgreSQL 不映射到校外。防火牆僅校內開 `:3000`。

---

## 9. 伺服器清單（第一期）

實際是 **一台 Windows 校內主機** 上的兩個容器：

1. **應用伺服器**（Node / Next.js）— 畫面、API、09:45／18:30 排程、帶 session 拉 Excel。
2. **PostgreSQL 16** — 歷史與最後狀態。

需要：Docker Desktop for Windows、能連 `10.127.7.200`、該時段開機、約 4 GB RAM／20 GB 磁碟。不要把 5432 暴露到互聯網。

---

## 10. 驗收標準

- 校內登入 `admin` / `000000`。
- 設定頁可保存 session id；測試連線有成功／失敗。
- 同步後學生頁：班別、學號、有則姓名、最後箱門與時間。
- 箱門頁：A–G；格號三位；無資料「空置」；有資料則不論類型都顯示最後學生與時間。
- 每格／每生可開以往記錄。
- 同一 Excel 匯入兩次不重複。
- 09:45 與 18:30 會自動跑（主機開著時）；另有人手同步。
- 內聯網不可達時中英提示，舊資料仍在。
- 介面 zh-HK / en；日期 `yyyy-mm-dd`。

---

## 11. 仍需你定的兩件事（會改行為）

**A. 首次匯入日**  
你寫了 `2028-01-01`。今天規格日是 **2026-09-19**。若 `from=2028-01-01`，現在同步會是 **0 筆**，要到 2028 才有資料。

請選一個：

1. 維持 `2028-01-01`（現在不拉歷史）
2. 改為 `2026-09-01`（本學年）
3. 改為 `2026-01-01`
4. 其他 `yyyy-mm-dd`：________

**B. 每櫃幾格？**  
Excel 例子是 `B-032号箱`。畫面要為沒有紀錄的格顯示「空置」，必須知道 `001` 到多少。

請回覆一個數字，例如 `40`、`50`、`60`。若 A–G 格數不同，請列出（如 A=40、B=32）。

**順便確認（一句即可）：** 本系統是裝在 **與 `:17789` 同一部** Windows（用 `:3000`），還是 **另一部** 校內 Windows？

**C. 請再看 Local Storage 與 Cookie（很重要）**  
請在同一網頁 DevTools → Application：

1. **Local Storage**（`http://10.127.7.200:17789`）所有鍵名列出來，尤其 `token`、`access_token`、`user`、`userInfo`、`vuex`。有值的鍵請複製（可遮中間幾位）。
2. **Cookies** 有沒有 `token`、`JSESSIONID`、`Authorization`。
3. Network 開 OpenLog 時，請求 Header 有沒有 `Authorization` 或自訂 header。

若只有 `__tea_session_id_586864`，本系統仍會按你的格式注入；但自動排程可能要你每天重貼一次。

---

## 12. 實作順序（上述確認後）

1. Docker Compose + PostgreSQL + admin 種子。
2. Excel 解析器（九欄 + `B-032号箱`）與去重測試。
3. 登入、雙語殼、設定頁（session id）。
4. 學生／箱門首頁與以往記錄（含空置規則）。
5. 內聯網探測、帶 session 導出、人手同步、09:45／18:30。
6. 在校內 Windows 用真實 session 驗一次。
