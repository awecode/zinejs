import { r as e } from "./types-DEz3mRLI.js";
//#region src/geometry/curls/mesh.ts
function t(e, t) {
	let n = e + 1, r = t + 1, i = n * r, a = new Float32Array(i * 2);
	for (let i = 0; i < r; i++) for (let r = 0; r < n; r++) {
		let o = i * n + r;
		a[o * 2] = r / e, a[o * 2 + 1] = i / t;
	}
	return {
		cols: e,
		rows: t,
		uvs: a,
		positions: new Float32Array(i * 3),
		normals: new Float32Array(i * 3)
	};
}
function n(e) {
	let t = e.cols + 1, n = e.rows + 1, r = e.positions, i = e.normals;
	for (let e = 0; e < n; e++) for (let a = 0; a < t; a++) {
		let o = a > 0 ? a - 1 : a, s = a < t - 1 ? a + 1 : a, c = e > 0 ? e - 1 : e, l = e < n - 1 ? e + 1 : e, u = (e * t + s) * 3, d = (e * t + o) * 3, f = (l * t + a) * 3, p = (c * t + a) * 3, m = r[u] - r[d], h = r[u + 1] - r[d + 1], g = r[u + 2] - r[d + 2], _ = r[f] - r[p], v = r[f + 1] - r[p + 1], y = r[f + 2] - r[p + 2], b = h * y - g * v, x = g * _ - m * y, S = m * v - h * _, C = Math.hypot(b, x, S) || 1;
		b /= C, x /= C, S /= C;
		let w = (e * t + a) * 3;
		i[w] = b, i[w + 1] = x, i[w + 2] = S;
	}
}
//#endregion
//#region src/geometry/curls/cone.ts
var r = 30 * Math.PI / 180, i = 1.35, a = .7, o = .42, s = .84, c = .88;
function l(e, t, l, u, d) {
	let f = e.cols + 1, p = e.rows + 1, m = e.positions, h = u >= s ? 1 : u / s, g = Math.sin(Math.PI * h), _ = Math.PI / 2 - g * (Math.PI / 2 - r), v = Math.sin(_), y = Math.cos(_), b = 1 / Math.max(v, 1e-6), x = l * (i + (a - i) * g), S = (d.y - .5) * 2, C = S >= 0, w = Math.min(1, Math.abs(S) / o), T = 1 - w, E = C ? l + x : -x, D = Math.hypot(t, .5 * l - E), O = Math.max(D * v, t / Math.PI), k = Math.min(1, u / c), A = -Math.PI * k, j = Math.cos(A), M = Math.sin(A);
	if (g < 1e-4) {
		for (let n = 0; n < p; n++) {
			let r = n / e.rows * l;
			for (let i = 0; i < f; i++) {
				let a = i / e.cols * t, o = (n * f + i) * 3;
				m[o] = a * j, m[o + 1] = r, m[o + 2] = -a * M;
			}
		}
		n(e);
		return;
	}
	for (let n = 0; n < p; n++) {
		let r = n / e.rows * l;
		for (let i = 0; i < f; i++) {
			let a = i / e.cols * t, o = a, s = r, c = 0;
			if (w > 1e-5) {
				let e = C ? l - r : r, t = -x, n = Math.hypot(a, e - t);
				if (n > 1e-8) {
					let e = n * v, r = Math.asin(Math.min(1, Math.max(0, a / n))) * b, i = 1 - Math.cos(r), u = n + t - e * i * v;
					o = e * Math.sin(r), s = C ? l - u : u, c = e * i * y;
				}
			}
			let u = o, d = s, p = c;
			if (T > 1e-5) {
				let e = a / O, t = O * Math.sin(e), n = O * (1 - Math.cos(e));
				u = w * o + T * t, d = w * s + T * r, p = w * c + T * n;
			}
			let h = (n * f + i) * 3;
			m[h] = u * j + p * M, m[h + 1] = d, m[h + 2] = -u * M + p * j;
		}
	}
	n(e);
}
//#endregion
//#region src/geometry/curls/simple.ts
function u(e, t, r, i) {
	let a = e.cols + 1, o = e.rows + 1, s = e.positions, c = i * Math.PI, l = Math.cos(c), u = Math.sin(c);
	for (let n = 0; n < a; n++) {
		let i = n / e.cols * t, c = i * l, d = i * u;
		for (let t = 0; t < o; t++) {
			let i = (t * a + n) * 3;
			s[i] = c, s[i + 1] = t / e.rows * r, s[i + 2] = d;
		}
	}
	n(e);
}
//#endregion
//#region src/geometry/curls/bundled.ts
var d = {
	deform: l,
	anchored: !0
}, f = {
	deform: u,
	anchored: !1,
	flat: !0,
	gloss: !1
}, p = {
	cone: d,
	simple: f
};
function m(t) {
	if (typeof t != "string") return t;
	let n = p[t];
	if (n) return n;
	throw e.includes(t) ? Error(`Zine: the '${t}' curl is not bundled. Import it and pass the model: import { ${t} } from '@zinejs/core/curls'  →  curl: ${t}`) : Error(`Zine: unknown curl ${JSON.stringify(t)}.`);
}
//#endregion
export { n as a, f as i, d as n, t as o, m as r, p as t };

//# sourceMappingURL=bundled-ESapkNsS.js.map