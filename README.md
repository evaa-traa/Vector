# Flowise Chat

Self-hosted ChatGPT + Perplexity style chat UI powered by Flowise, served from a single Node.js backend with SSE streaming.

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

Create a `.env` file in the project root:

```
PORT=3000

MODEL_1_NAME=Flowise GPT
MODEL_1_ID=YOUR_FLOW_ID
MODEL_1_HOST=https://your-flowise-host.hf.space

MODEL_2_NAME=Flowise Research
MODEL_2_ID=YOUR_FLOW_ID_2
MODEL_2_HOST=https://your-flowise-host.hf.space
```

3. Build the frontend

```bash
npm run build
```

4. Start the server

```bash
npm start
```

Open `http://localhost:3000`.

## Environment Variables

- `PORT` Optional server port
- `MODEL_1_NAME` Display name shown in the model selector
- `MODEL_1_ID` Flowise chatflow id
- `MODEL_1_HOST` Base Flowise host URL
- Add additional models by incrementing the suffix: `MODEL_2_*`, `MODEL_3_*`, and so on

## Deployment

### Render

1. Create a new Web Service
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add the environment variables for your models in Render settings

### Hugging Face Spaces

1. Create a Docker or Node Space
2. Set the same build and start commands as above
3. Configure the model environment variables in the Space settings

## API

### GET /models

Returns the configured models.

### POST /chat

SSE streaming endpoint.

Body:

```
{
  "message": "Hello",
  "modelId": "MODEL_ID",
  "mode": "chat"
}
```
