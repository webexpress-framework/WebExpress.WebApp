/**
 * SVG geometry for the headless DOM stub.
 *
 * The plain element stub models markup only: it has no layout, so every box it
 * reports is empty. The graph controls (GraphViewerCtrl, GraphEditorCtrl and
 * everything deriving from them) instead build their whole interaction model on
 * SVG primitives the plain stub does not have at all - createSVGPoint,
 * getScreenCTM and getBBox - and on className.baseVal, which an SVG element
 * exposes as an SVGAnimatedString rather than a plain string.
 *
 * This module supplies exactly those primitives on top of an existing element
 * class, so a document stub can hand out real SVG-shaped elements from
 * createElementNS while the HTML side stays untouched.
 *
 * The geometry is analytic, not typeset: a shape's box is derived from its own
 * coordinate attributes and a container's box is the union of its children.
 * Glyphs cannot be measured headlessly, so a <text> box assumes a fixed advance
 * per character. That is deliberate - the graph code only ever compares and
 * unions boxes, so the numbers have to be consistent, not pixel exact.
 */

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// a text box is estimated rather than measured; the value matches the advance
// the graph controls themselves assume in _measureNodeSize, so a label box in a
// test lines up with the box the control reserved for it
const TEXT_ADVANCE = 7;
const TEXT_HEIGHT = 16;

/**
 * Builds an SVG transformation matrix with the same field names and the same
 * operations (multiply, inverse) the browser SVGMatrix exposes, which is the
 * surface pointer-to-local conversion relies on.
 * @param {number} [a] - The horizontal scaling component.
 * @param {number} [b] - The vertical skewing component.
 * @param {number} [c] - The horizontal skewing component.
 * @param {number} [d] - The vertical scaling component.
 * @param {number} [e] - The horizontal translation component.
 * @param {number} [f] - The vertical translation component.
 * @returns {object} The matrix.
 */
export function svgMatrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    return {
        a, b, c, d, e, f,

        multiply(other) {
            return svgMatrix(
                this.a * other.a + this.c * other.b,
                this.b * other.a + this.d * other.b,
                this.a * other.c + this.c * other.d,
                this.b * other.c + this.d * other.d,
                this.a * other.e + this.c * other.f + this.e,
                this.b * other.e + this.d * other.f + this.f
            );
        },

        inverse() {
            const det = this.a * this.d - this.b * this.c;
            if (det === 0) {
                throw new Error("the matrix is not invertible");
            }
            return svgMatrix(
                this.d / det,
                -this.b / det,
                -this.c / det,
                this.a / det,
                (this.c * this.f - this.d * this.e) / det,
                (this.b * this.e - this.a * this.f) / det
            );
        },

        translate(tx, ty) { return this.multiply(svgMatrix(1, 0, 0, 1, tx, ty)); },
        scale(sx, sy) { return this.multiply(svgMatrix(sx, 0, 0, sy === undefined ? sx : sy, 0, 0)); }
    };
}

/**
 * Parses the transform attribute into a matrix. Only the function set the graph
 * controls emit is honoured (translate, scale, rotate and a literal matrix);
 * anything else is ignored rather than approximated, so an unsupported
 * transform degrades to identity instead of to a wrong number.
 * @param {string} text - The transform attribute value.
 * @returns {object} The resulting matrix.
 */
export function parseTransform(text) {
    let matrix = svgMatrix();
    const pattern = /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g;
    let hit;

    while ((hit = pattern.exec(String(text || ""))) !== null) {
        const args = hit[2]
            .split(/[\s,]+/)
            .map((part) => parseFloat(part))
            .filter((value) => Number.isFinite(value));

        if (hit[1] === "translate") {
            matrix = matrix.multiply(svgMatrix(1, 0, 0, 1, args[0] || 0, args[1] || 0));
        } else if (hit[1] === "scale") {
            const sx = args.length > 0 ? args[0] : 1;
            const sy = args.length > 1 ? args[1] : sx;
            matrix = matrix.multiply(svgMatrix(sx, 0, 0, sy, 0, 0));
        } else if (hit[1] === "rotate" && args.length > 0) {
            const rad = (args[0] * Math.PI) / 180;
            matrix = matrix.multiply(svgMatrix(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0));
        } else if (hit[1] === "matrix" && args.length === 6) {
            matrix = matrix.multiply(svgMatrix(...args));
        }
    }
    return matrix;
}

/**
 * Extracts the coordinate pairs from a path data string. Commands are ignored
 * and the raw numbers are paired up, which is exact for the move / line / cubic
 * commands the graph emits and an over-estimate for arcs.
 * @param {string} data - The d attribute value.
 * @returns {Array<{x: number, y: number}>} The points.
 */
function pathPoints(data) {
    const numbers = String(data || "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    const points = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
        points.push({ x: parseFloat(numbers[i]), y: parseFloat(numbers[i + 1]) });
    }
    return points;
}

/**
 * Reduces a point list to its bounding box.
 * @param {Array<{x: number, y: number}>} points - The points.
 * @returns {{x: number, y: number, width: number, height: number}} The box.
 */
function boxOfPoints(points) {
    if (points.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Unions the boxes of the element children, skipping the ones that carry no
 * geometry at all so an empty <defs> does not drag a container box to the
 * origin.
 * @param {object} element - The container element.
 * @returns {{x: number, y: number, width: number, height: number}} The box.
 */
function boxOfChildren(element) {
    const points = [];
    for (const child of element.children) {
        if (typeof child.getBBox !== "function") {
            continue;
        }
        const box = child.getBBox();
        if (box.width === 0 && box.height === 0 && box.x === 0 && box.y === 0) {
            continue;
        }
        points.push({ x: box.x, y: box.y });
        points.push({ x: box.x + box.width, y: box.y + box.height });
    }
    return boxOfPoints(points);
}

/**
 * Derives an SVG element class from a plain element class, adding the
 * SVG-specific surface the graph controls use.
 * @param {Function} ElementClass - The base element class of the stub.
 * @returns {Function} The SVG element class.
 */
export function createSvgElementClass(ElementClass) {
    return class SvgElement extends ElementClass {
        constructor(tag) {
            super(tag);
            // SVG is XML, so its elements report the qualified name unchanged
            // rather than upper-cased the way HTML elements do. The graph
            // controls branch on that (el.tagName === "path"), so the stub has
            // to preserve the case as well
            this.tagName = String(tag);
        }

        /**
         * An SVG element exposes its class attribute as an SVGAnimatedString,
         * so assigning className.baseVal - which the graph controls do to reset
         * a node or edge class list in one step - has to reach the class set
         * rather than fail on a string primitive.
         */
        get className() {
            const owner = this;
            return {
                get baseVal() { return Array.from(owner._classes).join(" "); },
                set baseVal(value) { owner.className = value; },
                get animVal() { return Array.from(owner._classes).join(" "); }
            };
        }

        set className(value) {
            this._classes = new Set(String(value || "").split(/\s+/).filter(Boolean));
        }

        /**
         * The transformation from this element's user space to screen space:
         * the accumulated transform attributes up to the SVG root, offset by
         * where that root sits on screen.
         * @returns {object} The matrix.
         */
        getScreenCTM() {
            let matrix = svgMatrix();
            let current = this;

            while (current && current.nodeType === 1) {
                const transform = current.getAttribute ? current.getAttribute("transform") : null;
                if (transform) {
                    matrix = parseTransform(transform).multiply(matrix);
                }
                if (String(current.tagName).toLowerCase() === "svg") {
                    const rect = current.getBoundingClientRect();
                    return svgMatrix(1, 0, 0, 1, rect.left, rect.top).multiply(matrix);
                }
                current = current.parentNode;
            }
            return matrix;
        }

        /**
         * The transformation from this element's user space to the nearest
         * viewport, which for the stub is the same accumulation without the
         * screen offset.
         * @returns {object} The matrix.
         */
        getCTM() {
            let matrix = svgMatrix();
            let current = this;

            while (current && current.nodeType === 1) {
                const transform = current.getAttribute ? current.getAttribute("transform") : null;
                if (transform) {
                    matrix = parseTransform(transform).multiply(matrix);
                }
                if (String(current.tagName).toLowerCase() === "svg") {
                    return matrix;
                }
                current = current.parentNode;
            }
            return matrix;
        }

        /**
         * Creates a point that can be pushed through a matrix, matching the
         * SVGSVGElement factory the controls use to map pointer coordinates.
         * @returns {object} The point.
         */
        createSVGPoint() {
            return {
                x: 0,
                y: 0,
                matrixTransform(matrix) {
                    return {
                        x: matrix.a * this.x + matrix.c * this.y + matrix.e,
                        y: matrix.b * this.x + matrix.d * this.y + matrix.f
                    };
                }
            };
        }

        /**
         * Creates an identity matrix.
         * @returns {object} The matrix.
         */
        createSVGMatrix() {
            return svgMatrix();
        }

        /**
         * The tight box around the element geometry in its own user space.
         * @returns {{x: number, y: number, width: number, height: number}} The box.
         */
        getBBox() {
            const num = (name) => {
                const raw = this.getAttribute(name);
                const value = raw == null ? NaN : parseFloat(raw);
                return Number.isFinite(value) ? value : 0;
            };
            const tag = String(this.tagName).toLowerCase();

            if (tag === "rect" || tag === "image" || tag === "foreignobject" || tag === "use") {
                return { x: num("x"), y: num("y"), width: num("width"), height: num("height") };
            }
            if (tag === "circle") {
                const r = num("r");
                return { x: num("cx") - r, y: num("cy") - r, width: r * 2, height: r * 2 };
            }
            if (tag === "ellipse") {
                const rx = num("rx");
                const ry = num("ry");
                return { x: num("cx") - rx, y: num("cy") - ry, width: rx * 2, height: ry * 2 };
            }
            if (tag === "line") {
                return boxOfPoints([{ x: num("x1"), y: num("y1") }, { x: num("x2"), y: num("y2") }]);
            }
            if (tag === "path") {
                return boxOfPoints(pathPoints(this.getAttribute("d")));
            }
            if (tag === "polyline" || tag === "polygon") {
                return boxOfPoints(pathPoints(this.getAttribute("points")));
            }
            if (tag === "text" || tag === "tspan") {
                const width = this.textContent.length * TEXT_ADVANCE;
                const anchor = this.getAttribute("text-anchor");
                const x = anchor === "middle" ? num("x") - width / 2 : (anchor === "end" ? num("x") - width : num("x"));
                return { x, y: num("y") - TEXT_HEIGHT, width, height: TEXT_HEIGHT };
            }
            return boxOfChildren(this);
        }

        /**
         * The total length of a path, approximated by summing the straight
         * distances between the coordinate pairs in the path data.
         * @returns {number} The length.
         */
        getTotalLength() {
            const points = pathPoints(this.getAttribute("d"));
            let total = 0;
            for (let i = 1; i < points.length; i++) {
                total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            }
            return total;
        }
    };
}
