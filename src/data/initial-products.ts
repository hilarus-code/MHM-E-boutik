import { Product, Category } from '../types';
import { v4 as uuidv4 } from 'uuid';

const generateProducts = (category: Category, names: string[], defaultFormat?: string): Product[] => {
  return names.map(name => {
    // Generate some random but realistic-looking prices for demo purposes
    const costPrice = Math.floor(Math.random() * 300 + 200) * 5; // 1000 - 2500
    const wholesalePrice = costPrice + (Math.floor(Math.random() * 50 + 20) * 5); // cost + 100-350
    const retailPrice = wholesalePrice + (Math.floor(Math.random() * 50 + 40) * 5); // wholesale + 200-450
    
    return {
      id: uuidv4(),
      name,
      category,
      retailPrice,
      wholesalePrice,
      wholesaleThreshold: 24, // Typically a case
      stock: Math.floor(Math.random() * 200) + 50, // Initial stock 50-250
      costPrice,
      format: defaultFormat
    };
  });
};

export const initialProducts: Product[] = [
  ...generateProducts('Bières et Boissons Alcoolisées', [
    'Heineken', 'Desperados', 'Vody', 'Légende', 'Beaufort', 'Star Beer', 
    'Bière blonde', 'Radler', 'Hollandia', 'Sangria', 'Savana', 'Gold', 
    'Panaché', 'El Passo', 'Malta'
  ]),
  ...generateProducts('Sodas et Boissons Gazeuses', [
    'Coca', 'Fanta', 'Sprite', 'Schweppes', 'Tonic', 'Pampl', 'Pilo', 
    'Pomme citron', 'Gazeifié'
  ]),
  ...generateProducts('Boissons Énergisantes et Toniques', [
    'XXL', 'Monster', 'Energic', 'Synergie', 'Rush', 'Rector', 'Madame Bulldozer'
  ]),
  ...generateProducts('Jus, Boissons Lactées et Fruits', [
    'Comtesse Fruit', 'Dudu Lait', 'Dudu Yaourt', 'Orange Rox', 'Comtesse'
  ]),
  ...generateProducts('Eaux', [
    'Eau Fresh', 'Comtesse Eau', 'Fifa'
  ]),
  ...generateProducts('Cocktails', [
    'Cocktail'
  ]),
  ...generateProducts('Autres', [
    'Canere', 'Beter pl', 'Champagn Baltazar', 'Chodeau', 'Bona Brizo', 
    'JRA', 'Kebebo', 'Sinunu'
  ])
];
