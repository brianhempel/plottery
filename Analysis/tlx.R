library(ggplot2)
library(dplyr)
library(rstatix)
library(grid)

cond_ai = 'No GUI'
cond_gui = 'No AI'
t1 = 'T1'
t2 = 'T2'
t3 = 'T3'

tlx_data <- read.csv('/Users/lisa/projects/sketch-neo-plot/Analysis/tlx-new.csv')
colnames(tlx_data) <- c("Timestamp", "ID", "Task", "Mental_Demand", "Hurry", "Performance", "Effort", "Frustration", "Condition")

### replace condition labels
# AI
tlx_data <- tlx_data %>%
  mutate(Condition = ifelse(Condition == "AI", cond_ai, Condition))
# GUI
tlx_data <- tlx_data %>%
  mutate(Condition = ifelse(Condition == "DM", cond_gui, Condition))

### replace task labels
# t1
tlx_data <- tlx_data %>%
  mutate(Task = ifelse(Task == "Boxplot - Task 1", t1, Task))
# t2
tlx_data <- tlx_data %>%
  mutate(Task = ifelse(Task == "Boxplot - Task 2", t2, Task))
# t3
tlx_data <- tlx_data %>%
  mutate(Task = ifelse(Task == "Soundwave", t3, Task))


### T1 data
t1 <- tlx_data[tlx_data$Task == t1, ]
# t1_no_gui <- tlx_data[tlx_data$Condition == cond_ai & tlx_data$Task == t1, ]
# # t1_no_gui
# t1_no_ai <- tlx_data[tlx_data$Condition == cond_gui & tlx_data$Task == t1, ] 
# t1_no_ai

#### T1 mental test
t1_mental_test <- wilcox.test(Mental_Demand~Condition, data=t1, exact=FALSE) # p=0.5192
t1_mental_effect <- wilcox_effsize(Mental_Demand~Condition, data=t1) # r = 0.238

#### T1 hurry test
t1_hurry_test <- wilcox.test(Hurry~Condition, data=t1, exact=FALSE) # p=0.7473
t1_hurry_effect <- wilcox_effsize(Hurry~Condition, data=t1) # r = 0.136

#### T1 Performance test
t1_performance_test <- wilcox.test(Performance~Condition, data=t1, exact=FALSE) # p=0.1558
t1_performance_effect <- wilcox_effsize(Performance~Condition, data=t1) # r = 0.483

#### T1 effort test
t1_effort_test <- wilcox.test(Effort~Condition, data=t1, exact=FALSE) # p=0.5165
t1_effort_effect <- wilcox_effsize(Effort~Condition, data=t1) # r = 0.239

#### T1 frustration test
t1_frustration_test <- wilcox.test(Frustration~Condition, data=t1, exact=FALSE) # p=0.1563
t1_frustration_effect <- wilcox_effsize(Frustration~Condition, data=t1) # r = 0.486



### T2 data
t2 <- tlx_data[tlx_data$Task == t2, ]

#### T2 mental test
t2_mental_test <- wilcox.test(Mental_Demand~Condition, data=t2, exact=FALSE) # p=0.3932
t2_mental_effect <- wilcox_effsize(Mental_Demand~Condition, data=t2) # r = 0.304

#### T2 hurry test
t2_hurry_test <- wilcox.test(Hurry~Condition, data=t2, exact=FALSE) # p=0.2858
t2_hurry_effect <- wilcox_effsize(Hurry~Condition, data=t2) # r = 0.371

#### T2 Performance test
t2_performance_test <- wilcox.test(Performance~Condition, data=t2, exact=FALSE) # p=0.2877
t2_performance_effect <- wilcox_effsize(Performance~Condition, data=t2) # r = 0.374

#### T2 effort test
t2_effort_test <- wilcox.test(Effort~Condition, data=t2, exact=FALSE) # p=0.3383
t2_effort_effect <- wilcox_effsize(Effort~Condition, data=t2) # r = 0.336

#### T2 frustration test
t2_frustration_test <- wilcox.test(Frustration~Condition, data=t2, exact=FALSE) # p=0.8294
t2_frustration_effect <- wilcox_effsize(Frustration~Condition, data=t2) # r = 0.102




tlx_data

