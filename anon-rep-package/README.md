# CHI 2025 Submission 3615 Supplementary Materials

This is the replication package for the user study in the CHI 2025 submission 3615 "Plottery: Sculpting Plots with Code, GUI, and AI". It is best to read the paper first before walking through this package.

The package contains four directories and two files as follows:
1. `study1-procedure.pdf`: detailed procedure of Study 1 (first part of the user study)
1. `study1-starter`: starter notebooks for Study 1 (first part of the user study)
2. `study1-sol`: notebooks with sample solutions for the tasks in Study 1
3. `study1-surveys`: pdfs of post-task and post-study surveys in Study 1
4. `study2-procedure.pdf`: detailed procedure of Study 2 (second part of the user study)
4. `study2-starter`: starter notebooks for Study 2 (second part of the user study)


This package does NOT contain the Plottery system. See `Requirements` below.

## Requirements
- The starter/sol notebooks are currently read-only because they assume that the source of Plottery is available, and that they are located one level below the source directory. We will update the notebooks after open sourcing Plottery.
- To use the AI assistant in Plottery (based on GPT-4o), one needs to configure their own OpenAI API key as an environment variable, i.e., setting `OPENAI_API_KEY=yourKeyHere` before running `jupyter notebook`.


## Study 1 Tasks
We used three tasks across the study:
- (T1) Box Plot - Part I: given 10 data records of time values from two experimental groups and the time limit data, create a box plot of time values for each group, a horizontal line with a value closed to the time limit, and a plot title (Modified from https://osf.io/nvmdb)
- (T2) Box Plot - Part II: based on the plot from T1, and 10 data records of the task success of the corresponding experiment subjects, add an overlay of scatter plot using the time values and color-coded with the task success (Modified from https://osf.io/nvmdb)
- (T3) Sound Waves Plot: given data of four wave forms represented as numpy arrays, create two vertically stacked subplots where the top plot displays the sine and square waves and the bottom shows the triangle and sawtooth waves.

Among the tasks, T1 and T2 were in one notebook named `Boxplot-starter.ipynb` as they were interconnected; T3 was in its own notebook named `Sound-waves-starter.ipynb`. Additionally, there was a tutorial task in its own notebook named `Tutorial-starter.ipynb`.

## Study1 Procedure and Data Collection 
The study was conducted in person, with the tool used in the study running on the interviewer's computer in a web browser. Each session lasted no more than 90 minutes and included four sections: a tutorial (10 mins), T1 (10 mins), T2 (10 mins), T3 (15 min), and a post-study survey that moderated a semi-structured interview (20 mins). Each task was also followed by a post-task survey with the same questions where participants self-rated their cognitive load post each task.

There were three conditions in the study for completing three tasks. While all conditions allow participants to edit code directly and/or use Google search, they differ as follows: (C1) In _AI+Code_, participants could prompt the AI assistant in Plottery but not use the GUI; (C2) In _GUI+Code_, they could use the GUI in Plottery but not the AI assistant; (C3) In _Mixed_, they could use all modalities freely. C1 and C2 were meant for the participants to use the novel modalities of Plottery individually---GUI or AI. With the established familiarity with each modality, C3 could thus enable a more natural use of all modalities.

We followed a _within-subjects_ design for T1 and T2. As such, T1 and T2 were done in either condition C1 or C2 and task T3 in condition C3. Since all participants did the tasks following the order of T1, T2, T3, this led to two possible groups: T1C1-T2C2-T3C3 and T1C2-T2C1-T3C3.

The first two authors ran all the studies.

For _quantitative_ analysis: 
(1) we noted down each task success during the study---we consider a task completed successfully if the participant created a plot with all the necessary components within the time limit (they were instructed not to worry about the plot scale or color shades);
(2) for T3, where code, AI and GUI were all allowed, we revisited the recordings to obtain the onset and ending timestamps of every modality interaction to compute the usage counts and durations for each modality as well as the counts for modality switches; we further coded the durations of the three stages in each AI modality use: typing, waiting for a response, and validating. 
Due to the small sample size, we attempted no statistical tests to detect any significance; rather, we report summary statistics combined with the qualitative data to analyze the use of Plottery.


Revisiting recordings nad post-surveys, we collected three kinds of _qualitative_ data:
(1) for what plot changes each modality was used: adding (visuals), removing, and restyling;
(2) reasons for modality switches: failure-driven or not;
(3) Plottery-related behaviors and comments: overall helpfulness of Plottery, overall frustrations, desired features, and comments specific to each modality.
For (1) and (2), we conducted top-down coding driven by the categories.
For (3), we first conducted open-coding on the data and iteratively merged codes, and then derived themes from codes and relevant data categories.



## Study 2 Tasks
We gathered five tasks adapted from the first author's work (four plots are unpublished, the remaining was anonymized). 

First, one plot served as as an informal refresher under the guidance of the facilitator: its authoring was divided into two parts which participants completed ablating either GUI or AI for each part (conditions C1-C2 or C2-C1, order counterbalanced) to encourage participants to practice the different modalities. The refresher took 25-40 minutes in total.

The remaining four plots were chosen to, collectively, cover the topics of the 20 most-visited pages on matplotlib.org (broad tutorial pages excluded), including e.g., histograms, colorbars, and images (`imshow`).
Participants attempted these tasks in a random counterbalanced order using all modalities freely (condition C3) without intervention from the facilitator. Each task was limited to 40mins, with a 5min break after the first task. The last 10 minutes before the two-hour session limit was devoted to a semi-structured interview. Given the long timeout and task difficulty, participants usually timed-out, completing ~1.5 to ~2.5 of the four tasks in total.



## Study 2 Procedure and Data Collection
The study was conducted in person, with the tool used in the study running on the interviewer's computer in a web browser. Each session lasted no more than 120 minutes and included three sections: a practice task (40 mins max), as many of the four tasks as time permitted (up to 10min before the end of the study, 40min max on each task), and a post-study semi-structured interview (10 mins).

There were three conditions in the study for completing tasks. The first two conditions were C1 and C2 from Study 1, used in the two parts of the practice task only. The third condition was C3 from Study 1, where participants were free to use all modalities, used in the four non-practice tasks. We randomized the order of C1 and C2 in the practice task. We also randomized the order of the four non-practice task so that each participant started with a different task.

The first author ran all the studies.
Participants spent around 25-40 minutes in on the practice tasks.
Up until 10 minutes before the two-hour limit, they worked on the four formal tasks, spending up to 40 minutes on each task.
We randomized the ordering of the four formal tasks so that each of the four participants started on a different task.
All participants took a 5-minute break after completing the first formal task.
In the last 10 minutes, they went through a semi-structured interview on the overall helpfulness of the tool, frustration, and specific modality use (same questions as the Study 1 post-survey questions), and additionally how much they tried to understand the Matplotlib code generated by Plottery.

We collected the same _quantitative_ data from Study 1 by instrumenting Plottery to record every user event.
Unlike in Study 1, where we revisited video recordings to code validation behaviors of AI-generated code, in Study 2 we used the time between when the AI-generated code was rendered and the next user event to indicate validation time.
For _qualitative_ analysis, we conducted top-down coding of the post-study interviews using themes emerged from Study 1, noticing no new themes.
