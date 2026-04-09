import express from "express";
import { Client } from "@elastic/elasticsearch";
import path from "path";
import { fileURLToPath } from "url";
import { INDEX, INDEX_MAPPINGS } from "./es_config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ES_URL = process.env.ELASTICSEARCH_URL || "http://127.0.0.1:9200";

const client = new Client({ node: ES_URL });

/** Chỉ tạo index (rỗng) nếu chưa có. Dữ liệu nạp bằng: npm run seed */
async function ensureIndex() {
  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    await client.indices.create({
      index: INDEX,
      mappings: INDEX_MAPPINGS,
    });
    console.warn(
      `Index ${INDEX} vừa được tạo (chưa có dữ liệu). Chạy: npm run seed`
    );
  }
}

/** Gợi ý đọc trực tiếp từ Elasticsearch (Completion Suggester). */
async function suggest(prefix) {
  const q = prefix.trim();
  if (!q) return [];

  const res = await client.search({
    index: INDEX,
    suggest: {
      "movie-suggest": {
        prefix: q,
        completion: {
          field: "title",
          size: 10,
          skip_duplicates: true,
          fuzzy: { fuzziness: "AUTO" },
        },
      },
    },
  });

  const options =
    res.suggest?.["movie-suggest"]?.[0]?.options?.map((o) => o.text) ?? [];
  return [...new Set(options)];
}

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/suggest", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const suggestions = await suggest(q);
    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(503).json({
      error: "Không kết nối được Elasticsearch. Chạy: docker compose up -d",
    });
  }
});

async function main() {
  await client.ping();
  await ensureIndex();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Demo: http://localhost:${port}`);
    console.log(`Elasticsearch: ${ES_URL}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
