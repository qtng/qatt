/*
QATT Code parser

qc = QattCode()
const parsed = qc.parse("ngdi2tng");

Result:
[
  {onset: "ng", rhyme: "dd", coda: "i", tone: 2, error: ""},
  {onset: "tt", rhyme: "ng", coda: "", tone: 0, error: ""}
]
*/


class QattCode {
            constructor() {
                this.BASE_2 = new Set(["ng", "tr", "dd", "th", "nh", "ch", "dz", "kh", "ph"]);
                this.BASE_1 = new Set(["z", "h", "g", "c", "l", "n", "t", "x", "s", "r", "m", "b", "v"]);
                
                // Neue Markierungen übersetzt in den entsprechenden Auslaut (Coda)
                this.MARKINGS = { 
                    "i": "i", 
                    "u": "u", 
                    "y": "n", 
                    "q": "ng", 
                    "w": "m" 
                };
                this.TONES = new Set(["0", "1", "2", "3", "4", "5", "6", "7"]);
            }

            isDoubled(str) {
                return str.length === 2 && str[0] === str[1] && this.BASE_1.has(str[0]);
            }

            isValid2(str) {
                return this.BASE_2.has(str) || this.isDoubled(str);
            }

            expand(str) {
                return (str.length === 1 && this.BASE_1.has(str) ? str + str : str);
            }

            parseChunk(input) {
                let str = input.toLowerCase().trim();
                // Neue saubere Datenstruktur gemäss Anforderung
                let res = { onset: "", rhyme: "", coda: "", tone: 0, error: "" };

                if (str.length === 0) return res;

                // 1. Ton parsen (gierig am Ende, Konvertierung zu Number)
                let lastChar = str.slice(-1);
                if (this.TONES.has(lastChar)) {
                    res.tone = parseInt(lastChar, 10);
                    str = str.slice(0, -1);
                }

                if (str.length === 0) return res; 

                // 2. Markierung parsen und sofort in den finalen Auslaut (Coda) übersetzen
                lastChar = str.slice(-1);
                if (this.MARKINGS[lastChar] !== undefined) {
                    res.coda = this.MARKINGS[lastChar];
                    str = str.slice(0, -1);
                }

                if (str.length === 0) {
                    res.error = "Konsonantenstamm fehlt.";
                    return res;
                }

                // 3. Konsonanten-Parsing (Onset & Rhyme)
                if (this.BASE_2.has(str) || (str.length === 1 && this.BASE_1.has(str))) {
                    let expanded = this.expand(str);
                    res.onset = expanded;
                    res.rhyme = expanded;
                } else if (this.isDoubled(str)) {
                    res.onset = str;
                    res.rhyme = str;
                } else {
                    let canRaw = "", chiRaw = "";
                    
                    if (str.length >= 2 && this.isValid2(str.slice(-2))) {
                        chiRaw = str.slice(-2);
                        canRaw = str.slice(0, -2);
                    } else {
                        chiRaw = str.slice(-1);
                        canRaw = str.slice(0, -1);
                    }

                    res.rhyme = this.expand(chiRaw);
                    res.onset = this.expand(canRaw);

                    if (!this.isValid2(res.rhyme)) res.error = `Invalid onset: '${chiRaw}'.`;
                    if (!this.isValid2(res.onset)) res.error += `Invalid rhyme: '${canRaw}'.`;
                }

                return res;
            }

            // Hauptfunktion für die unendliche Eingabekette
            parse(input) {
                const fullInput = input.toLowerCase();
                // Teilt den String nach jeder Zahl 0-7, entfernt leere Fragmente
                const blocks = fullInput.split(/(?<=[0-7])/).filter(b => b.trim().length > 0);
                
                return blocks.map(block => this.parseChunk(block));
            }
}

  
