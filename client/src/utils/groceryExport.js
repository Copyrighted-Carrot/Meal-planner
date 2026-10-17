export function groceryRows(items = []) {
    return items.map(item => ({ checked: Boolean(item.checked), name: String(item.name || ''), amount: String(item.amount || '') }));
}

const csvCell = value => {
    let text = String(value);
    // Treat ingredient names as text, even when opened by a spreadsheet program.
    if (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

export function groceryCSV(items) {
    return [['Checked', 'Ingredient', 'Amount'], ...groceryRows(items).map(row => [row.checked ? 'Yes' : 'No', row.name, row.amount])]
        .map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function groceryText(items) {
    return groceryRows(items).map(row => `${row.checked ? '[x]' : '[ ]'} ${row.name}${row.amount ? `: ${row.amount}` : ''}`).join('\n');
}

export function groceryPDFTable(items) {
    return {
        head: [['Checked', 'Ingredient', 'Amount']],
        body: groceryRows(items).map(row => [row.checked ? 'Yes' : 'No', row.name, row.amount]),
        startY: 30, margin: { top: 20, bottom: 20 },
        styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
        rowPageBreak: 'avoid',
    };
}
