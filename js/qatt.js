
const qattOptions = {
      convert: ".qatt",
      selector: "qatt",
      mapping: {},
      ...JSON.parse(document.documentElement.dataset.qatt || "{}")
}

if (qattOptions.lfix) {
      qattOptions.mapping = {
            "ng": "l",
            "h": "ng",
            "g": "h",
            "c": "g",
            "l": "c",
            ...qattOptions.mapping
      }
}
((window) => {
      function Animation(root, attrs, glyphs, opts) {
        if (typeof root === "object") {
          opts = root
          root = root.root
          attrs = opts.steps
          glyphs = opts.steps.map(step => step.path)
          glyphs.splice(0, 0, opts.initial || glyphs[0])
          glyphs = [glyphs]
        }
        this.root = root
        this.opts = {
          plain: false,
          selector: "path",
          stepDuration: 1250,
          animDuration: 350,
          useEasing: true,
          size: 250,
          autostart: true,
          svg: null,
          animate: true,
          viewBox: "0 0 1200 1200",
          preformat: (anim, attr) => attr,
          ondisplay: (anim, attr) => {},
          ...opts,
          pathAttrs: {
            "stroke-width": Number(document.querySelector("html").dataset.stroke),
            ...(opts.pathAttrs || {})
          },
        }
        this.stepCounter = null
        this.attrs = attrs
        this.glyphs = glyphs
        if (this.opts.svg) {
          this.svg = this.opts.svg
        } else {
          const svg = document.createElementNS(SVG_NS, "svg")
          svg.setAttributeNS(null, "viewBox", this.opts.viewBox)
          this.svg = svg;
          this.svg.style.width = this.opts.size + "px"
          this.svg.style.height = this.opts.size + "px"
          if (this.opts.plain) {
            root.append(this.svg)
          } else {
            this.text = document.createElement("summary")
            this.stage = document.createElement("figure")
            this.stage.prepend(this.svg, this.text)
            root.prepend(this.stage)
          }
        }
        this.svg.addEventListener('click', ()=>this.animate())
        if (this.opts.autostart) this.start()
      }
    
      Animation.prototype.start = function(){
        if (this.interval) {
            this.stop()
        }
        this.interval = setInterval(()=>this.animate(), this.opts.stepDuration)
        this.animate()
      }
        
      Animation.prototype.stop = function(){
        clearInterval(this.interval)
        this.interval = null
      }
        
      const SVG_NS = "http://www.w3.org/2000/svg"

      Animation.prototype.animate = function(){
        if (!this.opts.animate) return
        this.glyphs.forEach((g, i) => this.animateStep(this.stepCounter, i))
        this.stepCounter = (this.stepCounter || 0) + 1
      }
        
      Animation.prototype.animateStep = function(step, g) {
        let glyph = this.svg.querySelectorAll('.glyph')[g]
        let isInit = false
        if (step === null) {
            glyph = document.createElementNS(SVG_NS, "path")
            glyph.classList.add("glyph")
            glyph.setAttribute("d", this.glyphs[g][0])
            glyph.setAttribute("vector-effect", "non-scaling-stroke")
            Object.keys(this.opts.pathAttrs).forEach((k) => glyph.setAttribute(k,this.opts.pathAttrs[k]))
            this.svg.append(glyph)
            step = 0;
            isInit = true
        }
        if(step == this.glyphs[g].length-2) this.stop()
        step = (step % (this.glyphs[g].length - 1)) + 1
        const attrs = this.opts.preformat.bind(this)(this, this.attrs[step-1] || {})
        if (attrs[this.opts.selector]) this.glyphs[g][step] = attrs[this.opts.selector];
        let to = this.glyphs[g][step]
        let from
        if (step == 1) from = this.glyphs[g][this.glyphs[g].length - 1]
        else from = this.glyphs[g][step-1]
        if (isInit) from = this.glyphs[g][0] || to
        else if(from == "" && (to != "" && to != null)) {
          from = to
        } else if(from === null && (to != "" && to != null)) {
          for (var i = (step > 1 ? step : this.glyphs[g].length) - 1; i >= 0; i--) {
            const p = this.glyphs[g][i]
            if (p) from = p
            if (from) break
          }
          if (!from) from = this.glyphs[g][0] || to
        }
        if (to && glyph.classList.contains("hidden")) {
          from = this.glyphs[g][0] || from
        }
        glyph.classList[to == "" ? "add" : "remove"]("hidden")
        this.currentPath = to
        if (to != "" && to != null) {
            //glyph.setAttribute("d", to)
            if (attrs.morph || (this.opts.morph && attrs.morph !== false)) {
              glyph.setAttribute("d", this.glyphs[g][0])
                this.morphTo(glyph, from, to)
            } else {
                glyph.querySelectorAll("animate").forEach((el)=>el.remove())
                glyph.setAttribute("d", to)
            }
        }
        if (!this.opts.plain){
            this.stage.querySelectorAll(".text").forEach(t => t.style.display = "")
            this.stage.querySelectorAll(".text-" + step).forEach(t => t.style.display = "block")
            const div = document.createElement("h1")
            const sup = document.createElement("sup")
            sup.innerHTML = attrs.sup || ""
            div.innerHTML = attrs.text || ""
            this.text.innerHTML = ""
            this.text.append(div)
            this.sup = sup
            div.append(sup)
        }
        if (this.opts.ondisplay) this.opts.ondisplay.bind(this)(this, attrs)
      }
      
      Animation.prototype.morphTo = function(glyph, a, b) {
        // remove old animate if present
        const old = glyph.querySelector("animate")
        if (old) old.remove()
      
        const anim = document.createElementNS(SVG_NS, "animate")
      
        anim.setAttribute("attributeName", "d")
        anim.setAttribute("from", a)
        anim.setAttribute("to", b)
        anim.setAttribute("dur", (this.opts.animDuration/1000) + "s")
        anim.setAttribute("fill", "freeze")
      
        if (this.opts.useEasing) {
          anim.setAttribute("calcMode", "spline")
          anim.setAttribute("keyTimes", "0;1")
          anim.setAttribute("keySplines", "0 0 0.5 1")
        }
          
        glyph.appendChild(anim)
        anim.beginElement()
      }
      
      Animation.prototype.print = function(names, opts) {
        if (typeof names === "string") names = [names]
        if (!opts) opts = {}
        return names.map(name => {
          let step = 0
          this.attrs.forEach((a, i) => {
            if (a.text == name) step = i
          })
          const div = document.createElement("div")
          const anim = new Animation({
              ...this.opts,
              plain: true,
              root: div,
              stepDuration: 999999999999,
              steps: [{...this.attrs[step]}],
              autostart:true,
              ...opts
          })
          anim.opts.animate = false
          return anim
        })
      }
        
      Animation.prototype.overlay = function(names, opts) {
        if (typeof names === "string") names = [names]
        if (!opts) opts = {}
        let anim1 = opts.connect
        names.forEach(name => {
          let step = 0
          this.attrs.forEach((a, i) => {
            if (a.text == name) step = i
          })
          const anim = new Animation({
              ...this.opts,
              plain: true,
              root: anim1 ? anim1.root : this.root || document.createElement("div"),
              svg: anim1 ? anim1.svg : null,
              stepDuration: 999999999999,
              steps: [{...this.attrs[step]}],
              autostart:true,
              viewBox: "0 0 1100 1100",
              ...opts
          })
          if (!anim1) anim1 = anim
          anim.opts.animate = false
        })
        return anim1
      }

      Animation.prototype.getStrokes = function() {
          const d = this.currentPath || "M0 0"
          const tokens = d
            .replace(/([MmLlVvHhCc])/g, ' $1 ')
            .replace(/([^eE])([-+])/g, '$1 $2')
            .trim()
            .split(/\s+/);
        
          let i = 0;
          let x = 0;
          let y = 0;
        
          let currentSection = null;
          const sections = [];
        
          function closeSection() {
            if (currentSection) {
              sections.push(currentSection);
              currentSection = null;
            }
          }
        
          while (i < tokens.length) {
            const cmd = tokens[i++];
        
            switch (cmd) {
              case 'M': {
                closeSection();
                x = parseFloat(tokens[i++]);
                y = parseFloat(tokens[i++]);
                //currentSection = { x, y, x2: null, y2: null };
                break;
              }
        
              case 'm': {
                closeSection();
                x += parseFloat(tokens[i++]);
                y += parseFloat(tokens[i++]);
                currentSection = { x, y, x2: x, y2: y };
                break;
              }
        
              case 'l':
                currentSection.x2 = x += parseFloat(tokens[i++]);
                currentSection.y2 = y += parseFloat(tokens[i++]);
                break;
        
              case 'h':
                currentSection.x2 = x += parseFloat(tokens[i++]);
                break;
        
              case 'v':
                currentSection.y2 = y += parseFloat(tokens[i++]);
                break;
        
              case 'c':
                i += 4;
                currentSection.x2 = x += parseFloat(tokens[i++]);
                currentSection.y2 = y += parseFloat(tokens[i++]);
                break;
        
              default:
                throw new Error(`Unbekannter Befehl: ${cmd}`);
            }
          }
          closeSection();
          return sections;
      }
      
      Animation.prototype.clearColorized = function(what){
        let cls = ".colorized, .dot"
        if (what == "dots") cls = ".dot";
        else if (what == "strokes") cls = ".colorized:not(.dot)"
        requestAnimationFrame(() => {
          this.svg.querySelectorAll(cls).forEach((el)=>el.remove())
        })
      }
      Animation.prototype.colorizeSegment = function(s, attrs) {
        const paths = this.getStrokes()
        const seg = paths[s]
        if (!seg) return
        const glyph = document.createElementNS(SVG_NS, "path")
        glyph.classList.add("glyph", "colorized")
        if (attrs && attrs.dot) {
          attrs = {...this.opts.pathAttrs,
            "stroke-width": Number(document.querySelector("html").dataset.stroke) * 3,
            "stroke-linecap": "square",
            ...attrs
          }
          glyph.classList.add("dot")
          if (attrs.dot == 1)
            var d = `M${seg.x} ${seg.y} L${seg.x} ${seg.y}`
          else if (attrs.dot == 2)
            var d = `M${seg.x2} ${seg.y2} L${seg.x2} ${seg.y2}`
        } else {
          attrs = {...this.opts.pathAttrs, stroke: "red", ...attrs}
          var d = `M${seg.x} ${seg.y} L${seg.x2} ${seg.y2}`
        }
        glyph.setAttribute("d", d)
        Object.keys(attrs).forEach((k) => glyph.style[k] = attrs[k])
        requestAnimationFrame(() => {
          this.svg.append(glyph)
          requestAnimationFrame(() => {
            glyph.classList.add("colorized-active")
          })
        })
      }
      window.Animation = Animation
    })(window)

const qatt = new Animation({
      morph: true,
      initial: "M200 200 m400 400 l0 0 m0 0 l0 0 m0 0 l0 0",
      steps: [
        {
            text: "ʔ",
            path: "M200 200 m100 150 l600 0 m-550 250 l500 0 m-550 250 l600 0",
            qatt: "M200 200 m50 150 l700 0 m-700 250 l700 0 m-700 250 l700 0"
        },
        {
            morph:false,
            text: "test",
            path: "M200 200 m0 0 v500 h500",
            qatt: "M100 100 m0 0 h800 v800 c0 0 -800 0 -800 -800"
        },
        {
          text: "B",
          path: "M200 200 m400 50 l0 700 m0 0 l0 0 m-400 0 l800 0",
          qatt: "M200 200 m700 50 l-600 600 m0-600 l600 600 m-700 150 l800 0"
        },
        {
          text: "C", sup: "(K, Q)",
          path: "M200 200 m200 250 l500 0 m-600 300 l600 0 m0 -550 l0 800",
          qatt: "M200 200 m100 250 l600 0 m-600 300 l600 0 m0 -550 l0 800"
        },
        {
          text: "CH",
          path: "M200 200 m100 250 l600 0 m-650 300 l700 0 m-350 -550 l0 800",
          qatt: "M200 200 m100 350 l600 -200 m-600 500 l600 -200 m-300 -450 l0 800"
        },
        {
          text: "DD",
          path: "M200 200 m400 50 l0 700 m-350 -400 l700 0 m-750 400 l800 0",
          qatt: "M200 200 m0 400 l800 0 m-400 -400 l0 800 m-400 0 l800 0"
        },
        {
          text: "D", sup: "(Z)",
          path: "M200 200 m400 0 l-400 800 m300 -600 l500 600 m-500 -200 l100 150",
          qatt: "M200 200 m400 0 l0 800 m-300 -650 l600 200 m-600 100 l600 200"
        },
        {
          text: "PH", sup: "(Ph)",
          path: "M200 200 m100 400 l600 0 m0 0 l0 0 m0 -400 l0 800",
          qatt: "M200 200 m750 50 l-600 700 m0 -700 l600 700 m150 -750 l0 800"
        },
        {
          text: "G", sup: "(Gh)",
          path: "M200 200 m100 250 l500 0 m-500 300 l600 0 m-600 -550 l0 800",
          qatt: "M200 200 m100 0 l0 800 m0 -550 l600 0 m-600 300 l600 0",
        },
        {
          text: "GI", sup: "(J)",
          path: "M200 200 m400 0 l-400 800 m300 -600 l500 600 m-500 -200 l100 150",
          qatt: "M200 200 m100 150 l600 200 m-600 100 l600 200 m-300 -650 l0 800"
        },
        {
          text: "H",
          path: "M200 200 m250 150 l0 600 m300 -700 l0 700 m-550 0 l800 0",
          qatt: "M200 200 m250 0 l0 800 m300 -800 l0 800 m-550 0 l800 0"
        },
        {
          text: "KH",
          path: "M200 200 m0 100 l800 0 m-650 0 l0 650 m0 0 l650 0",
          qatt: "M200 200 m0 0 l800 0 m-700 100 l600 600 m-700 100 l800 0"
        },
        {
          text: "L",
          xpath: "M200 200 m200 50 l0 550 m400 -600 l0 800 m0 0 l0 0",
          path: "M200 200 m200 50 l0 800 m250 -750 l0 550 m250 -575 l0 700",
          qatt: "M200 200 m100 0 l0 800 m300 -800 l0 800 m300-800 l0 800"
        },
        {
          text: "M",
          path: "M200 200 m400 50 l0 700 m0 0 l0 0 m-400 -700 l800 0",
          qatt: "M200 200 m0 0 l800 0 m-100 150 l-600 600 m0 -600 l600 600"
        },
        {
          text: "N",
          path: "M200 200 m100 100 l0 600 m0 -300 l700 0 m-325 -400 l0 800",
          qatt: "M200 200 m100 0 l0 800 m0 -400 l700 0 m-325 -400 l0 800",
        },
        {
          text: "NG", sup: "(Ngh)",
          path: "M200 200 m250 50 l0 600 m300 -600 l0 700 m-550 -700 l800 0",
          qatt: "M200 200 m0 0 l800 0 m-550 0 l0 800 m300 -800 l0 800"
        },
        {
          text: "NH",
          path: "M200 200 m500 0 l-500 800 m200-800 l-200 320 m350 0 l400 480",
          qatt: "M200 200 m250 0 l0 800 m300 -800 l0 800 m-550 -500 l800 200"
        },
        {
          text: "R",
          path: "M200 200 m150 0 l0 800 m-150-800 l800 0 m0 0 l0 800",
          qatt: "M200 200 m0 0 l0 800 m100-700 l600 600 m100-700 l0 800"
        },
        {
          text: "S",
          path: "M200 200 m100 0 l0 800 m0 0 l700 -100 m0 -700 l0 800",
          qatt: "M200 200 m0 0 l0 800 m700 -700 l-600 600 m700 -700 l0 800"
        },
        {
          text: "T",
          xpath: "M200 200 m0 400 l800 0 m-400-400 l0 800 m0 0l0 0",
          path: "M200 200 m0 400 l800 0 m-400-400 l0 800 m400 -700l0 600",
          qatt: "M200 200 m0 400 l800 0 m-400-400 l0 800 m400-800 l0 800"
        },
        {
          text: "TH",
          path: "M200 200 m250 100 l0 600 m300 -700 l0 800 m-550 -400 l800 0",
          qatt: "M200 200 m250 0 l0 800 m300 -800 l0 800 m-550 -300 l800 -200"
        },
        {
           text: "TR",
           path: "M200 200 m150 0 l500 0 m-650 400 l800 0 m-400-400 l0 800",
           qatt: "M200 200 m0 0 l800 0 m-800 400 l800 0 m-400-400 l0 800"
        },
        {
          text: "V",
          path: "M200 200 m100 400 l600 0 m0 0 l0 0 m-600 -400 l0 800",
          qatt: "M200 200 m0 0 l0 800 m750 -750 l-600 700 m0 -700 l600 700"
        },
        {
          text: "X",
          path: "M200 200 m50 100 l600 0 m0 0 l-50 650 m-600 0 l800 0",
          qatt: "M200 200 m0 0 l800 0 m-100 100 l-600 600 m-100 100 l800 0"
        }
      ],
      root: document.createElement('figure'),
      stepDuration: 3000,
      animDuration: 300,
      selector: "path",
      autostart: false,
      preformat: (anim, attrs)=>{
          attrs = {
              ...attrs,
              sup: attrs.sup
          }
          return attrs
     }
})

const marks = new Animation({
        autostart: false,
        root: document.createElement("div"),
        initial: "M0 0 c0 0 0 0 0 0 c0 0 0 0 0 0",
        size: 32,
        pathAttrs: {"stroke-width": 50},
        steps: [
            {
                text: "0",
                path: "M0 0 c0 0 0 0 0 0 c0 0 0 0 0 0",
            }, {
                text: "1",
                path: "M100 100 m0-75 c97 0 97 150 0 150 c-97 0 -97 -150 0 -150",
            }, {
                text: "2",
                path: "M1100 100 m0-75 c97 0 97 150 0 150 c-97 0 -97 -150 0 -150",
            }, {
                text: "3",
                path: "M1100 1100 m0-75 c97 0 97 150 0 150 c-97 0 -97 -150 0 -150",
            }, {
                text: "4",
                path: "M100 1100 m0-75 c97 0 97 150 0 150 c-97 0 -97 -150 0 -150",
            }, {
                text: "5",
                path: "M75 75 v150m0-150h150",
            }, {
                text: "6",
                path: "M1125 75 v150m0-150h-150",
            }, {
                text: "7",
                path: "M1125 1125 v-150m0 150h-150",
            }, {
                text: "8",
                path: "M75 1125 v-150m0 150h150",
            }
        ]
    })


function writeQATT(root, codes, options) {
let opts = {
      mapping: {},
      dotmap: {
            '?': [1,3,5,6,4,2],
            'b': [3,2,5,6,4,1],
            'c': [1,3,4,6,5,2],
            'ch': [5,1,3,6,4,2],
            'dd': [3,1,4,5,6,2],
            'g': [1,2,5,6,4,3],
            'h': [1,2,5,6,4,3],
            'kh': [1,3,5,6,4,2],
            'l': [3,1,2,4,6,5],
            'm': [1,5,4,6,3,2],
            'n': [1,2,3,6,4,5],
            'ng': [1,3,4,6,5,2],
            'nh': [1,5,2,4,6,3],
            'ph': [3,2,4,6,5,1],
            'r': [1,2,4,6,5,3],
            's': [1,2,4,6,5,3],
            't': [3,1,4,2,6,5],
            'th': [1,5,2,4,6,3],
            'tr': [1,5,3,6,4,2],
            'v': [1,2,4,6,3,5],
            'x': [1,4, 5,6,3,2]
      },
      ...qattOptions,
      ...(options ||{})
    }
    codes
    .trim()
    .split(/\s+/)
    .forEach(s => {
        if (!s.trim()) return
        if (s[0] == "#") {
            const span = document.createElement("span")
            span.innerHTML = s.slice(1)
            out1.append(span)
            return
        }
        let code = s.replace(/[^a-zA-Z?]/g, "")
        code = opts.mapping[code] || opts.mapping[code.toLowerCase()] || code
        let dot = s.split(/[+-]/)[0].replace(/\D/g, "")
        let tone = "" + parseInt((s.split(/[+-]/)[1] || "").replace(/\D/g, "") || 0)
        const dotmap = opts.dotmap[code.toLowerCase()]
        if (dotmap) dot = dotmap[dot - 1]
        
        if (tone && s.indexOf("-") >= 0) tone = "" + (parseInt(tone) + 4)
        const chars = qatt.print(
          [code.toUpperCase()],
          {
              root: root,
              ...opts,
              size: opts.size || (s[0] == "." ? 32 : 36),
              ondisplay: (anim, attrs)=>{
                  if (dot) {
                    const seg = parseInt((dot-1) / 2)
                    const pos = ((dot-1) % 2) + 1
                    anim.clearColorized()
                    anim.colorizeSegment(seg, {dot: pos, stroke: "#f00", "stroke-linecap": "square"})
                  }
              }
          }
        )
        if (tone != null && tone != "") marks.overlay(tone, {
            connect: chars[0]
        })
      })
  }

  window.addEventListener(
    "load",
    ()=>{
      document.querySelectorAll(qattOptions.convert).forEach((el)=>{
        const t = el.innerText
        el.innerHTML = ""
        let opts = {
          size: Number(el.dataset.size || 24),
          ...qattOptions.opts,
          ...(el.dataset.opts ? JSON.parse(el.dataset.opts) : {})
        }
        writeQATT(el, t, opts)
      })
    }
  );
