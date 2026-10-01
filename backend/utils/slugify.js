// "3 Things to Check Before Buying Land!" → "3-things-to-check-before-buying-land"
export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || 'item';

// Appends -2, -3, ... until the slug is free (ignoring the document being edited)
export const uniqueSlug = async (Model, base, excludeId) => {
  const root = slugify(base);
  let slug = root;
  for (let n = 2; await Model.exists({ slug, ...(excludeId && { _id: { $ne: excludeId } }) }); n++) {
    slug = `${root}-${n}`;
  }
  return slug;
};
