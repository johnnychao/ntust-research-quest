# 合成R練習：兩次完整實跑驗證

驗證時間：2026-10-11 23:37:42 Asia/Taipei

結果：PASS。連續兩次執行完整生成器＋12模型分析。10個CSV位元組相同；網頁JSON排除generatedAt後全文相同。

兩次seed都為1151011；原始資料、EFA、SEM路徑、6列恆等性差值、成長參數及時間編碼均包含於比對。

MD5在本處只用於相同性檢查，並非身分驗證或防竄改簽章。

兩次模型均完成收斂、post.check、有限SE與robust配適度檢查。驗證僅涵蓋合成本機分析；不是原研究重現或真實課堂驗證。

詳細逐檔比對見reproducibility_hashes.csv。

## Windows PowerShell 5 補驗

PASS：以 powershell.exe 5.1.22621.6133 執行 UTF-8 BOM 版本正常單輪，使用與已 staged 檔案位元組相同、保留中文路徑的隔離副本；12模型與21項核對通過。10個CSV的SHA256與原專案相同，網頁JSON排除 generatedAt 後內容相同。執行後呼叫端的 LC_ALL、LC_CTYPE、LANG 恢復；原專案 staged 來源與JSON沒有更動。

此補驗沒有重跑 -Verify；前述兩次重跑紀錄保留。
