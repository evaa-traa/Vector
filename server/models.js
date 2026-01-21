function normalizeHost(host) {
  if (typeof host !== "string") return "";
  return host
    .trim()
    .replace(/^[\s'"`\u2018\u2019\u201C\u201D]+|[\s'"`\u2018\u2019\u201C\u201D]+$/g, "")
    .replace(/`/g, "")
    .replace(/\/$/, "");
}

function normalizeId(id) {
  if (typeof id !== "string") return "";
  return id
    .trim()
    .replace(/^[\s'"`\u2018\u2019\u201C\u201D]+|[\s'"`\u2018\u2019\u201C\u201D]+$/g, "")
    .replace(/`/g, "");
}

function normalizeHeaderName(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^[\s'"`\u2018\u2019\u201C\u201D]+|[\s'"`\u2018\u2019\u201C\u201D]+$/g, "")
    .replace(/`/g, "");
}

function normalizeHeaderValue(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^[\s'"`\u2018\u2019\u201C\u201D]+|[\s'"`\u2018\u2019\u201C\u201D]+$/g, "")
    .replace(/`/g, "");
}

function collectModelIndices(env) {
  const indices = new Set();
  for (const key of Object.keys(env || {})) {
    const match = /^MODEL_(\d+)_(NAME|ID|HOST|API_KEY|AUTH_HEADER|AUTH_VALUE)$/.exec(key);
    if (match) {
      indices.add(Number(match[1]));
    }
  }
  return Array.from(indices).filter(Number.isFinite).sort((a, b) => a - b);
}

function loadModelsFromEnvDetailed(env) {
  const indices = collectModelIndices(env);
  const models = [];
  const issues = [];

  if (indices.length === 0) {
    issues.push("No model environment variables found (MODEL_1_NAME/ID/HOST).");
    return { models, issues };
  }

  for (const index of indices) {
    const name = env[`MODEL_${index}_NAME`] || `Model ${index}`;
    let id = env[`MODEL_${index}_ID`];
    if (id && typeof id === "string") {
      id = normalizeId(id);
      // If the ID contains a slash, it might be a partial path, extract the last segment
      if (id.includes("/")) {
        id = id.split("/").pop();
      }
    }
    const host = normalizeHost(env[`MODEL_${index}_HOST`]);
    const apiKey = normalizeHeaderValue(env[`MODEL_${index}_API_KEY`]);
    const authHeader = normalizeHeaderName(env[`MODEL_${index}_AUTH_HEADER`]);
    const authValue = normalizeHeaderValue(env[`MODEL_${index}_AUTH_VALUE`]);

    const missing = [];
    if (!id) missing.push(`MODEL_${index}_ID`);
    if (!host) missing.push(`MODEL_${index}_HOST`);

    if (missing.length > 0) {
      issues.push(`Model ${index} is incomplete (missing: ${missing.join(", ")}).`);
      continue;
    }

    models.push({ name, id, host, index, apiKey, authHeader, authValue });
  }

  if (models.length === 0) {
    issues.push("No complete models found. Check MODEL_n_NAME/ID/HOST.");
  }

  return { models, issues };
}

function loadModelsFromEnv(env) {
  return loadModelsFromEnvDetailed(env).models;
}

function loadPublicModels(env) {
  const detailed = loadModelsFromEnvDetailed(env);
  const publicModels = detailed.models.map((m) => ({
    id: String(m.index),
    name: m.name
  }));
  return { models: publicModels, issues: detailed.issues };
}

module.exports = {
  loadModelsFromEnv,
  loadModelsFromEnvDetailed,
  loadPublicModels
};
