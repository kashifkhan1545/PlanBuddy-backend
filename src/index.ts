import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * JSON Schema for task planning
 * Must include "additionalProperties": false at each object level
 */
const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "dueDate", "priority", "notes", "emoji"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          notes: { type: "string" },
          emoji: { type: "string" }
        }
      }
    }
  }
} as const;


app.post("/plan", async (req, res) => {
  try {
    const { goal, horizon } = req.body;
    if (!goal || !horizon) {
      return res.status(400).json({ error: "goal and horizon required" });
    }

    const horizonText =
      horizon === "today" ? "end of today" : "end of this week";

    const response = await client.responses.create({
      model: "gpt-4o",
      instructions: "You are a helpful planning assistant. Return only JSON.",
      input: [
        {
          role: "user",
          content: `Create a task plan for "${goal}", spread until ${horizonText}. Keep 4–10 tasks.`
        }
      ],
      text: {
        // @ts-ignore: OpenAI SDK typings lag behind the API
        format: {
          type: "json_schema",
          name: "task_plan",
          schema: planSchema,
          strict: true
        }
      }
    });

    const jsonText = response.output_text;
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      return res
        .status(502)
        .json({ error: "Model returned invalid JSON", raw: jsonText });
    }

    return res.json(data);
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .json({ error: err.message ?? "Server error" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () =>
  console.log(`✅ Backend running at http://localhost:${port}`)
);
