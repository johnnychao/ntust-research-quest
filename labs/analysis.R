# SYNTHETIC TEACHING ANALYSIS ONLY. No real participants or original-study results.
args <- commandArgs(trailingOnly = FALSE)
script_arg <- grep("^--file=", args, value = TRUE)
source_paths <- vapply(sys.frames(), function(frame) if (is.null(frame$ofile)) "" else as.character(frame$ofile)[1], character(1))
source_paths <- source_paths[nzchar(source_paths)]
if (length(source_paths)) {
  script_path <- tail(source_paths, 1)
} else if (length(script_arg) == 1L) {
  script_path <- sub("^--file=", "", script_arg)
} else stop("Open this saved file in RStudio and use Source (not Run Selection), or run it with Rscript.")
lab_dir <- dirname(normalizePath(script_path, winslash = "/", mustWork = TRUE))
if (!requireNamespace("lavaan", quietly = TRUE)) stop("Dependency missing: lavaan. Ask your instructor to install lavaan; this script never installs packages automatically.")
suppressPackageStartupMessages(library(lavaan))
set.seed(1151011)
read_lab <- function(name) {
  path <- file.path(lab_dir, name)
  if (!file.exists(path)) stop("Missing input: ", name, ". Run generate_data.R first.")
  x <- read.csv(path, na.strings = "-9", check.names = FALSE)
  if (anyDuplicated(x$id) || !all(x$synthetic)) stop("Expected unique IDs and synthetic=TRUE.")
  x
}
sport <- read_lab("synthetic_sport.csv")
school <- read_lab("synthetic_school_wide.csv")
sport_items <- c(paste0("aut_", 1:3), paste0("ctl_", 1:3), paste0("amo_", 1:3), paste0("vit_", 1:3))
school_items <- unlist(lapply(0:3, function(t) paste0("psc_t", t, "_", 1:3)))
stopifnot(nrow(sport) == 300L, nrow(school) == 500L, all(sport_items %in% names(sport)), all(school_items %in% names(school)))
for (x in list(sport, school)) {
  if (!all(x$sex %in% 0:1) || !all(x$elite %in% 0:1) || !all(x$cohort_group %in% 1:2)) stop("Invalid group/covariate codes.")
}

# Stop on convergence/admissibility failures rather than display misleading results.
safe_fit <- function(id, expr) {
  fit <- eval.parent(substitute(expr))
  if (!isTRUE(lavInspect(fit, "converged"))) stop(id, ": model did not converge; no new result files written.")
  if (!isTRUE(lavInspect(fit, "post.check"))) stop(id, ": inadmissible solution; no new result files written.")
  se <- parameterEstimates(fit)$se
  if (any(!is.finite(se))) stop(id, ": invalid standard errors; no new result files written.")
  fit
}
measurement <- '
autonomy =~ aut_1 + aut_2 + aut_3
controlled =~ ctl_1 + ctl_2 + ctl_3
disengagement =~ amo_1 + amo_2 + amo_3
vitality =~ vit_1 + vit_2 + vit_3
'
fits <- list()
fits$sport_cfa <- safe_fit("sport_cfa", cfa(measurement, data = sport, estimator = "MLR", missing = "fiml"))
fits$sport_sem <- safe_fit("sport_sem", sem(paste(measurement, 'vitality ~ autonomy + controlled + disengagement', sep = "\n"), data = sport, estimator = "MLR", missing = "fiml"))

# Base-R maximum likelihood EFA: complete-case analysis, not FIML.
efa_columns <- sport_items[1:9]
efa_complete <- complete.cases(sport[, efa_columns])
efa <- factanal(sport[efa_complete, efa_columns], factors = 3, rotation = "varimax", scores = "none")
efa_loadings <- data.frame(item = rownames(efa$loadings), unclass(efa$loadings), uniqueness = efa$uniquenesses, check.names = FALSE)

# Baseline model is used later in MIMIC. sex and elite remain distinct.
baseline <- 'f =~ psc_t0_1 + psc_t0_2 + psc_t0_3'

# Longitudinal invariance: same-indicator residuals correlate across all waves.
# First loading fixes the scale at each wave; scalar model frees later means.
long_model <- function(stage) {
  metric <- stage != "configural"
  scalar <- stage %in% c("scalar", "strict")
  strict <- stage == "strict"
  out <- character()
  for (t in 0:3) {
    out <- c(out, sprintf("f%d =~ 1*psc_t%d_1 + %spsc_t%d_2 + %spsc_t%d_3", t, t, if (metric) "l2*" else "", t, if (metric) "l3*" else "", t))
    if (scalar) {
      for (k in 1:3) out <- c(out, sprintf("psc_t%d_%d ~ i%d*1", t, k, k))
      out <- c(out, sprintf("f%d ~ %s*1", t, if (t == 0) "0" else "NA"))
    }
    if (strict) for (k in 1:3) out <- c(out, sprintf("psc_t%d_%d ~~ e%d*psc_t%d_%d", t, k, k, t, k))
  }
  for (k in 1:3) for (a in 0:2) for (b in (a + 1):3) out <- c(out, sprintf("psc_t%d_%d ~~ psc_t%d_%d", a, k, b, k))
  paste(out, collapse = "\n")
}
# Cross-group comparisons use all four-wave factors. Three indicators and
# one factor alone are saturated, so baseline configural fit cannot diagnose fit.
for (stage in c("configural", "metric", "scalar", "strict")) {
  equal <- switch(stage, configural = character(), metric = "loadings", scalar = c("loadings", "intercepts"), strict = c("loadings", "intercepts", "residuals"))
  id <- paste0("group_", stage)
  fits[[id]] <- safe_fit(id, cfa(long_model("configural"), data = school, group = "elite", group.equal = equal, estimator = "MLR", missing = "fiml", meanstructure = TRUE))
}
for (stage in c("configural", "metric", "scalar", "strict")) {
  id <- paste0("time_", stage)
  fits[[id]] <- safe_fit(id, cfa(long_model(stage), data = school, estimator = "MLR", missing = "fiml", meanstructure = TRUE))
}

# MIMIC is an illustration of latent regression; not a substitute for DIF testing.
school$age_c <- school$age - mean(school$age)
school$cohort_c <- school$cohort_group - 1
fits$mimic <- safe_fit("mimic", sem(paste(baseline, 'f ~ age_c + sex + elite + cohort_c', sep = "\n"), data = school, estimator = "MLR", missing = "fiml", meanstructure = TRUE, fixed.x = TRUE))

# Simplified growth uses >=2-of-3 indicator means at each wave.
# This is composite growth, not a full second-order latent growth model.
for (t in 0:3) {
  values <- school[, paste0("psc_t", t, "_", 1:3)]
  score <- rowMeans(values, na.rm = TRUE)
  score[rowSums(!is.na(values)) < 2] <- NA_real_
  school[[paste0("score_t", t)]] <- score
}
growth_model <- '
intercept =~ 1*score_t0 + 1*score_t1 + 1*score_t2 + 1*score_t3
slope =~ 0*score_t0 + 1*score_t1 + 2*score_t2 + 3*score_t3
'
fits$growth <- safe_fit("growth", growth(growth_model, data = school, estimator = "MLR", missing = "fiml"))

labels <- c(sport_cfa = "運動動機與活力 CFA", sport_sem = "動機→活力 SEM", group_configural = "跨 elite 組：形態", group_metric = "跨 elite 組：負荷", group_scalar = "跨 elite 組：截距", group_strict = "跨 elite 組：殘差", time_configural = "跨時間：形態", time_metric = "跨時間：負荷", time_scalar = "跨時間：截距", time_strict = "跨時間：殘差", mimic = "基線 MIMIC", growth = "合成指標簡化成長模型")
fit_rows <- lapply(names(fits), function(id) {
  fm <- fitMeasures(fits[[id]], c("cfi.robust", "rmsea.robust", "srmr", "df.scaled", "chisq.scaled", "pvalue.scaled"))
  if (any(!is.finite(fm))) stop(id, ": missing robust fit measures; no new result files written.")
  data.frame(id, label = unname(labels[id]), dataset = if (startsWith(id, "sport")) "sport" else "school", n = sum(lavInspect(fits[[id]], "nobs")), estimator = "MLR", converged = TRUE, cfi = fm[1], rmsea = fm[2], srmr = fm[3], df = fm[4], chisq = fm[5], pvalue = fm[6], row.names = NULL)
})
results <- do.call(rbind, fit_rows)
comparisons <- do.call(rbind, lapply(c("group", "time"), function(prefix) {
  stages <- c("configural", "metric", "scalar", "strict")
  do.call(rbind, lapply(2:4, function(i) {
    from <- paste0(prefix, "_", stages[i - 1])
    to <- paste0(prefix, "_", stages[i])
    a <- results[results$id == from, ]
    b <- results[results$id == to, ]
    data.frame(id = paste0(prefix, "_", stages[i], "_vs_", stages[i - 1]), from, to, deltaCFI = b$cfi - a$cfi, deltaRMSEA = b$rmsea - a$rmsea, definition = "restricted minus less restricted; robust CFI/RMSEA")
  }))
}))
param_frames <- lapply(names(fits), function(id) {
  p <- parameterEstimates(fits[[id]], standardized = TRUE, ci = TRUE)
  p$model_id <- id
  p
})
param_columns <- unique(unlist(lapply(param_frames, names)))
all_params <- do.call(rbind, lapply(param_frames, function(p) {
  for (column in setdiff(param_columns, names(p))) p[[column]] <- NA
  p[, param_columns]
}))
paths <- all_params[all_params$model_id %in% c("sport_sem", "mimic") & all_params$op == "~", c("model_id", "lhs", "op", "rhs", "est", "se", "z", "pvalue", "ci.lower", "ci.upper", "std.all")]
growth_parameters <- all_params[all_params$model_id == "growth" & all_params$lhs %in% c("intercept", "slope") & all_params$op %in% c("~1", "~~"), c("model_id", "lhs", "op", "rhs", "est", "se", "pvalue", "ci.lower", "ci.upper")]
growth_mean_i <- growth_parameters$est[growth_parameters$lhs == "intercept" & growth_parameters$op == "~1"]
growth_mean_s <- growth_parameters$est[growth_parameters$lhs == "slope" & growth_parameters$op == "~1"]
orthogonal <- poly(0:3, degree = 2)
stopifnot(max(abs(crossprod(orthogonal) - diag(2))) < 1e-10)
time_basis <- data.frame(time = 0:3, centered_at_last = -3:0, orthogonal_linear = orthogonal[, 1], orthogonal_quadratic = orthogonal[, 2], baseline_intercept = growth_mean_i, last_wave_intercept = growth_mean_i + 3 * growth_mean_s, slope = growth_mean_s, predicted_baseline_coding = growth_mean_i + (0:3) * growth_mean_s, predicted_last_coding = growth_mean_i + 3 * growth_mean_s + (-3:0) * growth_mean_s)
stopifnot(max(abs(time_basis$predicted_baseline_coding - time_basis$predicted_last_coding)) < 1e-10)
dataset_rows <- list(
  list(id = "sport", n = nrow(sport), variables = length(sport_items), missing = sum(is.na(sport[, sport_items])), cells = nrow(sport) * length(sport_items), completeCases = sum(complete.cases(sport[, sport_items]))),
  list(id = "school", n = nrow(school), variables = length(school_items), missing = sum(is.na(school[, school_items])), cells = nrow(school) * length(school_items), completeCases = sum(complete.cases(school[, school_items])))
)

# Minimal dependency-free JSON serialization for a finite, known output schema.
json_quote <- function(s) {
  s <- gsub("\\", "\\\\", enc2utf8(s), fixed = TRUE)
  s <- gsub('"', '\\"', s, fixed = TRUE)
  s <- gsub("\n", "\\n", s, fixed = TRUE)
  s <- gsub("\r", "\\r", s, fixed = TRUE)
  s <- gsub("\t", "\\t", s, fixed = TRUE)
  paste0('"', s, '"')
}
to_json <- function(x) {
  if (is.null(x)) return("null")
  if (is.data.frame(x)) return(to_json(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE]))))
  if (is.list(x)) {
    if (!is.null(names(x))) return(paste0("{", paste(paste0(json_quote(names(x)), ":", vapply(x, to_json, character(1))), collapse = ","), "}"))
    return(paste0("[", paste(vapply(x, to_json, character(1)), collapse = ","), "]"))
  }
  if (length(x) != 1L) return(to_json(as.list(unname(x))))
  if (is.na(x)) return("null")
  if (is.character(x)) return(json_quote(x))
  if (is.logical(x)) return(if (x) "true" else "false")
  if (!is.finite(x)) stop("Refusing nonfinite JSON output.")
  sprintf("%.12g", x)
}
notes <- c(
  "全部為 seed=1151011 產生的連續合成指標，並非 BREQ／SVS 原始題目、原研究個案或原研究結果。",
  "CSV 缺失碼 -9 轉為 NA。MLR 模型使用 FIML，EFA 使用九個動機指標的完整個案；缺失機制是生成器的隨機缺失，真實研究仍須評估假設。",
  "CFI/RMSEA 全部使用 lavaan robust 指標；chisq/df/pvalue 使用 scaled 指標；SRMR 為未標示 robust 的 SRMR。不可跨不同指標版本混算 Δ。",
  "ΔCFI＝較嚴格模型減較寬鬆模型，負值表示 CFI 降低。ΔRMSEA 同方向相減；正值表示 RMSEA 增加。數值需配合模型、理論及樣本判讀，沒有自動通過／失敗門檻。",
  "本seed八個恆等性模型CFI截在1、RMSEA截在0，六列Δ為0；樣本卡方小於自由度與指標截斷會造成此結果，不能據此宣稱完美配適或普遍完全恆等。",
  "跨群組以 elite 分組，sex 另為合成二元共變項；elite 絕不是性別。群組指標不映射真實人物。",
  "MIMIC 此例只示範潛在回歸，未設定指標直接效果，不能據此宣稱無 DIF 或完整測量恆等性。",
  "成長模型使用每波至少2題的平均作為觀察指標，並非完整多指標二階潛在成長、原文 Mplus 模型或因果模型。每一波 time 單位為一年。",
  "兩組 cohort_group 僅為玩具世代標記；未重現完整世代序列設計、原始插補、多重插補合併推論或正交多項式整套原研究分析。",
  "EFA varimax 的因素順序及正負號沒有固有意義，不能將 Factor1 的固定名稱硬解釋為某構念。"
)
payload <- list(generatedAt = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z", tz = "Asia/Taipei"), synthetic = TRUE, seed = 1151011, software = list(R = as.character(getRversion()), lavaan = as.character(packageVersion("lavaan"))), datasets = dataset_rows, models = results, comparisons = comparisons, efa = list(n = sum(efa_complete), factors = 3, rotation = "varimax", chisq = unname(efa$STATISTIC), df = unname(efa$dof), pvalue = unname(efa$PVAL), loadings = efa_loadings), semPaths = paths[paths$model_id == "sport_sem", ], mimicPaths = paths[paths$model_id == "mimic", ], growthParameters = growth_parameters, growthCoding = time_basis, growthMissing = sum(is.na(school[, paste0("score_t", 0:3)])), notes = notes)
write_csv <- function(x, filename) write.table(x, file.path(lab_dir, filename), sep = ",", row.names = FALSE, quote = TRUE, fileEncoding = "UTF-8", na = "")
# Write only after every fit/check succeeded.
write_csv(results, "results.csv")
write_csv(comparisons, "invariance_comparisons.csv")
write_csv(efa_loadings, "efa_loadings.csv")
write_csv(paths, "regression_paths.csv")
write_csv(growth_parameters, "growth_parameters.csv")
write_csv(time_basis, "time_basis.csv")
write_csv(all_params, "model_parameters.csv")
writeLines(to_json(payload), file.path(lab_dir, "..", "data", "lab-results.json"), useBytes = TRUE)
writeLines(c("SYNTHETIC ONLY — generated and fitted locally; not original-study replication.", paste0("Seed: ", payload$seed), paste0("R: ", payload$software$R, "; lavaan: ", payload$software$lavaan), paste0("Verified models: ", nrow(results), "; all converged and post.check TRUE; finite SE and robust fit measures."), paste0("Sport missing indicator cells: ", dataset_rows[[1]]$missing, "/", dataset_rows[[1]]$cells, "; EFA complete-case N: ", sum(efa_complete)), paste0("School missing indicator cells: ", dataset_rows[[2]]$missing, "/", dataset_rows[[2]]$cells), "All displayed CFI/RMSEA are robust; SRMR is ordinary SRMR.", "Review README and codebook before interpretation.", capture.output(print(results, row.names = FALSE)), capture.output(print(comparisons, row.names = FALSE))), file.path(lab_dir, "verification_record.txt"), useBytes = TRUE)
cat("All 12 synthetic models converged with admissible solutions. Results and web JSON written.\n")
print(results, row.names = FALSE)
