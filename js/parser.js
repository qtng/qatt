/*
Parse a string into an object
containing syllabe parts.

The parsed object has these attributes:

```
    .onset
    .glide
    .vowel
    .coda
    .tone
    AND .code <----- qatt.js character code
```

The .code attribute can be used as
QATT character descriotion for qatt.js
Use:

````
    parser = new VietnameseParser()
    const parts = parser.parse("ca");
    console.log(parts.code, oarts);
````
*/

class VietnameseParser {
            static ONSETS = ["ngh", "ng", "nh", "gh", "ph", "th", "ch", "tr", "kh", "gi", "qu", "b", "c", "d", "đ", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "x"];
            static CODAS = ["ng", "nh", "ch", "m", "n", "p", "t", "c"];
            static VALID_VOWELS = [
                "ai", "ao", "au", "ay", "ây", "âu", "eo", "êu", "ia", "iê", "iêu", "iu", 
                "oi", "ôi", "ơi", "ua", "uô", "uôi", "ui", "ưa", "ưi", "ươ", "ươi", "ươu", "ưu", 
                "ya", "yê", "yêu",
                "a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y"
            ];
            
            static QATT_ONSET_MAP = {"p": "b", "đ": "d", "d": "dz", "ngh": "ng", "q": "c", "k": "c", "gh": "g"};
            static QATT_VOWEL_MAP = {
                "a": "a", "ă": "aw", "â": "aw2", "e": "e2", "ê": "e", "i": "i",
                "ia": "i2", "iê": "i2", "o": "o2", "ơ": "a2", "ô": "o", "u": "u",
                "ư": "y", "ua": "u2", "uô": "u2", "ưa": "y2", "ươ": "y2", "y": "i",
                "ya": "i2", "yê": "i2",
            };
            static TONE_INT_MAP = {"ngang": 0, "sac": 1, "huyen": 2, "hoi": 3, "nga": 4, "nang": 5};
            static DIACRITIC_MAP = { '\u0300': 'huyen', '\u0301': 'sac', '\u0309': 'hoi', '\u0303': 'nga', '\u0323': 'nang' };

            constructor() {
                // Normalisiere Listen für den Vergleich
                this.onsets = VietnameseParser.ONSETS.map(s => s.normalize('NFD').toLowerCase());
                this.codas = VietnameseParser.CODAS.map(s => s.normalize('NFD').toLowerCase());
                this.vowels = VietnameseParser.VALID_VOWELS.map(s => s.normalize('NFD').toLowerCase());
            }

            parse(word) {
                if (/[fjwz]/i.test(word) && !word.toLowerCase().startsWith('gi')) return null;

                let normalized = word.normalize('NFD').toLowerCase();
                let tone = 'ngang';
                let toneChar = '';

                // 1. Ton isolieren
                for (let char of normalized) {
                    if (VietnameseParser.DIACRITIC_MAP[char]) {
                        tone = VietnameseParser.DIACRITIC_MAP[char];
                        toneChar = char;
                        normalized = normalized.replace(char, '');
                        break;
                    }
                }

                let res = { onset: '', glide: '', vowel: '', coda: '', tone: tone };
                let temp = normalized;

                // 2. Anlaut
                for (let o of this.onsets) {
                    if (temp.startsWith(o)) {
                        res.onset = o;
                        temp = temp.substring(o.length);
                        break;
                    }
                }

                if (res.onset == "qu") {
                    res.onset = "q";
                    res.glide = "u";
                }

                // 3. Auslaut (Coda)
                for (let c of this.codas) {
                    if (temp.endsWith(c) && temp.length > c.length) {
                        let remainder = temp.substring(0, temp.length - c.length);
                        if (remainder.length > 0) {
                            res.coda = c;
                            temp = remainder;
                            break;
                        }
                    }
                }

                // 4. Glide (u/o) vs Vokal
                if (temp.length >= 2 && !this.vowels.includes(temp) && (temp.startsWith('u') || temp.startsWith('o'))) {
                    const first = temp[0];
                    const rest = temp.substring(1);
                    if (this.vowels.includes(rest)) {
                        res.glide = first;
                        res.vowel = rest;
                        temp = "";
                    }
                } else if (!temp && res.onset === "gi") {
                    res.vowel = "i";
                }

                // 5. Restlicher Vokal-Kern
                if (temp !== "" && this.vowels.includes(temp)) {
                    res.vowel = temp;
                    temp = "";
                }
                
                // Fallback für semi-vokale Auslaute (i/y/o/u am Ende)
                if (!res.coda && res.vowel.length > 1) {
                    const lastChar = res.vowel[res.vowel.length-1];
                    if (["i","y","o","u"].includes(lastChar)) {
                        res.coda = lastChar;
                        res.vowel = res.vowel.slice(0, -1);
                        if (lastChar == "y" || lastChar == "u") {
                            if (res.vowel == "a") res.vowel = "ă";
                        }
                    }
                }

                if (temp !== "" || res.vowel === "") return null;

                return this._finalize(res, toneChar);
            }

            _finalize(res, toneChar) {
                const toNFC = (s) => {
                    if (!s) return "";
                    let t = s.normalize('NFC');
                    if (s === res.vowel) {
                        let p = t.length - 2;
                        if (["iê", "uô", "ươ", "yê"].includes(t.substr(0,2))) p = 2;
                        if (p < 0) p = 0;
                        t = (t.slice(0, p + 1) + toneChar + t.slice(p + 1));
                    }
                    return t.normalize('NFC');
                };

                const code = [
                    VietnameseParser.QATT_ONSET_MAP[res.onset] || res.onset || "_",
                    (res.glide ? "w" : "") + (VietnameseParser.QATT_VOWEL_MAP[res.vowel.normalize('NFC')] || res.vowel),
                    (res.coda == "o" ? "u" : res.coda == "y" ? "i" : res.coda || ""),
                    VietnameseParser.TONE_INT_MAP[res.tone] || "0"
                ].join(",").replace("c,wo,", "c,waw2,");

                return {
                    code: code,
                    onset: res.onset,
                    glide: res.glide,
                    vowel: toNFC(res.vowel),
                    coda: res.coda,
                    tone: res.tone
                };
            }
}

