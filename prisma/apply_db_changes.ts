import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('🔄 Applying DB changes...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. In attribute_values table: Ensure columns color_code, sort_order, order_list exist
    await client.query(`
      ALTER TABLE attribute_values 
      ADD COLUMN IF NOT EXISTS color_code text,
      ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS order_list integer DEFAULT 0;
    `);

    // Clean up literal string 'null'
    await client.query(`
      UPDATE attribute_values 
      SET color_code = NULL 
      WHERE color_code = 'null';
    `);

    // Update color codes for colors in attribute_values
    const colorHexMap: Record<string, string> = {
      'Black': '#1A1A1A',
      'White': '#FFFFFF',
      'Navy Blue': '#1B2A4A',
      'Red': '#C0392B',
      'Olive Green': '#6B7C4D',
      'Maroon': '#7B1C2E',
      'Emerald Green': '#1A6B4A',
      'Royal Blue': '#1A3A7A',
      'Mustard Yellow': '#D4A017',
      'Pink': '#E8748A',
      'Gold': '#C9973A',
      'Teal': '#1A7B7B',
      'Magenta': '#B5226E',
      'Beige': '#E8DABB',
    };

    for (const [colorName, hex] of Object.entries(colorHexMap)) {
      await client.query(`
        UPDATE attribute_values 
        SET color_code = $1 
        WHERE value = $2 AND attribute_id IN (SELECT id FROM attributes WHERE name = 'Color');
      `, [hex, colorName]);
    }

    // Update order numbers for sizes (ordered lowest to highest)
    const sizeOrderMap: Record<string, number> = {
      'XS': 1,
      'S': 2,
      'M': 3,
      'L': 4,
      'XL': 5,
      'XXL': 6,
      '3XL': 7,
      'Free Size': 8,
      'Unstitched': 9,
    };

    for (const [sizeName, orderNum] of Object.entries(sizeOrderMap)) {
      await client.query(`
        UPDATE attribute_values 
        SET sort_order = $1, order_list = $1 
        WHERE value = $2 AND attribute_id IN (SELECT id FROM attributes WHERE name = 'Size');
      `, [orderNum, sizeName]);
    }

    // 2. In products table: Add color_code column and populate from attribute_values
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS color_code text;
    `);

    const updateProductsResult = await client.query(`
      UPDATE products p
      SET color_code = av.color_code
      FROM attribute_values av
      WHERE p.color_id = av.id;
    `);
    console.log(`✅ Updated ${updateProductsResult.rowCount} products with color_code.`);

    // 3. In product_variants table: Add sort_order and order_list columns and populate from size attribute_values
    await client.query(`
      ALTER TABLE product_variants 
      ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS order_list integer DEFAULT 0;
    `);

    const updateVariantsResult = await client.query(`
      UPDATE product_variants pv
      SET sort_order = av.sort_order,
          order_list = av.sort_order
      FROM attribute_values av
      WHERE pv.size_id = av.id;
    `);
    console.log(`✅ Updated ${updateVariantsResult.rowCount} product_variants with sort_order & order_list.`);

    // Create index on sort_order if not exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attribute_values_sort_order ON attribute_values(sort_order);
      CREATE INDEX IF NOT EXISTS idx_product_variants_sort_order ON product_variants(sort_order);
    `);

    await client.query('COMMIT');
    console.log('🎉 DB changes committed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
