# 運動科學研究探險隊

臺灣科技大學業師課程，由趙恩（恩恩老師）帶領。以運動心理研究情境串起四堂、每堂180分鐘的研究生統計課程：因素分析、動機與活力SEM、測量恆等性、發展軌跡。

**公開網站：https://johnnychao.github.io/ntust-research-quest/**

## 開始使用

1. 在瀏覽器開啟網站，選擇開課年度。
2. 點「開始第一關」，完成互動任務，再提交核心判斷；答錯可提示與重試。
3. 留下研究筆記。課後到「學習手札」列印成PDF，或到「進度與設定」下載JSON備份。
4. 教師點「教師投影模式」可直接切換任一關，示範不會改變學生進度。

網站免登入，學習資料留在自己的瀏覽器。換裝置前匯出JSON，再於相同年度與教材版本匯入。網站沒有教師集中紀錄或自動作業繳交功能；依任課教師規定繳交成果。

## 本機版本（Windows）

下載GitHub的ZIP並解壓縮，進入專案資料夾。這個本機方式需要Node.js 18以上；若未安裝，直接使用公開網站即可。在檔案總管的網址列輸入 `powershell`、按Enter，於開啟的PowerShell貼上：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Learning.ps1
```

預期瀏覽器開啟 `http://127.0.0.1:8765/`。此指令只對本次啟動套用執行原則，不修改電腦的全域設定。直接雙擊index.html可能因瀏覽器本機讀檔限制無法載入教材。

結束本機服務：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Learning.ps1 -Stop
```

## 教材與資料

- 四堂各六關，共24關；題庫與課程位於 `data/course.json`，年度與日期位於 `data/config.json`。
- [學生操作說明](docs/student-guide.md)、[年度更新指南](docs/annual-update.md)、[R實作指南](labs/README.md)、[欄位說明](labs/codebook.md)。
- `labs/`的CSV全部是固定種子生成的**合成資料**；`data/lab-results.json`為附帶R腳本實跑的結果。
- 互動滑桿是**概念示意**，不會在瀏覽器估計SEM；合成分析也不等同原研究結果。
- 原Wiley PDF、期刊全文、逐筆研究資料與教師備課原件不在公開專案內。正式來源連結見研究補給站。
- 圖像為AI生成教學插圖；雪梨校園為虛構場景，不是實際研究地點。角色/場景記錄見 `assets/asset-manifest.json`。

## 維護與檢查

本網站是無框架、無建置依賴的HTML/CSS/JavaScript。Node.js 18以上可執行：

```text
node --check app.js
node --check state.js
node --test tests/state.test.js
```

瀏覽器驗收腳本 `tests/browser-check.mjs` 需可用的Playwright及Chrome/Chromium；細節見腳本參數。瀏覽器測試和真實課堂試行分別驗證。

GitHub Pages以main分支根目錄發布。每次更新需先本機檢查，再發布；版本標籤保留回復點。公開題目與前端答案適用形成性自學，正式評量由教師評閱反思與作業。

## 使用範圍

本課程內容供教學與學習使用。引用文獻與第三方資料的權利仍屬原權利人；本專案未包含原文全文的再散布授權。恩恩老師角色延續使用者核准造型，不應用來冒充本人或官方學校身分。
