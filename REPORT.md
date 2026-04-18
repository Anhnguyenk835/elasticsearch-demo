# Demo: Type-ahead với Elasticsearch

## 1. Tổng quan demo

- **Search 1 — Completion Suggester:** người dùng gõ tiền tố, backend gọi Elasticsearch **Suggest API** trên field kiểu `completion` (`title`), trả về danh sách gợi ý tối đa 10 mục.
- **Search 2 — `search_as_you_type`:** cùng bài toán gợi ý nhưng dùng **truy vấn tìm kiếm** `multi_match` với `type: "bool_prefix"` trên field `title_sayt` và các subfield do Elasticsearch tạo sẵn (`_2gram`, `_3gram`, `_index_prefix`).
- **Dữ liệu:** nạp từ `data_seed.json` qua `npm run seed`; API đọc **chỉ từ Elasticsearch**, không hardcode danh sách trong server khi search.
- **UI:** hai ô tìm kiếm, debounce ~180ms, gọi lần lượt `GET /api/suggest?q=` và `GET /api/suggest-sayt?q=`.

---

## 2. Các options kỹ thuật: full-text search + type-ahead trên Elasticsearch

Phần này nói về **cách thiết kế truy vấn và index** để vừa hỗ trợ **gõ dần (type-ahead)** vừa bám sát **tìm kiếm full-text** (nhiều từ, thứ tự, relevance), **không** nói tới Docker/cloud hay cách cài cluster.

| Option | Cơ chế chính | Type-ahead / full-text |
|--------|----------------|------------------------|
| **A. Completion Suggester** | Field `completion`; API `_search` với `suggest.completion`, thường kèm `prefix`. | **Type-ahead rất mạnh:** độ trễ thấp, FSM tối ưu cho tiền tố. **Không phải full-text kiểu BM25:** không đánh giá relevance theo câu dài như `match`; phù hợp danh sách “ứng viên” cố định (brand, địa danh, tiêu đề catalog). |
| **B. `search_as_you_type` + `bool_prefix`** | Datatype đặc biệt sinh subfield (`_2gram`, `_3gram`, `_index_prefix`…); truy vấn `multi_match` `type: "bool_prefix"`. | **Cân bằng:** từng **token** trong câu có thể là **tiền tố** → gõ dần cụm (“dark kn…”) vẫn khớp; bám **mô hình tìm kiếm** hơn completion thuần. Chi phí index và mapping cố định theo ES. |
| **C. Edge n-gram / n-gram (analyzer tùy chỉnh)** | `text` + filter `edge_ngram` hoặc `ngram` trong `analyzer`; query `match`, `match_bool_prefix`, hoặc `match_phrase_prefix`. | **Linh hoạt tối đa:** tự kiểm soát min/max gram, analyzer tiếng Việt, stopword. **Nhược:** phải tự thiết kế mapping, dễ phình index nếu `ngram` quá rộng; cần hiểu tokenization. |
| **D. `match_phrase_prefix`** | Cụm từ + từ cuối là prefix trên field `text` (thường không dùng n-gram). | **Đơn giản** khi chỉ cần “cụm + tiền tố từ cuối”. **Nhược:** từ cuối có thể tốn kém (prefix trên term lớn); ít “mượt” cho từng từ giữa câu đang gõ dở như `bool_prefix` + SAYT. |
| **E. `prefix` / `wildcard` trên `keyword`** | So khớp tiền tố chuỗi nguyên khối. | Chỉ hợp **mã/id/tên không tách từ**; **không** thay cho full-text đa từ; thường tránh cho ô search người dùng tự do. |

### 2.1. Ưu / nhược 

- **A — Completion:** cực nhanh cho autocomplete “một dòng”; dễ thêm **fuzzy** trên suggester. Hạn chế: dữ liệu cần chuẩn bị dạng “ứng viên”; không thay thế search page đầy đủ.
- **B — `search_as_you_type`:** ít boilerplate hơn **C** vì ES định nghĩa sẵn subfield; **`bool_prefix`** hỗ trợ **nhiều từ đang gõ dở** — đúng ý “full-text + as you type”. Fuzzy tích hợp kém hơn so với `match` thuần.
- **C — N-gram tự cấu hình:** mạnh khi cần locale, synonym, fine-tuning; chi phí bảo trì mapping cao hơn **B**.
- **D / E:** bổ trợ trong một số màn hình; ít dùng làm **một** giải pháp duy nhất cho ô search gợi ý kiểu Google.

### 2.2. Li do demo chọn **A + B**

- **Search 1 (`completion`):** minh họa **chuẩn autocomplete** — latency thấp, fuzzy trên tiền tố, phù hợp hộp gợi ý ngay dưới ô nhập.
- **Search 2 (`search_as_you_type` + `bool_prefix`):** minh họa **cùng bài toán UX type-ahead** nhưng đi theo **trục full-text** (multi-term, prefix theo từ), để so sánh trực quan hai họ giải pháp trên cùng bộ dữ liệu seed.

---

## 3. Hướng dẫn chạy (demo)

1. Có **Elasticsearch** chạy tại `http://127.0.0.1:9200` (trong repo này thường dùng **Docker Compose** — xem `docker-compose.yml`; không phải “option” full-text, chỉ là cách tiện để chạy ES local).
2. Trong thư mục `elasticsearch-demo`:  
   `docker compose up -d`  
   Đợi cluster sẵn sàng (thường vài chục giây), kiểm tra: `curl http://127.0.0.1:9200`.
3. `npm install` (lần đầu), sau đó:  
   `npm run seed` — nạp dữ liệu từ `data_seed.json` vào index `typeahead_movies`.  
   *Nếu đổi mapping:* xóa index cũ rồi seed lại (xem comment trong `es_config.mjs`).
4. `npm start` — mở `http://localhost:3000`.

---

## 4. Quyết định kiểu tham số và mapping

### 4.1. Hai “đường” gợi ý — hai kiểu field

| Thành phần | Kiểu field / API | Lý do thiết kế |
|------------|------------------|----------------|
| **Search 1** | `title`: `completion` + **Suggest** `completion` | FSM index tối ưu cho **prefix completion**; độ trễ thấp, đúng bài toán autocomplete cổ điển. |
| **Search 2** | `title_sayt`: `search_as_you_type` + **`multi_match` `bool_prefix`** | Elasticsearch sinh sẵn edge n-gram / prefix subfield; `bool_prefix` cho phép match **nhiều từ theo thứ tự** (gõ dần cụm như “dark kn…”). |

Cùng một `title` nguồn từ seed được ghi **hai lần** vào hai field khác nhau để so sánh hai kỹ thuật, không tranh chấp mapping (một document không thể vừa là `completion` vừa là full `text` trên cùng một path đơn giản cho hai mode khác nhau).

### 4.2. Tham số API HTTP

- **`q` (query string):** một chuỗi duy nhất; server `trim()` và từ chối rỗng (trả danh sách rỗng). Đơn giản cho UI, đủ cho demo.
- **`ELASTICSEARCH_URL`:** cho phép trỏ ES trên máy khác hoặc cloud mà không sửa code.
- **`PORT`:** cổng Express (mặc định 3000).

### 4.3. Tham số truy vấn Elasticsearch — Search 1 (Completion)

| Tham số | Giá trị trong demo | Ý nghĩa |
|---------|-------------------|---------|
| `prefix` | Nội dung `q` sau `trim` | Tiền tố người dùng đang gõ. |
| `field` | `title` | Field `completion` đã index. |
| `size` | `10` | Giới hạn số gợi ý; cân bằng giữa đủ dùng và gọn response. |
| `skip_duplicates` | `true` | Tránh lặp text hiển thị khi index có trùng input. |
| `fuzzy` | `{ fuzziness: "AUTO" }` | Cho phép sai lệch nhỏ so với tiền tố (xem mục 5). |

### 4.4. Tham số truy vấn — Search 2 (`search_as_you_type`)

| Tham số | Giá trị trong demo | Ý nghĩa |
|---------|-------------------|---------|
| `type` | `bool_prefix` | Từng term trong `query` có thể là prefix; phù hợp “gõ dần từng từ”. |
| `fields` | `title_sayt`, `title_sayt._2gram`, `title_sayt._3gram`, `title_sayt._index_prefix` | Khớp khuyến nghị của Elasticsearch cho datatype `search_as_you_type`. |
| `size` | `10` | Đồng bộ với Search 1 để so sánh UX. |
| `_source` | `["title_sayt"]` | Chỉ trả text hiển thị, giảm payload. |

---

## 5. Xử lý fuzzy matching

### 5.1. Search 1 — có fuzzy (Completion Suggester)

Trong `server.js`, suggester completion dùng:

```text
fuzzy: { fuzziness: "AUTO" }
```

- Elasticsearch áp dụng **fuzzy lên completion suggester** theo tài liệu chính thức: cho phép biến thể gần đúng của **prefix** (sai chính tả nhẹ, bỏ sót ký tự trong giới hạn do `AUTO` quyết định theo độ dài term).
- **Ưu:** trải nghiệm “dễ chịu” khi gõ lệch vài ký tự.
- **Hạn chế:** fuzzy trên completion **không thay thế** một truy vấn full-text đầy đủ; chỉ mở rộng không gian gợi ý quanh tiền tố. `AUTO` cố định mức chỉnh sửa theo độ dài — đủ cho demo, có thể tinh chỉnh `fuzziness: 1 | 2` hoặc thêm `min_length`, `prefix_length` nếu cần chặt hơn.

### 5.2. Search 2 — chưa bật fuzzy trong `multi_match`

Luồng `bool_prefix` trên `search_as_you_type` trong code hiện tại **không** kèm `fuzziness` của `match` (vì `multi_match` kiểu `bool_prefix` không hỗ trợ fuzziness theo cùng một cơ chế đơn giản như `match` thường).

**Nếu sau này cần “dễ sai” hơn cho Search 2, có thể cân nhắc:**

- Kết hợp thêm một mệnh đề `should` với `match` / `fuzzy` trên một field `text` phân tích riêng (trade-off: phức tạp scoring, cần tuning).
- Hoặc dùng **synonym filter** / chuẩn hóa unicode ở **analyzer** cho tiếng Việt thay vì fuzzy.

Trong phạm vi demo, **Search 1 đại diện cho fuzzy nhẹ trên autocomplete**; **Search 2 đại diện cho khớp theo cụm từ tiền tố** (đúng hơn khi người dùng gõ đủ chính tả từng phần).

---

## 6. Kết luận ngắn

- **Options full-text + type-ahead:** có nhiều hướng (completion, `search_as_you_type`, n-gram tùy chỉnh, `match_phrase_prefix`, v.v.); demo cố ý dùng **hai hướng A + B** để đối chiếu **autocomplete thuần** với **gõ dần theo cụm từ** gần full-text hơn.
- **Tham số:** tách hai field (`completion` vs `search_as_you_type`) phục vụ hai pattern; tham số `size`, `skip_duplicates`, `fields` của `bool_prefix` bám theo khuyến nghị Elasticsearch.
- **Fuzzy:** chỉ **Completion Suggester** bật `fuzziness: "AUTO"`; **Search 2** dựa vào `search_as_you_type` + `bool_prefix`, không fuzzy trong truy vấn hiện tại — có thể mở rộng (mệnh đề `should`, field `text` riêng, analyzer) nếu cần.

