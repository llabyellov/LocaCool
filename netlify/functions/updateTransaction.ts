import { Handler } from "@netlify/functions";
import { Client } from "pg";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "PUT") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const client = new Client({
    connectionString: process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const transaction = JSON.parse(event.body || "{}");
    
    await client.connect();
    await client.query(
      "UPDATE transactions SET date = $2, amount = $3, description = $4, category = $5, type = $6 WHERE id = $1",
      [transaction.id, transaction.date, transaction.amount, transaction.description, transaction.category, transaction.type]
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
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
