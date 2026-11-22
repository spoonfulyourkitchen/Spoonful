const fs = require('fs');
const p = 'D:/Spoonful/mobile/src/lib/i18n-212.ts';
const pairs = [
  ["statRecipes: '1.100+ Rezepte'", "statRecipes: '15.700+ Rezepte'"],
  ["statRecipes: '1,100+ recipes'", "statRecipes: '15,700+ recipes'"],
  ["statRecipes: 'أكثر من ١١٠٠ وصفة'", "statRecipes: 'أكثر من ١٥٧٠٠ وصفة'"],
  ["statRecipes: '1 100+ recettes'", "statRecipes: '15 700+ recettes'"],
  ["statRecipes: 'Más de 1.100 recetas'", "statRecipes: 'Más de 15.700 recetas'"],
  ["statRecipes: '1.100+ ricette'", "statRecipes: '15.700+ ricette'"],
  ["statRecipes: '1.100+ tarif'", "statRecipes: '15.700+ tarif'"],
  ["statRecipes: '1.100+ receitas'", "statRecipes: '15.700+ receitas'"],
  ["statRecipes: '1.100+ recepten'", "statRecipes: '15.700+ recepten'"],
  ["statRecipes: 'Более 1100 рецептов'", "statRecipes: 'Более 15 700 рецептов'"],
];
let src = fs.readFileSync(p, 'utf8');
let hits = 0;
for (const [from, to] of pairs) {
  if (!src.includes(from)) {
    console.log('NICHT GEFUNDEN: ' + from);
    continue;
  }
  src = src.split(from).join(to);
  hits += 1;
}
fs.writeFileSync(p, src);
console.log(`ersetzt: ${hits}/${pairs.length}`);
