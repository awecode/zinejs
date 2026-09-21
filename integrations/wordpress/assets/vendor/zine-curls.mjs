import { n as e, r as t, t as n } from "./types-DEz3mRLI.js";
import { a as r, i, n as a, o, t as s } from "./bundled-ESapkNsS.js";
//#region src/geometry/curls/roll.ts
function c(e, t, n, i) {
	let a = e.cols + 1, o = e.rows + 1, s = e.positions, c = Math.max(1e-6, i < .5 ? i * 2 * Math.PI : (1 - (i - .5) * 2) * Math.PI), l = t / c, u = i < .5 ? 0 : -(i - .5) * 2 * Math.PI, d = Math.cos(u), f = Math.sin(u);
	for (let t = 0; t < a; t++) {
		let r = t / e.cols * c, i = Math.sin(r) * l, u = (1 - Math.cos(r)) * l, p = i * d + u * f, m = -i * f + u * d;
		for (let r = 0; r < o; r++) {
			let i = (r * a + t) * 3;
			s[i] = p, s[i + 1] = r / e.rows * n, s[i + 2] = m;
		}
	}
	r(e);
}
//#endregion
//#region src/geometry/curls/leaf.ts
var l = .34, u = 11 * Math.PI / 180, d = 128;
function f() {
	let e = /* @__PURE__ */ new Float64Array(129), t = /* @__PURE__ */ new Float64Array(129), n = 1 / d, r = (e) => Math.PI * e - .5 * Math.sin(2 * Math.PI * e);
	for (let i = 1; i <= d; i++) {
		let a = r((i - 1) * n), o = r(i * n);
		e[i] = e[i - 1] + .5 * (Math.cos(a) + Math.cos(o)) * n, t[i] = t[i - 1] + .5 * (Math.sin(a) + Math.sin(o)) * n;
	}
	return e[d] = 0, {
		x: e,
		z: t
	};
}
var p = f(), m = p.z[d];
function h(e) {
	let t = Math.max(0, Math.min(1, e)) * d, n = Math.min(d - 1, Math.floor(t)), r = t - n;
	return [p.x[n] + (p.x[n + 1] - p.x[n]) * r, p.z[n] + (p.z[n + 1] - p.z[n]) * r];
}
function g(e, t, n, i, a) {
	let o = e.cols + 1, s = e.rows + 1, c = e.positions;
	if (i <= 1e-7 || i >= .9999999) {
		let a = i < .5 ? 1 : -1;
		for (let r = 0; r < s; r++) {
			let i = r / e.rows * n;
			for (let n = 0; n < o; n++) {
				let s = (r * o + n) * 3;
				c[s] = a * (n / e.cols) * t, c[s + 1] = i, c[s + 2] = 0;
			}
		}
		r(e);
		return;
	}
	let d = Math.sin(Math.PI * i) ** .72, f = Math.max(1e-6, t * l * d), p = Math.max(-1, Math.min(1, (a.y - .5) * 2)) * u * Math.sin(Math.PI * i) ** 1.15, g = Math.cos(p), _ = Math.sin(p), v = -_, y = g, b = Math.abs(_) * n * .5, x = t + b / g, S = x + (-(f + b) / g - x) * i, C = n * .5;
	for (let r = 0; r < s; r++) {
		let i = r / e.rows * n;
		for (let n = 0; n < o; n++) {
			let a = n / e.cols * t, s = a - S, l = i - C, u = s * g + l * _, d = s * v + l * y, p = (r * o + n) * 3;
			if (u <= 0) {
				c[p] = a, c[p + 1] = i, c[p + 2] = 0;
				continue;
			}
			let b, x;
			if (u < f) {
				let [e, t] = h(u / f);
				b = f * e, x = f * t;
			} else b = -(u - f), x = f * m;
			c[p] = S + v * d + g * b, c[p + 1] = C + y * d + _ * b, c[p + 2] = x;
		}
	}
	r(e);
}
//#endregion
//#region src/geometry/curls/flick.ts
var _ = .45;
function v(e, t, n, i, a) {
	let o = e.cols + 1, s = e.rows + 1, c = e.cols, l = e.positions, u = t / c, d = Math.PI * i, f = -.52 * Math.sin(2 * Math.PI * i);
	for (let t = 0; t < s; t++) {
		let r = t / e.rows, i = f * (1 + _ * Math.abs(r - a.y)), s = r * n, p = 0, m = 0, h = Math.cos(d), g = Math.sin(d);
		l[t * o * 3] = 0, l[t * o * 3 + 1] = s, l[t * o * 3 + 2] = 0;
		for (let e = 1; e < o; e++) {
			let n = e / c, r = d + i * n * n, a = Math.cos(r), f = Math.sin(r);
			p += .5 * (h + a) * u, m += .5 * (g + f) * u, h = a, g = f;
			let _ = (t * o + e) * 3;
			l[_] = p, l[_ + 1] = s, l[_ + 2] = m;
		}
	}
	r(e);
}
//#endregion
//#region src/geometry/curls/silk.ts
var y = .52, b = .62, x = .5, S = 1.12;
function C(e, t, n, i, a) {
	let o = e.cols + 1, s = e.rows + 1, c = e.cols, l = e.positions, u = t / c, d = !!a.fill;
	if (i <= 1e-7 || i >= .9999999) {
		let a = i < .5 ? 1 : -1;
		for (let r = 0; r < s; r++) {
			let i = r / e.rows * n;
			for (let n = 0; n < o; n++) {
				let s = (r * o + n) * 3;
				l[s] = a * (n / e.cols) * t, l[s + 1] = i, l[s + 2] = 0;
			}
		}
		r(e);
		return;
	}
	let f = Math.PI * (d ? i ** +S : i), p = y * Math.sin(Math.PI * i) ** .8, m = b * Math.sin(Math.PI * i) * (1 - i);
	for (let t = 0; t < s; t++) {
		let r = t / e.rows, i = r * n, s = 1 - x * Math.abs(r - a.y), d = p * (.75 + .25 * s), h = m * s, g = 0, _ = 0, v = Math.cos(f), y = Math.sin(f);
		l[t * o * 3] = 0, l[t * o * 3 + 1] = i, l[t * o * 3 + 2] = 0;
		for (let e = 1; e < o; e++) {
			let n = e / c, r = f + d * Math.sin(2 * Math.PI * n) + h * n * n, a = Math.cos(r), s = Math.sin(r);
			g += .5 * (v + a) * u, _ += .5 * (y + s) * u, v = a, y = s;
			let p = (t * o + e) * 3;
			l[p] = g, l[p + 1] = i, l[p + 2] = _;
		}
	}
	r(e);
}
//#endregion
//#region src/geometry/curls/index.ts
var w = {
	deform: c,
	anchored: !1,
	flat: !0
}, T = {
	deform: g,
	anchored: !0
}, E = {
	deform: v,
	anchored: !0
}, D = {
	deform: C,
	anchored: !0
};
//#endregion
export { s as BUNDLED_CURLS, n as CURL_TYPES, e as DEFAULT_CURL, t as IMPORTABLE_CURLS, r as computeNormals, a as cone, o as createPageMesh, E as flick, T as leaf, w as roll, D as silk, i as simple };

//# sourceMappingURL=curls.js.map