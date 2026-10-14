// Shared Regex Parser for Ingredients
const KNOWN_UNITS = [
    'g', 'gm', 'grams', 'gram',
    'kg', 'kilo', 'kilograms',
    'ml', 'milliliter',
    'l', 'liter', 'litre',
    'lb', 'lbs', 'pound',
    'oz', 'ounce',
    'cup', 'cups',
    'tbsp', 'tablespoon', 'tablespoons',
    'tsp', 'teaspoon', 'teaspoons',
    'spoon', 'spoons',
    'glass', 'glasses',
    'bowl', 'bowls',
    'count', 'counts',
    'bunch', 'bunches',
    'pinch', 'pinches',
    'handful', 'handfuls',
    'packet', 'packets',
    'can', 'cans',
    'slice', 'slices',
    'piece', 'pieces',
    'pcs', 'pc' // Added pcs
];

export const parseIngredient = (input) => {
    // Pre-processing: Convert "a" or "an" to "1" if it looks like a quantity usage
    // e.g. "Salt a pinch", "a cup of rice"
    let trimmed = input.trim();
    if (!trimmed) return null;

    // Replace " a " or " an " with " 1 " (case insensitive, word boundaries)
    // Also handle start of string
    trimmed = trimmed.replace(/\b(a|an)\b/gi, "1");
    trimmed = trimmed.replace(/\b(half)\b/gi, "0.5");
    trimmed = trimmed.replace(/\b(quarter)\b/gi, "0.25");
    trimmed = trimmed.replace(/\b(one)\b/gi, "1");

    // Additional Number Words (2-10)
    const numMap = {
        two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
    };
    Object.keys(numMap).forEach(key => {
        trimmed = trimmed.replace(new RegExp(`\\b${key}\\b`, 'gi'), numMap[key]);
    });

    // Unicode Fraction normalization (fallback parser)
    trimmed = trimmed.replace(/½/g, '0.5');
    trimmed = trimmed.replace(/⅓/g, '0.33');
    trimmed = trimmed.replace(/⅔/g, '0.66');
    trimmed = trimmed.replace(/¼/g, '0.25');
    trimmed = trimmed.replace(/¾/g, '0.75');
    trimmed = trimmed.replace(/⅕/g, '0.2');
    trimmed = trimmed.replace(/⅖/g, '0.4');
    trimmed = trimmed.replace(/⅗/g, '0.6');
    trimmed = trimmed.replace(/⅘/g, '0.8');
    trimmed = trimmed.replace(/⅙/g, '0.16');
    trimmed = trimmed.replace(/⅚/g, '0.83');
    trimmed = trimmed.replace(/⅛/g, '0.125');
    trimmed = trimmed.replace(/⅜/g, '0.375');
    trimmed = trimmed.replace(/⅝/g, '0.625');
    trimmed = trimmed.replace(/⅞/g, '0.875');

    // Helper to check if a word is a known unit
    const isUnit = (word) => {
        if (!word) return false;
        const w = word.toLowerCase();
        return KNOWN_UNITS.includes(w) || KNOWN_UNITS.includes(w.replace(/s$/, ''));
    };
    // also check direct match for things like 'pcs' which ends in s but singular is pc

    // 1. PREFIX CHECK: "1 Cup Rice", "500g Flour", "1-2 tbsp Oil"
    // Regex: Start with Number/Range, optional space, optional Unit, then space, then Name
    const prefixRegex = /^([\d./\u2013\u2014-]+)\s*([a-zA-Z]+)?\s+(.*)$/;
    const prefixMatch = trimmed.match(prefixRegex);

    if (prefixMatch) {
        let qty = prefixMatch[1];
        let unitParts = prefixMatch[2] ? prefixMatch[2].toLowerCase() : "";
        let name = prefixMatch[3];

        if (unitParts && isUnit(unitParts)) {
            // Normalize plural to singular if needed
            if (!KNOWN_UNITS.includes(unitParts) && KNOWN_UNITS.includes(unitParts.replace(/s$/, ''))) {
                unitParts = unitParts.replace(/s$/, '');
            }
            // "1 Cup Rice" -> Valid Unit found
            return { qty, unit: unitParts, name: name.trim(), original: trimmed };
        }
    }

    // 2. SUFFIX CHECK (Name Qty Unit): "Rice 1 Cup", "Milk 1 l"
    // Regex: Name (greedy), space, Number, space(opt), Unit
    const suffixRegex = /^(.*)\s+([\d./]+)\s*([a-zA-Z]+)$/;
    const suffixMatch = trimmed.match(suffixRegex);

    if (suffixMatch) {
        let name = suffixMatch[1];
        let qty = suffixMatch[2];
        let unit = suffixMatch[3].toLowerCase();

        if (isUnit(unit)) {
            // Normalize plural to singular
            if (!KNOWN_UNITS.includes(unit) && KNOWN_UNITS.includes(unit.replace(/s$/, ''))) {
                unit = unit.replace(/s$/, '');
            }
            return { qty, unit, name: name.trim(), original: trimmed };
        }
    }

    // 📌 PARENTHESIS CHECK: "Salt (Pinch)", "Rice (1 Cup)"
    // Regex: Name (greedy), ( Content )
    const parenRegex = /^(.*?)\s*\((.*?)\)$/;
    const parenMatch = trimmed.match(parenRegex);
    if (parenMatch) {
        let name = parenMatch[1].trim();
        let content = parenMatch[2].trim();

        // recursve parse the content? Or simple check
        // If content is just a unit e.g. "pinch" -> 1 pinch
        let pContent = parseIngredient(content); // Recursion risk? No, content is smaller.

        // If "pinch" (fallback case of parseIngredient returns 'x' or '1'?)
        // Let's rely on basic check first
        let innerUnit = content.toLowerCase();
        if (isUnit(innerUnit)) {
            // "Salt (Pinch)" -> 1 Pinch Salt
            if (!KNOWN_UNITS.includes(innerUnit) && KNOWN_UNITS.includes(innerUnit.replace(/s$/, ''))) {
                innerUnit = innerUnit.replace(/s$/, '');
            }
            return { qty: "1", unit: innerUnit, name: name, original: trimmed };
        }

        // If content is "1 Cup"
        if (pContent && pContent.unit !== 'x') {
            return { qty: pContent.qty, unit: pContent.unit, name: name, original: trimmed };
        }
    }

    // 3. NUMBER SUFFIX CHECK (Name Qty): "Tomato 3", "Eggs 6"
    // Regex: Name (greedy), space, Number
    const numberSuffixRegex = /^(.*)\s+([\d./]+)$/;
    const numberSuffixMatch = trimmed.match(numberSuffixRegex);

    if (numberSuffixMatch) {
        let name = numberSuffixMatch[1];
        let qty = numberSuffixMatch[2];
        // Unit assumed to be 'count' (pieces/count)
        return { qty, unit: 'count', name: name.trim(), original: trimmed };
    }

    // 4. FALLBACK / SIMPLE COUNT CHECK
    // Re-evaluate the Prefix match for "Count" case: "1 Rice"
    if (prefixMatch) {
        let qty = prefixMatch[1];
        // The "unit" was not a known unit, so it's part of the name
        let potentialNameStart = prefixMatch[2] || "";
        let rest = prefixMatch[3];
        let fullMaskedName = (potentialNameStart + " " + rest).trim();

        return { qty, unit: "count", name: fullMaskedName, original: trimmed };
    }

    // Just Text (e.g. "Salt") -> Qty empty
    return { qty: "", unit: "x", name: trimmed, original: trimmed };
};

export const formatIngredient = (ing) => {
    const q = ing.qty ? ing.qty : '';
    const u = ing.unit === 'x' ? '' : ing.unit;
    return `${q} ${u} ${ing.name}`.trim();
};
