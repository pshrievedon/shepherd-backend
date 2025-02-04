// index.js (Replit server)
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running!");
});

/**
 * Analyze the scraped profile data using simple heuristics.
 * This function examines account age, recent comment length,
 * and profile description.
 */
function analyzeProfile(profileData) {
  let analysisDetails = {
    content_analysis: { score: 0, description: "" },
    engagement_with_users: { score: 0, description: "" },
    profile_metadata: { score: 0, description: "" },
  };

  // --- Engagement Analysis: Account Age ---
  // Assume profileData.accountAge is a string like "Joined 3 years ago"
  let years = 0;
  const match = profileData.accountAge.match(/(\d+)\s*year/);
  if (match) {
    years = parseInt(match[1], 10);
  }
  if (years < 1) {
    analysisDetails.engagement_with_users.score = 80;
    analysisDetails.engagement_with_users.description =
      "Account is very new, engagement is low.";
  } else if (years < 3) {
    analysisDetails.engagement_with_users.score = 60;
    analysisDetails.engagement_with_users.description =
      "Account is relatively new, moderate engagement.";
  } else {
    analysisDetails.engagement_with_users.score = 30;
    analysisDetails.engagement_with_users.description =
      "Account is older, engagement appears normal.";
  }

  // --- Content Analysis: Recent Comments ---
  if (!profileData.recentComments || profileData.recentComments.length === 0) {
    analysisDetails.content_analysis.score = 80;
    analysisDetails.content_analysis.description =
      "No recent comments detected; activity seems minimal.";
  } else {
    let totalLength = profileData.recentComments.reduce(
      (sum, comment) => sum + comment.text.length,
      0
    );
    let avgLength = totalLength / profileData.recentComments.length;
    if (avgLength < 20) {
      analysisDetails.content_analysis.score = 80;
      analysisDetails.content_analysis.description =
        "Recent comments are very short; may be automated.";
    } else if (avgLength < 50) {
      analysisDetails.content_analysis.score = 60;
      analysisDetails.content_analysis.description =
        "Recent comments are a bit short; some automation might be present.";
    } else {
      analysisDetails.content_analysis.score = 30;
      analysisDetails.content_analysis.description =
        "Recent comments appear detailed and natural.";
    }
  }

  // --- Profile Metadata Analysis: Description ---
  if (!profileData.description || profileData.description.trim() === "") {
    analysisDetails.profile_metadata.score = 80;
    analysisDetails.profile_metadata.description =
      "Profile description is missing, which is suspicious.";
  } else if (profileData.description.length < 10) {
    analysisDetails.profile_metadata.score = 60;
    analysisDetails.profile_metadata.description =
      "Profile description is very brief.";
  } else {
    analysisDetails.profile_metadata.score = 30;
    analysisDetails.profile_metadata.description =
      "Profile description appears normal.";
  }

  // Combine the three scores by averaging them.
  const likelihood = Math.round(
    (analysisDetails.content_analysis.score +
      analysisDetails.engagement_with_users.score +
      analysisDetails.profile_metadata.score) /
      3
  );

  return {
    bot_likelihood: likelihood,
    status: "Analysis complete",
    analysis: analysisDetails,
  };
}

app.post("/api/chat", (req, res) => {
  const profileData = req.body.message;
  console.log("Received profile data:", profileData);

  // Call our analysis function instead of returning dummy data
  const result = analyzeProfile(profileData);
  console.log("Analysis result:", result);
  res.json(result);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
