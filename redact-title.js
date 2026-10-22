// Hides a film's title inside clue text (plot summary, character names) so a clue never gives the
// answer away. "Lady Bird McPherson" in the plot of Lady Bird becomes "_____ McPherson".
(function () {
  const blank = '_____';
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['\u2019]/g, "['\u2019]");

  // The title itself plus the shorter forms a plot would use: without a leading article, without
  // a subtitle, and without a sequel number.
  function aliases(title) {
    const plain = title.trim();
    const noArticle = plain.replace(/^(?:the|a|an)\s+/i, '');
    const main = noArticle.split(/\s*[:\u2013\u2014]\s+|\s+-\s+/)[0];
    const base = main.replace(/\s+(?:\d+|[ivx]+)$/i, '');
    return [...new Set([plain, noArticle, main, base])].filter(Boolean)
      .sort((a, b) => b.length - a.length);
  }

  function redactTitle(text, title) {
    let result = String(text || '');
    for (const name of aliases(String(title || ''))) {
      const words = name.split(/\s+/).length;
      // Short one-word titles such as "It", "Her" or "Up" are ordinary words, so they are only
      // hidden when they contain a digit, like "1917" or "F9".
      if (words === 1 && name.length <= 3 && !/\d/.test(name)) continue;
      // A one-word title is only matched as written ("Gladiator" but not "a gladiator"), while a
      // longer title is matched in any casing.
      const flags = words === 1 ? 'gu' : 'giu';
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, flags);
      result = result.replace(pattern, blank);
    }
    return result;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { redactTitle };
  else window.redactTitle = redactTitle;
})();
