"use strict";
/**
 * routes/models.js
 * GET /models       — list all configured models with live capability info
 * GET /labs-model   — return the configured Labs model name
 */

const express = require("express");
const router = express.Router();
const { loadModelsFromEnvDetailed, loadPublicModels } = require("../models");
const { fetchCapabilities } = require("../lib/capabilities");

/**
 * Load the dedicated Labs model from LABS_MODEL_* env vars.
 * Falls back to the first regular model if LABS_MODEL_ID / LABS_MODEL_HOST are not set.
 * @returns {object|null}
 */
function loadLabsModel() {
    const name = process.env.LABS_MODEL_NAME || "Labs Model";
    const id = (process.env.LABS_MODEL_ID || "").trim();
    const host = (process.env.LABS_MODEL_HOST || "").trim().replace(/\/$/, "");
    const apiKey = (process.env.LABS_MODEL_API_KEY || "").trim();
    const authHeader = (process.env.LABS_MODEL_AUTH_HEADER || "").trim();
    const authValue = (process.env.LABS_MODEL_AUTH_VALUE || "").trim();

    if (id && host) {
        return { name, id, host, index: "labs", apiKey, authHeader, authValue };
    }
    // Fallback to first regular model
    const detailed = loadModelsFromEnvDetailed(process.env);
    if (detailed.models.length > 0) {
        return { ...detailed.models[0], name: name || detailed.models[0].name };
    }
    return null;
}

// GET /models — returns enriched model list with live capabilities
router.get("/models", async (req, res) => {
    const detailed = loadModelsFromEnvDetailed(process.env).models;
    const { models, issues } = loadPublicModels(process.env);

    const capabilityPairs = await Promise.all(
        detailed.map(async (model) => ({
            id: String(model.index),
            features: await fetchCapabilities(model)
        }))
    );
    const capabilityMap = new Map(capabilityPairs.map((item) => [item.id, item.features]));

    const enriched = models.map((model) => ({
        ...model,
        features: capabilityMap.get(model.id) || { uploads: false, tts: false, stt: false, status: "unknown" }
    }));

    res.json({ models: enriched, issues });
});

// GET /labs-model — exposes Labs model name to the client
router.get("/labs-model", (req, res) => {
    const labsModel = loadLabsModel();
    if (!labsModel) {
        return res.json({ model: null, error: "No Labs model configured" });
    }
    res.json({ model: { name: labsModel.name } });
});

module.exports = router;
module.exports.loadLabsModel = loadLabsModel; // re-exported for use in routes/labs.js
