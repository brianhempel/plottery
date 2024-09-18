# CHI 2025 Submission 3615 Supplementary Materials

This is the replication package for the user study in the CHI 2025 submission 3615 "Plottery: Sculpting Plots with Code, GUI, and AI". It is best reading the paper first before walking through this package.

The package contains two directories as follows:
1. `study-starter`: starter notebooks for the study
2. `study-sol`: notebooks with sample solutions for the tasks
3. `surveys`: pdfs of post-task and post-study surveys

## Tasks
We used three tasks across the study:
- (T1) Box Plot - Part I: given 10 data records of time values from two experimental groups and the time limit data, create a box plot of time values for each group, a horizontal line with a value closed to the time limit, and a plot title (Modified from https://osf.io/nvmdb)
- (T2) Box Plot - Part II: based on the plot from T1, and 10 data records of the task success of the corresponding experiment subjects, add an overlay of scatter plot using the time values and color-coded with the task success (Modified from https://osf.io/nvmdb)
- (T3) Sound Waves Plot: given data of four wave forms represented as numpy arrays, create two vertically stacked subplots where the top plot displays the sine and square waves and the bottom shows the triangle and sawtooth waves.

Among the tasks, T1 and T2 were in one notebook named `Boxplot-starter.ipynb` as they were interconnected; T3 was in its own notebook named `Sound-waves-starter.ipynb`. Additionally, there was a tutorial task in its own notebook named `Tutorial-starter.ipynb`.

## Study Procedure and Data Collection 
The study was conducted in person, with the tool used in the study running on the interviewer's computer in a web browser. Each session lasted no more than 90 minutes and included four sections: a tutorial (10 mins), T1 (10 mins), T2 (10 mins), T3 (15 min), and a post-study survey that moderated a semi-structured interview (20 mins). Each task was also followed by a post-task survey with the same questions where participants self-rated their cognitive load post each task.

There were three conditions in the study for completing three tasks. While all conditions allow participants to edit code directly and/or use Google search, they differ as follows: (C1) In _AI+Code_, participants could prompt the AI assistant in \sys but not use the GUI; (C2) In _GUI+Code_, they could use the GUI in \sys but not the AI assistant; (C3) In _Mixed_, they could use all modalities freely. C1 and C2 were meant for the participants to use the novel modalities of Plottery individually---GUI or AI. With the established familiarity with each modality, C3 could thus enable a more natural use of all modalities.

We followed a \emph{within-subjects} design for T1 and T2. As such, T1 and T2 were done in either condition C1 or C2 and task T3 in condition C3. Since all participants did the tasks following the order of T1, T2, T3, this led to two possible groups: T1C1-T2C2-T3C3 and T1C2-T2C1-T3C3.

We collected the following data throughout the study:

1. The tutorial was self-explanatory and guided participants to make a bar chart using different modalities in Plottery. Since the tutorial contained detailed instructions, participants followed the tutorial themselves, but throughout the tutorial, they could ask the interviewer any question, and the interviewer could interrupt if they observed any misunderstood usage of Plottery or the tutorial.

2. Participants completed the three tasks; T1 and T2 each had a 10-min limit, while T3 had a 15-min limit due to its increased complexity (making a plot with subplots). Each task notebook included cells of necessary imports and data definitions, a task description and an expected output plot, and a starter code cell for triggering Plottery. For each task, we recorded the correctness of the final code. Although we also measured participants' cognitive load via five NASA Task Load Index questions (TLX) from the post-task survey, we only used these measurements as a sanity check for task difficulty and did not use such data to answer our research questions.

3. We asked participants to reflect on the various Plottery features in a post-study survey. The survey included solely open-ended questions to facilitate a semi-structured interview.

4. In addition, to compute the interaction time and counts of each modality (GUI, AI, and code) in Plottery, one author revisited the video recordings of task T3 to capture the onset and ending timestamps of each modality interaction. Note that a modality interaction could include activities relevant to using modality (e.g., searching the web to figure out what code to write, reading data definitions and task instructions to figure out what properties to change in the GUI). 


## Requirements
- The starter/sol notebooks are currently read-only because they assume that the source of Plottery is available, and that they are located one level below the source directory. We will update the notebooks after open sourcing Plottery.
- To use the AI assistant in Plottery (based on GPT-4o), one needs to configure their own OpenAI API key as an environment variable, i.e., setting `OPENAI_API_KEY=yourKeyHere` before running `jupyter notebook`.