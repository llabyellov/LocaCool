import { Handler } from "@netlify/functions";
import { Client } from "pg";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "DELETE") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const client = new Client({
    connectionString: process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { id } = JSON.parse(event.body || "{}");
    
    await client.connect();
    await client.query("DELETE FROM transactions WHERE id = $1", [id]);
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
