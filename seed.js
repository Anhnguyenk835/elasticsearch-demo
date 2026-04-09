import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@elastic/elasticsearch";
import { INDEX, INDEX_MAPPINGS } from "./es_config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ES_URL = process.env.ELASTICSEARCH_URL || "http://127.0.0.1:9200";

// kết nối đến elasticsearch
const client = new Client({ node: ES_URL });

function loadSeedRecords() {
  const raw = readFileSync(path.join(__dirname, "data_seed.json"), "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("data_seed.json phải là mảng [{ title: string }, ...]");
  }
  return data.map((row, i) => {
    if (!row || typeof row.title !== "string" || !row.title.trim()) {
      throw new Error(`data_seed.json: phần tử #${i + 1} thiếu title hợp lệ`);
    }
    return {
      title: row.title.trim(),
      weight:
        typeof row.weight === "number" && row.weight >= 0
          ? row.weight
          : data.length - i,
    };
  });
}

// tạo index nếu chưa có
async function ensureIndex() {
  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    await client.indices.create({
      index: INDEX,
      mappings: INDEX_MAPPINGS,
    });
    console.log(`Đã tạo index: ${INDEX}`);
  }
}

// index dữ liệu
async function bulkIndex(records) {
  const operations = records.flatMap((r, i) => [
    { index: { _index: INDEX, _id: String(i + 1) } },
    { title: { input: r.title, weight: r.weight } },
  ]);
  // index dữ liệu vào elasticsearch bằng bulk
  const bulkRes = await client.bulk({ refresh: true, operations });
  if (bulkRes.errors) {
    const failed = bulkRes.items.find((it) => it.index?.error);
    throw new Error(failed?.index?.error?.reason || "Bulk indexing failed");
  }
  console.log(`Đã index ${records.length} document vào Elasticsearch (${INDEX}).`);
}

async function main() {
  await client.ping();
  const records = loadSeedRecords();
  await ensureIndex();
  await bulkIndex(records);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
