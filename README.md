# 蚵仔照護紀錄網站

這是一個綁定 Google 試算表的 Apps Script 網站，重點是讓醫生一眼看到：

- 每日喝水總量
- 每日食物總量
- 早藥 / 晚藥是否有餵
- 大便與嘔吐備註
- 每日一張照片，可點圖放大
- 當天由上往下的紀錄時間軸

## 檔案

- `Code.gs`: Apps Script 後端，直接寫入綁定的 Google 試算表
- `Index.html`: 網站前端
- `appsscript.json`: Apps Script 設定

## 連到你的 Google 試算表

1. 打開這份試算表  
   `https://docs.google.com/spreadsheets/d/1L88Cvo3kFz-t8wc2nG6l92tLDycJUpEg1tIz4WShSQY/edit`
2. 點 `擴充功能` → `Apps Script`
3. 把預設檔案內容清掉
4. 建立或覆蓋：
   - `Code.gs`
   - `Index.html`
   - `appsscript.json`
5. 將這個資料夾內對應檔案內容貼進去
6. 先手動執行一次 `getInitialData`，完成 Google 授權
7. 第一次上傳照片時，Apps Script 會再要求 Google Drive 權限，因為照片會存到 Drive
8. 點 `部署` → `新增部署作業`
9. 類型選 `網頁應用程式`
10. 執行身分選 `我自己`
11. 存取權限選 `知道連結的人`
12. 部署後打開網址，就能直接使用

## 表格欄位

後端會自動在同一份試算表建立或使用 `紀錄` 工作表，欄位如下：

- `id`
- `date`
- `time`
- `waterG`
- `foodType`
- `brand`
- `foodAmountG`
- `medMorning`
- `medNight`
- `stoolDetail`
- `vomitDetail`
- `note`
- `createdAt`

另外會自動建立 `每日圖片` 工作表，記錄每天對應的照片檔案資訊。

## 本機預覽

直接打開 `Index.html` 可以先看版面。

- 本機預覽資料只存在瀏覽器 `localStorage`
- 真正連到 Google 試算表與 Google Drive，要用 Apps Script 部署後的網址
