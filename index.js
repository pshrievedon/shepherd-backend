// index.js

const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// --- CORS Configuration ---
// Allow all origins (for testing purposes)
// Also, explicitly handle OPTIONS requests.
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.options("*", cors());

// --- JSON Parsing Middleware ---
app.use(express.json());

// --- Test GET Route ---
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// --- Analysis Function ---
function analyzeProfile(profileData) {
  let analysisDetails = {
    content_analysis: { score: 0, description: "" },
    engagement_with_users: { score: 0, description: "" },
    profile_metadata: { score: 0, description: "" },
    additional_checks: { score: 0, description: "" },
  };

  // A. Parse Account Age into Years
  let accountAgeYears = null;
  if (profileData.accountAge) {
    let accountDate = new Date(profileData.accountAge);
    if (!isNaN(accountDate)) {
      const now = new Date();
      const diffMs = now - accountDate;
      accountAgeYears = diffMs / (1000 * 60 * 60 * 24 * 365);
    }
  }

  // B. Engagement Analysis (Account Age)
  if (!profileData.accountAge || accountAgeYears === null) {
    analysisDetails.engagement_with_users.score = 50;
    analysisDetails.engagement_with_users.description =
      "Account age not provided.";
  } else if (accountAgeYears < 1) {
    analysisDetails.engagement_with_users.score = 60;
    analysisDetails.engagement_with_users.description =
      "Account is very new; low engagement is common in new users.";
  } else if (accountAgeYears < 3) {
    analysisDetails.engagement_with_users.score = 40;
    analysisDetails.engagement_with_users.description =
      "Account is moderately new; engagement appears acceptable.";
  } else {
    analysisDetails.engagement_with_users.score = 20;
    analysisDetails.engagement_with_users.description =
      "Account is well-established; engagement is as expected.";
  }

  // Conditional adjustment for new accounts with high posting frequency and low engagement.
  let postingFrequency = Array.isArray(profileData.recentComments)
    ? profileData.recentComments.length
    : 0;
  if (accountAgeYears !== null && accountAgeYears < 1 && postingFrequency > 5) {
    if (profileData.postKarma && profileData.commentKarma !== undefined) {
      const ratio = profileData.commentKarma / profileData.postKarma;
      if (ratio < 0.05) {
        analysisDetails.engagement_with_users.score = Math.min(
          100,
          Math.round(analysisDetails.engagement_with_users.score * 1.5)
        );
        analysisDetails.engagement_with_users.description +=
          " Additionally, frequent posts with very low engagement were detected.";
      }
    }
  }

  // C. Content Analysis (Recent Comments)
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

  // D. Profile Metadata Analysis (Description)
  if (!profileData.description || profileData.description.trim() === "") {
    if (accountAgeYears !== null && accountAgeYears < 1) {
      analysisDetails.profile_metadata.score = 60;
      analysisDetails.profile_metadata.description =
        "Profile description is missing; many new users leave this blank.";
    } else {
      analysisDetails.profile_metadata.score = 50;
      analysisDetails.profile_metadata.description =
        "Profile description is missing; note that many genuine users leave this blank.";
    }
  } else if (profileData.description.length < 10) {
    analysisDetails.profile_metadata.score = 50;
    analysisDetails.profile_metadata.description =
      "Profile description is very brief.";
  } else {
    analysisDetails.profile_metadata.score = 20;
    analysisDetails.profile_metadata.description =
      "Profile description appears normal.";
  }

  // E. Additional Checks: Duplicate Comment Ratio & Karma Discrepancy
  let duplicateScore = 0;
  let duplicateDescription = "";
  if (
    Array.isArray(profileData.recentComments) &&
    profileData.recentComments.length > 0
  ) {
    let commentCounts = {};
    profileData.recentComments.forEach((comment) => {
      const text = comment.text || "";
      commentCounts[text] = (commentCounts[text] || 0) + 1;
    });
    let duplicateCount = Object.values(commentCounts).reduce(
      (sum, count) => sum + (count - 1),
      0
    );
    let duplicateRatio = duplicateCount / profileData.recentComments.length;
    if (duplicateRatio > 0.3) {
      duplicateScore = 100; // Extreme penalty
      duplicateDescription = "High repetition detected in recent comments.";
    } else if (duplicateRatio > 0.1) {
      duplicateScore = 50;
      duplicateDescription = "Some repetition observed in recent comments.";
    } else {
      duplicateScore = 20;
      duplicateDescription = "Recent comments are sufficiently varied.";
    }
  } else {
    duplicateScore = 50;
    duplicateDescription = "Insufficient comment data for duplicate analysis.";
  }

  let karmaScore = 0;
  let karmaDescription = "";
  if (profileData.postKarma && profileData.commentKarma !== undefined) {
    const ratio = profileData.commentKarma / profileData.postKarma;
    if (ratio < 0.01) {
      karmaScore = 100; // Extreme penalty
      karmaDescription = "Extremely low comment karma relative to post karma.";
    } else if (ratio < 0.05) {
      karmaScore = 80;
      karmaDescription = "Low comment karma relative to post karma.";
    } else {
      karmaScore = 20;
      karmaDescription = "Karma distribution appears typical.";
    }
  } else {
    karmaScore = 50;
    karmaDescription = "Insufficient karma data for analysis.";
  }

  analysisDetails.additional_checks.score = Math.round(
    (duplicateScore + karmaScore) / 2
  );
  analysisDetails.additional_checks.description = `${duplicateDescription} ${karmaDescription}`;

  // F. Final Bot Likelihood Calculation with Conditional Weighting & Override
  let weightContent = 1;
  let weightEngagement = 1;
  let weightMetadata = 1;
  let weightAdditional = 1.5; // Extra weight for additional checks
  if (accountAgeYears !== null && accountAgeYears < 1) {
    weightMetadata = 0.5;
  }

  let weightedScore = Math.round(
    (analysisDetails.content_analysis.score * weightContent +
      analysisDetails.engagement_with_users.score * weightEngagement +
      analysisDetails.profile_metadata.score * weightMetadata +
      analysisDetails.additional_checks.score * weightAdditional) /
      (weightContent + weightEngagement + weightMetadata + weightAdditional)
  );

  // Override: If either critical check is extreme, force final score to 100.
  let overrideTriggered = false;
  let overrideExplanation = "";
  if (duplicateScore === 100 || karmaScore === 100) {
    weightedScore = 100;
    overrideTriggered = true;
    if (duplicateScore === 100 && karmaScore === 100) {
      overrideExplanation =
        "Both duplicate comment ratio and extremely low comment karma triggered the override.";
    } else if (duplicateScore === 100) {
      overrideExplanation = "Duplicate comment ratio triggered the override.";
    } else if (karmaScore === 100) {
      overrideExplanation = "Karma discrepancy triggered the override.";
    }
  }

  return {
    bot_likelihood: weightedScore,
    status: "Analysis complete",
    overrideTriggered: overrideTriggered,
    overrideExplanation: overrideExplanation,
    analysis: analysisDetails,
  };
}

// --- POST Endpoint ---
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

// --- Start the Server ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
