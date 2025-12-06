import { Handler } from "@netlify/functions";
import { Client } from "pg";

export const handler: Handler = async (event) => {
  try {
    const data = JSON.parse(event.body || "{}");

    const client = new Client({
      connectionString: process.env.NEON_DB_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    await client.query(
      "INSERT INTO reservations (name, email, date) VALUES ($1, $2, $3)",
      [data.name, data.email, data.date]
    );

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
