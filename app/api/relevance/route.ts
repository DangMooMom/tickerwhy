// POST /api/relevance  (PLANNED, not implemented)
//
// This is where the Groq call will go: read the key with getLlmConfig() from
// "@/lib/llm", call the OpenAI-compatible API, validate the JSON against the
// schema, and return only the validated result. The key never leaves the server.
//
// Until then the article page shows example data labelled "simulated".

export async function POST() {
  return Response.json(
    { status: "planned", error: "LLM relevance check is not implemented yet." },
    { status: 501 },
  );
}
