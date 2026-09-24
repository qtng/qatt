/*
QATT renderer

const q = new Qatt(options);

// Parses QattCode notation into list of QattCode objects.
// Primarily useful for online keyboards / IME,
// e.g. to normalize input, count glyphs (SVGs) in advance,
// show last typed word, or calculate cursor positions.
q.parse("ngdi2tng0"); // qatt code for "người ta"
// result: [
//   {input: "ngddi2" code: "ngdi2", onset:"ng", rhyme: "d", coda: "i", tone: 2},
//   {input: "tng0", code: "tng0", onset: "t", rhyme: "ng", coda: "", tone: 0}
// ]

// Renders QattCode notation as SVG, one per QattCode.
// Also accepts space separated internal render codes (i.e. comma separated onset, rhyme, coda, tone, e.g. "t,i2,ng,1")
q.render("ngdi2tng0", element); // two SVG, one for "ngdi2" and one for "tng0"

// use MutationObserver to automatically render
// the innerText of the registered tag
q.observe("TT");

*/

const PREFIX = "v2-";
const defaultSvgDefs = `<svg xmlns="http://www.w3.org/2000/svg"
    	style="height:4800px;width:2540px;"
    	id="svg">
    	<defs>

    	<path id="v2-a" data-onsetsize="xsmall" d="M60 10 v80 M50 90 h20 M65 35 h30 m-30 25 h30"/>
    	<path id="v2-a2" data-onsetsize="xsmall" d="M68 20 h25 m-8 0 v40 c0 5 0 15 -5 30 M80 44 h-18 m0 22 h18"/>
    	<path id="v2-aw" data-onsetsize="xsmall" d="M73 17 v52 M90 10 v40 c0 5 0 20 -4 40 M62 46 l37-10 M57 36v20"/>
    	<path id="v2-aw2" data-onsetsize="xsmall" d="M62 15 h36 M71 25 l-8 14 M80 20 v68 m-22-38 h44"/>
    	<path id="v2-e" data-onsetsize="xsmall" d="M55 15h20 M65 15 v70 M82 25 v50 M99 15 v70"/>
    	<path id="v2-e2" data-onsetsize="xsmall"  d="M58 10 h40 M58 26 l14-6 m-3 5 v50 M90 10 v75"/>
    	<path id="v2-i" data-onsetsize="xsmall"  d="M58 10 h40 M69 10 v65 M90 25 v60 m0-60 m-3-5l14 6"/>
    	<path id="v2-i2" data-onsetsize="xsmall"  d="M58 38 l32-5m-32 30l32-5 M74 13 v77 h1 l20-5"/>
    	<path id="v2-o" data-onsetsize="xsmall"  d="M58 15 h30 c-4 22 -8 45 -30 70 M64 38 M64 38m4-12l-10 20M64 38 c6 8 14 18 28 40"/>
    	<path id="v2-o2" data-onsetsize="xsmall" d="M88 10 c0 0 -8 40 -19 56 m-10-6l12 16 M64 23 c0 0 13 15 28 40 M64 86 h30"/>
    	<path id="v2-u2" data-onsetsize="xsmall" d="M60 25v45 m-2 4l14-14 M95 15 c-4 22 -7 45 -24 70 M71 28 c0 0 15 24 28 50"/>
    	<path id="v2-u" data-onsetsize="xsmall" d="M94 16v50 M82 20 c0 0 -8 40 -18 56 m-7-8l9 18 M62 30 c0 0 14 24 26 50"/>
    	<path id="v2-y" data-onsetsize="xsmall" d="M66 16 v65 M66 40 h28 m0-8v16 M67 60 l28 3"/>
		<path id="v2-y2" data-onsetsize="xsmall" d="M64 20 v50 M80 13 v58 h1 l12-5 M60 85 h35"/>

    	<path id="v2-_1" data-onsetsize="xsmall" d="M61 22 m-1-8 v16"/>
    	<path id="v2-_2" data-onsetsize="xsmall" d="M62 45 m-1-8 v16"/>
    	<path id="v2-_3" data-onsetsize="xsmall" d="M60 70 m-1-8 v16"/>
    	<path id="v2-_4" data-onsetsize="xsmall" d="M60 70 m33-3 m1-8 v16"/>
    	<path id="v2-_5" data-onsetsize="xsmall" d="M62 45 m26 0 m1-8 v16"/>
    	<path id="v2-_6" data-onsetsize="xsmall" d="M61 22 m30 0 m1-8 v16"/>
    	<path id="v2-_" d="M61 22 h30 M62 45 h26 M60 70 l34 -3"/>

    	<path id="v2-b" d="M62 30 c0 0 10 10 28 33 M82 15 c0 0 -7 40 -17 55 M57 85 h35"/>
    	<path id="v2-b1" data-onsetsize="xsmall" d="M62 30 m1 -8 l-5 15"/>
    	<path id="v2-b2" data-onsetsize="xsmall" d="M82 15 m-17 55 m-6-4 l10 11"/>
    	<path id="v2-b3" data-onsetsize="xsmall" d="M57 85 m0-8 v16"/>
    	<path id="v2-b4" data-onsetsize="xsmall" d="M57 85 m35 0 m0-8 v16"/>
    	<path id="v2-b5" data-onsetsize="xsmall" d="M62 30 m28 33 m5 -8 l-6 15"/>
    	<path id="v2-b6" data-onsetsize="xsmall" d="M82 15 m-8 -1 h16"/>

    	<path id="v2-c1" data-onsetsize="xsmall" d="M60 40 m-1 -8 v16"/>
    	<path id="v2-c2" data-onsetsize="xsmall" d="M58 58 m-1 -8 v16"/>
    	<path id="v2-c3" data-onsetsize="xsmall" d="M58 58 m30 0 m-7 4 l-3 10"/>
    	<path id="v2-c4" data-onsetsize="xsmall" d="M90 16 m0 64 m-8 0 h16"/>
    	<path id="v2-c5" data-onsetsize="xsmall" d="M90 16 m-8 0 h16"/>
    	<path id="v2-c6" data-onsetsize="xsmall" d="M60 40 m30 0 m-10 -4 l-2 -9"/>
    	<path id="v2-c" d="M90 16 v64 M60 40 h30 M58 58 h30"/>

    	<path id="v2-ch1" data-onsetsize="xsmall" d="M78 20 m-8 -1 h16"/>
    	<path id="v2-ch2" data-onsetsize="xsmall" d="M60 42 m-1 -8 v16"/>
    	<path id="v2-ch3" data-onsetsize="xsmall" d="M60 64 m-1 -8 v16"/>
    	<path id="v2-ch4" data-onsetsize="xsmall" d="M78 20 m-5 62 m-6 1 h16"/>
    	<path id="v2-ch5" data-onsetsize="xsmall" d="M60 64 m35-6 m1 -8 v16"/>
    	<path id="v2-ch6" data-onsetsize="xsmall" d="M60 42 m35-6 m1 -8 v16"/>
  		<path id="v2-ch" d="M60 42 l35-6 M60 64 l35-6 M78 20 c0 30 0 45 -5 62"/>

    	<path id="v2-d1" data-onsetsize="xsmall" d="M78 20 m-8-1 h16"/>
    	<path id="v2-d2" data-onsetsize="xsmall" d="M62 40 m-1 -8 v16"/>
    	<path id="v2-d3" data-onsetsize="xsmall" d="M78 20 m0 44 m-12 -8 l11 5"/>
    	<path id="v2-d4" data-onsetsize="xsmall" d="M60 70 m-1 -8 v16"/>
    	<path id="v2-d5" data-onsetsize="xsmall" d="M60 70 m36-3 m1 -8 v16"/>
    	<path id="v2-d6" data-onsetsize="xsmall" d="M62 40 m32 0 m1 -8 v16"/>
    	<path id="v2-d" d="M62 40 h32 M78 20 v44 M60 70 l36 -3"/>

    	<path id="v2-dz1" data-onsetsize="xsmall" d="M78 20 m-8 -1 h16"/>
    	<path id="v2-dz2" data-onsetsize="xsmall" d="M60 36 m-1 -8 v16"/>
    	<path id="v2-dz3" data-onsetsize="xsmall" d="M60 58 m-1 -8 v16"/>
    	<path id="v2-dz4" data-onsetsize="xsmall" d="M78 20 m-5 62 m-6 1 h16"/>
    	<path id="v2-dz5" data-onsetsize="xsmall" d="M60 58 m35 6 m1 -8 v16"/>
    	<path id="v2-dz6" data-onsetsize="xsmall" d="M60 36 m35 6 m1 -8 v16"/>
    	<path id="v2-dz" d="M60 36 l35 6 M60 58 l35 6 M78 20 c0 30 0 45 -5 62"/>

    	<path id="v2-g1" data-onsetsize="xsmall" d="M60 16 m-8 0 h16"/>
    	<path id="v2-g2" data-onsetsize="xsmall" d="M60 16 m0 64 m-8 0 h16"/>
    	<path id="v2-g3" data-onsetsize="xsmall" d="M61 58 m4 1 l10 12"/>
    	<path id="v2-g4" data-onsetsize="xsmall" d="M61 58 m30 0 m0 -8 v16"/>
    	<path id="v2-g5" data-onsetsize="xsmall" d="M60 40 m30 0 m0 -8 v16"/>
    	<path id="v2-g6" data-onsetsize="xsmall" d="M60 40 m4 0 l10-12"/>
    	<path id="v2-g" d="M60 16 v64 M60 40 h30 M61 58 h30"/>

    	<path id="v2-h1" data-onsetsize="xsmall" d="M69 20 m-9 0 h16"/>
    	<path id="v2-h2" data-onsetsize="xsmall" d="M69 20 m0 46 m-2 -5 l-9 -7"/>
    	<path id="v2-h3" data-onsetsize="xsmall" d="M59 72 m-2 -8 v16"/>
    	<path id="v2-h4" data-onsetsize="xsmall" d="M59 72 m36 0 m2 -8 v16"/>
    	<path id="v2-h5" data-onsetsize="xsmall" d="M85 20 m0 46 m2 -5 l9 -7"/>
    	<path id="v2-h6" data-onsetsize="xsmall" d="M85 20 m-7 0 h16"/>
    	<path id="v2-h" d="M69 20 v46 M85 20 v46 M59 72 h36"/>

    	<path id="v2-kh1" data-onsetsize="xsmall" d="M61 18 m0 -8 v16"/>
    	<path id="v2-kh2" data-onsetsize="xsmall" d="M67 20 m0 8 l-8 10"/>
    	<path id="v2-kh3" data-onsetsize="xsmall" d="M60 76 m0 -8 v16"/>
    	<path id="v2-kh4" data-onsetsize="xsmall" d="M60 75 m36 0 m0 -8 v16"/>
    	<path id="v2-kh5" data-onsetsize="xsmall" d="M67 18 m10 54 m0 -4 l10 -10"/>
    	<path id="v2-kh6" data-onsetsize="xsmall" d="M61 18 m30 0 m0 -8 v16"/>
    	<path id="v2-kh" d="M61 18 h30 M67 20 l10 54 M60 76 h36"/>

    	<path id="v2-l1" data-onsetsize="xsmall" d="M79 18 m-7 0 h14"/>
    	<path id="v2-l2" data-onsetsize="xsmall" d="M63 16 m-10 -3 h16"/>
    	<path id="v2-l3" data-onsetsize="xsmall" d="M63 16 m-5 64 m-6 0 l15 3"/>
    	<path id="v2-l4" data-onsetsize="xsmall" d="M79 18 m0 54 m-7 0 h14"/>
    	<path id="v2-l5" data-onsetsize="xsmall" d="M95 16 m0 58 m-6 4 h14"/>
    	<path id="v2-l6" data-onsetsize="xsmall" d="M95 16 m-6 -4 h14"/>
    	<path id="v2-l" d="M63 16 v30 c0 5 0 20 -5 34 M79 18 v54 M95 16 v58"/>

    	<path id="v2-m1" data-onsetsize="xsmall" d="M60 18 m-2 -8 v16"/>
    	<path id="v2-m2" data-onsetsize="xsmall" d="M66 35 m0-8 l-6 14"/>
    	<path id="v2-m3" data-onsetsize="xsmall" d="M85 30 m-25 50 m-1 -10 l6 14"/>
    	<path id="v2-m4" data-onsetsize="xsmall" d="M66 35 m23 42 m0 4 l6-14"/>
    	<path id="v2-m5" data-onsetsize="xsmall" d="M85 30 m-2-4 l10 15"/>
    	<path id="v2-m6" data-onsetsize="xsmall" d="M60 18 m30 0 m2 -8 v16"/>
    	<path id="v2-m" d="M60 18 h30 M85 30 c0 0 -8 30 -20 50 M66 35 c0 0 12 18 23 42"/>

    	<path id="v2-n1" data-onsetsize="xsmall" d="M60 16 m-8 0 h16"/>
		<path id="v2-n2" data-onsetsize="xsmall" d="M60 16 m0 64 m-8 0 h16"/>
		<path id="v2-n3" data-onsetsize="xsmall" d="M61 46 m3 1 l7 14"/>
		<path id="v2-n4" data-onsetsize="xsmall" d="M79 24 m0 44 m-8 0 h16"/>
		<path id="v2-n5" data-onsetsize="xsmall" d="M60 46 m34 0 m0-8 v16"/>
		<path id="v2-n6" data-onsetsize="xsmall" d="M79 24 m-8 0 h16"/>
		<path id="v2-n" d="M60 16 v64 M60 46 h34 M79 24 v44"/>

    	<path id="v2-ng1" data-onsetsize="xsmall" d="M60 22 m-2 -8 v16"/>
    	<path id="v2-ng2" data-onsetsize="xsmall" d="M70 22 m-1 6 l-10 10"/>
    	<path id="v2-ng3" data-onsetsize="xsmall" d="M70 22 m-6 50 m-6 1 h16"/>
    	<path id="v2-ng4" data-onsetsize="xsmall" d="M88 22 m0 51 m-8 0 h16"/>
    	<path id="v2-ng5" data-onsetsize="xsmall" d="M88 22 m1 6 l10 10"/>
    	<path id="v2-ng6" data-onsetsize="xsmall" d="M60 22 m38 0 m2 -8 v16"/>
    	<path id="v2-ng" d="M60 22 h38 M70 22 c0 20 0 30 -6 50 M88 22 v51"/>

    	<path id="v2-nh1" data-onsetsize="xsmall" d="M68 20 m-8 0 h16"/>
    	<path id="v2-nh2" data-onsetsize="xsmall" d="M59 42 m-3 -8 v16"/>
    	<path id="v2-nh3" data-onsetsize="xsmall" d="M68 20 m-3 55 m-8 0 h16"/>
    	<path id="v2-nh4" data-onsetsize="xsmall" d="M86 20 m0 56 m-8 0 h16"/>
    	<path id="v2-nh5" data-onsetsize="xsmall" d="M59 42 m38 8 m1 -8 v16"/>
    	<path id="v2-nh6" data-onsetsize="xsmall" d="M86 20 m-8 0 h16"/>
    	<path id="v2-nh" d="M59 42 l38 8 M68 20 c0 20 0 35 -3 55 M86 20 v56"/>

    	<path id="v2-ph1" data-onsetsize="xsmall" d="M57 30 m1-7l-5 15"/>
		<path id="v2-ph2" data-onsetsize="xsmall" d="M77 20 m-18 56 m-4-8l6 15"/>
		<path id="v2-ph3" data-onsetsize="xsmall" d="M57 30 m26 50 m6-1l-12 4"/>
		<path id="v2-ph4" data-onsetsize="xsmall" d="M89 16 m0 50 m-8 0 h16"/>
		<path id="v2-ph5" data-onsetsize="xsmall" d="M89 16 m-6 0 h14"/>
		<path id="v2-ph6" data-onsetsize="xsmall" d="M77 20 m-2-6l8 14"/>
		<path id="v2-ph" data-onsetsize="xsmall" d="M89 16v50 M77 20 c0 0 -8 40 -18 56 M57 30 c0 0 14 24 26 50"/>

		<path id="v2-r1" data-onsetsize="xsmall" d="M61 75 m0-57 m-8 0 h16"/>
		<path id="v2-r2" data-onsetsize="xsmall" d="M61 75 m-8 0 h16"/>
		<path id="v2-r3" data-onsetsize="xsmall" d="M61 75 m0-57 m2 12 m20 14 m-1 1 l-4 8"/>
		<path id="v2-r4" data-onsetsize="xsmall" d="M92 18 m0 56 m-8 0 h16"/>
		<path id="v2-r5" data-onsetsize="xsmall" d="M92 18 m-8 0 h16"/>
		<path id="v2-r6" data-onsetsize="xsmall" d="M61 75 m0-57 m2 12 m4 2 l8 -8"/>
		<path id="v2-r" d="M61 75 v-57 m2 12 l20 14 M92 18 v56"/>

    	<path id="v2-s1" data-onsetsize="xsmall" d="M61 18 m-8 0 h16"/>
    	<path id="v2-s2" data-onsetsize="xsmall" d="M61 18 m0 57 m-8 0 h16"/>
    	<path id="v2-s3" data-onsetsize="xsmall" d="M63 71 m4 -2 l8 8"/>
    	<path id="v2-s4" data-onsetsize="xsmall" d="M92 18 m0 56 m-8 0 h16"/>
    	<path id="v2-s5" data-onsetsize="xsmall" d="M92 18 m-8 0 h16"/>
    	<path id="v2-s6" data-onsetsize="xsmall" d="M63 71 m20 -11 m-1 -1 l-4 -8"/>
    	<path id="v2-s" d="M61 18 v57 M63 71 l20 -11 M92 18 v56"/>

    	<path id="v2-t1" data-onsetsize="xsmall" d="M77 24 m-8 0 h16"/>
    	<path id="v2-t2" data-onsetsize="xsmall" d="M60 46 m0-8 v16"/>
    	<path id="v2-t3" data-onsetsize="xsmall" d="M77 24 m0 44 m-8 0 h16"/>
    	<path id="v2-t4" data-onsetsize="xsmall" d="M60 46 m34 0 m-3 1 l-7 14"/>
    	<path id="v2-t5" data-onsetsize="xsmall" d="M94 16 m0 64 m-8 0 h16"/>
    	<path id="v2-t6" data-onsetsize="xsmall" d="M94 16 m-8 0 h16"/>
    	<path id="v2-t" d="M94 16 v64 M60 46 h34 M77 24 v44"/>

    	<path id="v2-th1" data-onsetsize="xsmall" d="M68 20 m-8 0 h16"/>
    	<path id="v2-th2" data-onsetsize="xsmall" d="M59 50 m-3 -8 v16"/>
    	<path id="v2-th3" data-onsetsize="xsmall" d="M68 20 m-3 55 m-8 0 h16"/>
    	<path id="v2-th4" data-onsetsize="xsmall" d="M86 20 m0 56 m-8 0 h16"/>
    	<path id="v2-th5" data-onsetsize="xsmall" d="M59 50 m38 -8 m1 -8 v16"/>
    	<path id="v2-th6" data-onsetsize="xsmall" d="M86 20 m-8 0 h16"/>
    	<path id="v2-th" d="M59 50 l38 -8 M68 20 c0 20 0 35 -3 55 M86 20 v56"/>

    	<path id="v2-tr1" data-onsetsize="xsmall" d="M64 20 m0-8 v16"/>
		<path id="v2-tr2" data-onsetsize="xsmall" d="M76 20 m-1 3 l-12 12"/>
		<path id="v2-tr3" data-onsetsize="xsmall" d="M60 45 m0-8 v16"/>
		<path id="v2-tr4" data-onsetsize="xsmall" d="M76 20 m0 58 m-8 0 h16"/>
		<path id="v2-tr5" data-onsetsize="xsmall" d="M60 45 m34 0 m0-8 v16"/>
		<path id="v2-tr6" data-onsetsize="xsmall" d="M64 20 m26 0 m0-8 v16"/>
		<path id="v2-tr" d="M76 20 v58 M64 20 h26 M60 45 h34"/>

    	<path id="v2-v1" data-onsetsize="xsmall" d="M60 20 m-8 0 h16"/>
		<path id="v2-v2" data-onsetsize="xsmall" d="M60 20 m0 50 m-2 4l14-14"/>
		<path id="v2-v3" data-onsetsize="xsmall" d="M95 15 m-24 70 m-8 1 h16"/>
		<path id="v2-v4" data-onsetsize="xsmall" d="M71 28 m28 50 m5 -2 l-13 8"/>
		<path id="v2-v5" data-onsetsize="xsmall" d="M95 15 m-8-1 h16"/>
		<path id="v2-v6" data-onsetsize="xsmall" d="M71 28 m2-8 l-6 15"/>
		<path id="v2-v" data-onsetsize="xsmall" d="M60 20v50 M95 15 c-4 22 -7 45 -24 70 M71 28 c0 0 15 24 28 50"/>

    	<path id="v2-x1" data-onsetsize="xsmall" d="M61 18 m0 -8 v16"/>
    	<path id="v2-x2" data-onsetsize="xsmall" d="M89 19 m-10 51 m0 -4 l-8 -10"/>
    	<path id="v2-x3" data-onsetsize="xsmall" d="M60 74 m0 -8 v16"/>
    	<path id="v2-x4" data-onsetsize="xsmall" d="M60 74 m36 0 m0 -8 v16"/>
    	<path id="v2-x5" data-onsetsize="xsmall" d="M89 19 m-0 6 l8 10"/>
    	<path id="v2-x6" data-onsetsize="xsmall" d="M61 18 m32 0 m3 -8 v16"/>
    	<path id="v2-x" d="M61 18 h32 M89 19 l-10 51 M60 74 h36"/>

    	<path id="v2-_-medial" d="M9 22 m0-8 v16"/>
    	<path id="v2-_-small" d="M11 22 h30 M12 45 h26 M10 70 l34 -3"/>
    	<path id="v2-b-medial" d="M14 25 m0-8 l-5 16"/>
    	<path id="v2-b-small" d="M14 25 l30 35 M35 10 c0 0 -7 40 -20 65 M10 80 l38 -5"/>
    	<path id="v2-c-medial" d="M14 40 m0-8 v16"/>
    	<path id="v2-c-small" d="M44 18 v60 M14 40 h30 M12 62 l30 -4"/>
    	<path id="v2-ch-medial" d="M28 20 m-8 0 h16"/>
    	<path id="v2-ch-small" d="M10 42 l35-6 M10 64 l35-6 M28 20 c0 30 0 45 -5 62"/>
    	<path id="v2-d-medial" d="M28 20 m-8 0 h16"/>
    	<path id="v2-d-small" d="M12 40 h32 M28 20 v44 M10 70 l36 -3"/>
    	<path id="v2-dz-medial" d="M28 20 m-8 0 h16"/>
    	<path id="v2-dz-small" d="M10 36 l35 6 M10 58 l35 6 M28 20 c0 30 0 45 -5 62"/>
    	<path id="v2-gi-small" d="M10 36 l35 6 M10 58 l35 6 M28 20 v62"/>
    	<path id="v2-g-medial" d="M16 18 m-8 0 h16"/>
    	<path id="v2-g-small" d="M16 18 v65 M16 40 h28 M17 60 l28 3"/>
    	<path id="v2-h-medial" d="M20 26 m-8 0 h16"/>
    	<path id="v2-h-small" d="M36 20 v46 M20 26 v37 M10 70 l36 -3"/>
    	<path id="v2-kh-medial" d="M11 18 m-4 -8 v16"/>
    	<path id="v2-kh-small" d="M41 18 h-30 m6 0 v2 l10 54M10 76 h36"/>
    	<path id="v2-l-medial" d="M30 16 m-6 0 h12"/>
    	<path id="v2-l-small" d="M15 16 v30 c0 5 0 20 -5 34 M30 16 v58 M45 16 v58"/>
    	<path id="v2-m-medial" d="M10 15 m0 -8 v16"/>
    	<path id="v2-m-small" d="M10 15 h30 c-4 22 -8 45 -30 70 M16 38 c6 8 14 18 28 40"/>
    	<path id="v2-n-medial" d="M15 16 m-8 0 h16"/>
    	<path id="v2-n-small" d="M15 16 v64 M34 23 v44 M20 45 h26"/>
    	<path id="v2-ng-medial" d="M10 22 m-2-8 v16"/>
    	<path id="v2-ng-small" d="M10 22 h38 M20 22 c0 20 0 40 -10 50 M38 22 v51"/>
    	<path id="v2-nh-medial" d="M20 15 m-10 0 h16"/>
    	<path id="v2-nh-small" d="M8 40 l40 8 M20 15 c0 20 0 45 -10 55 M37 15 v56"/>
    	<path id="v2-ph-medial" d="M9 28 m0-8 l-5 16"/>
    	<path id="v2-ph-small" d="M45 16 v50 M33 15 c-4 22 -8 45 -28 70 M9 28 c6 8 14 24 28 50"/>
    	<path id="v2-r-medial" d="M10 18 m-8 0 h16"/>
    	<path id="v2-r-small" d="M11 70 v-52 m2 12 l20 14 M44 18 v56"/>
    	<path id="v2-s-medial" d="M11 18 m-8 0 h16"/>
    	<path id="v2-s-small" d="M11 18 v52 m0 -4 l22 -8 M44 18 v56"/>
    	<path id="v2-t-medial" d="M24 24 m-8 0 h16"/>
    	<path id="v2-t-small" d="M44 16 v64 M10 46 h34 M24 24 v44"/>
    	<path id="v2-th-medial" d="M20 15 m-10 0 h16"/>
    	<path id="v2-th-small" d="M8 48 l40 -10 M20 15 c0 20 0 45 -10 55 M37 15 v56"/>
    	<path id="v2-tr-medial" d="M10 20 m0 -8 v16"/>
    	<path id="v2-tr-small" d="M28 20 v56 M10 20 h36 M13 45 h30"/>
    	<path id="v2-v-medial" d="M10 16 m-8 0 h16"/>
    	<path id="v2-v-small" d="M10 16 v56 M44 15 c-4 22 -8 45 -30 70 M23 28 c4 8 10 24 20 50"/>
    	<path id="v2-x-medial" d="M11 18 m0 -8 v16"/>
    	<path id="v2-x-small" d="M11 18 h32 m-4 0 l-10 52 M10 74 h36"/>

    	<path id="v2-UU" d="M25 22 h45 v1 c0 0 -15 35 -55 55 M30 27 c0 0 14 33 50 50"/>
    	<path id="v2-II" d="M25 22 v55 l45-4 M70 22 v55"/>
		<path id="v2-U" d="M70 22 c0 0 -15 35 -55 55 M25 22 c0 0 15 35 55 55"/>
    	<path id="v2-I" d="M52 15 l-8 68 M25 35 l50 8 M22 58 l50 8"/>
    	<path id="v2-M" d="M22 18 h55 m-8 20 c0 0 -12 20 -46 45 M30 37 c0 0 12 20 42 46"/>
    	<path id="v2-N" d="M20 15 v70 M22 45 l57 4 M53 20 v60"/>
    	<path id="v2-P" d="M55 15 c0 0 -10 30 -30 63 M20 80 l60 0 M28 24 l40 40"/>
    	<path id="v2-C" d="M20 37 h55 M20 63 h55 M75 15 v70"/>
    	<path id="v2-T" d="M17 50 l58 -4 M43 20 v60 M75 15 v70"/>
    	<path id="v2-NG" d="M15 20 h66 M34 20 c0 20 0 40 -10 60 M62 20 v60"/>
    	<path id="v2-NH" d="M15 45 l66 10 M34 20 c0 20 0 40 -10 60 M62 20 v60"/>
		<path id="v2-CH" d="M48 15 l8 68 M25 40 l50 -8 M28 64 l50 -8"/>

    	<path id="qt0" d="M2 90 m0 14 c-12 0 -12 -14 -6 -14"/>
    	<path id="qt1" d="M98 -5 c12 0 12 14 0 14"/>
    	<path id="qt2" d="M2 90 c12 0 12 14 0 14 c-12 0 -12 -14 0 -14 l10-1"/>
    	<path id="qt3" d="M2 -5 c-12 0 -12 14 0 14"/>
    	<path id="qt4" d="M2 -5 c12 0 12 14 0 14 c-12 0 -12 -14 0 -14 l10-1"/>
    	<path id="qt5" d="M98 -5 c12 0 12 14 0 14 c-12 0 -12 -14 0 -14 l-10-1"/>
    	<path id="qt6" d="M98 90 m0-5v5 c12 0 12 14 0 14"/>
		<path id="qt7" d="M98 90 m0-5v5 c12 0 12 14 0 14 c-12 0 -12 -14 0 -14"/>

    	<path id="square" style="opacity:.0" stroke-width="2" d="M-9 -9 h118 v118 h-118 z"/>
    	</defs>
    	</svg>`;

// Kodierung: welches Vokal+Finale+Ton-Kombi welchem zusammengesetzten
// Glyphen-Code (Rahmen + Positions-Strich) entspricht.
const defaultQattEncoding = {

	  a2: "_2",
      anh: "_3", awnh: "_3", a2nh: "_3",
      a2n: "_4",
      a2i: "_5",
      a2m: "_6",
	
      wa2: "_2",
      wanh: "_3", wawnh: "_3", wa2nh: "_3",
      wa2n: "_4",
      wa2i: "_5",
      om: "_6",

      a: "ng2",
      ang: "ng3",
      an: "ng4",
      ai: "ng5",
      am: "ng6",

      wa: "h2",
      wang: "h3",
      wan: "h4",
      wai: "h5",
      wam: "h6",

      e2: "g2",
      e2ng: "g3",
      e2n: "g4",
      y2: "g5",
      e2m: "g6",

      we2: "c2",
      we2ng: "c3",
      we2n: "c4",
      y: "c5",
      om: "c6",

      au: "tr2",
      yng: "tr3",
      yi: "tr4",
      yn: "tr5",
      ym: "tr6",

      wau: "d2",
      y2ng: "d3",
      y2i: "d4",
      y2n: "d5",
      y2m: "d6",

      aw2u: "n2",
      aw2ng: "n3",
      aw2i: "n4",
      aw2n: "n5",
      aw2m: "n6",

      waw2u: "t2",
      waw2ng: "t3",
      waw2i: "t4",
      waw2n: "t5",
      um: "t6",

      awu: "th2",
      awng: "th3",
      awi: "th4",
      awn: "th5",
      awm: "th6",

      wawu: "nh2",
      wawng: "nh3",
      wawi: "nh4",
      wawn: "nh5",
      wawm: "nh6",

      a2ng: "ch2",
      i2ng: "ch3",
      i2: "ch4",
      i2n: "ch5",
      i2m: "ch6",

      wa2ng: "dz2",
      wi2ng: "dz3",
      wi2: "dz4",
      wi2n: "dz5",
      u2m: "dz6",

      eng: "x2",
      enh: "x3",
      e: "x4",
      en: "x5",
      em: "x6",

      weng: "kh2",
      wenh: "kh3",
      we: "kh4",
      wen: "kh5",
      wem: "kh6",
	
      ing: "s2",
      inh: "s3",
      i: "s4",
      in: "s5",
      im: "s6",

      wing: "r2",
      winh: "r3",
      wi: "r4",
      win: "r5",
      wim: "r6",

      o: "m2",
      on: "m3",
      oi: "m4",
      yu: "m5",
      y2u: "m6",

      u: "b2",
      un: "b3",
      ui: "b4",
      eu: "b5",
      i2u: "b6",

      o2: "v2",
      o2n: "v3",
      o2i: "v4",
      e2u: "v5",
      we2u: "v6",

      u2: "ph2",
      u2n: "ph3",
      u2i: "ph4",
      iu: "ph5",
      wiu: "ph6"
};

const qattCodeDigitLetters = {
  /*empty coda*/ "": {default: 0},
  /*-U coda*/ "u": {default: 1},
  /*-NG coda*/ q: { default: 2, n: 0 },
  /*-N coda*/ y: { default: 3 },
  /*-I coda*/ i: { default: 4 },
  /*-M coda*/ w: { default: 5 },
};

function digitForLetter(letter, base) {
  const entry = qattCodeDigitLetters[letter || ""];
  if (!entry) return null;
  return String(base in entry ? entry[base] : entry.default);
}

class Qatt {
  constructor(options = {}) {
    this.qattEncoding = options.qattEncoding || defaultQattEncoding;
    this.defs = options.defs || defaultSvgDefs;
    this.container = options.container || document.createElement("div");
    this.charFontsize = options.charFontsize || "1em";
    this.svgns = "http://www.w3.org/2000/svg";
    this.cache = new Map();
    this.defsElement = null;
    this._initializeDefs();
    this._injectFallbackStyles();
	this.qc = new QattCode();
  }

  _initializeDefs() {
    if (!this.defs) return;
    this.defsElement = document.createElement("div");
    this.defsElement.innerHTML = this.defs;
    this.defsElement.style.display = "none";
    document.body.append(this.defsElement);
  }

  // Injiziert einmalig ein minimales Default-Stylesheet, damit die gerenderten SVGs auch
  // ganz ohne eigenes CSS sichtbar sind ("ready to use"). ":where(tt)" statt "tt" sorgt
  // dafür, dass der "tt"-Teil selbst 0 Spezifität hat - eine eigene Regel wie "tt svg{...}"
  // gewinnt also immer automatisch dagegen, egal an welcher Stelle im Dokument sie steht.
  _injectFallbackStyles() {
    if (document.getElementById("qatt-fallback-style")) return;
    const style = document.createElement("style");
    style.id = "qatt-fallback-style";
    style.textContent = `:where(tt) svg {
  width: 1.4em;
  height: 1.4em;
  position: relative;
  top: -.125em;
  stroke-width: 6px;
  stroke: currentColor;
  fill: transparent;
}`;
    document.head.appendChild(style);
  }

  _getDefById(id) {
    return this.defsElement && id ? this.defsElement.querySelector(`#${CSS.escape(id)}`) : null;
  }

  _getPost(hasGlide, nucleus) {
    let base = nucleus;
    if (base?.charAt(0) === "w") base = base.substr(1);
    let post = "small";
    if (["a", "a2"].includes(base)) post = "large";
    if (["o", "o2", "e", "e2", "i2", "u2", "y"].includes(base)) post = "xsmall";
    if (hasGlide) post = (post === "large") ? "small" : "xsmall";
    return post;
  }

  _useG(g, id) {
    const use = document.createElementNS(this.svgns, "use");
    use.setAttribute("href", "#" + id);
    use.setAttribute("vector-effect", "non-scaling-stroke");
    use.style.vectorEffect = "non-scaling-stroke";
    g.appendChild(use);
    return g;
  }

  // render a glyph code, e.g. t,i2,ng,1 - or, without any comma, the
  // compact notation (e.g. nhhh3, nnhhg0, bbnnn1cchh3 ...)
  render(text, root) {
    if (!text.includes(",")) {
      text = this._decodeCompact(text);
    }
    text = text.replace(/\+/g, "").replace(/^[^,\s]*,/g, "$&+").replace(/ [^,]*,/g, "$&+");
    return this._renderText(text, root);
  }

  _decodeCompact(text) {
    return this.parse(text).map(q => {
      return [
		  q.onset == "z" ? "_" : q.onset,
		  q.rhyme + (digitForLetter(q.coda, q.rhyme)).toString(),
		  "",
		  q.tone.toString()
	  ].join(",")
	}).join(" ");
  }

  parse(text) {
	  return this.qc.parse(text);
  }

  _renderText(text, root) {
    const target = root || this.container;
    const fragment = document.createDocumentFragment();

    text.split(" ").forEach(t => {
      if (t.includes(",")) {
        if (this.cache.has(t)) {
          this.cache.get(t).forEach(node => fragment.appendChild(node.cloneNode(true)));
        } else {
          const tempContainer = document.createElement("div");
          this._renderSvg(tempContainer, ...t.split(","));

          const nodes = Array.from(tempContainer.childNodes);
          if (nodes.length > 0) {
            this.cache.set(t, nodes);
            nodes.forEach(node => fragment.appendChild(node.cloneNode(true)));
          }
        }
      } else {
        this._renderChar(t, fragment);
      }
    });

    target.innerHTML = "";
    target.appendChild(fragment);
  }

  _renderSvg(root, initial, vowel, final, tone, isCoda) {
    if (vowel && vowel.startsWith("+")) {
      vowel = vowel.substr(1);
      if (["t", "p", "c", "ch"].includes(final)) {
        if (final === "t") final = "n";
        else if (final === "p") final = "m";
        else if (final === "c") final = "ng";
        else if (final === "ch") final = "nh";
        if (String(tone) === "1") tone = 6;
        else if (String(tone) === "5") tone = 7;
      }
      const qv = this.qattEncoding[vowel + ((!final || !isNaN(Number(final))) ? "" : final)];
      if (qv) {
        vowel = qv;
        final = null;

        if (vowel.endsWith("7")) initial = "w" + initial;
        else if (vowel.endsWith("8")) final = "II";
        else if (vowel.endsWith("9")) final = "UU";
        vowel = vowel.replace(/[789]$/, "");
      }
    }

    const svg = document.createElementNS(this.svgns, "svg");
    let g;

    if (initial || vowel) {
      g = document.createElementNS(this.svgns, "g");
      this._useG(g, "square");
      svg.appendChild(g);
    }

    if (initial) {
      const post = this._getPost(vowel?.charAt(0) === "w", vowel);
      let id = PREFIX + initial.replace("w", "") + "-" + post;
      const hasMark = initial.indexOf("w") === 0;
      if (!this._getDefById(id)) id = id.replace("xsmall", "small").replace("large", "xxsmall");
      if (!this._getDefById(id)) id = id.replace("xxsmall", "xsmall").replace("xsmall", "small");
      this._useG(g, id);
      if (hasMark) this._useG(g, PREFIX + initial.replace("w", "") + "-medial");
      initial = initial.replace("w", "");
    }

    if (vowel) {
      let vStr = vowel;
      if (vStr.charAt(0) === "w") {
        vStr = vStr.substr(1);
        this._useG(g, `${PREFIX}${initial}-medial`);
      }

      if (!"aeiouy".includes(vStr[0]) && /\d$/.test(vStr)) {
        this._useG(g, PREFIX + vStr.replace(/\d/, ""));
        if (tone || final) {
          this._useG(g, "qt" + (tone || final || 0));
        }
        tone = "";
      }
      this._useG(g, PREFIX + vStr);
    }

    svg.setAttribute("viewBox", "-10 -25 120 125");
    svg.style.aspectRatio = "13 / 15";
    svg.style.verticalAlign = "bottom";
    svg.style.overflow = "visible";
    svg.setAttribute("preserveAspectRatio", "none");

    if (g) {
      const nobr = root.tagName === "NOBR" ? root : document.createElement("nobr");
      nobr.append(svg);
      if (nobr !== root) root.appendChild(nobr);
      this._handleTones(nobr, initial, vowel, final, tone, g);
    } else {
      this._handleTones(root, initial, vowel, final, tone, g);
    }
    return g;
  }

  _handleTones(root, initial, vowel, final, tone, g) {
    if (g && tone != null && tone !== "" && tone >= 0 && tone < 8) {
      this._useG(g, "qt" + (tone || 0));
    }
    if (final) {
      this._renderSvg(root, "", final.toUpperCase(), 0, null, true);
    }
  }

  _renderChar(t, root) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      display: "inline-block",
      width: "110px", height: "110px", lineHeight: "110px",
      textAlign: "center", verticalAlign: "bottom",
      marginBottom: "30px", fontSize: this.charFontsize, fontWeight: "400"
    });
    el.textContent = t;
    root.appendChild(el);
  }

  observe(tagName = "TT") {
    tagName = tagName.toUpperCase();
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeName === tagName) {
            this.render(n.textContent.trim(), n);
          } else if (n.nodeType === 1) {
            n.querySelectorAll(tagName).forEach(tag => {
              this.render(tag.textContent.trim(), tag);
            });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(tagName).forEach(tag => {
      this.render(tag.textContent.trim(), tag);
    });
  }
}

/*
Qatt Code tokenizer, renders a continuous string
of qatt codes into a list of qatt code objects.
e.g
qc = new QattCode();
qc.parse("ngddi0"); // -> [{input: "ngddi0", code: "ngdi5", onset:"ng", rhyme: "d", coda: "i", tone: 0}]

codes are normalized, e.g. dd becomes d.
*/
class QattCode {
            constructor() {
                this.BASE_2 = new Set(["ng", "tr", "th", "nh", "ch", "dz", "kh", "ph"]);
                this.BASE_1 = new Set(["z", "h", "g", "c", "l", "d", "n", "t", "x", "s", "r", "m", "b", "v"]);
                 this.MARKINGS = { 
                    "i": "i", 
                    "u": "u", 
                    "y": "y", "n": "y",
                    "q": "q", "ng": "q", "nh": "q",
                    "w": "w", "m": "w",
                };
                this.TONES = new Set(["0", "1", "2", "3", "4", "5", "6", "7"]);
            }
            isDoubled(str) {
                return str.length === 2 && str[0] === str[1] && this.BASE_1.has(str[0]);
            }
            isValid2(str) {
                return this.BASE_2.has(str) || this.isDoubled(str);
            }
            parseChunk(input) {
                let str = input.toLowerCase().trim();
                let res = { onset: "", rhyme: "", coda: "", tone: null, error: "" };
                if (str.length === 0) return res;
                let lastChar = str.slice(-1);
                if (this.TONES.has(lastChar)) {
                    res.tone = parseInt(lastChar, 10);
                    str = str.slice(0, -1);
                }
                if (str.length === 0) return res; 
                lastChar = str.slice(-1);
                if (this.MARKINGS[lastChar] !== undefined) {
                    res.coda = this.MARKINGS[lastChar];
                    str = str.slice(0, -1);
                }
                if (str.length === 0) {
                    res.error = "Onset missing.";
                    return res;
                }
              if (this.BASE_2.has(str) || (str.length === 1 && this.BASE_1.has(str))) {
                    res.onset = str;
                    res.rhyme = str;
                } else if (this.isDoubled(str)) {
                    res.onset = str[0];
                    res.rhyme = str[0];
                } else {
                    let canRaw = "", chiRaw = "";
                    
                    if (str.length >= 2 && this.isValid2(str.slice(-2))) {
                        chiRaw = str.slice(-2);
                        canRaw = str.slice(0, -2);
                    } else {
                        chiRaw = str.slice(-1);
                        canRaw = str.slice(0, -1);
                    }
                    res.rhyme = this.isDoubled(chiRaw) ? chiRaw[0] : chiRaw;
                    res.onset = this.isDoubled(canRaw) ? canRaw[0] : canRaw;
                    if (!this.isValid2(res.rhyme)) res.error = `Invalid onset: '${chiRaw}'.`;
                    if (!this.isValid2(res.onset)) res.error += `Invalid rhyme: '${canRaw}'.`;
                }
				res.input = input;
				res.code = res.onset + res.rhyme + res.coda + res.tone;
                return res;
            }
            parse(input) {
                const fullInput = input.toLowerCase();
                const blocks = fullInput.split(/(?<=[0-7])/).filter(b => b.trim().length > 0);
                return blocks.map(block => this.parseChunk(block));
            }
}


