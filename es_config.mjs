/**
 * index và mapping dùng cho server (search) và seed (index).
 * Nếu đã có index cũ (thiếu title_sayt hoặc sai kiểu): xóa index rồi chạy lại npm run seed.
 *   curl -X DELETE "localhost:9200/typeahead_movies"
 */

export const INDEX = "typeahead_movies";

export const INDEX_MAPPINGS = {
  properties: {
    /** Search 1: Completion Suggester */
    title: { type: "completion" },
    /** Search 2: multi_match bool_prefix trên search_as_you_type */
    title_sayt: { type: "search_as_you_type" },
  },
};
