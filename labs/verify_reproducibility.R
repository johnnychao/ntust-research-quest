# Rerun SYNTHETIC generation and all analyses twice; compare exact outputs.
args <- commandArgs(trailingOnly = FALSE)
script_arg <- grep("^--file=", args, value = TRUE)
if (length(script_arg) != 1L) stop("Run this file using Rscript.")
lab_dir <- dirname(normalizePath(sub("^--file=", "", script_arg), winslash = "/", mustWork = TRUE))
outputs <- c("synthetic_sport.csv", "synthetic_school_wide.csv", "synthetic_school_long.csv", "results.csv", "invariance_comparisons.csv", "efa_loadings.csv", "regression_paths.csv", "growth_parameters.csv", "model_parameters.csv", "time_basis.csv")
run_all <- function() {
  e <- new.env(parent = globalenv())
  source(file.path(lab_dir, "generate_data.R"), local = e, encoding = "UTF-8")
  source(file.path(lab_dir, "analysis.R"), local = e, encoding = "UTF-8")
}
normalize_json_time <- function() {
  text <- readLines(file.path(lab_dir, "..", "data", "lab-results.json"), encoding = "UTF-8", warn = FALSE)
  sub('"generatedAt":"[^"]+"', '"generatedAt":"TIME_IGNORED_FOR_REPRODUCIBILITY"', text)
}
log_first <- capture.output(run_all())
first_hash <- unname(tools::md5sum(file.path(lab_dir, outputs)))
first_json <- normalize_json_time()
log_second <- capture.output(run_all())
second_hash <- unname(tools::md5sum(file.path(lab_dir, outputs)))
second_json <- normalize_json_time()
stopifnot(identical(first_hash, second_hash), identical(first_json, second_json))
record <- data.frame(file = outputs, first_md5 = first_hash, second_md5 = second_hash, identical = first_hash == second_hash)
write.table(record, file.path(lab_dir, "reproducibility_hashes.csv"), sep = ",", row.names = FALSE, quote = TRUE, fileEncoding = "UTF-8")
writeLines(c("# 合成R練習：兩次完整實跑驗證", "", paste0("驗證時間：", format(Sys.time(), "%Y-%m-%d %H:%M:%S", tz = "Asia/Taipei"), " Asia/Taipei"), "", "結果：PASS。連續兩次執行完整生成器＋12模型分析。10個CSV位元組相同；網頁JSON排除generatedAt後全文相同。", "", "兩次seed都為1151011；原始資料、EFA、SEM路徑、6列恆等性差值、成長參數及時間編碼均包含於比對。", "", "MD5在本處只用於相同性檢查，並非身分驗證或防竄改簽章。", "", "兩次模型均完成收斂、post.check、有限SE與robust配適度檢查。驗證僅涵蓋合成本機分析；不是原研究重現或真實課堂驗證。", "", "詳細逐檔比對見reproducibility_hashes.csv。"), file.path(lab_dir, "reproducibility_record.md"), useBytes = TRUE)
cat("PASS: 2 complete runs; 10 CSV files identical; web JSON identical except generatedAt.\n")
