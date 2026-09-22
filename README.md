# cccmmwc_mobile_locker

校內手機櫃開門紀錄查詢系統。職員用**已連學校網絡**的電腦或手機打開本系統，按「更新」取得最新記錄。

> **語言 / Language**：繁體中文（香港）／ English。日期格式 `yyyy-mm-dd`。

---

## 快速開始（校內 Windows / macOS + Docker）

### 1. 安裝 Docker Desktop

下載並啟動 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

### 2. 複製倉庫

```cmd
git clone https://github.com/paulng99/cccmmwc_mobile_locker.git
cd cccmmwc_mobile_locker
```

### 3. 建立環境變數檔

**Windows CMD：**

```cmd
copy .env.example .env
```

**macOS / Linux：**

```bash
cp .env.example .env
```

然後以文字編輯器開啟 `.env`，把 `SESSION_SECRET` 改成至少 32 個字元的隨機字串（例如任意英文字母加數字組合）。詳見 [.env.example](.env.example) 內的說明。

### 4. 啟動服務

```cmd
docker compose up --build
```

首次啟動會建立資料庫及應用容器，需時約 2–3 分鐘。之後再啟動只需：

```cmd
docker compose up
```

### 5. 打開系統

在**同一個校內網絡**下，瀏覽器輸入：

```
http://（這台電腦的內網 IP）:3000
```

> ⚠️ 必須使用 **HTTP**，不是 HTTPS。內網 IP 通常形如 `192.168.x.x` 或 `10.x.x.x`；可在系統設定或執行 `ipconfig`（Windows）/ `ifconfig`（macOS）查找。本機自用可用 `http://localhost:3000`。

### 6. 登入

| 欄位 | 預設值   |
|------|---------|
| 登入名稱 | `admin` |
| 密碼   | `000000` |

---

## 更新記錄（「更新」按鈕的作用）

按「更新」會讓系統向學校 OpenLog 伺服器 `http://10.127.7.200:17789` **自動下載 Excel 開箱記錄**並匯入資料庫。這個操作：

- **不是**更新應用程式本身。
- 需要這台電腦（即 Docker 主機）能在校網連到 `10.127.7.200`。
- 若瀏覽器因 CORS 政策無法直接讀取，同一顆「更新」按鈕會自動改由 Docker 容器作服務端轉發——操作步驟不變。

若連接失敗（顯示「未能連接校內手機櫃系統」），可手動到智能柜頁面匯出 Excel，再用頁面上的「上傳 Excel」按鈕匯入。

---

## 設定智能柜 Cookie（可選）

設定 Cookie 後，按「更新」時系統可用你的帳號身份自動下載 Excel，省去每次手動匯出的步驟。

**Settings 頁中的欄位名稱：** 「智能柜登入 Cookie（可選）」

**取得方式：**

1. 在**同一台電腦**的瀏覽器打開智能柜網頁並登入。
2. 按 F12 開啟 DevTools → 切換到 **Application** 頁籤 → 左側選 **Cookies**。
3. 找到並複製 **`.AspNetCore.Identity.Application`** 的值（不包括 `Culture` 等其他 cookie）。
4. 回到本系統 Settings 頁，把這段值貼進「智能柜登入 Cookie（可選）」欄位，按「儲存」。

> ⚠️ 貼入欄位的是 **cookie 字串**（格式如 `.AspNetCore.Identity.Application=CfDJ8…`），**不是** JSON 物件。`__tea_` 開頭的統計 JSON（如 `{"sessionId":…}`）**無效**，系統會忽略。

---

## Session 過期處理

若更新時出現「請先在呢部電腦登入智能柜」或「手機櫃系統要求重新登入」提示，代表 Cookie 已失效。處理步驟：

1. 在同一台電腦重新登入智能柜。
2. 重新到 DevTools 複製 `.AspNetCore.Identity.Application` 的值。
3. 貼回 Settings 頁「智能柜登入 Cookie（可選）」欄位並儲存。
4. 再按「更新」。

或改為在智能柜頁面手動匯出 Excel，用「上傳 Excel」功能匯入。

---

## 常見問題

| 問題 | 原因 / 解決方法 |
|------|----------------|
| 打開頁面顯示「無法連線」 | 確認 Docker 已啟動、用 HTTP（非 HTTPS）、輸入正確內網 IP 及 `:3000` 連接埠 |
| 「更新」一直失敗 | 確認這台電腦已連上校網，且能連到 `10.127.7.200` |
| 更新顯示 CORS 錯誤後繼續 | 正常行為，系統自動切換為 Docker 服務端轉發 |
| Cookie 無效 / 被忽略 | 確認貼入的是 `.AspNetCore.Identity.Application=…` cookie 字串，而非 JSON |
| Session 過期提示 | 按上方「Session 過期處理」步驟重新取得 Cookie |

---

## 停止服務

```cmd
docker compose down
```

加 `-v` 會**同時刪除**資料庫資料（不可復原）：

```cmd
docker compose down -v
```
