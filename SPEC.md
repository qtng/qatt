# QATT Description Code – Specification

Version: 0.1 preliminary

## 1. Syntax (BNF)

```text
<QATT-Code> ::= <Letter><Dot><Tone>  
<Letter>    ::= Ɂ | B | C | Ch | D | Dd | G | H | Kh | L | M | N | Ng | Nh | Ph | R | S | T | Th | Tr | V | X
<Dot>       ::= 0 | 1 | 2 | 3 | 4 | 5 | 6 | •0 | •1 | •2 | •3 | •4 | •5 |• 6
<Tone>      ::= +1 | +2 | +3 | +4 | -1 | -2 | -3 | -4
<IDS>       ::= ⿰<QATT-Code><QATT-Code> | ⿱<QATT-Code><QATT-Code> | ⿲<QATT-Code><QATT-Code><QATT-Code> | ⿳<QATT-Code><QATT-Code><QATT-Code>
```

## 2. Components Overview (Table)

| Component | Syntax / Options | Notes |
|-----------|-----------------|-------|
| Letter    | Ɂ, B, C, Ch, D, Dd, G, H, Kh, L, M, N, Ng, Nh, Ph, R, S, T, Th, Tr, V, X | Base sign (cán tự) |
| Dot (in stroke order) | 0, 1, 2, 3, 4, 4, 6 | Placement of dot in QATT order |
| Dot (in QATT order) | •0, •1, •2, •3, •4, •5, •6 | Placement on strokes |
| Tone (thanh điệu) | +1, +2, +3, +4, -1, -2, -3, -4 | plus sign for full tone symbol "ₒ", minus sign for half tone symbol "꜀", number designates corner placement (1=top-left, 2=top-right, 3=bottom-left,  4=bottom-right) |
| IDS       | ⿰, ⿱, ⿲, ⿳ | Ideographic sequences  

---

## 2. Component Meaning

1. **Base Symbol** – Base symbol (cán tự) from Quốc Âm Tân Tự, the symbol name is case sensitive, i.e. first letter is uppercase and subsequent letters are lowercase.  
2. **Dot Marking** – Optional dot (phẩy), the number indicates placement of dot. If the number is preceeed by a "•", the number indicates the order according to the original QATT instructions from the 19th century. Otherwise the number indicates placement as the corner number on **main stroke** or **support rectangle**. The **main stroke** (nét chính) is the stroke that connects all other strokes or lies between or next to them. The **support rectangle** (chữ nhật phụ) is the rectangle or parallelogram that is formed by the the remaining support strokes (nét phụ). The placement positions 1 to 4 indicate the corners on the support rectangle, while positions 5 and 6 indicate the start and end of the main stroke:
   * 1: placement on top left of support rectangle
   * 2: placement on top right of support rectangle
   * 3: placement on bottom left of support rectangle
   * 4: placement on bottom right of support rectangle
   * 5: placement on start of main stroke
   * 6: placement on send of main stroke
3. **Tone** – `°` = whole tone symbol (thanh điệu dương), `꜄` = half tone symbol (thanh điệu âm)
    - Number indicates corner: 1 = top-left, 2 = top-right, 3 = bottom-left, 4 = bottom-right
4. **IDS** – Combines multiple QATT codes to represent complex characters

---

## 3. Examples

| QATT-Code  | Description                                        | SVG |
|------------|---------------------------------------------------|-----|
| Tr1+8 | Base symbol Tr (廾) with dot on top left of support rectangle and half tone symbol at position 4 (bottom-left) | ꜀升 |
| Dd1+1 | Base symbol Dd (士) with dot at start of main stroke and full tone symbol at position 1 (top-left) | ⁰壬 |
| ⿱ThDd-2 | Combined character consisting of unmarked Th on top of Dd with half tone symbol at position 2 (top-right) | 芏꜄ |茱

---

## 4. Notes
- QATT Description Code describes **visual structure only**; no semantic meaning.  
- Extensible to new letters, dot positions, tones, and IDS sequences.

## 5. Reference Table

Reference table with dot positions in stroke order.

![QATT Lookup Table](qatt.png)
