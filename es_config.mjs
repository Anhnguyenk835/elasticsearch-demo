/** Tên index và mapping dùng chung cho server (search) và seed (index). */

export const INDEX = "typeahead_movies";

export const INDEX_MAPPINGS = {
  properties: {
    title: { type: "completion" },
  },
};
