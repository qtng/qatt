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
                "ya", "yê", "yêu", "yu",
                "a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y"
            ];
            
            static QATT_ONSET_MAP = {"p": "b", "đ": "d", "d": "dz", "ngh": "ng", "q": "c", "k": "c", "gh": "g", "gi": "dz"};
            // The 22 base shapes in the order of the rhyme tables (row i of a table = shape SHAPES[i]; z is the shape without strokes, written "_" in codes)
            static SHAPES = "l z ng h g c tr d n t th nh ch dz x kh s r m b v ph".split(" ");

            // Rhyme tables of the known decodings: DECODINGS[name][row][column] = rhyme written with the shape of the row and the marking stroke
            // column + 2 (a sixth column is the shape without marking stroke).
            static DECODINGS = {
                    qatt: [
                        ["ơ", "ơnh", "ơn", "ơi", "ơm"],
                        ["uơ", "uơnh", "uơn", "uơi", "ôm"],
                        ["a", "ang", "an", "ai", "am"],
                        ["oa", "oang", "oan", "oai", "oam"],
                        ["e", "eng", "en", "ươ", "em"],
                        ["oe", "oeng", "oen", "ư", "om"],
                        ["ưu", "ưng", "ưi", "ưn", "ưm"],
                        ["ươu", "ương", "ươi", "ươn", "ươm"],
                        ["âu", "âng", "ây", "ân", "âm"],
                        ["uâu", "uâng", "uây", "uân", "um"],
                        ["au", "ăng", "ay", "ăn", "ăm"],
                        ["oau", "oăng", "oay", "oăn", "oăm"],
                        ["ơng", "iêng", "iê", "iên", "iêm"],
                        ["uơng", "uyêng", "uyê", "uyên", "uôm"],
                        ["êng", "ênh", "ê", "ên", "êm"],
                        ["uêng", "uênh", "uê", "uên", "uêm"],
                        ["ing", "inh", "i", "in", "im"],
                        ["uyng", "uynh", "uy", "uyn", "uym"],
                        ["ô", "ôn", "ôi", "ao", "oao"],
                        ["u", "un", "ui", "eo", "oeo"],
                        ["o", "on", "oi", "iêu", "êu"],
                        ["ua", "uôn", "uôi", "iu", "uyu"]
                    ],
                    qoex: [
                        ["", "anh", "ơn", "ơi", "ơm", "ơ"],
                        ["", "oanh", "uơn", "uơi", "", "uơ"],
                        ["", "ang", "an", "ai", "am", "a"],
                        ["", "oang", "oan", "oai", "oam", "oa"],
                        ["", "eng", "en", "", "em", "e"],
                        ["", "oeng", "oen", "", "", "oe"],
                        ["ưu", "ưng", "ưi", "ưn", "ưm", "ư"],
                        ["ươu", "ương", "ươi", "ươn", "ươm", "ươ"],
                        ["âu", "âng", "ây", "ân", "âm", "â"],
                        ["uâu", "uâng", "uây", "uân", "", "uâ"],
                        ["au", "ăng", "ay", "ăn", "ăm", "ă"],
                        ["oau", "oăng", "oay", "oăn", "oăm", "oă"],
                        ["", "iêng", "", "iên", "iêm", "iê"],
                        ["", "", "", "uyên", "", "uyê"],
                        ["", "ênh", "ê", "ên", "êm", "ê"],
                        ["", "uênh", "uê", "uên", "uêm", "uê"],
                        ["", "inh", "i", "in", "im", "i"],
                        ["", "uynh", "uy", "uyn", "uym", "uy"],
                        ["", "ôn", "ôi", "ao", "oao", "ô"],
                        ["", "un", "ui", "eo", "oeo", "u"],
                        ["", "on", "oi", "iêu", "êu", "o"],
                        ["", "uôn", "uôi", "iu", "uyu", "uô"]
                    ],
                    qoex2: [
                        ["ơ", "anh", "ơn", "ơi", "ơm", ""],
                        ["uơ", "oanh", "uơn", "uơi", "", ""],
                        ["a", "ang", "an", "ai", "am", "ao"],
                        ["oa", "oang", "oan", "oai", "oam", "oao"],
                        ["e", "eng", "en", "", "em", "eo"],
                        ["oe", "oeng", "oen", "", "", "oeo"],
                        ["ư", "ưng", "ưi", "ưn", "ưm", "ưu"],
                        ["ươ", "ương", "ươi", "ươn", "ươm", "ươu"],
                        ["", "âng", "ây", "ân", "âm", "âu"],
                        ["", "uâng", "uây", "uân", "", "uâu"],
                        ["", "ăng", "ay", "ăn", "ăm", "au"],
                        ["", "oăng", "oay", "oăn", "oăm", "oau"],
                        ["", "iêng", "iê", "iên", "iêm", "iêu"],
                        ["", "", "uyê", "uyên", "", ""],
                        ["", "ênh", "ê", "ên", "êm", "êu"],
                        ["", "uênh", "uê", "uên", "uêm", "uêu"],
                        ["", "inh", "i", "in", "im", "iu"],
                        ["", "uynh", "uy", "uyn", "uym", "uyu"],
                        ["ô", "ôn", "ôi", "", "", "ôm"],
                        ["u", "un", "ui", "", "", "um"],
                        ["o", "on", "oi", "", "", "om"],
                        ["ua", "uôn", "uôi", "", "", "uôm"]
                    ],
                    omniglot: [
                        ["ê", "ênh", "ơn", "uơ", "um"],
                        ["oe", "ung", "oan", "uy", "âm"],
                        ["e", "ông", "an", "i", "uâm"],
                        ["oa", "oen", "oeng", "ưa", "em"],
                        ["a", "en", "eng", "ư", "uôm"],
                        ["uê", "uơn", "uênh", "ơ", "ôm"],
                        ["âu", "ưng", "ai", "ưn", "om"],
                        ["uâu", "ooeng", "oai", "ươn", "ơm"],
                        ["ao", "âng", "ay", "ăn", "ươm"],
                        ["oai", "uâng", "oay", "oăn", "uơm"],
                        ["au", "ăng", "ơi", "ân", "êm"],
                        ["oao", "oăng", "uơi", "uân", "im"],
                        ["uông", "iêng", "ia", "ên", "iêm"],
                        ["uưng", "uyêng", "uay", "uên", "am"],
                        ["ương", "anh", "ây", "iên", "oam"],
                        ["ang", "oanh", "uây", "uyên", "ăm"],
                        ["oang", "inh", "ưi", "in", "oăm"],
                        ["ong", "uynh", "ươi", "uyn", "ưm"],
                        ["ô", "ôn", "ôi", "ưu", "ươu"],
                        ["o", "un", "ui", "iu", "iêu"],
                        ["ua", "on", "oi", "êu", "eo"],
                        ["u", "uôn", "uôi", "uêu", "oeo"]
                    ]
                };

            // Hợp Thư: the rhymes the tables lack (ong 2, ung 3, uông 4) are written with one shape, the one of the onset: the shape with the marking
            // stroke of the rhyme, a joiner, the plain shape (code of parse(): .hop, e.g. vong -> "v2,v,,0"; the onset field carries the stroke).
            // ông is the plain shape alone ("v,,,0": no rhyme)
            static HOP_THU = { "ong": 2, "ung": 3, "uông": 4, "ông": 0 };

            // Rhymes the table lacks but writes like another one (tried after the table, see _lookup)
            static RHYME_SUBSTITUTES = { "anh": "ơnh", "oanh": "uơnh" };

            // Syllables ending in c, ch, t, p use the rhyme of the nasal twin and an entering tone (6 = âm nhập, 7 = dương nhập)
            static OPEN_DIPHTHONG = { ia: "iê", ya: "yê", ua: "uô", "ưa": "ươ" };

            static STOP_TWIN = { "c": "ng", "ch": "nh", "t": "n", "p": "m" };

            static QATT_VOWEL_MAP = {
                "a": "a", "ă": "aw", "â": "aw2", "e": "e2", "ê": "e", "i": "i",
                "ia": "i2", "iê": "i2", "o": "o2", "ơ": "a2", "ô": "o", "u": "u",
                "ư": "y", "ua": "u2", "uô": "u2", "ưa": "y2", "ươ": "y2", "y": "i",
                "ya": "i2", "yê": "i2",
            };
            static TONE_INT_MAP = {"ngang": 0, "sac": 1, "huyen": 2, "hoi": 3, "nga": 4, "nang": 5};
            static DIACRITIC_MAP = { '\u0300': 'huyen', '\u0301': 'sac', '\u0309': 'hoi', '\u0303': 'nga', '\u0323': 'nang' };

            // decoding: name of a table in VietnameseParser.DECODINGS, or a table itself (rows of rhymes, see DECODINGS)
            constructor(decoding = "qatt") {
                this.setDecoding(decoding);
                // Normalisiere Listen für den Vergleich
                this.onsets = VietnameseParser.ONSETS.map(s => s.normalize('NFD').toLowerCase());
                this.codas = VietnameseParser.CODAS.map(s => s.normalize('NFD').toLowerCase());
                this.vowels = VietnameseParser.VALID_VOWELS.map(s => s.normalize('NFD').toLowerCase());
            }

            // Chooses the decoding used for the "qatt" code of parse(): a name or a table.
            setDecoding(decoding) {
                const table = typeof decoding === "string" ? VietnameseParser.DECODINGS[decoding] : decoding;
                if (!Array.isArray(table)) throw new Error("Unknown decoding: " + decoding);
                this.decoding = decoding;
                this.rhymes = new Map(); // rhyme -> code of its glyph, e.g. "ư" -> "c5"
                table.forEach((row, i) => row.forEach((rhyme, j) => {
                    if (!rhyme || this.rhymes.has(rhyme)) return;
                    const shape = VietnameseParser.SHAPES[i] === "z" ? "_" : VietnameseParser.SHAPES[i];
                    this.rhymes.set(rhyme, shape + (j < 5 ? j + 2 : ""));
                }));
                this.glyphs = new Map(); // glyph code -> rhyme, the reverse of this.rhymes (also the glyphs whose rhyme another glyph has first)
                table.forEach((row, i) => row.forEach((rhyme, j) => {
                    if (!rhyme) return;
                    const shape = VietnameseParser.SHAPES[i] === "z" ? "_" : VietnameseParser.SHAPES[i];
                    this.glyphs.set(shape + (j < 5 ? j + 2 : ""), rhyme);
                }));
            }

            // ---------- the reverse: QATT glyph -> Quốc Ngữ ----------
            // The spelling of a syllable given as { onset, rhyme, tone, hop } (what QattText.decode makes of a cell of QATT text):
            // onset: shape of the onset ("_" none), rhyme: code of the rhyme glyph in the table, e.g. "c5" (no rhyme: ông), tone: 0 to 8 as in
            // the qatt code, hop: "ong", "ung", "uông" for the Hợp Thư writing (the onset shape carries the rhyme). null if there is no reading.
            toQuocNgu({ onset, rhyme, tone = 0, hop }) {
                let rh = hop || (rhyme === "" ? "ông" : this.glyphs.get(rhyme));
                if (rh === undefined) return null;
                const OPEN = { "iê": "ia", "uyê": "uya", "uô": "ua", "ươ": "ưa" }; // the table writes the open rhymes of the diphthongs with their closed form
                if (rh in OPEN) rh = OPEN[rh];
                if (rh == "ơnh") rh = "anh"; // anh / oanh stand for ơnh / uơnh where the table lacks them (see RHYME_SUBSTITUTES)
                if (rh == "uơnh") rh = "oanh";
                let t = [null, "sac", "huyen", "hoi", "nga", "nang"][tone] || null;
                if (tone == 6 || tone == 7) { // entering tones: the nasal of the twin becomes the stop
                    const stop = { ng: "c", nh: "ch", n: "t", m: "p" };
                    const m = /(ng|nh|n|m)$/.exec(rh);
                    if (!m) return null;
                    rh = rh.slice(0, -m[1].length) + stop[m[1]];
                    t = tone == 6 ? "sac" : "nang";
                }
                const BACK = { "_": "", dz: "d", d: "đ", b: "b", c: "c", g: "g", ng: "ng" };
                let on = onset in BACK ? BACK[onset] : onset;
                const next = rh[0];
                if (onset == "c") { // c, k or q
                    if (/^(uâ|uê|uy|uơ|oa|oă|oe)/.test(rh)) { on = "qu"; rh = rh.slice(1); if (rh[0] == "o") rh = "u" + rh.slice(1); if (rh == "âc") rh = "ôc"; } // quốc is written like quấc
                    else if (/^(e|ê|i|y|iê|ia)/.test(rh)) on = "k";
                } else if (onset == "g" && /^(e|ê|i)/.test(rh)) on = "gh";
                else if (onset == "ng" && /^(e|ê|i)/.test(rh)) on = "ngh";
                return on + this._tonePlaced(rh, t);
            }

            // the tone mark on the right vowel of a rhyme (modern spelling: the vowel with a hat or horn, else the middle one, with a coda the second, else the first: hòa, thúy)
            _tonePlaced(rhyme, tone) {
                const MARK = { sac: "\u0301", huyen: "\u0300", hoi: "\u0309", nga: "\u0303", nang: "\u0323" };
                if (!tone) return rhyme;
                const chars = Array.from(rhyme.normalize("NFC"));
                const isVowel = c => /[aăâeêioôơuưy]/i.test(c);
                const vowels = chars.map((c, i) => isVowel(c) ? i : -1).filter(i => i >= 0);
                // the glide u of qu is not a vowel of the rhyme
                let at;
                const modified = vowels.filter(i => /[ăâêôơư]/i.test(chars[i]));
                if (modified.length) at = modified[modified.length - 1];
                else if (vowels.length == 1) at = vowels[0];
                else if (vowels.length == 3) at = vowels[1];
                else if (vowels.length == 2) {
                    const closed = vowels[1] < chars.length - 1; // a coda follows: the second vowel (toán), else the first (hòa, thúy, mái)
                    at = closed ? vowels[1] : vowels[0];
                } else return rhyme;
                chars[at] = (chars[at].normalize("NFD")[0] + (chars[at].normalize("NFD").slice(1)) + MARK[tone]).normalize("NFC");
                return chars.join("");
            }

            // Result: .code is the older code of the phoneme glyphs (the former renderer.js, removed), .qatt the code of the decoding (qatt.js, see _qattCode)
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
                // what is written after the onset, as in the spelling (the rhyme looked up in the decoding)
                let spelling = temp.normalize('NFC');
                if (res.onset == "qu") spelling = spelling == "a" ? "oa" : "u" + (spelling == "ôc" ? "âc" : spelling);   // special rules: quốc is treated like quấc; qua is oa (not ua, which is the open form of uô, as in cua)
                if (res.onset == "gi" && spelling == "") spelling = "i";

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

                return this._finalize(res, toneChar, spelling);
            }

            // Code for qatt.js after the decoding: "onset,shape+marking,,tone", e.g. tự -> "t,c5,,5".
            // The rhyme (glide, vowel and coda together) is looked up in the rhyme table; syllables ending in c, ch, t, p take the
            // rhyme of their nasal twin and an entering tone (sắc 6, nặng 7). null if the rhyme is not in the table.
            _qattCode(res, spelling) {
                const { rhyme, tone } = this._rhymeAndTone(res, spelling);
                const glyph = this._lookup(rhyme, res);
                if (!glyph) return null;
                const onset = VietnameseParser.QATT_ONSET_MAP[res.onset] || res.onset || "_";
                return [onset, glyph, "", tone].join(",");
            }

            // The glyph of a rhyme: the table first, then the substitutes: after qu the glide u is written o (quen = qoen),
            // and anh / oanh are written ơnh / uơnh where the table has no anh / oanh
            _lookup(rhyme, res) {
                const candidates = [rhyme];
                if (res.onset == "q" && rhyme.startsWith("u")) candidates.push("o" + rhyme.slice(1));
                for (const r of candidates.slice()) { const alt = VietnameseParser.RHYME_SUBSTITUTES[r]; if (alt) candidates.push(alt); }
                for (const r of candidates.slice()) { const m = /^(.*?)(ia|ya|ua|ưa)$/.exec(r); if (m) candidates.push(m[1] + VietnameseParser.OPEN_DIPHTHONG[m[2]]); } // the open ia, ua, ưa are the rhymes iê, uô, ươ where the table has only those (chia = chiê)
                for (const r of candidates) if (this.rhymes.has(r)) return this.rhymes.get(r);
                return null;
            }

            _rhymeAndTone(res, spelling) {
                let rhyme = spelling, tone = VietnameseParser.TONE_INT_MAP[res.tone] || 0;
                const twin = VietnameseParser.STOP_TWIN[res.coda];
                if (twin) {
                    rhyme = rhyme.slice(0, rhyme.length - res.coda.length) + twin;
                    if (res.tone == "sac") tone = 6;
                    else if (res.tone == "nang") tone = 7;
                }
                return { rhyme, tone };
            }

            // Hợp Thư code for a rhyme that the table lacks (ong, ung, uông), else null: "shape+mark,shape,,tone"
            _hopCode(res, spelling) {
                const { rhyme, tone } = this._rhymeAndTone(res, spelling);
                const mark = VietnameseParser.HOP_THU[rhyme];
                if (mark === undefined || this.rhymes.has(rhyme)) return null;
                const shape = VietnameseParser.QATT_ONSET_MAP[res.onset] || res.onset || "_";
                return mark ? [shape + mark, shape, "", tone].join(",") : [shape, "", "", tone].join(",");
            }

            _finalize(res, toneChar, spelling) {
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
                    qatt: this._qattCode(res, spelling),
                    hop: this._hopCode(res, spelling),
                    onset: res.onset,
                    glide: res.glide,
                    vowel: toNFC(res.vowel),
                    coda: res.coda,
                    tone: res.tone
                };
            }
}

