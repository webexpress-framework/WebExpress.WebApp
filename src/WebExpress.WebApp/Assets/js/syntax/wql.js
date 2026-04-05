/**
 * Syntax highlighting for WebExpress Query Language (WQL) based on WQL grammar.
 * @param {string} code - WQL code to be highlighted
 * @returns {string} HTML with syntax highlighting classes
 */
webexpress.webui.Syntax.register("wql", "wql", function(code) {
    // define grammar fragments and tokens
    const logicalOperators = [
        "and", "or", "&", "\\|\\|"
    ];
    const setOperators = [
        "in", "not in"
    ];
    const wqlKeywords = [
        "order", "by", "asc", "desc", "take", "skip"
    ];
    const binaryOperatorsWord = [
        "is not", "is"
    ];
    const binaryOperatorsSymbol = [
        "==", "!=", ">=", "<=", ">", "<", "=", "~"
    ];
    const namePattern = "[A-Za-z_][A-Za-z0-9_]*";
    const stringPattern = `"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'`;
    const doublePattern = "[+-]?[0-9]*\\.[0-9]+";
    const numberPattern = "[0-9]+";

    // ordered token specifications: longest, leftmost match wins
    const tokenSpecs = [
        // comments (single-line and multi-line)
        { type: "comment",   regex: /\/\/.*|\/\*[\s\S]*?\*\//y },
        // keywords
        { type: "keyword",   regex: new RegExp(`\\b(?:${wqlKeywords.join("|")})\\b`, "y") },
        // logical operators
        { type: "logical",   regex: new RegExp(`\\b(?:${logicalOperators.join("|")})\\b`, "y") },
        // set operators
        { type: "operator",     regex: new RegExp(`\\b(?:${setOperators.join("|")})\\b`, "y") },
        // binary operators (words, e.g. "is not", "is")
        { type: "operator",     regex: new RegExp(`\\b(?:${binaryOperatorsWord.join("|")})\\b`, "y") },
        // binary operators (symbols, e.g. ==, !=, =, etc.) - no word boundary!
        { type: "operator",     regex: new RegExp(binaryOperatorsSymbol.map(op =>
                op.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
            ).join('|'), "y")
        },
        // function tokens: name(... - only name before '(' not followed by '.'!
        { type: "function",  regex: new RegExp(`${namePattern}(?=\\s*\\()`, "y") },
        // attributes: name or name.name (ignore function names due to exclusive scan)
        { type: "attribute", regex: new RegExp(`${namePattern}(?:\\.${namePattern})*`, "y") },
        // numbers: double and integer
        { type: "number",    regex: new RegExp(`${doublePattern}|${numberPattern}`, "y") },
        // string parameters: single or double quoted
        { type: "string",    regex: new RegExp(stringPattern, "y") },
        // comma
        { type: "comma",     regex: /,/y },
        // parenthesis
        { type: "paren",     regex: /[()]/y },
        // dot
        { type: "dot",       regex: /\./y }
    ];

    /**
     * Wraps a token value in a syntax span for highlighting.
     * @param {string} type - Token type (used as a CSS class)
     * @param {string} value - Token text value to highlight
     * @returns {string} HTML span for highlighted token
     */
    function tokenToSpan(type, value) {
        return `<span class="${type}">${value}</span>`;
    }

    /**
     * Highlights a single line of source code according to WQL syntax.
     * Consumes tokens left-to-right, always picking the leftmost, longest match.
     * @param {string} line - Source code line
     * @returns {string} HTML for highlighted line
     */
    function highlightLine(line) {
        let html = "";
        let pos = 0;
        const len = line.length;
        while (pos < len) {
            let bestToken = null;
            let bestLength = 0;
            // try all token regexps at the current position, pick the longest match
            for (const spec of tokenSpecs) {
                spec.regex.lastIndex = pos;
                const match = spec.regex.exec(line);
                if (match && match.index === pos) {
                    const value = match[0];
                    if (value.length > bestLength) {
                        bestLength = value.length;
                        bestToken = { type: spec.type, value };
                    }
                }
            }
            if (!bestToken) {
                // output single character unhighlighted
                html += line[pos];
                pos += 1;
            } else {
                html += tokenToSpan(bestToken.type, bestToken.value);
                pos += bestToken.value.length;
            }
        }
        return `<span class="wx-code-line">${html}</span>`;
    }

    // highlight each line and join
    return code.split('\n').map(highlightLine).join('');
});