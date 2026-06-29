import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const res = await fetch('http://localhost:3000/api/db/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: "8d90dd0a-4a3d-433c-9ffe-f9f772f62e35", // ID from my last run
      name: "Test Update",
      category: "TestCat",
      retailPrice: 15,
      wholesalePrice: 12,
      wholesaleThreshold: 5,
      unitsPerWholesale: 5,
      minStockLevel: 2,
      stock: 10,
      costPrice: 5,
      format: "TestFormat"
    })
  });
  console.log(res.status, await res.text());
}
run();
