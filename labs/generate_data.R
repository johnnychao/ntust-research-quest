# ALL DATA ARE SYNTHETIC. No participant records or scale item wording are used.
# Run from any working directory: Rscript path/to/labs/generate_data.R
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
set.seed(1151011)
missing_code <- -9
add_missing <- function(x, rate) {
  mask <- matrix(runif(length(x)) < rate, nrow(x), ncol(x))
  x[mask] <- missing_code
  x
}
write_csv <- function(x, filename) write.table(x, file.path(lab_dir, filename), sep = ",", row.names = FALSE, col.names = TRUE, quote = TRUE, fileEncoding = "UTF-8", na = "-9")

# Continuous toy indicators, not BREQ/SVS questionnaire responses.
n <- 300L
sex <- sample(0:1, n, replace = TRUE)
elite <- rbinom(n, 1, .28)
cohort_group <- sample(1:2, n, replace = TRUE)
age <- sample(20:65, n, replace = TRUE)
sigma <- matrix(c(1, .30, -.25, .30, 1, .20, -.25, .20, 1), 3, 3)
latent <- matrix(rnorm(n * 3), n, 3) %*% chol(sigma)
colnames(latent) <- c("autonomy", "pressure", "disengagement")
vitality <- .55 * latent[, 1] - .15 * latent[, 2] - .35 * latent[, 3] + rnorm(n, 0, .75)
items <- matrix(NA_real_, n, 12)
for (j in 1:3) for (k in 1:3) items[, (j - 1) * 3 + k] <- 5 + c(1, .85, 1.1)[k] * latent[, j] + rnorm(n, 0, .55)
for (k in 1:3) items[, 9 + k] <- 5 + c(1, .9, 1.05)[k] * vitality + rnorm(n, 0, .50)
items <- round(add_missing(items, .04), 6)
colnames(items) <- c(paste0("aut_", 1:3), paste0("ctl_", 1:3), paste0("amo_", 1:3), paste0("vit_", 1:3))
sport <- data.frame(id = sprintf("SYN_S%03d", seq_len(n)), synthetic = TRUE, age, sex, elite, cohort_group, time = 0L, missingCode = missing_code, items, check.names = FALSE)
write_csv(sport, "synthetic_sport.csv")

# Four-wave toy cohort. Measurement parameters are invariant by construction.
n <- 500L
sex <- sample(0:1, n, replace = TRUE)
elite <- rbinom(n, 1, .30)
cohort_group <- sample(1:2, n, replace = TRUE)
age <- sample(12:17, n, replace = TRUE) + 2 * (cohort_group - 1)
intercept <- .22 * sex + .40 * elite + .12 * (age - mean(age)) + .20 * (cohort_group - 1) + rnorm(n, 0, .85)
slope <- .18 - .025 * (age - mean(age)) + .07 * elite + .09 * sex + .12 * (intercept - mean(intercept)) + rnorm(n, 0, .17)
method <- matrix(rnorm(n * 3, 0, .18), n, 3)
school_items <- matrix(NA_real_, n, 12)
for (t in 0:3) {
  # Wave-specific fluctuations avoid a rank-2 latent covariance matrix.
  wave <- intercept + t * slope + rnorm(n, 0, .30)
  for (k in 1:3) school_items[, t * 3 + k] <- c(4, 4.25, 3.75)[k] + c(1, .9, 1.1)[k] * wave + method[, k] + rnorm(n, 0, .40)
}
school_items <- round(add_missing(school_items, .05), 6)
colnames(school_items) <- unlist(lapply(0:3, function(t) paste0("psc_t", t, "_", 1:3)))
school <- data.frame(id = sprintf("SYN_C%03d", seq_len(n)), synthetic = TRUE, age, sex, elite, cohort_group, time = 0L, missingCode = missing_code, school_items, check.names = FALSE)
write_csv(school, "synthetic_school_wide.csv")
school_long <- do.call(rbind, lapply(0:3, function(t) data.frame(id = school$id, synthetic = TRUE, age = school$age + t, baseline_age = school$age, sex, elite, cohort_group, time = t, missingCode = missing_code, psc_1 = school_items[, t * 3 + 1], psc_2 = school_items[, t * 3 + 2], psc_3 = school_items[, t * 3 + 3])))
write_csv(school_long, "synthetic_school_long.csv")
cat("Created SYNTHETIC ONLY: sport 300 rows; school wide 500 rows; school long 2000 rows. Seed = 1151011.\n")
