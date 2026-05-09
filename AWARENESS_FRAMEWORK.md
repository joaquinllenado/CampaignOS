Awareness Intelligence Framework — Variable Definitions & Plain-English Descriptions (V1)
Objective Definition
Awareness Objective
The goal of an awareness campaign is to maximize:
visibility


audience penetration


creator amplification


attention capture


sustained reach momentum


The awareness framework evaluates:
how broadly content spreads


how efficiently creators amplify messaging


whether audiences meaningfully engage with content


whether awareness is sustained or passive


The framework intentionally separates:
baseline visibility


strong awareness


breakout amplification


to avoid overfitting to viral outliers.

Awareness Evaluation Structure
Layer
Purpose
Reach Quality
Visibility strength
Engagement Density
Audience resonance
Amplification Efficiency
Creator/network spread
Consistency
Stability over time
Breakout Potential
Viral amplification


1. Reach Quality Layer
Purpose
Measures how effectively content generates visibility and audience exposure.
This layer evaluates:
reach scale


content exposure


creator distribution breadth


top-of-funnel penetration



Variables

views
Data Dictionary Definition
Total views at the individual video level.
Source:
Video Metrics → views

Plain-English Meaning
How many times a TikTok video was watched.
This is the primary awareness signal because it measures:
exposure


audience reach


visibility scale



Why It Matters
Higher views generally indicate:
stronger awareness distribution


broader audience penetration


more successful top-of-funnel exposure


However:
views alone do not guarantee:
engagement


resonance


conversion



video_views
Data Dictionary Definition
Aggregate total views across all videos in a campaign or time period.
Source:
Time Series Metrics → video_views

Plain-English Meaning
The total amount of visibility generated across all campaign content over time.
While views measures one video,
video_views measures:
campaign-wide awareness


cumulative exposure


momentum across the campaign



Why It Matters
Helps measure:
sustained awareness


campaign visibility growth


momentum over time



creators_reached
Data Dictionary Definition
Number of creators contacted or reached through outreach activity.
Source:
Summary Metrics / Time Series Metrics → creators_reached

Plain-English Meaning
How many creators the brand attempted to activate for the campaign.
This measures:
creator network expansion


outreach breadth


amplification opportunity



Why It Matters
Awareness campaigns often depend on:
broad creator participation


creator distribution scale


multi-creator amplification



videos_posted
Data Dictionary Definition
Number of TikTok videos published during the reporting period.
Source:
Summary Metrics / Time Series Metrics → videos_posted

Plain-English Meaning
How much content was created for the campaign.
This represents:
content volume


posting activity


campaign output



Why It Matters
More content increases opportunities for:
awareness amplification


algorithmic distribution


breakout content


But:
high posting volume without engagement may indicate:
low-quality awareness


weak creator fit



new_creators_posting
Data Dictionary Definition
Number of newly active creators posting campaign content.
Source:
Summary Metrics → new_creators_posting

Plain-English Meaning
How many new creators started participating in the campaign.
This measures:
creator activation


network growth


campaign expansion



Why It Matters
Strong awareness campaigns often:
activate new creator audiences


expand distribution beyond existing creator relationships


increase network reach



Reach Quality Benchmark Bands
Band
Percentile
Interpretation
Weak
P0–P25
Low visibility
Baseline
P25–P50
Expected awareness
Healthy
P50–P75
Stable awareness
Strong
P75–P90
High visibility
Exceptional
P90–P95
Breakout awareness
Viral
P95+
Outlier amplification


2. Engagement Density Layer
Purpose
Measures audience resonance and interaction quality.
The framework assumes:
awareness without interaction is weak awareness.
This layer evaluates whether:
audiences respond


content resonates


awareness is active rather than passive



Variables

like_count
Data Dictionary Definition
Number of likes on a video.
Source:
Video Intelligence Metrics → likes

Plain-English Meaning
How many viewers reacted positively to the content.
Likes are:
lightweight engagement signals


indicators of surface-level resonance



Why It Matters
Higher likes generally suggest:
audience approval


strong content appeal


positive initial attention


However:
likes alone are often passive and should not dominate scoring.

comment_count
Data Dictionary Definition
Number of comments on a video.
Source:
Video Metrics → comment_count

Plain-English Meaning
How many viewers actively interacted with the content through conversation.
Comments indicate:
stronger engagement


deeper audience attention


community interaction



Why It Matters
Comments are a stronger awareness-quality signal than likes because they require:
intentional interaction


emotional response


audience participation



engagement_rate
Data Dictionary Definition
Derived metric:
(likes + comments) / views

Plain-English Meaning
The percentage of viewers who interacted with the content.
This measures:
awareness quality


resonance efficiency


audience participation



Formula
Engagement\ Rate = \frac{Likes + Comments}{Views}

Why It Matters
High awareness with weak engagement often indicates:
passive scrolling


weak content resonance


low memorability


Strong engagement density suggests:
stronger audience connection


stronger awareness quality



comments_per_view
Data Dictionary Definition
Derived metric:
comments / views

Plain-English Meaning
How much discussion content generates relative to its visibility.
This measures:
conversation density


audience activation


engagement depth



Why It Matters
Some content gets:
high views


low meaningful interaction


Comments per view helps identify:
awareness quality


resonance strength


active audience participation



3. Amplification Efficiency Layer
Purpose
Measures how effectively creators amplify campaign visibility across the network.
This layer evaluates:
creator participation


creator distribution breadth


creator activation efficiency


awareness scalability



Variables

active_creators
Data Dictionary Definition
Distinct creators generating activity during the reporting period.
Source:
Summary Metrics → active_creators

Plain-English Meaning
How many creators actively participated in the campaign.
This measures:
creator engagement


campaign participation


amplification network size



Why It Matters
Awareness campaigns rely heavily on:
creator participation


creator diversity


network expansion



creators_messaged
Data Dictionary Definition
Number of creators contacted through outreach messaging.
Source:
Summary Metrics → creators_messaged

Plain-English Meaning
How many creators received campaign outreach.
This measures:
outreach scale


campaign activation effort


creator recruitment attempts



Why It Matters
Helps evaluate:
outreach efficiency


creator conversion


campaign scaling potential



tc_invites_sent
Data Dictionary Definition
Number of target collaboration invitations sent.
Source:
Summary Metrics → tc_invites_sent

Plain-English Meaning
How many formal creator collaboration invitations were issued.
This measures:
collaboration activity


creator partnership expansion


campaign recruiting effort



Why It Matters
Strong awareness campaigns often require:
scalable creator onboarding


broad creator collaboration


efficient creator activation



Derived Metrics

Creator Amplification
Formula
Creator\ Amplification = \frac{Total\ Views}{Active\ Creators}

Plain-English Meaning
How much awareness each creator generates on average.
This measures:
creator efficiency


creator visibility impact


amplification power



Creator Activation Rate
Formula
Creator\ Activation\ Rate = \frac{New\ Creators\ Posting}{Active\ Creators}

Plain-English Meaning
How effectively the campaign activates new creators into participation.
This measures:
campaign expansion


creator onboarding effectiveness


awareness scalability



4. Consistency Layer
Purpose
Measures stability and repeatability of awareness performance over time.
The framework prioritizes:
sustained awareness
over:
isolated viral spikes.

Variables

daily_video_views
Data Dictionary Definition
Daily aggregate video views from time-series metrics.
Source:
Time Series Metrics → video_views

Plain-English Meaning
How much awareness the campaign generates each day.
This measures:
awareness momentum


visibility stability


campaign consistency



Why It Matters
Healthy awareness campaigns should sustain:
visibility


engagement


creator participation


rather than relying on:
one-day spikes


short-lived virality



posting_frequency
Data Dictionary Definition
Derived metric:
videos_posted over time.

Plain-English Meaning
How often campaign content is published.
This measures:
campaign cadence


content consistency


distribution frequency



Why It Matters
Consistent posting often improves:
algorithmic distribution


audience recall


sustained awareness



5. Breakout Potential Layer
Purpose
Measures exceptional awareness amplification and viral acceleration.
This layer is intentionally weighted lower to avoid overfitting.

Variables

breakout_views
Data Dictionary Definition
Videos performing above P90/P95 view thresholds.
Derived from:
Video Metrics → views

Plain-English Meaning
Videos generating unusually high visibility relative to the dataset.
This represents:
viral amplification


trend acceleration


exceptional reach



Why It Matters
Breakout content can dramatically increase:
awareness scale


creator exposure


campaign momentum


However:
viral spikes should not dominate campaign evaluation.

awareness_velocity
Data Dictionary Definition
Rate of awareness growth over time.
Derived from:
Time Series Metrics

Plain-English Meaning
How quickly awareness grows or declines during a campaign.
This measures:
momentum


acceleration


trend formation



Why It Matters
Strong awareness campaigns often show:
sustained momentum


repeated engagement spikes


ongoing creator participation


rather than:
one-time visibility bursts.



