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
  let years = 0;
  if (profileData.accountAge) {
    const match = profileData.accountAge.match(/(\d+)\s*year/);
    if (match) {
      years = parseInt(match[1], 10);
    }
  }
  if (!profileData.accountAge) {
    analysisDetails.engagement_with_users.score = 50;
    analysisDetails.engagement_with_users.description =
      "Account age not provided.";
  } else if (years < 1) {
    analysisDetails.engagement_with_users.score = 60;
    analysisDetails.engagement_with_users.description =
      "Account is very new; low engagement is common in new users.";
  } else if (years < 3) {
    analysisDetails.engagement_with_users.score = 40;
    analysisDetails.engagement_with_users.description =
      "Account is moderately new; engagement appears acceptable.";
  } else {
    analysisDetails.engagement_with_users.score = 20;
    analysisDetails.engagement_with_users.description =
      "Account is well-established; engagement is as expected.";
  }

  // --- Content Analysis: Recent Comments ---
  if (
    !Array.isArray(profileData.recentComments) ||
    profileData.recentComments.length === 0
  ) {
    analysisDetails.content_analysis.score = 70;
    analysisDetails.content_analysis.description =
      "No recent comments detected; the user might simply be a lurker.";
  } else {
    let totalLength = profileData.recentComments.reduce(
      (sum, comment) => sum + (comment.text ? comment.text.length : 0),
      0
    );
    let avgLength = totalLength / profileData.recentComments.length;
    if (avgLength < 15) {
      analysisDetails.content_analysis.score = 70;
      analysisDetails.content_analysis.description =
        "Recent comments are unusually short; this can sometimes indicate automation.";
    } else if (avgLength < 40) {
      analysisDetails.content_analysis.score = 40;
      analysisDetails.content_analysis.description =
        "Recent comments are within a typical range for casual users.";
    } else {
      analysisDetails.content_analysis.score = 20;
      analysisDetails.content_analysis.description =
        "Recent comments appear detailed and natural.";
    }
  }

  // --- Profile Metadata Analysis: Description ---
  if (!profileData.description || profileData.description.trim() === "") {
    analysisDetails.profile_metadata.score = 50;
    analysisDetails.profile_metadata.description =
      "Profile description is missing; note that many genuine users leave this blank.";
  } else if (profileData.description.length < 10) {
    analysisDetails.profile_metadata.score = 50;
    analysisDetails.profile_metadata.description =
      "Profile description is very brief.";
  } else {
    analysisDetails.profile_metadata.score = 20;
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
  try {
    const profileData = req.body.message;
    console.log("Received profile data:", profileData);
    const result = analyzeProfile(profileData);
    console.log("Analysis result:", result);
    res.json(result);
  } catch (error) {
    console.error("Error analyzing profile:", error);
    res.status(500).json({ error: error.toString() });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
