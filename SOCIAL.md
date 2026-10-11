# Launch posts

## X: launch (attach the vertical cut `vakeel-short.mp4`)

```
Every coal plant in India needs a clearance. The file is 246 pages. Nobody reads it.

So we built Vakeel: AI agents on @awscloud Bedrock read the filing, prove every number against the page, and help people object before it's approved.

Live: https://d4i9n8m04ddaa.cloudfront.net
#BharatBuilds @WeMakeDevs
```

## X: reply thread (posted under the launch tweet)

```
1/ What it found in one real government file (EAC Thermal, 20 Jun 2025):
• 1,320 MW Adani Power expansion, public hearing exempted, recommended
• 104,110 m³ of river water a day, enough for 7.7 lakh people
• ~₹4,887 crore/yr of climate damage (our estimate from published factors)
```

```
2/ The AI isn't allowed to make anything up. Every claim needs a word-for-word quote + page, and code checks it against the PDF. ~40 claims it couldn't prove were thrown away and shown in a "what Vakeel refused to tell you" list.
```

```
3/ Nothing is filed without a human. Step Functions waits (waitForTaskToken) until a resident reads the letter and types the exact sentence to sign. The letter gets a SHA-256 receipt.
```

```
4/ Built on Amazon Bedrock (Nova 2 Lite), Step Functions, Lambda, DynamoDB, S3, CloudFront, Polly. Code + write-ups ↓
```

## LinkedIn (attach the main 16:9 film)

```
On 20 June 2025, a government committee met to decide the future of six coal power plants. Its minutes are public: 246 pages.

On page 18, a 1,320 MW coal expansion, 2.2 km from a reserved forest, was exempted from its public hearing. On page 25, it was recommended.

Nobody objected, because nobody could read it.

For Environmental Hacks (#BharatBuilds, powered by AWS) we built Vakeel (Hindi for "advocate"):
→ Step Functions sends one Amazon Bedrock agent per project in the filing; 246 pages are read in under a minute
→ every number must come with a word-for-word quote and page, and is verified in code against the PDF
→ plain-language warnings in English, Hindi and the state's language, with costs computed by code from published factors
→ a formal objection drafted from the committee's own record, which can't be filed until a real person signs it

Live: https://d4i9n8m04ddaa.cloudfront.net

@WeMakeDevs @Amazon Web Services (AWS) #AWS #AmazonBedrock #BharatBuilds #ClimateTech
```
