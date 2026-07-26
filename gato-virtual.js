/* ===========================================================================
 *  GatoVirtual — mascota web tipo "shimeji/neko" retro pero fluida y cute.
 *  Libre y gratuita. Se añade con una sola función:
 *
 *      crearGato();                       // gato por defecto
 *      crearGato({ nombre: 'Luna' });     // parametrizado
 *      const g = new GatoVirtual({ ... }); // o como clase
 *
 *  No necesita dependencias. Funciona en cualquier web.
 * ===========================================================================*/
(function (global) {
  'use strict';

  const DEFAULTS = {
    sprites: null,          // {idle:'data:...', caminar:'...'} para auto-contenido
    assetsPath: 'assets/',  // si no hay sprites embebidos, carga de aquí
    prefijo: 'gato_',
    extension: '.png',
    nombre: 'Michi',
    tamano: 110,            // px de lado
    escala: 1,              // multiplicador de tamaño
    velocidad: 72,          // px/seg al caminar
    interactivo: true,      // clic = acariciar
    seguirRaton: true,      // curiosea el cursor cuando pasa cerca
    sonido: false,          // maullidos/ronroneo sintetizados (WebAudio)
    zIndex: 999999,
    onEstado: null,         // callback(nombreEstado)
  };

  const MOVIMIENTO = new Set(['vagar', 'seguir', 'jugar']);
  let estilosOK = false;

  function inyectarEstilos() {
    if (estilosOK) return; estilosOK = true;
    const css = `
.gv-cont{position:fixed;left:0;top:0;will-change:transform;pointer-events:none;}
.gv-flip{width:100%;height:100%;transition:transform .22s ease;}
.gv-sprite{width:100%;height:100%;background-size:contain;background-repeat:no-repeat;
  background-position:center bottom;filter:drop-shadow(0 7px 5px rgba(0,0,0,.20));
  transform-origin:50% 100%;}
.gv-cont.gv-on .gv-sprite{pointer-events:auto;cursor:grab;}
.gv-cont.gv-on .gv-sprite:active{cursor:grabbing;}

.gv-idle .gv-sprite{animation:gv-respira 3.2s ease-in-out infinite;}
.gv-cam  .gv-sprite{animation:gv-bob .46s ease-in-out infinite;}
.gv-jug  .gv-sprite{animation:gv-salta .42s ease-in-out infinite;}
.gv-enf  .gv-sprite{animation:gv-tiembla .11s linear infinite;}
.gv-dorm .gv-sprite{animation:gv-dormir 3.6s ease-in-out infinite;}

@keyframes gv-respira{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.035) translateY(-1px)}}
@keyframes gv-bob{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-5px) rotate(1.5deg)}}
@keyframes gv-salta{0%,100%{transform:translateY(0) scale(1,1)}45%{transform:translateY(-14px) scale(.92,1.08)}55%{transform:translateY(-14px) scale(.92,1.08)}}
@keyframes gv-tiembla{0%{transform:translate(-2px,0) rotate(-2deg)}50%{transform:translate(2px,0) rotate(2deg)}100%{transform:translate(-2px,0) rotate(-2deg)}}
@keyframes gv-dormir{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
@keyframes gv-aterriza{0%{transform:scale(1.18,.82)}60%{transform:scale(.94,1.06)}100%{transform:scale(1,1)}}
.gv-pop .gv-sprite{animation:gv-aterriza .34s ease-out !important;}

.gv-part{position:absolute;left:50%;top:6px;pointer-events:none;font-size:20px;
  line-height:1;transform:translateX(-50%);user-select:none;}
.gv-corazon{animation:gv-flota 1.1s ease-out forwards;}
.gv-zzz{animation:gv-flotaZ 1.6s ease-out forwards;}
.gv-chispa{animation:gv-chisp .7s ease-out forwards;}
.gv-burbuja{top:-14px;font-size:22px;animation:gv-burb 2.2s ease-out forwards;
  background:rgba(255,255,255,.92);border-radius:50%;padding:4px 6px;
  box-shadow:0 2px 6px rgba(0,0,0,.18);}
@keyframes gv-flota{0%{opacity:0;transform:translate(-50%,0) scale(.4)}20%{opacity:1}
  100%{opacity:0;transform:translate(-50%,-46px) scale(1.1)}}
@keyframes gv-flotaZ{0%{opacity:0;transform:translate(-50%,0)}25%{opacity:1}
  100%{opacity:0;transform:translate(0%,-40px) rotate(12deg)}}
@keyframes gv-chisp{0%{opacity:0;transform:translate(-50%,0) scale(.2)}40%{opacity:1;transform:translate(-50%,-10px) scale(1.2)}
  100%{opacity:0;transform:translate(-50%,-22px) scale(.6)}}
@keyframes gv-burb{0%{opacity:0;transform:translate(-50%,6px) scale(.3)}18%{opacity:1;transform:translate(-50%,0) scale(1)}
  82%{opacity:1}100%{opacity:0;transform:translate(-50%,-8px) scale(.9)}}

.gv-pelota{position:fixed;left:0;top:0;width:22px;height:22px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fff,#d23 70%);box-shadow:0 3px 5px rgba(0,0,0,.3);
  pointer-events:none;will-change:transform;z-index:inherit;transition:transform .25s ease;}
`;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class GatoVirtual {
    constructor(opciones = {}) {
      this.cfg = Object.assign({}, DEFAULTS, opciones);
      inyectarEstilos();

      // necesidades (0–100)
      this.energia = rnd(70, 100);
      this.hambre = rnd(0, 25);
      this.aburrimiento = rnd(0, 30);
      this.felicidad = rnd(70, 90);

      this.estado = 'idle';
      this.dir = 1;                 // 1 = mira a la izquierda (pose base), -1 = derecha
      this.ocupadoHasta = 0;
      this.efectoFin = null;
      this.proximaDecision = 0;
      this.seguirHasta = 0;
      this.jugarHasta = 0;
      this.pelota = null;
      this.clicks = [];
      this._raf = null;
      this._ultimo = 0;
      this.audio = null;

      this._construir();
      this._eventos();
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }

    /* ---------- construcción del DOM ---------- */
    _construir() {
      const t = this.cfg.tamano * this.cfg.escala;
      this.cont = document.createElement('div');
      this.cont.className = 'gv-cont gv-idle' + (this.cfg.interactivo ? ' gv-on' : '');
      this.cont.style.width = this.cont.style.height = t + 'px';
      this.cont.style.zIndex = this.cfg.zIndex;
      this.cont.title = this.cfg.nombre;

      this.flip = document.createElement('div'); this.flip.className = 'gv-flip';
      this.sprite = document.createElement('div'); this.sprite.className = 'gv-sprite';
      this.flip.appendChild(this.sprite);
      this.cont.appendChild(this.flip);
      document.body.appendChild(this.cont);

      this.t = t;
      this.x = rnd(t, window.innerWidth - 2 * t);
      this.y = rnd(t, window.innerHeight - 2 * t);
      this.objX = this.x; this.objY = this.y;
      this._sprite('idle');
      this._render();
    }

    _eventos() {
      this._onMove = (e) => { this.ratonX = e.clientX; this.ratonY = e.clientY; this.ratonVisto = performance.now(); };
      window.addEventListener('mousemove', this._onMove, { passive: true });
      this._onResize = () => { this.x = clamp(this.x, 0, window.innerWidth - this.t); this.y = clamp(this.y, 0, window.innerHeight - this.t); };
      window.addEventListener('resize', this._onResize);
      if (this.cfg.interactivo) {
        this.sprite.addEventListener('pointerdown', () => this.acariciar());
      }
    }

    /* ---------- sprites ---------- */
    _url(clave) {
      const c = this.cfg;
      if (c.sprites && c.sprites[clave]) return c.sprites[clave];
      return c.assetsPath + c.prefijo + clave + c.extension;
    }
    _sprite(clave) { this.sprite.style.backgroundImage = `url("${this._url(clave)}")`; }

    _setEstado(estado, spriteClave, clase) {
      this.estado = estado;
      this._sprite(spriteClave);
      this.cont.className = 'gv-cont' + (this.cfg.interactivo ? ' gv-on' : '') + ' gv-' + clase;
      if (typeof this.cfg.onEstado === 'function') this.cfg.onEstado(estado, this);
    }

    /* ---------- bucle principal ---------- */
    _loop(t) {
      const dt = this._ultimo ? clamp((t - this._ultimo) / 1000, 0, 0.05) : 0;
      this._ultimo = t;
      this._necesidades(dt);

      if (t < this.ocupadoHasta) {            // acción "bloqueada" en curso
        this._raf = requestAnimationFrame((tt) => this._loop(tt));
        return;
      }
      if (this.ocupadoHasta && t >= this.ocupadoHasta) {  // acaba de terminar
        this.ocupadoHasta = 0;
        if (this.efectoFin) { this.efectoFin(); this.efectoFin = null; }
        this.proximaDecision = t;
        this._setEstado('idle', 'idle', 'idle');
      }

      if (this.estado === 'jugar') this._jugando(t, dt);
      else if (this.estado === 'seguir') this._siguiendo(t, dt);
      else {
        if (t >= this.proximaDecision) this._decidir(t);
        if (MOVIMIENTO.has(this.estado)) this._mover(dt);
      }

      this._render();
      this._raf = requestAnimationFrame((tt) => this._loop(tt));
    }

    _necesidades(dt) {
      this.hambre = clamp(this.hambre + dt * 1.5, 0, 100);
      this.energia = clamp(this.energia - dt * 0.9, 0, 100);
      this.aburrimiento = clamp(this.aburrimiento + dt * 1.1, 0, 100);
      this.felicidad = clamp(this.felicidad - dt * 0.35, 0, 100);
    }

    /* ---------- cerebro: elige qué hacer ---------- */
    _decidir(t) {
      const cursorCerca = this.cfg.seguirRaton && this.ratonVisto &&
        (t - this.ratonVisto < 1500) &&
        Math.hypot((this.ratonX - this.x - this.t / 2), (this.ratonY - this.y - this.t / 2)) < 280;

      if (this.hambre >= 88) return this._comer(t);
      if (this.energia <= 12) return this._dormir(t);
      if (this.energia < 30 && Math.random() < 0.5) return this._esconder(t);
      if (this.aburrimiento >= 72 && this.energia > 25) return this._jugar(t);
      if (cursorCerca && this.energia > 20) return this._seguir(t);
      if (this.hambre > 60 && Math.random() < 0.5) return this._maullar(t);

      const r = Math.random();
      if (r < 0.5) {                              // vagar a un punto nuevo
        this.objX = rnd(0, window.innerWidth - this.t);
        this.objY = rnd(0, window.innerHeight - this.t);
        this._setEstado('vagar', 'caminar', 'cam');
        this.proximaDecision = Infinity;          // decide al llegar
      } else if (r < 0.72) {                      // quedarse quieto / mirar
        this._setEstado('idle', 'idle', 'idle');
        this.proximaDecision = t + rnd(2200, 4200);
        if (Math.random() < 0.4) this._pensar();
      } else {                                    // curiosear alrededor
        this.objX = clamp(this.x + rnd(-120, 120), 0, window.innerWidth - this.t);
        this.objY = clamp(this.y + rnd(-90, 90), 0, window.innerHeight - this.t);
        this._setEstado('vagar', 'investigar', 'cam');
        this.proximaDecision = Infinity;
      }
    }

    _mover(dt) {
      const dx = this.objX - this.x, dy = this.objY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) { this._alLlegar(); return; }
      if (Math.abs(dx) > 4) this.dir = dx < 0 ? 1 : -1;     // mira hacia donde va
      const paso = this.cfg.velocidad * this.cfg.escala * dt;
      const k = Math.min(paso, dist) / dist;
      this.x += dx * k; this.y += dy * k;
    }

    _alLlegar() {
      // tras caminar: pausa breve mirando alrededor
      this._setEstado('idle', 'idle', 'idle');
      this.proximaDecision = performance.now() + rnd(600, 2000);
    }

    /* ---------- comportamientos especiales ---------- */
    _comer(t) {
      this._setEstado('comer', 'comer', 'idle');
      this.ocupadoHasta = t + 4000;
      this.efectoFin = () => { this.hambre = 0; this.felicidad = clamp(this.felicidad + 8, 0, 100); };
      if (this.cfg.sonido) this._maullido(0.9);
    }
    _dormir(t) {
      this._setEstado('dormir', 'dormir', 'dorm');
      this.ocupadoHasta = t + 7000;
      this.efectoFin = () => { this.energia = 100; };
      this._burbuja('💤');
    }
    _esconder(t) {
      this._setEstado('esconderse', 'esonderse', 'idle');
      this.ocupadoHasta = t + 4500;
      this.efectoFin = () => { this.energia = clamp(this.energia + 12, 0, 100); };
    }
    _maullar(t) {
      this._setEstado('maullar', 'maullar', 'idle');
      this.ocupadoHasta = t + 1700;
      this._burbuja(this.hambre > 60 ? '🍗' : '❔');
      if (this.cfg.sonido) this._maullido(1);
    }
    _enfadar(t) {
      this._setEstado('enfadado', 'enfadado', 'enf');
      this.ocupadoHasta = t + 2200;
      this.efectoFin = () => { this.felicidad = clamp(this.felicidad - 6, 0, 100); };
      this._burbuja('💢');
    }
    _jugar(t) {
      this._setEstado('jugar', 'jugar', 'jug');
      this.jugarHasta = t + 6500;
      this._crearPelota();
      this._chispa();
    }
    _seguir(t) {
      this._setEstado('seguir', 'investigar', 'cam');
      this.seguirHasta = t + rnd(3500, 6000);
      this._burbuja('❔');
    }

    _jugando(t, dt) {
      if (t > this.jugarHasta) {
        this._quitarPelota();
        this.aburrimiento = 0;
        this.energia = clamp(this.energia - 10, 0, 100);
        this.felicidad = clamp(this.felicidad + 14, 0, 100);
        this.proximaDecision = t; this._setEstado('idle', 'idle', 'idle');
        return;
      }
      // la pelota da saltitos; el gato la persigue
      if (!this._pelotaSig || t > this._pelotaSig) {
        this.pbX = rnd(40, window.innerWidth - 60);
        this.pbY = rnd(40, window.innerHeight - 60);
        this._pelotaSig = t + rnd(700, 1300);
        if (this.pelota) this.pelota.style.transform = `translate(${this.pbX}px,${this.pbY}px)`;
      }
      this.objX = clamp(this.pbX - this.t / 2, 0, window.innerWidth - this.t);
      this.objY = clamp(this.pbY - this.t * 0.7, 0, window.innerHeight - this.t);
      this._mover(dt);
    }

    _siguiendo(t, dt) {
      const lejos = !this.ratonVisto || (t - this.ratonVisto > 1600) ||
        Math.hypot(this.ratonX - this.x - this.t / 2, this.ratonY - this.y - this.t / 2) > 380;
      if (t > this.seguirHasta || lejos) {
        this.proximaDecision = t; this._setEstado('idle', 'idle', 'idle'); return;
      }
      this.objX = clamp(this.ratonX - this.t / 2, 0, window.innerWidth - this.t);
      this.objY = clamp(this.ratonY - this.t * 0.55, 0, window.innerHeight - this.t);
      this._mover(dt);
    }

    /* ---------- pelota ---------- */
    _crearPelota() {
      this._quitarPelota();
      this.pelota = document.createElement('div');
      this.pelota.className = 'gv-pelota';
      this.pelota.style.zIndex = this.cfg.zIndex;
      document.body.appendChild(this.pelota);
      this.pbX = this.x; this.pbY = this.y; this._pelotaSig = 0;
    }
    _quitarPelota() { if (this.pelota) { this.pelota.remove(); this.pelota = null; } }

    /* ---------- render ---------- */
    _render() {
      this.cont.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      this.flip.style.transform = `scaleX(${this.dir})`;
    }

    /* ---------- partículas ---------- */
    _particula(txt, clase, dur) {
      const p = document.createElement('span');
      p.className = 'gv-part ' + clase; p.textContent = txt;
      this.cont.appendChild(p);
      setTimeout(() => p.remove(), dur);
    }
    _corazon() { this._particula('❤️', 'gv-corazon', 1200); }
    _chispa() { for (let i = 0; i < 3; i++) setTimeout(() => this._particula('✨', 'gv-chispa', 750), i * 90); }
    _burbuja(e) { this._particula(e, 'gv-burbuja', 2300); }
    _pensar() {
      let e = null;
      if (this.hambre > 65) e = '🍗';
      else if (this.energia < 28) e = '💤';
      else if (this.aburrimiento > 65) e = '🎾';
      else if (this.felicidad > 85) e = '❤️';
      if (e) this._burbuja(e);
    }
    _pop() { this.cont.classList.add('gv-pop'); setTimeout(() => this.cont.classList.remove('gv-pop'), 340); }

    /* ---------- sonido (sintetizado, sin assets) ---------- */
    _ctx() { if (!this.audio) { try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return this.audio; }
    _maullido(f = 1) {
      const a = this._ctx(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle';
      o.frequency.setValueAtTime(620 * f, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(340 * f, a.currentTime + 0.32);
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.36);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.4);
    }
    _ronroneo() {
      const a = this._ctx(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth';
      o.frequency.value = 28;
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, a.currentTime + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.9);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 1);
    }

    /* ===================== API PÚBLICA ===================== */
    acariciar() {
      const t = performance.now();
      this.clicks = this.clicks.filter((c) => t - c < 2000); this.clicks.push(t);
      if (this.clicks.length >= 5) { this.clicks = []; return this._enfadar(t); }   // ¡no me agobies!
      this.felicidad = clamp(this.felicidad + 16, 0, 100);
      this.aburrimiento = clamp(this.aburrimiento - 18, 0, 100);
      this._corazon(); this._pop();
      if (!(t < this.ocupadoHasta && (this.estado === 'dormir' || this.estado === 'comer'))) {
        this._setEstado('maullar', 'maullar', 'idle'); this.ocupadoHasta = t + 1200;
      }
      if (this.cfg.sonido) this._ronroneo();
      return this;
    }
    alimentar() { this._comer(performance.now()); this._corazon(); return this; }
    aJugar() { this._jugar(performance.now()); return this; }
    aDormir() { this._dormir(performance.now()); return this; }
    hablar() { const t = performance.now(); this._maullar(t); if (this.cfg.sonido) this._maullido(1); return this; }
    get animo() { return { energia: this.energia | 0, hambre: this.hambre | 0, aburrimiento: this.aburrimiento | 0, felicidad: this.felicidad | 0, estado: this.estado }; }

    destruir() {
      cancelAnimationFrame(this._raf);
      window.removeEventListener('mousemove', this._onMove);
      window.removeEventListener('resize', this._onResize);
      this._quitarPelota();
      this.cont.remove();
    }
  }

  function crearGato(opciones) { return new GatoVirtual(opciones); }

  global.GatoVirtual = GatoVirtual;
  global.crearGato = crearGato;
})(window);
