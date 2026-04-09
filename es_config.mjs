/** index và mapping dùng cho server (search) và seed (index). */

export const INDEX = "typeahead_movies";

export const INDEX_MAPPINGS = {
  properties: {
    title: { type: "completion" },  // trường được index và dùng cho completion suggester
  },
};
