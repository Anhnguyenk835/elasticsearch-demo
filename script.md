# Thuyết trình demo Elasticsearch + Type-ahead (~3 phút)

> **Gợi ý nhịp nói:** ~120–130 từ/phút → khoảng 360–400 từ tổng cộng. Có thể rút hoặc thêm 1–2 câu tùy tempo.

---

## Gợi ý slide (tùy chọn)

1. **Tiêu đề:** Demo tìm kiếm gợi ý (type-ahead) với Elasticsearch  
2. **Kiến trúc:** Docker (ES) → seed dữ liệu → Node API → trình duyệt  
3. **Luồng dữ liệu:** `data_seed.json` → index `typeahead_movies` → API `/api/suggest`  
4. **Điểm kỹ thuật:** Completion Suggester + debounce phía client  
5. **Demo trực tiếp:** gõ vài ký tự (ví dụ *spider*, *mắt*)

---

## Kịch bản đọc (khoảng 3 phút)

**[0:00–0:25 — Mở đầu]**  
Em/chào thầy cô và các bạn. Em xin trình bày một demo nhỏ về **tìm kiếm gợi ý khi đang gõ**, hay còn gọi là **type-ahead**, sử dụng **Elasticsearch** làm lớp lưu trữ và tìm kiếm, thay vì quét toàn bộ danh sách phim trong bộ nhớ hay trong database quan hệ.

**[0:25–1:05 — Bài toán và cách làm]**  
Trong ứng dụng thực tế, người dùng gõ vài ký tự đầu của tên phim và mong muốn nhận **gợi ý ngay lập tức**. Elasticsearch phù hợp vì được tối ưu cho **full-text search và gợi ý**, có thể mở rộng khi dữ liệu lớn. Demo của em gồm bốn phần chính: chạy **Elasticsearch trong Docker**; một file **`data_seed.json`** chứa danh sách tên phim; script **`npm run seed`** để **đẩy dữ liệu vào index** trên Elasticsearch; và một **server Node.js** phục vụ API **`/api/suggest`** cùng giao diện web đơn giản.

**[1:05–1:50 — Luồng kỹ thuật]**  
Khi seed chạy, dữ liệu được index vào index có tên **`typeahead_movies`**, với field **`title` kiểu completion** — đây là kiểu dữ liệu Elasticsearch dùng cho **Completion Suggester**, rất nhanh cho kiểu “gõ tiền tố, trả về các cụm hoàn chỉnh”. Server **không** nhúng cứng danh sách phim: mọi gợi ý khi gọi API đều **đọc trực tiếp từ Elasticsearch**. Phía trình duyệt, em dùng **debounce** khoảng một trăm tám mươi mili giây để **không gọi API liên tục mỗi phím**, giảm tải và tránh nhấp nháy danh sách.

**[1:50–2:35 — Demo thao tác]**  
*(Chuyển sang màn hình demo.)*  
Đầu tiên em bật Elasticsearch bằng **`docker compose up -d`**, sau đó chạy **`npm run seed`** để nạp dữ liệu từ file JSON, rồi **`npm start`** để mở web. Khi em gõ chẳng hạn *“spi”* hoặc *“dune”*, danh sách gợi ý hiện ra — đó là kết quả API trả về sau khi Elasticsearch xử lý **truy vấn suggest** trên dữ liệu đã lưu trong cluster.

**[2:35–3:00 — Kết luận]**  
Tóm lại, demo thể hiện tách bạch **nguồn dữ liệu** (file seed), **lưu trữ và tìm kiếm** (Elasticsearch), và **tầng API + UI** (Node và HTML). Hướng mở rộng sau này có thể là đồng bộ từ hệ thống đặt vé thật, thêm phân quyền, hoặc tối ưu mapping theo ngôn ngữ. Em xin cảm ơn thầy cô và các bạn đã lắng nghe; em sẵn sàng nhận câu hỏi.

---

## Câu hỏi thường gặp (chuẩn bị nhanh)

| Câu hỏi gợi ý | Ý trả lời ngắn |
|----------------|----------------|
| Sao không lưu trong SQL? | Type-ahead trên text lớn, ES chuyên trách search/suggest và scale ngang dễ hơn cho use case này. |
| `data_seed.json` để làm gì? | Tách dữ liệu khỏi code; sửa file rồi chạy lại `npm run seed` để cập nhật index. |
| Debounce là gì? | Trì hoãn gọi API cho đến khi người dùng “ngừng gõ” một khoảng ngắn, tránh spam request. |

---

## Checklist trước khi lên thuyết trình

- [ ] Docker đang chạy, container Elasticsearch healthy  
- [ ] Đã `npm run seed` (index có document)  
- [ ] `npm start` và tab trình duyệt mở sẵn `http://localhost:3000`  
- [ ] Thử 1–2 từ khóa có trong `data_seed.json` (ví dụ *Mắt biếc*, *Spider*)
