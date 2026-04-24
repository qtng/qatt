/*
QATT renderer

const options = {};
const renderer = new SvgGlyphRenderer(options);

let type = 0; // traditional QATT
// type = -1 // trditional QATT with extra final
// type = 1 // simplified QATT
// type = 2 // simplified QATT with fused tones

const element = document.createElement("div");
renderer.render("t,i2,ng,1", element, optionalQattType);

// use mutationObserver to automatically render
// the innerText of the registered tag.
// The used Qatt type is read from the data-type attribute or
// falls back to localStorage.qattType if not specified.
renderer.observe("TT");
*/

const defaultSvgDefs = `<svg xmlns="http://www.w3.org/2000/svg"
    	style="height:4800px;width:2540px;"
    	id="svg">
    	<defs>
    
    	<path id="w-a"   d="M70 35 h27 M85 10 v40 c0 5 0 20 -5 40"/>
    	<path id="w-a2"  d="M70 35 h27 M85 10 v70 c0 10 0 10 -15 9"/>
    	<path id="w-aw"  d="M60 35 h40 M70 15 v45 M90 10 v40 c0 5 0 20 -5 40"/>
    	<path id="w-aw2" d="M60 35 h40 M70 15 v45 M90 10 v70 c0 10 0 10 -15 9"/>
    	<path id="w-i"   d="M60 36 h27 M70 13 v72 c0 0 0 5 5 5 c15 0 15 0 15 -5"/>
    	<path id="w-i2"  d="M54 30 h26 M62 13 v36 h23 c0 0 0 20 -15 40"/>
    	<path id="w-e"   d="M54 36 h29 M60 18 v40 M75 13 v72 c0 0 0 5 5 5 c12 0 12 0 12 -5"/>
    	<path id="w-e2"  d="M54 30 h32 M60 15 v35 M75 13 v36 h15 c0 5 0 22 -22 40"/>
    	
    	<path id="a" d="M70 13 v72 l1 -4 l22 -5"/>
	<path id="a2" d="M67 30 h22 v30 c0 5 0 15 -5 30"/>
	<path id="aw" d="M70 17 v45 M90 10 v40 c0 5 0 20 -5 40"/>
	<path id="aw2" d="M65 15 h25 m-3 2 c0 0 -4 16 -22 32 M80 40 v46"/>
	<path id="e" d="M60 10 h30 M75 10 v75"/>
	<path id="e2" d="M60 15 h32 m-4 2 c0 0 -10 13 -30 25 M69 42 v41 M88 40 v42"/>
	<path id="i" d="M82 10 c-2 20 -5 50 -24 80 M76 52 l18 36"/>
	<path id="i2" d="M58 38 h27 M70 13 v72 l1 -4 l22 -5"/>
	<path id="o" d="M58 15 h30 c-4 22 -8 45 -30 70 M64 38 c6 8 14 18 28 40"/>
	<path id="o2" d="M56 30 h26 M72 10 l-5 45 l20 0 v1 c0 0 -6 24 -15 35"/>
	<path id="u" d="M56 40 l30-14 v45 l-8 -1 M68 15 v72"/>
	<path id="u2" d="M72 10 c0 0 -5 40 -13 66 M54 80 l33 -7 M82 58 l8 20"/>
	<path id="y" d="M56 15 h30 v45 l-10 -1 M65 15 v72"/>
	<path id="y2" d="M66 20 v40 M82 13 v72 h1 l10 -4"/>		
    	
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
    	<path id="v2-dz-medial" d="M28 20 m-8 0 h16"/>
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
    	
    	<!--consonants-->
	<path id="_-medial" d="M10 22 m0-10 v20"/>
	<path id="_-large" d="M12 22 h44 M10 70 l48 -4"/>
	<path id="_-small" d="M11 22 h38 M10 70 l40 -3"/>
	<path id="_-xsmall" d="M11 22 h30 M10 70 l34 -3"/>
	
	<path id="b-medial" d="M10 32 l-4 16"/>
	<path id="b-large" d="M10 40 h40 M35 10 c0 0 -7 40 -20 66 M10 80 l40 -5"/>
	<path id="b-small" d="M10 40 h38 M35 10 c0 0 -7 40 -20 66 M10 80 l40 -5"/>
	<path id="b-xsmall" d="M10 40 h36 M35 10 c0 0 -7 40 -20 66 M10 80 l40 -5"/>
	
	<path id="c-medial" d="M12 18 m0-10 v20"/>
	<path id="c-large" d="M12 18 h43 c-2 35 -2 65 -15 60 M35 44 l-25 15"/>
	<path id="c-small" d="M12 18 h40 c-2 35 -2 65 -15 60 M35 44 l-25 15"/>
	<path id="c-xsmall" d="M12 18 h32 c-2 35 -2 65 -15 60 M28 44 l-18 12"/>
	
	<path id="ch-medial" d="M10 48 m0-10 v20"/>
	<path id="ch-large" d="M10 48 h46 M33 20 v62"/>
	<path id="ch-small" d="M10 48 h44 M32 20 v62"/>
	<path id="ch-xsmall" d="M10 48 h40 M30 20 v62"/>
	
	<path id="d-large-medial" d="M34 20 m-10 0 h20"/>
	<path id="d-small-medial" d="M32 20 m-10 0 h20"/>
	<path id="d-xsmall-medial" d="M28 20 m-10 0 h20"/>
	<path id="d-large" d="M34 20 v46 M10 70 l48 -4"/>
	<path id="d-small" d="M32 20 v44 M10 70 l44 -3"/>
	<path id="d-xsmall" d="M28 20 v44 M10 70 l36 -3"/>
	
	<path id="dz-medial" d="M36 10 m-10 0 h20"/>
	<path id="dz-large-medial" d="M38 10 m-10 0 h20"/>
	<path id="dz-large" d="M38 10 c-2 20 -6 50 -26 70 M34 45 l20 34"/>
	<path id="dz-small" d="M36 10 c-2 20 -5 50 -24 70 M32 45 l18 34"/>
	<path id="dz-xsmall" d="M36 10 c-2 20 -5 50 -24 70 M32 45 l18 34"/>
	<path id="gi-medial" d="M36 10 m-10 0 h20"/>
	<path id="gi-large-medial" d="M38 10 m-10 0 h20"/>
	<path id="gi-large" d="M38 10 c-2 20 -6 50 -26 70 M34 45 l20 34"/>
	<path id="gi-small" d="M36 10 c-2 20 -5 50 -24 70 M32 45 l18 34"/>
	<path id="gi-xsmall" d="M36 10 c-2 20 -5 50 -24 70 M32 45 l18 34"/>
	
	<path id="ph-medial" d="M12 36 m0-10 l-3 20"/>
	<path id="ph-large" d="M12 36 h40 c-2 15 -2 48 -15 42 M30 16 c0 10 0 33 -20 62"/>
	<path id="ph-small" d="M12 36 h36 c-2 15 -2 48 -15 42 M30 16 c0 10 0 33 -20 62"/>
	<path id="ph-xsmall" d="M12 36 h32 c-2 15 -2 48 -15 42 M24 16 c0 10 0 33 -14 62"/>
	
	<path id="g-medial" d="M15 15 m-10 0 h20"/>
	<path id="g-large" d="M15 15 v60 c0 0 0 10 10 10 h25 c0 0 5 0 7 -10 M15 40 l30 -5"/>
	<path id="g-small" d="M15 15 v60 c0 0 0 10 10 10 h22 c0 0 5 0 7 -10 M15 40 l30 -5"/>
	<path id="g-xsmall" d="M15 15 v60 c0 0 0 10 10 10 h17 c0 0 5 0 7 -10 M15 40 l25 -4"/>
	
	<path id="h-medial" d="M37 20 m-10 0 h20"/>
	<path id="h-xsmall-medial" d="M30 20 m-10 0 h20"/>
	<path id="h-large" d="M37 20 v46 M12 28 v36 M10 70 l48 -3"/>
	<path id="h-small" d="M36 20 v46 M11 28 v37 M10 70 l44 -3"/>
	<path id="h-xsmall" d="M30 20 v46 M11 28 v37 M10 70 l36 -3"/>
	
	<path id="kh-medial" d="M12 18 m0 -10 l-8 20"/>
	<path id="kh-large" d="M12 18 h44 M16 18 v46 l42 -7"/>
	<path id="kh-small" d="M11 18 h42 M15 18 v47 l40 -6"/>
	<path id="kh-xsmall" d="M11 18 h30 M15 18 v48 l30 -6"/>
	
	<path id="l-medial" d="M17 16 m-10 0 h20"/>
	<path id="l-small-medial" d="M16 16 m-10 0 h20"/>
	<path id="l-xsmall-medial" d="M15 16 m-10 0 h20"/>
	<path id="l-large" d="M17 16 v30 c0 5 0 20 -5 34 M48 16 v58"/>
	<path id="l-small" d="M16 16 v30 c0 5 0 20 -5 34 M44 16 v58"/>
	<path id="l-xsmall" d="M15 16 v30 c0 5 0 20 -5 34 M40 16 v58"/>
	
	<path id="m-medial" d="M10 15 m0 -10 v20"/>
	<path id="m-large" d="M10 15 h40 v1 c-8 22 -15 45 -40 69 M16 38 c10 8 20 18 34 36"/>
	<path id="m-small" d="M10 15 h40 v1 c-8 22 -15 45 -40 69 M16 38 c10 8 20 18 34 36"/>
	<path id="m-xsmall" d="M10 15 h30 v1 c-4 22 -8 45 -30 69 M16 38 c6 8 14 18 28 40"/>
	
	<path id="n-medial" d="M22 16 m-10 0 h20"/>
	<path id="n-large" d="M22 16 v60 M23 46 l33 3"/>
	<path id="n-small" d="M20 16 v60 M21 46 l33 3"/>
	<path id="n-xsmall" d="M20 16 v60 M21 46 l25 3"/>
	
	<path id="ng-medial" d="M12 18 m0 -10 v20"/>
	<path id="ng-large" d="M12 18 h43 c-2 35 -2 65 -15 60 M30 23 c0 10 0 28 -20 55"/>
	<path id="ng-small" d="M12 18 h40 c-2 35 -2 65 -15 60 M30 23 c0 10 0 28 -20 55"/>
	<path id="ng-xsmall" d="M12 18 h32 c-2 35 -2 65 -15 60 M24 22 c0 10 0 28 -14 55"/>
	
	<path id="nh-medial" d="M15 16 m0 -10 v20"/>
	<path id="nh-large" d="M15 16 h33 c0 0 -6 30 -38 64 M36 47 c0 0 9 12 19 28"/>
	<path id="nh-small" d="M15 16 h32 c0 0 -6 30 -38 64 M35 47 c0 0 9 12 19 28"/>
	<path id="nh-xsmall" d="M15 16 h26 c0 0 -6 30 -30 64 M30 50 c0 0 9 12 18 28"/>
	
	<path id="r-medial" d="M12 18 m3-10 l-15 20"/>
	<path id="r-large" d="M12 18 v52 M12 18 l44 0 v56"/>
	<path id="r-small" d="M11 18 v52 M11 18 l36 0 v56"/>
	<path id="r-xsmall" d="M11 18 v52 M11 18 l33 0 v56"/>
	
	<path id="s-medial" d="M12 15 m-10 0 h20"/>
	<path id="s-large" d="M12 18 v47 M10 70 l45 -9 M56 18 v52"/>
	<path id="s-small" d="M11 18 v47 M10 70 l37 -7 M48 18 v52"/>
	<path id="s-xsmall" d="M11 18 v47 M10 70 l33 -7 M44 18 v52"/>
	
	<path id="t-medial" d="M10 46 m0-10 l-2 20"/>
	<path id="t-large" d="M42 16 v60 M10 46 l30 -3"/>
	<path id="t-small" d="M40 16 v60 M10 46 l28 -3"/>
	<path id="t-xsmall" d="M38 16 v60 M10 46 l26 -3"/>
	
	<path id="th-medial" d="M13 16 m0 -10 v20"/>
	<path id="th-xsmall-medial" d="M10 16 m0 -10 v20"/>
	<path id="th-large" d="M15 16 h33 c0 0 0 30 -30 64 M15 46 h44"/>
	<path id="th-small" d="M14 16 h30 c0 0 0 30 -30 64 M14 46 h40"/>
	<path id="th-xsmall" d="M10 16 h28 c0 0 0 30 -28 64 M12 46 h32"/>
	
	<path id="tr-medial" d="M10 18 m0 -10 v20"/>
	<path id="tr-large" d="M36 20 v46 c0 0 0 10 -14 7 M10 18 l48 0"/>
	<path id="tr-small" d="M34 20 v46 c0 0 0 10 -14 7 M10 18 l44 0"/>
	<path id="tr-xsmall" d="M30 20 v46 c0 0 0 10 -14 7 M10 18 l36 0"/>
	
	<path id="x-medial" d="M11 19 m0 -10 v20"/>
	<path id="x-large" d="M12 18 h40 M52 18 l-3 51 M10 70 h48"/>
	<path id="x-small" d="M11 20 h38 M49 20 l-2 45 M10 70 h44"/>
	<path id="x-xsmall" d="M11 20 h30 M41 20 l-2 45 M10 70 h34"/>
	
	<path id="v-medial" d="M35 9 m-10 0 h20"/>
	<path id="v-large" d="M35 10 c0 0 -7 40 -20 66 M10 80 l40 -5 M47 62 l8 20"/>
	<path id="v-small" d="M35 10 c0 0 -7 40 -20 66 M10 80 l40 -5 M47 62 l8 20"/>
	<path id="v-xsmall" d="M35 10 c0 0 -7 40 -20 63 M10 77 l36 -10 M43 53 l8 20"/>
	
    	<path alternative-U id="v2-UU" d="M25 22 h45 v1 c0 0 -15 35 -55 55 M30 27 c0 0 14 33 50 50"/>
    	<path akternative-I id="v2-II" d="M25 22 v55 l45-4 M70 22 v55"/>
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
    	
    	<path id="U" d="M70 20 c0 0 -15 60 -55 65 M25 20 c0 0 15 60 55 65"/>
    	<path id="I" d="M50 15 v15 c0 0 -5 35 -30 55 M50 15 v15 c 0 0 5 35 30 55"/>
    	<path id="M" d="M25 18 h55 c0 0 0 30 -55 65 M36 42 c0 0 22 16 40 40"/>
    	<path id="N" d="M25 15 v70 M27 45 l52 4"/>
    	<path id="P" d="M55 15 c0 0 -10 30 -30 63 M20 80 l60 -5 M24 44 h52 "/>
    	<path id="C" d="M20 20 h65 c0 10 0 35 -10 60 c0 0 0 8 -20 0 M24 64 l30 -18"/>
		<path id="T" d="M70 15 v70 M15 50 l55 -5"/>
    	<path id="NG" d="M20 20 h65 c0 10 0 35 -10 60 c0 0 0 8 -20 0 M46 20 c0 0 0 40 -28 63"/>
    	<path id="NH" d="M23 15 h40 c0 0 -10 40 -45 70 M48 50 c 0 0 6 6 28 35"/>
		<path id="CH" d="M30 15 v65 c0 0 0 10 10 10 l37 -2 c0 0 5 0 5 -5 v-8 M15 48 l50 -5"/>
    	
    	<path id="NG_t"      d="M25 40 h48 c0 0 0 18 -8 40 c0 0 0 5 -15 2 M44 40 c0 0 0 20 -24 40"/>
    	<path id="NG_tsmall" d="M25 45 h48 c0 0 0 15 -8 35 c0 0 0 5 -15 2 M44 45 c0 0 0 17 -24 35"/>
		<path id="NH_t"      d="M20 35 h45 c0 0 -25 33 -45 50 M49 57 c 0 0 15 15 27 29"/>
		<path id="NH_tsmall" d="M20 45 h45 c0 0 -25 28 -45 40 M50 65 c 0 0 15 10 27 20"/>
		<path id="N_t"       d="M35 35 v45 M35 55 l40 2"/>
    	<path id="N_tsmall"  d="M35 40 v40 M35 56 l40 2"/>
    	<path id="M_t"      d="M26 40 h44 c0 0 0 25 -55 45 M36 55 c0 0 20 10 38 28"/>
    	<path id="M_tsmall" d="M26 46 h44 c0 0 0 22 -55 40 M36 62 c0 0 20 6 38 22"/>
    	<path id="T_t"      d="M48 40 v33 M23 78 h50"/>
    	<path id="T_tsmall" d="M48 45 v30 M23 78h50"/>
    	<path id="P_t"      d="M25 40 h45 v20 M48 40 v17 M25 64 h45 M25 40 v40 c0 5 5 5 40 5 c0 0 5 0 7 -3"/>
    	<path id="P_tsmall" d="M25 45 h45 v15 M48 45 v12 M25 64 h45 M25 45 v35 c0 5 5 5 40 5 c0 0 5 0 7 -3"/>
    	<path id="C_t"      d="M20 40 h55 c0 0 0 25 -6 40 c0 0 0 5 -15 0 M20 75 l24 -16"/>
    	<path id="C_tsmall" d="M20 46 h55 c0 0 0 22 -6 37 c0 0 0 5 -15 0 M20 77 l24 -15"/>
    	<path id="U_t"      d="M64 40 c0 0 -20 45 -48 45 M27 40 c0 0 20 45 48 45"/>
    	<path id="U_tsmall" d="M64 45 c0 0 -20 40 -48 40 M27 45 c0 0 20 40 48 40"/>
    	<path id="I_t"      d="M47 35 c0 0 0 35 -30 50 M47 35 c 0 0 5 35 30 50"/>
    	<path id="I_tsmall" d="M47 40 c0 0 0 30 -30 45 M47 40 c 0 0 5 30 30 45"/>
    	<path id="CH_t"      d="M35 40 v40 c0 0 0 10 10 10 l27 -2 c0 0 5 0 5 -5 v-5 M18 64 l50 -5"/>
    	<path id="CH_tsmall" d="M35 45 v35 c0 0 0 10 10 10 l27 -2 c0 0 5 0 5 -5 v-5 M18 64 l50 -5"/>
    	
    	<circle id="smallbox" cx="47" cy="62" r="25" stroke="gray" stroke-width="4px" stroke-dasharray="3,10"/>
    	<circle id="largebox" cx="52" cy="48" r="40" stroke="gray" stroke-width="4px" stroke-dasharray="3,10"/>
    	
    	<!--tones-->
    	<path id="qt0" d="M2 90 m0 15 c-12 0 -12 -15 0 -15"/>
    	<path id="qt1" d="M98 -5 c12 0 12 15 0 15"/>
    	<path id="qt2" d="M2 90 c12 0 12 15 0 15 c-12 0 -12 -15 0 -15"/>
    	<path id="qt3" d="M2 -5 m0 015 c-12 0 -12 -15 0 -15"/>
    	<path id="qt4" d="M2 -5 c12 0 12 15 0 15 c-12 0 -12 -15 0 -15"/>
    	<path id="qt5" d="M98 -5 c12 0 12 15 0 15 c-12 0 -12 -15 0 -15"/>
    	<path id="qt6" d="M98 90 c12 0 12 15 0 15"/>
		<path id="qt7" d="M98 90 c12 0 12 15 0 15 c-12 0 -12 -15 0 -15"/>
		
    	<path id="_t1" d="M16 12 h60 l-3 15"/>
    	<path id="_t2" d="M20 15 h50"/>
    	<path id="_t3" d="M30 10 l-15 23 M28 18 h44"/>
    	<path id="_t4" d="M30 8 l-15 25 M28 14 h44 M20 30 h52"/>
    	<path id="_t5" d="M26 12 h42 v16 M18 29 h58"/>
    	<path id="_t6" d="M20 10 v10 h50"/>
		<path id="_t7" d="M26 12 h42 v16 M18 29 h58"/>
	
    	<!--fullsize tones-->
    	<path id="_tlarge1" d="M30 20 h45 v55"/>
    	<path id="_tlarge2" d="M20 55 h60"/>
    	<path id="_tlarge3" d="M75 28 h-50 m0-8 c0 0 0 40 -10 60"/>
    	<path id="_tlarge4" d="M75 28 h-50 m0-8 c0 0 0 40 -10 60 m20-25 l35 0"/>
    	<path id="_tlarge5" d="M25 20 h45 v55 M20 75 h60"/>
        <path id="_tlarge6" d="M20 55 h60"/>
        <path id="_tlarge7" d="M25 20 h45 v55 M20 75 h60"/>
		
    	<path id="square" style="opacity:.0" stroke-width="2" d="M-9 -9 h118 v118 h-118 z"/>
    	</defs>
    	</svg>`;

const defaultQattEncoding = {
      ong: "_1",
      we2: "_2",
      ung: "_3",
      wan: "_4",
      wi: "_5",
      aw2m: "_6",
      
      e2: "ng2",
      o2ng: "ng3",
      an: "ng4",
      i: "ng5",
      waw2m: "ng6",
      
      wa: "h2",
      we2ng: "h3",
      we2n: "h4",
      y2: "h5",
      e2m: "h6",
      
      a: "g2",
      e2ng: "g3",
      e2n: "g4",
      y: "g5",
      u2m: "g6",
      
      we: "c2",
      wenh: "c3",
      wa2n: "c4",
      a2: "c5",
      om: "c6",
      
      e: "l2",
      enh: "l3",
      a2n: "l4",
      wa2: "l5",
      um: "l6",
      
      aw2u: "tr2",
      yng: "tr3",
      ai: "tr4",
      yn: "tr5",
      o2m: "tr6",
      
      waw2u: "d2",
      wyng: "d3",
      wai: "d4",
      y2n: "d5",
      a2m: "d6",
      
      au: "n2",
      aw2ng: "n3",
      awi: "n4",
      awn: "n5",
      y2m: "n6",
      
      wau: "t2",
      waw2ng: "t3",
      wawi: "t4",
      wawn: "t5",
      wym: "t6",
      
      awu: "th2",
      awng: "th3",
      a2i: "th4",
      aw2n: "th5",
      em: "th6",
      
      wawu: "nh2",
      wawng: "nh3",
      wa2i: "nh4",
      waw2n: "nh5",
      im: "nh6",
      
      u2ng: "ch2",
      i2ng: "ch3",
      i2: "ch4",
      en: "ch5",
      i2m: "ch6",
      
      wyng: "dz2",
      wi2ng: "dz3",
      wi2: "dz4",
      wen: "dz5",
      am: "dz6",
      
      y2ng: "x2",
      anh: "x3", awnh: "x3", a2nh: "x3", a2ng: "x3",
      aw2i: "x4",
      i2n: "x5",
      wam: "x6",
      
      ang: "kh2",
      wanh: "kh3", wawnh: "kh3", wa2nh: "kh3", wa2ng: "kh3",
      waw2i: "kh4",
      wi2n: "kh5",
      awm: "kh6",
      
      wang: "s2",
      inh: "s3",
      yi: "s4",
      in: "s5",
      wawm: "s6",
      
      oong: "r2",
      winh: "r3",
      y2i: "r4",
      win: "r5",
      ym: "r6",
      
      o: "m2",
      on: "m3",
      oi: "m4",
      yu: "m5",
      y2u: "m6",
      
      o2: "b2",
      un: "b3",
      ui: "b4",
      iu: "b5",
      i2u: "b6",
      
      u2: "v2",
      o2n: "v3",
      o2i: "v4",
      eu: "v5",
      e2u: "v6",
      
      u: "ph2",
      u2n: "ph3",
      u2i: "ph4",
      weu: "ph5",
      we2u: "ph6"
};

class SvgGlyphRenderer {
  constructor(options = {}) {
	const initialType = options.type != null ? options.type : localStorage.qattType || "0";
	this.qattEncoding = options.qattEncoding || defaultQattEncoding;
    this.defs = options.defs || defaultSvgDefs;
    this.container = options.container || document.createElement("div");
    this.charFontsize = options.charFontsize || "105px";
    this.svgns = "http://www.w3.org/2000/svg";
    this.prefixes = { onset: "v2-", vowel: "v2-", coda: "v2-", qattTones: true };
    this.cache = new Map();
    this.defsElement = null;
    this._initializeDefs();
  }

  _initializeDefs() {
    if (!this.defs) return;
    this.defsElement = document.createElement("div");
    this.defsElement.innerHTML = this.defs;
    this.defsElement.style.display = "none";
    document.body.append(this.defsElement);
  }
	
  getPrefixes(type) {
    const isSimplified = type == 1 || type == 2;
	const prefix = isSimplified ? "" : "v2-";
	return {
		type: (type || "0").toString(),
		onset: prefix,
		vowel: prefix,
		coda: prefix,
		qattTones: (type != 2)
	};
  }

  _getDefById(id) {
    return this.defsElement && id ? this.defsElement.querySelector(`#${CSS.escape(id)}`) : null;
  }

  getPost(glide, nucleus) {
    if (nucleus?.charAt(0) === "w") nucleus = nucleus.substr(1);
    const el = this._getDefById(nucleus);
    if (el && el.dataset.onsetsize) return el.dataset.onsetsize;

    let post = "small";
    if (["a", "a2"].includes(nucleus)) post = "large";
    if (["o", "o2", "e", "e2", "i2", "u2", "y"].includes(nucleus)) post = "xsmall";
    if (glide) post = (post === "large") ? "small" : "xsmall";
    return post;
  }

  useG(g, id, cls, _tone) {
    const u = document.createElementNS(this.svgns, "use");
    u.setAttribute('href', '#' + id);
    if (cls) u.setAttribute('class', cls);
    g.appendChild(u);
    //if (_tone === 3 || _tone === 4) {
      u.setAttribute('vector-effect', 'non-scaling-stroke');
      u.style["vector-effect"] = "non-scaling-stroke";
    //}
    return g;
  }
	
  render(text, root, type) {
	// render a glyph code, e.g. t,i2,ng,1 or t,+ch3,,1
	type = !Number.isNaN(type) ? Number(type) : 0;
	if (type == -1 || type == 3) {
      type = 0;
	  text = text.replace("+", "");
	} else if(type != 1 && type != 2) {
      text = text.replace("+", "").replace(",", ",+")
    }
	return this.renderText(text, root, type);
  }
	
  renderText(text, root, type) {
	type = !Number.isNaN(type) ? Number(type) : 0;
    const prefixes = this.getPrefixes(type);
    const target = root || this.container;
    const fragment = document.createDocumentFragment();
    
    text.split(" ").forEach(t => {
      if (t.includes(",")) {
        // Cache-Key prüfen
        if (this.cache.has(prefixes.type+t)) {
          // Alle gespeicherten Nodes des Eintrags klonen
          this.cache.get(prefixes.type+t).forEach(node => {
            fragment.appendChild(node.cloneNode(true));
          });
        } else {
          const tempContainer = document.createElement("div");
          this.renderSvg(tempContainer, prefixes, ...t.split(","));
          
          // Alle Kinder des tempContainers (alle SVGs) erfassen
          const nodes = Array.from(tempContainer.childNodes);
          
          if (nodes.length > 0) {
            this.cache.set(prefixes.type+t, nodes); // Das ganze Array speichern
            nodes.forEach(node => {
              fragment.appendChild(node.cloneNode(true));
            });
          }
        }
      } else {
        this.renderChar(t, fragment);
      }
    });
  
    target.innerHTML = ""; 
    target.appendChild(fragment);
  }

  renderSvg(root, prefixes, initial, vowel, final, tone, bold, isCoda) {
	if (vowel && vowel.startsWith("+")) {
		vowel = vowel.substr(1);
		if ((prefixes.type == "0" || prefixes.type == "3") && ["t", "p", "c", "ch"].includes(final)) {
            if (final == "t") final = "n";
			else if (final == "p") final = "m";
			else if (final == "c") final = "ng";
			else if (final == "ch") final = "nh";
			if (tone+"" == "1") tone = 6;
			else if (tone+"" == "5") tone = 7;
		}
		const qv = (this["qattEncoding"+prefixes.type] || this.qattEncoding)[vowel + ((!final || !isNaN(Number(final))) ? '' : final)];
		if (qv) {
			vowel = qv;
			final = null;
			// Mini-QATT rule
			// qattEncoding that ends with 7 means
			// the initial is marked at position 1.
			if (vowel.endsWith("7")) {
				// 7 means mini-QATT coda
				vowel = vowel.replace("7", "");
				initial = "w" + initial;
			}
		}
	}
    const d = document;
    const svg = d.createElementNS(this.svgns, "svg");
    let g;

    if (initial || vowel) {
      g = d.createElementNS(this.svgns, "g");
      this.useG(g, 'square');
      svg.appendChild(g);
    }

	let id;
    if (initial) {
      initial = initial.replace("#", "").replace("$", "");
      const post = this.getPost(vowel?.charAt(0) === "w", vowel);
      id = prefixes.onset + initial.replace("w","") + '-' + post;
	  const hasMark = initial.indexOf("w") == 0 ? true : false;
      if (!this._getDefById(id)) id = id.replace("xsmall", "small").replace("large", "xxsmall");
      if (!this._getDefById(id)) id = id.replace("xxsmall", "xsmall").replace("xsmall", "small");
      this.useG(g, id);
	  if (hasMark) this.useG(g, prefixes.onset + initial.replace("w","") + "-medial");
	  initial = initial.replace("w", "");
    }

    if (vowel) {
      let vStr = vowel;
      if (vStr.charAt(0) === "w") {
        vStr = vStr.substr(1);
        this.useG(g, `${prefixes.onset}${initial}-medial`);
      }
      
      if (!"aeiouy".includes(vStr[0]) && /\d$/.test(vStr)) {
        const toneVal = vStr.replace(/\d*(\d)/, "$1");
        this.useG(g, prefixes.vowel + vStr.replace(/\d/, ""));
        if (tone || final) this.useG(g, "qt" + (tone || final || 0));
        //final = "";
		tone = "";
      }
      this.useG(g, (isCoda ? prefixes.coda : prefixes.vowel) + vStr);
    }

    svg.setAttribute("viewBox", "-10 -25 120 125");
    svg.style.aspectRatio = "13 / 15";
    svg.style.verticalAlign = "bottom";
    svg.style.overflow = "visible";
	svg.setAttribute("preserveAspectRatio", "none");

    if (g) {
		const nobr = root.tagName == "NOBR" ? root : document.createElement("nobr");
		nobr.append(svg);
		if (nobr !== root) root.appendChild(nobr);
	    this._handleTones(nobr, prefixes, initial, vowel, final, tone, g);
	} else {
		this._handleTones(root, prefixes, initial, vowel, final, tone, g);
	}
	return g;
  }

  _handleTones(root, prefixes, initial, vowel, final, tone, g) {
    if (g && tone != null && tone != "" && tone >= 0) { //vowel && vowel.match(/[aeiouy]/)) {
      if (tone < 8 && prefixes.qattTones) this.useG(g, "qt" + (tone || 0));
    }

    if (tone != null && tone < 0) {
      tone = Math.abs(tone);
      if (!final) {
        if (String(tone) != "") this.renderSvg(root, prefixes, "", "_tlarge" + tone);
      } else {
        const tonesize = tone >= 0 ? "small" : "";
        const newG = this.renderSvg(root, prefixes, "", final.toUpperCase() + (tone ? '_t' : '') + tonesize, "", null, bold, true);
        this.useG(newG, "_t" + tone);
      }
    } else if (final) {
        if (tone && !prefixes.qattTones) {
		  if (Number(prefixes.type) == 2 && tone == 0) {
			  this.renderSvg(root, prefixes, "", final.toUpperCase(), 0, null, null, true);
		  } else {
              const tonesize = tone >= 3 ? "small" : "";
              const newG = this.renderSvg(root, prefixes, "", final.toUpperCase() + '_t' + tonesize, 0, null, null, true);
              this.useG(newG, "_t" + tone);
		  }
        } else {
          this.renderSvg(root, prefixes, "", final.toUpperCase(), 0, null, null, true);
        }
    } else if (tone && !prefixes.qattTones) {
        this.renderSvg(root, prefixes, "", '_tlarge' + tone, 0, null, null, true);
    }
  }


  renderChar(t, root) {
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
  observe(tagName) {
	tagName = (tagName ?? "TT").toUpperCase();
    const observer = new MutationObserver(mutations => {
	  const type = localStorage.getItem('qattType') || "0";
      for (let m of mutations) {
        for (let n of m.addedNodes) {
          if (n.nodeName === tagName) this.render(n.innerText.trim(), n, n.dataset.type ?? type);
          else if (n.nodeType === 1) n.querySelectorAll(tagName).forEach((tag) => {
			this.render(tag.innerText.trim(), tag, tag.dataset.type ?? type)
		  });
        }
      }
    });
	const type = localStorage.getItem('qattType') || "0";
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(tagName).forEach((tag) => {
	  this.render(tag.innerText.trim(), tag, tag.dataset.type ?? type);
	});
  }
}
