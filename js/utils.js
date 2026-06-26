export function getCSSVar(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

export function parseTrackTitle(fileName) {
  const withoutExt = fileName.slice(0, fileName.lastIndexOf(".")) || fileName;
  const separatorIndex = withoutExt.indexOf("-");
  if (separatorIndex === -1) return { author: null, title: withoutExt.trim() };
  return {
    author: withoutExt.slice(0, separatorIndex).trim(),
    title: withoutExt.slice(separatorIndex + 1).trim(),
  };
}
