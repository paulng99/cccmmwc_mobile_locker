# cccmmwc_mobile_locker

校內手機櫃開門紀錄查詢。職員用已連學校網絡的電腦或手機打開本系統，按「更新」，瀏覽器會向 `http://10.127.7.200:17789` 自動取 Excel。

## 執行（校內 Windows / Docker）

1. 安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. `git clone` 本倉庫
3. 複製環境變數：

```
copy .env.example .env
```

把 `SESSION_SECRET` 改成至少 32 個字元。

4. `docker compose up --build`
5. 瀏覽器打開 `http://（這台電腦的內網IP）:3000`
6. 登入 `admin` / `000000`
7. 設定頁貼上 OpenLog 的 session JSON（`__tea_session_id_586864`）
8. 在校網按「更新」

介面：繁體中文（香港）／ English。日期 `yyyy-mm-dd`。

若瀏覽器因 CORS 讀不到 Excel，同一顆「更新」會改由校內 Docker 轉發（Docker 主機也須能連 `10.127.7.200`）。
