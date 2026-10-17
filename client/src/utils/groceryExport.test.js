import { groceryCSV, groceryPDFTable, groceryRows, groceryText } from './groceryExport';

const items = [
    { _id: 'carrots', name: 'Carrots', amount: '1.5 kg', checked: true },
    { _id: 'salt', name: 'Salt', amount: 'Quantity unknown', checked: false },
    { _id: 'herbs', name: 'Fresh herbs', amount: '', checked: false },
];

test('all export formats retain the complete order, quantities, unknowns and checked states', () => {
    expect(groceryRows(items)).toEqual([
        { name: 'Carrots', amount: '1.5 kg', checked: true },
        { name: 'Salt', amount: 'Quantity unknown', checked: false },
        { name: 'Fresh herbs', amount: '', checked: false },
    ]);
    expect(groceryCSV(items)).toBe('"Checked","Ingredient","Amount"\r\n"Yes","Carrots","1.5 kg"\r\n"No","Salt","Quantity unknown"\r\n"No","Fresh herbs",""');
    expect(groceryText(items)).toBe('[x] Carrots: 1.5 kg\n[ ] Salt: Quantity unknown\n[ ] Fresh herbs');
    expect(groceryPDFTable(items).body).toEqual([
        ['Yes', 'Carrots', '1.5 kg'], ['No', 'Salt', 'Quantity unknown'], ['No', 'Fresh herbs', ''],
    ]);
});

test('CSV quotes commas, embedded quotes, Unicode and line breaks without losing text', () => {
    const csv = groceryCSV([{ name: 'Tomatoes, "ripe"\nPuréed', amount: '½ cup', checked: false }]);
    expect(csv).toBe('"Checked","Ingredient","Amount"\r\n"No","Tomatoes, ""ripe""\nPuréed","½ cup"');
});

test.each(['=1+1', '+1+1', '-1+1', '@SUM(1)', '  =1+1', '\t2', '\r2'])('CSV treats formula-like ingredient and quantity text as text: %j', value => {
    const csv = groceryCSV([{ name: value, amount: value }]);
    expect(csv).toContain(`"No","'${value}","'${value}"`);
});

test('PDF table wraps long content and enables automatic pagination without truncating rows', () => {
    const longItems = Array.from({ length: 100 }, (_, index) => ({ name: `Ingredient ${index}: ${'long label '.repeat(30)}`, amount: 'Quantity unknown' }));
    const table = groceryPDFTable(longItems);
    expect(table.body).toHaveLength(100);
    expect(table.body[99][1]).toBe(longItems[99].name);
    expect(table.styles.overflow).toBe('linebreak');
    expect(table.rowPageBreak).toBe('avoid');
    expect(table.margin).toEqual({ top: 20, bottom: 20 });
});

test('exporting does not mutate grocery items or invent missing quantities', () => {
    const frozen = Object.freeze([Object.freeze({ name: 'Basil', checked: false })]);
    expect(groceryRows(frozen)).toEqual([{ name: 'Basil', amount: '', checked: false }]);
    expect(groceryText(frozen)).toBe('[ ] Basil');
    expect(groceryCSV(frozen)).not.toMatch(/NaN|x1/);
    expect(groceryPDFTable(frozen).body).toEqual([['No', 'Basil', '']]);
});
