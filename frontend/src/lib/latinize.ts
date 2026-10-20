/**
 * Speech-to-text sometimes writes an English name in Hindi script ("रवि तेजा" for "Ravi Teja"). Intern names are in
 * Latin letters, so before matching names we spell Devanagari out in Latin. Rough on purpose: it only has to land
 * close enough for name matching. Text without Devanagari is returned untouched.
 */
const CONS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "f", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh",
  ष: "sh", स: "s", ह: "h", ळ: "l", क्ष: "ksh", ज्ञ: "gya", ड़: "d", ढ़: "dh", फ़: "f", ज़: "z", ख़: "kh", ग़: "g",
};
const VOWEL: Record<string, string> = { अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऋ: "ri", ऑ: "o" };
const MATRA: Record<string, string> = { "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ृ": "ri", "ॉ": "o", "ॅ": "e" };
const VIRAMA = "्";
const SIGNS: Record<string, string> = { "ं": "n", "ँ": "n", "ः": "h", "़": "" };

const isCons = (c: string | undefined) => !!c && c in CONS;

function word(w: string): string {
  const chars = [...w];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    let c = chars[i];
    // Letters written with a dot below (ड़, ज़) arrive as consonant + nukta.
    if (isCons(c) && chars[i + 1] === "़" && c + "़" in CONS) {
      c += "़";
      i++;
    }
    if (c in VOWEL) out += VOWEL[c];
    else if (c in MATRA) out += MATRA[c];
    else if (c in SIGNS) out += SIGNS[c];
    else if (c === VIRAMA) continue;
    else if (isCons(c)) {
      out += CONS[c];
      const next = chars[i + 1];
      // A consonant carries an "a" unless a vowel sign, a virama or the end of the word follows.
      if (next && next !== VIRAMA && !(next in MATRA) && !(next in SIGNS && next !== "ं" && next !== "ँ")) out += "a";
    } else out += c;
  }
  return out;
}

export function latinize(text: string): string {
  if (!/[ऀ-ॿ]/.test(text)) return text;
  return text
    .split(/(\s+)/)
    .map((p) => (/[ऀ-ॿ]/.test(p) ? word(p.replace(/[।॥]/g, ".")) : p))
    .join("");
}
