import { Handler } from "@netlify/functions";
import { Client } from "pg";

export const handler: Handler = async () => {
  const client = new Client({
    connectionString: process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query("SELECT * FROM transactions ORDER BY date DESC");
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows),
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
