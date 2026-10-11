# 四堂課 R 練習｜全部為合成資料

本資料包提供可實跑的EFA、CFA、SEM、測量恆等性、MIMIC及簡化成長模型。固定seed＝1151011，**沒有原研究個案、問卷原題或原研究數值**。教科書與期刊用於概念教學；這套數據用於安全操作與重現練習。

需要R及`lavaan`。本次驗證使用R 4.5.2、lavaan 0.6-20；不需要semTools、psych、tidyverse或jsonlite。依賴缺少時程式會停止，不會替學生自動安裝。

## 新手入口：RStudio

**課前**先在RStudio的Console（下方顯示`>`的區塊）執行：

```r
install.packages("lavaan")
```

這是使用者自己安裝課程所需套件；分析程式不會自動安裝。需要網路及可寫入R套件資料夾。已有lavaan者可跳過。第一次安裝或完整估計在課前完成，課中35分鐘以指定輸出判讀為主，無須每堂重跑12個模型。

在RStudio選擇 **File → Open File → labs/generate_data.R**，再按編輯器右上方的 **Source**。預期Console顯示`Created SYNTHETIC ONLY ...`。接著開啟 **labs/analysis.R → Source**，預期顯示`All 12 synthetic models converged ...`。請執行整份檔案，不使用單行Run或選取片段。兩份檔案會依自身位置定位，可從任意工作資料夾執行。

輸出位於專案的`labs/`資料夾及`data/lab-results.json`；下方表格列出用途。RStudio視窗實際點選尚未在本機獨立驗證；程式已驗證以R的`source()`方式載入完整檔案。若分析失敗，請讀Console錯誤，不把舊輸出當成本次成功。

## 進階入口：PowerShell／終端機

1. 在網頁下載的資料夾中解壓縮；保留`labs/`和`data/`相鄰。或使用已下載的完整GitHub專案。
2. Windows：在資料夾開啟PowerShell，執行：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\labs\run_labs.ps1
   ```

   若R沒有裝在預設位置：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\labs\run_labs.ps1 -RscriptPath 'C:\你的R安裝位置\bin\Rscript.exe'
   ```

3. macOS／Linux（終端機）或已有Rscript可用的Windows：

   ```text
   Rscript --vanilla labs/generate_data.R
   Rscript --vanilla labs/analysis.R
   ```

   兩個R程式都依儲存檔本身位置讀寫，從其他工作資料夾執行也可。Windows若出現LC_CTYPE／LC_ALL或中文路徑亂碼，改用上方PowerShell包裝；它只暫時移除不相容locale環境變數，結束時恢復，不改系統設定。

4. 預期看到`All 12 synthetic models converged ...`，並生成下表的結果。若出現錯誤，不得把舊結果當成此次通過；先讀錯誤訊息。分析先檢查全部模型成功才更新結果。

PowerShell包裝會同時核對21項資料與衍生結果。若需完整兩次重跑驗證，在專案資料夾的PowerShell執行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\labs\run_labs.ps1 -Verify
```

預期10個CSV位元組相同、網頁JSON排除時間戳記後相同。其他作業系統可執行`Rscript --vanilla labs/verify_reproducibility.R`及`Rscript --vanilla labs/validate_outputs.R`。教師已保存本次`data_quality_checks.csv`、`reproducibility_record.md`與`reproducibility_hashes.csv`。

| 輸出 | 內容 |
|---|---|
| `results.csv` | 12模型有效N、配適度及估計法 |
| `invariance_comparisons.csv` | 跨組／跨時間各三次巢套比較的ΔCFI、ΔRMSEA |
| `efa_loadings.csv` | 三因素varimax負荷、獨特性 |
| `regression_paths.csv` | SEM與MIMIC未標準化估計、SE、95%CI與標準化估計 |
| `growth_parameters.csv` | 截距／斜率平均、變異數及共變異數 |
| `model_parameters.csv` | 全部模型參數，方便教師核對 |
| `time_basis.csv` | 原時間、平移時間、線性／二次正交基底與預測平均 |
| `verification_record.txt` | 收斂、解的容許性、缺失與配適度驗證摘要 |
| `../data/lab-results.json` | 網頁讀取的預先實跑結果；含合成標示與推論限制 |

## 四堂指定輸出與讀表提示

### 第1堂：看不見的動機

先查字典區分構念、指標與共變項，閱讀`efa_loadings.csv`。EFA使用完整個案；因素順序與符號可旋轉，不能依固定Factor1名稱猜構念。比較`sport_cfa`與EFA的分析目的，核對CFA三指標如何固定尺度。

課中讀表：找兩項高負荷與一項較低負荷，說明是否足以單靠負荷刪題；在`results.csv`找`sport_cfa`有效N與配適度。正式作業與繳交要求以網站本堂作業為準。

### 第2堂：動機與活力研究站

讀`sport_sem`三條回歸路徑。區分未標準化係數、標準化係數、SE與95%CI；不要拿SE作Cohen's d分母。CFA與SEM在此模型中可能有相同或近似配適度，不能說「配適度一樣」就代表兩者解釋相同。

課中讀表：在`regression_paths.csv`找三條動機→活力路徑，將autonomy→vitality寫成含數值、尺度與限制的兩句說明，標示「合成教學資料」。正式作業與繳交要求以網站本堂作業為準。

### 第3堂：這把尺能公平比較嗎

跨組以`elite`＝0／1比較四波因素；**elite不是sex**。跨時間則以同一批500個合成個案比較四波。形態→負荷→截距→殘差逐步加限制；三指標單因素的基線形態模型飽和，故此處跨組使用完整四波模型，避免把無自由度當成配適良好證據。

讀`invariance_comparisons.csv`：ΔCFI＝較嚴格減較寬鬆，負值代表CFI降低；ΔRMSEA正值代表惡化。CFI／RMSEA全部採robust，chisq／df／p採scaled，SRMR為一般SRMR。不得把robust與一般指標混在同一個Δ。資料生成時參數設定恆等，但樣本估計仍有誤差；不提供機械通過規則。若要卡方差異檢定，須用lavaan適用MLR的縮放差異檢定，不能直接相減scaled χ²。

本次固定seed的八個恆等性模型，robust CFI都截在1、RMSEA都截在0，故六列Δ為0。這來自樣本卡方小於自由度與指標的截斷規則，不代表真實族群的所有參數完全相同。可同時觀察SRMR及各模型限制；教學中若使用非零Δ數字，須明確標示另為概念示意。

課中讀表：在`invariance_comparisons.csv`驗算一列ΔCFI，找出各模型新增限制；解釋FIML與多重插補的差異，指出本例沒有完成的世代序列／插補分析。正式作業與繳交要求以網站本堂作業為準。

### 第4堂：追蹤成長的研究員

MIMIC示範`age_c`、`sex`、`elite`、`cohort_c`預測基線潛在變項；未設定指標直接效果，不能以此模型宣稱沒有DIF。簡化成長使用每波至少兩題的平均，固定斜率負荷0、1、2、3；截距是基線平均，斜率是每年的平均變化。

`time_basis.csv`提供正交線性／二次基底。它只是時間編碼示意，沒有用該基底估計完整原文正交多項式模型。把時間平移成-3、-2、-1、0時，末波截距＝基線截距＋3×斜率；預測值不變。兩種編碼差異不代表研究發現改變。

課中讀表：在`regression_paths.csv`找MIMIC一條路徑，在`growth_parameters.csv`找截距／斜率及95%CI，再用`time_basis.csv`兩種時間編碼驗算末波預測平均。不得稱為完整二階潛在成長、完整Mplus或原研究重現。正式作業與繳交要求以網站本堂作業為準。

## 方法與驗證邊界

- 連續近似常態合成指標使用MLR＋FIML；EFA以base R `factanal`完整個案與varimax處理。
- 所有模型先檢查收斂、`post.check`、有限SE及robust配適度；不收斂或不容許時停止輸出。
- MLR標準誤及CI屬合成模型推論，不能外推真實校園或運動族群。
- 沒有複製完整世代序列、多重插補、DIF、部分恆等性重新估計或原作者Mplus輸出。部分恆等性在網站作概念教學，學生不應自行按配適度解鎖大量參數。
- 本機兩次同seed重跑與數值檢查是可重現性驗證，不等於真實課堂操作或原研究驗證。
- 方法來源：[lavaan缺失／估計教學](https://lavaan.ugent.be/tutorial/est.html)、[多群組恆等性](https://lavaan.ugent.be/tutorial/groups.html)、[成長模型](https://lavaan.ugent.be/tutorial/growth.html)。
